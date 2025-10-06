import asyncio
import json
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect
from voice_agent_text import voice_agent_text_helper
from company.training.training import is_training_session
import os
from datetime import datetime
from deepgram import DeepgramClient, DeepgramClientOptions, LiveTranscriptionEvents
from session_data import session_metadata
import time

# Initialize Deepgram
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("DEEPGRAM_API_KEY environment variable is required")

# Create Deepgram client with options
deepgram_options = DeepgramClientOptions(
    url="wss://api.deepgram.com/v1/listen",
    options={
        "punctuate": True,
        "interim_results": True,
        "language": "en-US",
        "model": "nova-2",
        "smart_format": True
    }
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.websocket_queues: Dict[str, asyncio.Queue] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.websocket_queues[session_id] = asyncio.Queue()
        print(f"🔌 WebSocket connected: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.websocket_queues:
            del self.websocket_queues[session_id]
        print(f"🔌 WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: Dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(message))
                return True
            except Exception as e:
                print(f"❌ Error sending message to {session_id}: {e}")
                return False
        return False

manager = ConnectionManager()

class ModernVoiceWebSocketHandler:
    def __init__(self):
        self.manager = manager
        self.dg = DeepgramClient(DEEPGRAM_API_KEY, deepgram_options)

    async def handle_websocket(self, websocket: WebSocket, session_id: str, company_id: str, user_id: str = None):
        """Handle WebSocket connection for real-time voice streaming with Deepgram"""
        try:
            await self.manager.connect(websocket, session_id)
            
            # Extract company_id and user_id from query parameters if not provided
            if not company_id:
                company_id = websocket.query_params.get("companyId")
            if not user_id:
                user_id = websocket.query_params.get("userId")
            
            if not company_id:
                print(f"❌ Missing company_id in WebSocket connection")
                await self.manager.send_message(session_id, {
                    "type": "error",
                    "message": "Missing company_id parameter"
                })
                return
            
            print(f"🔌 Modern Voice WebSocket connected: {session_id}")
            print(f"📊 Parameters: company_id={company_id}, user_id={user_id}")
            
            # Create or get session for this connection
            from manage_twilio.calls import create_or_get_session
            from session_data import sessions, session_metadata
            
            actual_session_id = create_or_get_session(company_id, "voice", session_id, user_id=user_id)
            
            # Use the actual session_id for the connection
            self.manager.active_connections[actual_session_id] = websocket
            self.manager.websocket_queues[actual_session_id] = asyncio.Queue()
            
            # Capture the current event loop for use in Deepgram handlers
            loop = asyncio.get_running_loop()
            
            # Flag to track if connection is disconnected
            is_disconnected = False
            
            # Send welcome message with actual session_id
            await self.manager.send_message(actual_session_id, {
                "type": "status",
                "message": "Connected to AI voice agent with real-time transcription",
                "session_id": actual_session_id,
                "original_session_id": session_id
            })
            
            # Create Deepgram live connection
            conn = self.dg.listen.live(deepgram_options)
            
            # Set up Deepgram event handlers
            def on_open(conn, open, **kwargs):
                if not is_disconnected:
                    print(f"🎤 Deepgram connection open for session: {actual_session_id}")
                    # Use queue to send message from thread
                    if actual_session_id in self.manager.websocket_queues:
                        asyncio.run_coroutine_threadsafe(
                            self.manager.websocket_queues[actual_session_id].put({
                                "type": "status",
                                "message": "Deepgram connection established"
                            }),
                            loop
                        )
            
            def on_transcript(conn, result, **kwargs):
                if is_disconnected:
                    return
                    
                # Handle the new result format
                if hasattr(result, 'channel') and result.channel:
                    alt = result.channel.alternatives[0]
                    if not alt.transcript:
                        return
                    
                    is_final = getattr(result, "is_final", False)
                    
                    # Always log both interim and final for debugging
                    print(f"🎤 Session {actual_session_id}: {'FINAL' if is_final else 'INTERIM'}: {alt.transcript}")
                    
                    # Only process FINAL transcriptions with AI
                    if is_final:
                        # Mark time for latency measurement
                        try:
                            meta = session_metadata.get(actual_session_id, {})
                            meta["final_tx_at_monotonic"] = time.monotonic()
                            session_metadata[actual_session_id] = meta
                            print(f"⏱️ FINAL_SENT: session={actual_session_id} t={meta['final_tx_at_monotonic']:.6f}")
                        except Exception:
                            pass
                        # Send final transcript back to frontend via queue
                        transcript_data = {
                            "type": "transcript",
                            "transcript": alt.transcript,
                            "is_final": True,
                            "confidence": alt.confidence if hasattr(alt, 'confidence') else None,
                            "final_sent_at": datetime.utcnow().isoformat() + "Z"
                        }
                        
                        if actual_session_id in self.manager.websocket_queues:
                            asyncio.run_coroutine_threadsafe(
                                self.manager.websocket_queues[actual_session_id].put(transcript_data),
                                loop
                            )
                        
                        # Process with AI in background
                        asyncio.run_coroutine_threadsafe(
                            self.process_final_transcript(actual_session_id, alt.transcript, company_id, user_id),
                            loop
                        )
                        # Charge Deepgram STT by characters (non-blocking)
                        try:
                            from credits_helper import deepgram_stt_chars_with_credits
                            asyncio.run_coroutine_threadsafe(
                                deepgram_stt_chars_with_credits(user_id, company_id, len(alt.transcript)),
                                loop
                            )
                        except Exception as _:
                            pass
            
            def on_error(conn, error, **kwargs):
                if is_disconnected:
                    return
                    
                error_msg = f"Deepgram error: {error}"
                print(f"❌ {error_msg}")
                if actual_session_id in self.manager.websocket_queues:
                    asyncio.run_coroutine_threadsafe(
                        self.manager.websocket_queues[actual_session_id].put({
                            "type": "error",
                            "message": error_msg
                        }),
                        loop
                    )
            
            def on_close(conn, close, **kwargs):
                if not is_disconnected:
                    print(f"🎤 Deepgram connection closed for session: {actual_session_id}")
                if actual_session_id in self.manager.websocket_queues:
                    asyncio.run_coroutine_threadsafe(
                        self.manager.websocket_queues[actual_session_id].put({
                            "type": "status",
                            "message": "Deepgram connection closed"
                        }),
                        loop
                    )
            
            # Set up Deepgram event handlers using the new API
            conn.on(LiveTranscriptionEvents.Open, on_open)
            conn.on(LiveTranscriptionEvents.Transcript, on_transcript)
            conn.on(LiveTranscriptionEvents.Error, on_error)
            conn.on(LiveTranscriptionEvents.Close, on_close)
            
            # Start Deepgram connection
            conn.start()
            
            # Handle incoming audio data from frontend and outgoing messages from Deepgram
            try:
                while True:
                    # Check if WebSocket is still connected
                    if websocket.client_state.value >= 3:  # WebSocket is closed
                        print(f"🔌 WebSocket closed: {session_id}")
                        is_disconnected = True
                        break
                    
                    # Wait for either audio data from frontend or messages from Deepgram
                    try:
                        # Check connection state before creating tasks
                        if websocket.client_state.value >= 3:
                            print(f"🔌 WebSocket closed before processing: {session_id}")
                            is_disconnected = True
                            break
                            
                        done, pending = await asyncio.wait(
                            [
                                asyncio.create_task(websocket.receive_bytes()),
                                asyncio.create_task(self.manager.websocket_queues[actual_session_id].get())
                            ],
                            return_when=asyncio.FIRST_COMPLETED,
                            timeout=1.0  # Add timeout to prevent hanging
                        )
                        
                        for task in done:
                            try:
                                result = task.result()
                                
                                if isinstance(result, bytes):
                                    # Audio data from frontend - send to Deepgram
                                    if conn and hasattr(conn, 'send'):
                                        conn.send(result)
                                else:
                                    # Message from Deepgram - send to frontend
                                    if websocket.client_state.value < 3:  # Only send if still connected
                                        await websocket.send_text(json.dumps(result))
                                    
                                    # If this is a final transcript, process it with AI
                                    if isinstance(result, dict) and result.get("type") == "transcript" and result.get("is_final"):
                                        await self.process_final_transcript(actual_session_id, result["transcript"], company_id, user_id)
                                    
                            except Exception as e:
                                # Check if it's a disconnect error
                                if "disconnect" in str(e).lower() or "receive" in str(e).lower():
                                    print(f"🔌 WebSocket disconnected during processing: {session_id}")
                                    is_disconnected = True
                                    return  # Exit the function completely
                                else:
                                    print(f"❌ Error processing message: {e}")
                        
                        # Cancel pending tasks
                        for task in pending:
                            task.cancel()
                            
                    except asyncio.TimeoutError:
                        # Timeout occurred, check if we should continue
                        continue
                    except Exception as e:
                        # Check if it's a disconnect error
                        if "disconnect" in str(e).lower() or "receive" in str(e).lower():
                            print(f"🔌 WebSocket disconnected: {session_id}")
                            is_disconnected = True
                            return  # Exit the function completely
                        else:
                            print(f"❌ Error in message processing loop: {e}")
                            break
                        
            except WebSocketDisconnect:
                print(f"🔌 WebSocket disconnected: {session_id}")
                is_disconnected = True
            except Exception as e:
                # Check if it's a disconnect error
                if "disconnect" in str(e).lower() or "receive" in str(e).lower():
                    print(f"🔌 WebSocket disconnected: {session_id}")
                    is_disconnected = True
                else:
                    print(f"❌ Error in WebSocket handler: {e}")
                    if websocket.client_state.value < 3:  # Only send if still connected
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"WebSocket error: {str(e)}"
                            }))
                        except:
                            pass  # Ignore errors when sending error messages
            finally:
                # Clean up
                if actual_session_id in self.manager.active_connections:
                    self.manager.disconnect(actual_session_id)
                if conn and hasattr(conn, 'finish'):
                    conn.finish()

        except Exception as e:
            print(f"❌ Error in WebSocket handler: {e}")
            if websocket.client_state.value < 3:  # Only send if still connected
                try:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"WebSocket error: {str(e)}"
                    }))
                except:
                    pass  # Ignore errors when sending error messages

    async def process_final_transcript(self, session_id: str, transcript: str, company_id: str, user_id: str = None):
        """Process final transcript with AI and return audio response"""
        try:
            print(f"🎤 Processing final transcript: {transcript}")
            print(f"🎤 Session: {session_id}, Company: {company_id}, User: {user_id}")
            
            # Check if this is a training session
            if is_training_session(session_id):
                await self.manager.send_message(session_id, {
                    "type": "error",
                    "message": "This is a training session. Please use the training interface."
                })
                return
            
            # Ensure session exists and has proper metadata
            from manage_twilio.calls import create_or_get_session
            from session_data import sessions, session_metadata
            
            # Create or get session with proper metadata
            actual_session_id = create_or_get_session(company_id, "voice", session_id, user_id=user_id)
            
            print(f"🎤 Session created/retrieved: {actual_session_id}")
            print(f"🎤 Available sessions: {list(sessions.keys())}")
            print(f"🎤 Session metadata: {session_metadata.get(actual_session_id, {})}")
            
            # Use the voice_agent_text_helper for AI processing
            from fastapi import Form
            from io import BytesIO
            
            # Create FormData-like structure for the helper
            form_data = {
                "session_id": actual_session_id,
                "user_text": transcript, 
            }
            
            # Call the voice agent text helper
            result = await voice_agent_text_helper(**form_data)
            
            if "error" in result:
                await self.manager.send_message(session_id, {
                    "type": "error",
                    "message": result["error"]
                })
                return
            
            # Send audio response back
            response_message = {
                "type": "audio_response",
                "text": result.get("textResponse", ""),
                "audio": result.get("audio", ""),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            print(f"🎵 Sending audio response to session: {session_id}")
            print(f"🎵 Response length: {len(result.get('audio', ''))} chars")
            print(f"🎵 Text response: {result.get('textResponse', '')[:100]}...")
            
            await self.manager.send_message(session_id, response_message)
            
            print(f"✅ AI response processed for session: {session_id}")
            
        except Exception as e:
            print(f"❌ Error processing final transcript: {e}")
            await self.manager.send_message(session_id, {
                "type": "error",
                "message": f"Error processing transcript: {str(e)}"
            })

# Create handler instance
modern_voice_handler = ModernVoiceWebSocketHandler()

async def handle_voice_websocket(websocket: WebSocket, session_id: str, company_id: str, user_id: str = None):
    """Main WebSocket handler for voice calls with modern Deepgram approach"""
    await modern_voice_handler.handle_websocket(websocket, session_id, company_id, user_id)

# Utility functions for Twilio integration
def create_voice_twiml_with_websocket(company_id: str, session_id: str, websocket_url: str) -> str:
    """Create TwiML that connects to WebSocket for real-time voice with Deepgram"""
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Connecting you to your AI assistant with real-time transcription. Please wait.</Say>
    <Connect>
        <Stream url="{websocket_url}" />
    </Connect>
</Response>"""
    return twiml

def get_websocket_url(company_id: str, session_id: str) -> str:
    """Get WebSocket URL for voice streaming"""
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    return f"{base_url}/voice/websocket/{company_id}/{session_id}?company_id={company_id}" 