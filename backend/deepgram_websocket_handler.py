import asyncio
import json
import base64
import os
import threading
import time
from typing import Dict, Optional
from fastapi import WebSocket, WebSocketDisconnect
from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents
from dotenv import load_dotenv

load_dotenv()

class DeepgramWebSocketHandler:
    def __init__(self):
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        if not self.deepgram_api_key:
            raise ValueError("DEEPGRAM_API_KEY not found in environment variables")
        
        self.dg = DeepgramClient(api_key=self.deepgram_api_key)
        self.active_connections: Dict[str, WebSocket] = {}
        self.websocket_queues: Dict[str, asyncio.Queue] = {}
        self.session_start_times: Dict[str, float] = {}
        
    async def handle_websocket(self, websocket: WebSocket, session_id: str = "test"):
        """Handle WebSocket connection for real-time Deepgram transcription"""
        try:
            await websocket.accept()
            
            # Create or get session for this connection
            from manage_twilio.calls import create_or_get_session
            from session_data import sessions, session_metadata
            
            # For now, use a default company_id - this should be passed from frontend
            company_id = websocket.query_params.get("company_id")
            user_id = websocket.query_params.get("user_id")
            actual_session_id = create_or_get_session(company_id, "voice", session_id, user_id=user_id)
            
            print(f"🔌 Deepgram WebSocket connected: {session_id} -> {actual_session_id}")
            
            # Use the actual session_id for the connection
            self.active_connections[actual_session_id] = websocket
            
            # Create a queue for sending messages from Deepgram thread to WebSocket
            queue = asyncio.Queue()
            self.websocket_queues[actual_session_id] = queue
            
            # Track session start time for duration calculation
            self.session_start_times[actual_session_id] = time.time()
            
            # Capture the current event loop for use in Deepgram handlers
            loop = asyncio.get_running_loop()
            
            # Flag to track if connection is disconnected
            is_disconnected = False
            
            # Send welcome message with actual session_id
            await websocket.send_text(json.dumps({
                "type": "status",
                "message": "Connected to Deepgram transcription service",
                "session_id": actual_session_id,
                "original_session_id": session_id
            }))
            
            # Create Deepgram live connection
            conn = self.dg.listen.websocket.v("1")
            
            # Set up Deepgram event handlers
            def on_open(conn, open, **kwargs):
                if not is_disconnected:
                    print(f"🎤 Deepgram connection open for session: {actual_session_id}")
                    # Use queue to send message from thread
                    if actual_session_id in self.websocket_queues:
                        asyncio.run_coroutine_threadsafe(
                            self.websocket_queues[actual_session_id].put({
                                "type": "status",
                                "message": "Deepgram connection established"
                            }),
                            loop
                        )
            
            def on_transcript(conn, result, **kwargs):
                if is_disconnected:
                    return
                    
                alt = result.channel.alternatives[0]
                if not alt.transcript:
                    return
                
                is_final = getattr(result, "is_final", False)
                
                # Only send FINAL transcriptions to the frontend
                if is_final:
                    transcript_data = {
                        "type": "transcript",
                        "transcript": alt.transcript,
                        "is_final": True,
                        "confidence": alt.confidence if hasattr(alt, 'confidence') else None
                    }
                    
                    # Send final transcript back to frontend via queue
                    if actual_session_id in self.websocket_queues:
                        asyncio.run_coroutine_threadsafe(
                            self.websocket_queues[actual_session_id].put(transcript_data),
                            loop
                        )
                
                # Always log both interim and final for debugging
                print(f"🎤 Session {actual_session_id}: {'FINAL' if is_final else 'INTERIM'}: {alt.transcript}")
            
            def on_error(conn, error, **kwargs):
                if is_disconnected:
                    return
                    
                error_msg = f"Deepgram error: {error}"
                print(f"❌ {error_msg}")
                if actual_session_id in self.websocket_queues:
                    asyncio.run_coroutine_threadsafe(
                        self.websocket_queues[actual_session_id].put({
                            "type": "error",
                            "message": error_msg
                        }),
                        loop
                    )
            
            def on_close(conn, close, **kwargs):
                if not is_disconnected:
                    print(f"🎤 Deepgram connection closed for session: {actual_session_id}")
                    
                    # Track usage when connection closes
                    if actual_session_id in self.session_start_times:
                        duration_minutes = (time.time() - self.session_start_times[actual_session_id]) / 60
                        print(f"🎤 DEEPGRAM DURATION: Session duration: {duration_minutes:.3f} minutes")
                        
                        # Track usage in background
                        if user_id and company_id:
                            print(f"🎤 DEEPGRAM CREDITS: User and company provided, tracking usage and credits")
                            try:
                                from main import supabase
                                
                                # Track Deepgram STT usage
                                print(f"🎤 DEEPGRAM USAGE TRACKING: Tracking usage in database")
                                result = supabase.rpc('track_model_usage', {
                                    'p_user_id': user_id,
                                    'p_company_id': company_id,
                                    'p_session_id': actual_session_id,
                                    'p_model_type': 'stt',
                                    'p_provider': 'deepgram',
                                    'p_model_name': 'nova-2',
                                    'p_usage_amount': duration_minutes,
                                    'p_metadata': {
                                        'duration_minutes': duration_minutes,
                                        'session_id': actual_session_id
                                    }
                                }).execute()
                                print(f"✅ DEEPGRAM USAGE TRACKING: Usage tracked successfully")
                                
                                # Also track credits using the new credit system
                                try:
                                    print(f"🎤 DEEPGRAM CREDIT TRACKING: Starting credit deduction")
                                    from credits_helper import deepgram_stt_with_credits
                                    credit_result = asyncio.run_coroutine_threadsafe(
                                        deepgram_stt_with_credits(user_id, company_id, duration_minutes),
                                        loop
                                    ).result()
                                    print(f"✅ DEEPGRAM CREDIT SUCCESS: Credits deducted for Deepgram STT: {credit_result['credits_used']} credits")
                                    print(f"✅ DEEPGRAM CREDIT SUCCESS: Remaining credits: {credit_result['remaining_credits']} credits")
                                except Exception as credit_error:
                                    print(f"❌ DEEPGRAM CREDIT ERROR: Error processing Deepgram STT credits: {credit_error}")
                                    import traceback
                                    traceback.print_exc()
                                    
                            except Exception as e:
                                print(f"❌ DEEPGRAM TRACKING ERROR: Error tracking Deepgram STT usage: {e}")
                                import traceback
                                traceback.print_exc()
                        else:
                            print(f"⚠️ DEEPGRAM CREDITS: Skipping Deepgram STT cost tracking - missing user_id or company_id")
                            print(f"⚠️ DEEPGRAM CREDITS: user_id={user_id}, company_id={company_id}")
                        
                        # Clean up session start time
                        del self.session_start_times[actual_session_id]
                        print(f"🎤 DEEPGRAM CLEANUP: Removed session start time for {actual_session_id}")
                    
                if actual_session_id in self.websocket_queues:
                    asyncio.run_coroutine_threadsafe(
                        self.websocket_queues[actual_session_id].put({
                            "type": "status",
                            "message": "Deepgram connection closed"
                        }),
                        loop
                    )
            
            # Register event handlers
            conn.on(LiveTranscriptionEvents.Open, on_open)
            conn.on(LiveTranscriptionEvents.Transcript, on_transcript)
            conn.on(LiveTranscriptionEvents.Error, on_error)
            conn.on(LiveTranscriptionEvents.Close, on_close)
            
            # Configure Deepgram options (matching your terminal version)
            opts = LiveOptions(
                model="nova-2",
                language="es-419",  # Spanish (Latin America)
                punctuate=True,
                interim_results=True,
                encoding="linear16",
                channels=1,
                sample_rate=16000,
                vad_events=True,
                endpointing=300,  # ms of silence to end an utterance
            )
            
            # Start Deepgram connection
            conn.start(opts)
            
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
                                asyncio.create_task(queue.get())
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
                if actual_session_id in self.active_connections:
                    del self.active_connections[actual_session_id]
                if actual_session_id in self.websocket_queues:
                    del self.websocket_queues[actual_session_id]
                
                if conn and hasattr(conn, 'finish'):
                    try:
                        conn.finish()
                    except:
                        pass  # Ignore errors during cleanup
                    
        except Exception as e:
            print(f"❌ Error setting up Deepgram WebSocket: {e}")
            if websocket.client_state.value < 3:  # Not closed
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Setup error: {str(e)}"
                }))

# Global handler instance
deepgram_handler = DeepgramWebSocketHandler()

async def handle_deepgram_websocket(websocket: WebSocket, session_id: str = "test"):
    """Main WebSocket handler function"""
    await deepgram_handler.handle_websocket(websocket, session_id) 