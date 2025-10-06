import asyncio
import json
import os
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect
from deepgram import DeepgramClient, SpeakWebSocketEvents, SpeakOptions
from session_data import session_metadata

# Global registry to allow server-side Speak into an active TTS session
TTS_REGISTRY: Dict[str, object] = {}

async def tts_server_speak(session_id: str, text: str, flush: bool = False) -> bool:
    try:
        dg_conn = TTS_REGISTRY.get(session_id)
        if not dg_conn:
            print(f"⚠️ TTS SERVER SPEAK: No active TTS connection for session {session_id}")
            return False
        from .deepgram_tts_websocket import sanitize_speak_text  # local import guard
    except Exception:
        pass
    try:
        cleaned = sanitize_speak_text(text)
        if not cleaned:
            return False
        dg_conn.send_text(cleaned)
        if flush:
            dg_conn.flush()
        return True
    except Exception as e:
        print(f"❌ TTS SERVER SPEAK error for {session_id}: {e}")
        return False


def sanitize_speak_text(raw: Optional[str]) -> Optional[str]:
    """Return clean plain text for TTS or None if not usable.
    - If raw looks like JSON, attempt to extract common text fields
    - Strip simple markup and collapse whitespace
    - Enforce non-empty string
    """
    try:
        if raw is None:
            return None
        if isinstance(raw, (dict, list)):
            obj = raw
        else:
            s = str(raw).strip()
            if not s:
                return None
            if (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")):
                try:
                    obj = json.loads(s)
                except Exception:
                    obj = None
            else:
                obj = None
            if obj is None:
                import re
                s = re.sub(r"<[^>]+>", " ", s)
                s = re.sub(r"\s+", " ", s).strip()
                return s if s else None
        if isinstance(obj, dict):
            for key in ("text", "textResponse", "message", "content"):
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    return sanitize_speak_text(val)
        return None
    except Exception:
        return None


class DeepgramTTSWebSocketHandler:
    def __init__(self) -> None:
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        if not self.deepgram_api_key:
            raise ValueError("DEEPGRAM_API_KEY not found in environment variables")

        self.dg = DeepgramClient(api_key=self.deepgram_api_key)

    async def handle(self, websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            # Query params
            user_id = websocket.query_params.get("user_id")
            company_id = websocket.query_params.get("company_id")
            session_id = websocket.query_params.get("session_id") or "tts"

            # Optional first JSON config message
            default_model = "aura-2-estrella-es"
            model_id = default_model
            encoding = "linear16"
            sample_rate = 16000
            container = "wav"
            language_code = websocket.query_params.get("language") or "es"

            # Mark stream active in session metadata
            try:
                meta = session_metadata.get(session_id, {})
                meta.update({
                    "tts_stream_active": True,
                    "tts_stream_started_at": asyncio.get_running_loop().time(),
                })
                session_metadata[session_id] = meta
            except Exception:
                pass

            # Notify client
            await websocket.send_text(json.dumps({
                "type": "status",
                "message": "Connected to Deepgram TTS streaming",
                "defaults": {"model": model_id, "encoding": encoding, "sample_rate": sample_rate, "container": container}
            }))

            # Prepare Deepgram connection
            dg_conn = self.dg.speak.websocket.v("1")
            loop = asyncio.get_running_loop()
            audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
            total_audio_bytes = 0

            def on_open(self_ref, open, **kwargs):
                asyncio.run_coroutine_threadsafe(
                    websocket.send_text(json.dumps({"type": "status", "message": "Deepgram TTS connected", "ready_for_audio": True})),
                    loop
                )

            def on_audio(self_ref, data: bytes, **kwargs):
                nonlocal total_audio_bytes
                total_audio_bytes += len(data)
                asyncio.run_coroutine_threadsafe(audio_queue.put(data), loop)

            def on_close(self_ref, close, **kwargs):
                asyncio.run_coroutine_threadsafe(
                    websocket.send_text(json.dumps({"type": "status", "message": "Deepgram TTS closed"})),
                    loop
                )

            def on_error(self_ref, err, **kwargs):
                asyncio.run_coroutine_threadsafe(
                    websocket.send_text(json.dumps({"type": "error", "message": f"Deepgram TTS error: {err}"})),
                    loop
                )

            dg_conn.on(SpeakWebSocketEvents.Open, on_open)
            dg_conn.on(SpeakWebSocketEvents.AudioData, on_audio)
            dg_conn.on(SpeakWebSocketEvents.Close, on_close)
            dg_conn.on(SpeakWebSocketEvents.Error, on_error)

            # Try to read an initial config message (non-blocking short timeout)
            try:
                cfg = await asyncio.wait_for(websocket.receive_text(), timeout=0.15)
                try:
                    cfg_obj = json.loads(cfg)
                    model_id = cfg_obj.get("model", model_id)
                    encoding = cfg_obj.get("encoding", encoding)
                    sample_rate = int(cfg_obj.get("sample_rate", sample_rate) or sample_rate)
                    container = cfg_obj.get("container", container)
                    language_code = cfg_obj.get("language", language_code)
                except Exception:
                    await websocket.send_text(json.dumps({"type": "info", "message": "Config not provided; using defaults"}))
                    first_pending_speak = cfg
                else:
                    first_pending_speak = None
            except asyncio.TimeoutError:
                first_pending_speak = None

            # Start Deepgram connection (use dynamic options; container is not supported here)
            opts = {
                "model": model_id,
                "encoding": encoding,
                "sample_rate": sample_rate,
            }
            if dg_conn.start(opts) is False:
                await websocket.send_text(json.dumps({"type": "error", "message": "Failed to start Deepgram TTS"}))
                return

            # Register this session for server-driven Speak
            TTS_REGISTRY[session_id] = dg_conn

            async def forward_audio_to_client():
                first_chunk_sent = False
                try:
                    while True:
                        data = await audio_queue.get()
                        if websocket.client_state.value >= 3:
                            break
                        if not first_chunk_sent:
                            first_chunk_sent = True
                            try:
                                # Simple prints for latency measurement
                                start_now = asyncio.get_running_loop().time()
                                print(f"🔊 PLAYBACK_START: session={session_id} t={start_now:.6f}")
                                try:
                                    meta = session_metadata.get(session_id, {})
                                    t0 = meta.get("final_tx_at_monotonic")
                                    if isinstance(t0, (int, float)):
                                        latency = start_now - t0
                                        print(f"⏱️ LATENCY final→playback: {latency:.3f}s")
                                except Exception:
                                    pass
                            except Exception:
                                pass
                        await websocket.send_bytes(data)
                except Exception:
                    pass

            audio_task = asyncio.create_task(forward_audio_to_client())

            # If the very first message was text (and not JSON config), try to parse it as Speak/Flush
            if first_pending_speak is not None:
                try:
                    obj = json.loads(first_pending_speak)
                    if obj.get("type") == "Speak":
                        cleaned = sanitize_speak_text(obj.get("text", ""))
                        if cleaned:
                            dg_conn.send_text(cleaned)
                        else:
                            asyncio.run_coroutine_threadsafe(websocket.send_text(json.dumps({"type":"warning","message":"Ignored non-plain Speak payload"})), loop)
                    elif obj.get("type") == "Flush":
                        dg_conn.flush()
                except Exception:
                    cleaned = sanitize_speak_text(first_pending_speak)
                    if cleaned:
                        dg_conn.send_text(cleaned)
                        dg_conn.flush()
                    else:
                        asyncio.run_coroutine_threadsafe(websocket.send_text(json.dumps({"type":"warning","message":"Ignored non-plain first message"})), loop)

            # Main loop: relay client messages and audio
            try:
                while True:
                    if websocket.client_state.value >= 3:
                        break
                    try:
                        message = await asyncio.wait_for(websocket.receive(), timeout=0.5)
                    except asyncio.TimeoutError:
                        continue

                    if message is None:
                        continue

                    if message.get("type") == "websocket.disconnect":
                        break

                    if "text" in message:
                        try:
                            payload = json.loads(message["text"]) if isinstance(message["text"], str) else {}
                            mtype = payload.get("type")
                            if mtype == "Speak":
                                cleaned = sanitize_speak_text(payload.get("text", ""))
                                if cleaned:
                                    dg_conn.send_text(cleaned)
                                else:
                                    await websocket.send_text(json.dumps({"type": "warning", "message": "Ignored non-plain Speak payload"}))
                            elif mtype == "Flush":
                                dg_conn.flush()
                            elif mtype == "Close":
                                dg_conn.finish()
                                break
                            elif mtype == "Config":
                                await websocket.send_text(json.dumps({"type": "warning", "message": "Config can only be sent before start"}))
                            else:
                                cleaned = sanitize_speak_text(message["text"])
                                if cleaned:
                                    dg_conn.send_text(cleaned)
                                    dg_conn.flush()
                                else:
                                    await websocket.send_text(json.dumps({"type": "warning", "message": "Ignored non-plain text payload"}))
                        except Exception as e:
                            await websocket.send_text(json.dumps({"type": "error", "message": f"Invalid message: {e}"}))
                    else:
                        pass
            except WebSocketDisconnect:
                pass
            finally:
                try:
                    dg_conn.finish()
                except Exception:
                    pass
                audio_task.cancel()

            # Telemetry + credits
            try:
                if user_id and company_id:
                    from main import supabase
                    duration_minutes = max(0.0, (total_audio_bytes / max(1, sample_rate * 2)) / 60.0)
                    print(f"🔢 DG TTS total bytes={total_audio_bytes}, est minutes={duration_minutes:.3f}")
                    supabase.rpc('track_model_usage', {
                        'p_user_id': user_id,
                        'p_company_id': company_id,
                        'p_session_id': session_id,
                        'p_model_type': 'tts',
                        'p_provider': 'deepgram',
                        'p_model_name': model_id,
                        'p_usage_amount': duration_minutes,
                        'p_metadata': {
                            'encoding': encoding,
                            'sample_rate': sample_rate,
                            'container': container,
                            'total_audio_bytes': total_audio_bytes,
                            'estimated_duration_minutes': duration_minutes,
                            'language': language_code
                        }
                    }).execute()

                    from credits_helper import check_and_use_credits, _round_up_tenth
                    billed_minutes = _round_up_tenth(duration_minutes)
                    async def _deduct():
                        try:
                            result = await check_and_use_credits(
                                user_id, company_id, 'deepgram_aura_v2_tts', billed_minutes,
                                f"Deepgram Aura v2 TTS stream ({duration_minutes:.2f} minutes → billed {billed_minutes:.1f}m)"
                            )
                            print(f"✅ DG TTS CREDIT: used={result['credits_used']} remaining={result['remaining_credits']}")
                        except Exception as ex:
                            print(f"❌ DG TTS CREDIT ERROR: {ex}")
                    asyncio.create_task(_deduct())
                else:
                    print("⚠️ DG TTS: missing user_id/company_id; skipping telemetry/credits")
            except Exception as e:
                print(f"❌ DG TTS telemetry/credit error: {e}")

        except Exception as e:
            print(f"❌ Error in Deepgram TTS WS handler: {e}")
            try:
                await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
            except Exception:
                pass
        finally:
            try:
                TTS_REGISTRY.pop(session_id, None)
            except Exception:
                pass
            try:
                await websocket.close()
            except Exception:
                pass


handler = DeepgramTTSWebSocketHandler()

async def handle_deepgram_tts_websocket(websocket: WebSocket) -> None:
    await handler.handle(websocket) 