import os
from dotenv import load_dotenv
from typing import Optional, Dict
import httpx
from pydantic import BaseModel
from fastapi import HTTPException, Response
from datetime import datetime
import uuid

load_dotenv()

from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
from twilio.twiml.messaging_response import MessagingResponse

# Environment variables
MASTER_API_KEY = os.getenv("MASTER_API_KEY")
MASTER_API_SECRET = os.getenv("MASTER_API_SECRET")
MASTER_ACCOUNT_SID = os.getenv("MASTER_ACCOUNT_SID")
MASTER_AUTH_TOKEN = os.getenv("MASTER_AUTH_TOKEN")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# Import Supabase client and session management
from main import  sessions, session_metadata
from database_utils import get_sb

supabase =get_sb()

#-----Pydantic Models-----

class IncomingCallData(BaseModel):
    """Data structure for incoming call information"""
    call_sid: str
    from_number: str
    to_number: str
    direction: str = "inbound"
    company_id: Optional[str] = None

class CallStatusData(BaseModel):
    """Data structure for call status updates"""
    call_sid: str
    call_status: str
    call_duration: Optional[int] = None
    recording_url: Optional[str] = None

class VoiceStreamConfig(BaseModel):
    """Configuration for voice streaming"""
    company_id: str
    session_id: Optional[str] = None
    language_code: str = "es"

class WhatsAppMessageData(BaseModel):
    """Data structure for WhatsApp messages"""
    message_sid: str
    from_number: str
    to_number: str
    body: str
    company_id: Optional[str] = None

#-----Helper Functions-----

def master_client() -> Client:
    """Get Twilio master client"""
    if MASTER_API_KEY and MASTER_API_SECRET:
        return Client(MASTER_API_KEY, MASTER_API_SECRET, MASTER_ACCOUNT_SID)
    elif MASTER_ACCOUNT_SID and MASTER_AUTH_TOKEN:
        return Client(MASTER_ACCOUNT_SID, MASTER_AUTH_TOKEN)
    else:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")

def subaccount_client(sub_sid: str, key_sid: Optional[str] = None, key_secret: Optional[str] = None) -> Client:
    """Get Twilio subaccount client"""
    if key_sid and key_secret:
        return Client(key_sid, key_secret, sub_sid)
    else:
        # Fallback to master credentials
        return master_client()

def extract_company_from_phone_number(phone_number: str) -> Optional[str]:
    """Extract company_id from phone number"""
    try:
        print(f"🔍 Looking up company for phone number: {phone_number}")
        
        # First try phone_numbers table (for purchased numbers)
        result = supabase.table("phone_numbers").select("company_id").eq("phone_number", phone_number).execute()
        
        if result.data:
            company_id = result.data[0]["company_id"]
            print(f"✅ Found company {company_id} in phone_numbers table")
            return company_id
        
        # Then try phone_number_users table (for registered numbers)
        result = supabase.table("phone_number_users").select("company_id").eq("phone_number", phone_number).execute()
        
        if result.data:
            company_id = result.data[0]["company_id"]
            print(f"✅ Found company {company_id} in phone_number_users table")
            return company_id
        
        print(f"❌ No company found for phone number: {phone_number}")
        return None
        
    except Exception as e:
        print(f"❌ Error extracting company from phone number: {e}")
        return None

def get_user_from_phone_number(phone_number: str) -> Optional[str]:
    """Get user_id from phone number"""
    try:
        print(f"🔍 Looking up user for phone number: {phone_number}")
        
        # Try phone_number_users table first
        result = supabase.table("phone_number_users").select("user_id").eq("phone_number", phone_number).execute()
        
        if result.data:
            user_id = result.data[0]["user_id"]
            print(f"✅ Found user_id {user_id} in phone_number_users table")
            return user_id
        
        # Try phone_numbers table
        result = supabase.table("phone_numbers").select("user_id").eq("phone_number", phone_number).execute()
        
        if result.data and result.data[0].get("user_id"):
            user_id = result.data[0]["user_id"]
            print(f"✅ Found user_id {user_id} in phone_numbers table")
            return user_id
        
        print(f"📞 No user found for phone number {phone_number}")
        return None
        
    except Exception as e:
        print(f"❌ Error getting user from phone number: {e}")
        return None

def create_or_get_session(company_id: str, source: str, identifier: str = None, user_id: str = None) -> str:
    """Create or get existing session for voice/WhatsApp calls"""
    try:
        print(f"📞 create_or_get_session called with: company_id={company_id}, source={source}, identifier={identifier}, user_id={user_id}")
        
        # Removed synchronous credit pre-check here to avoid awaiting async in sync context
        
        # If identifier is already a UUID and exists in sessions, use it directly
        if identifier and identifier in sessions:
            print(f"📞 Using existing session directly: {identifier}")
            return identifier
        
        # If identifier is already a UUID and exists in session_metadata, use it directly
        if identifier and identifier in session_metadata:
            print(f"📞 Using existing session from metadata: {identifier}")
            return identifier
        
        # Always use UUID for session_id to avoid database type conflicts
        if not identifier:
            # New call - create UUID session
            session_id = str(uuid.uuid4())
            print(f"📞 Creating new session for new call: {session_id}")
        else:
            # Check if session exists in memory first
            session_key = f"{source}_{identifier}_{company_id}"
            if session_key in sessions:
                print(f"📞 Using existing session from memory: {session_key}")
                return session_key
            
            # Check if session exists in database
            existing_session = supabase.table("session_summaries").select("session_id").eq("session_id", session_key).execute()
            
            if existing_session.data:
                # Load existing session into memory
                sessions[session_key] = {
                    "company_id": company_id,
                    "mode": source,
                    "created_at": datetime.utcnow().isoformat()
                }
                session_metadata[session_key] = {
                    "company_id": company_id,
                    "source": source,
                    "identifier": identifier,
                    "user_id": user_id
                }
                print(f"📞 Loaded existing session from database: {session_key}")
                return session_key
            
            # If identifier is a UUID, use it directly as session_id
            import re
            uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
            if uuid_pattern.match(identifier):
                session_id = identifier
                print(f"📞 Using identifier as session_id: {session_id}")
            else:
                # Create new UUID session for this identifier
                session_id = str(uuid.uuid4())
                print(f"📞 Creating new UUID session for identifier: {identifier} -> {session_id}")
        
        # Create new session in memory
        sessions[session_id] = {
            "company_id": company_id,
            "mode": source,
            "created_at": datetime.utcnow().isoformat()
        }
        session_metadata[session_id] = {
            "company_id": company_id,
            "source": source,
            "identifier": identifier or "new_call",
            "user_id": user_id
        }
        
        print(f"📞 Created session in memory: {session_id}")
        print(f"📞 Available sessions: {list(sessions.keys())}")
        
        # Store in database with UUID session_id (only use existing columns)
        session_data = {
            "session_id": session_id,  # This is now always a UUID
            "company_id": company_id,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("session_summaries").insert(session_data).execute()
            print(f"📞 Created new session: {session_id} with user_id: {user_id}")
            print(f"📞 Session data stored in database successfully")
        except Exception as e:
            print(f"❌ Error storing session in database: {e}")
            # Continue even if database storage fails
        
        # Pre-warm the chat session in the background (non-blocking)
        async def pre_warm_background():
            try:
                from agent.agent import pre_warm_chat_session
                print(f"🔥 Starting pre-warm for session: {session_id}")
                pre_warm_result = await pre_warm_chat_session(session_id, company_id, user_id)
                if pre_warm_result and isinstance(pre_warm_result, dict) and pre_warm_result.get("error") == "insufficient_credits":
                    print(f"❌ Pre-warm failed due to insufficient credits for session: {session_id}")
                else:
                    print(f"🔥 Pre-warm completed for session: {session_id}")
            except Exception as e:
                print(f"❌ Error in background pre-warming: {e}")
                import traceback
                traceback.print_exc()
        
        # Start pre-warming in background (don't await)
        import asyncio
        asyncio.create_task(pre_warm_background())
        
        print(f"📞 Returning session_id: {session_id}")
        return session_id
        
    except Exception as e:
        print(f"❌ Error creating session: {e}")
        # Fallback to UUID
        return str(uuid.uuid4())

def log_call_data(call_data: IncomingCallData) -> str:
    """Log incoming call data to database"""
    try:
        log_entry = {
            "call_sid": call_data.call_sid,
            "company_id": call_data.company_id,
            "from_number": call_data.from_number,
            "to_number": call_data.to_number,
            "direction": call_data.direction,
            "status": "ringing",
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("call_logs").insert(log_entry).execute()
        print(f"✅ Logged call: {call_data.call_sid}")
        
        return result.data[0]["id"] if result.data else None
        
    except Exception as e:
        print(f"❌ Error logging call: {e}")
        return None

def update_call_status(status_data: CallStatusData) -> bool:
    """Update call status in database"""
    try:
        update_data = {
            "status": status_data.call_status,
            "duration_seconds": status_data.call_duration,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if status_data.recording_url:
            update_data["recording_url"] = status_data.recording_url
        
        supabase.table("call_logs").update(update_data).eq("call_sid", status_data.call_sid).execute()
        print(f"✅ Updated call status: {status_data.call_sid} -> {status_data.call_status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error updating call status: {e}")
        return False

async def store_message_in_history(session_id: str, company_id: str, message_type: str, content: str, metadata: Dict = None):
    """Store message in conversation history"""
    try:
        from company.storage.storage import store_message_in_history_helper
        # Fix parameter order: company_id should be first, then session_id
        await store_message_in_history_helper(company_id, session_id, message_type, content, metadata)
        print(f"✅ Stored {message_type} message for session: {session_id}")
        
    except Exception as e:
        print(f"❌ Error storing message: {e}")

def get_company_language(company_id: str) -> str:
    """Get company's preferred language"""
    try:
        result = supabase.table("companies").select("language").eq("company_id", company_id).execute()
        if result.data:
            return result.data[0].get("language", "es")
        return "es"
    except Exception as e:
        print(f"❌ Error getting company language: {e}")
        return "es"

#-----Voice Call Helpers-----

def handle_incoming_voice_call_helper(call_data: IncomingCallData) -> Response:
    """Handle incoming voice calls and route to AI agent"""
    try:
        print(f"📞 Incoming call: {call_data.call_sid} from {call_data.from_number}")
        
        # Extract company from phone number
        company_id = call_data.company_id or extract_company_from_phone_number(call_data.to_number)
        
        if not company_id:
            # Return error TwiML
            error_response = VoiceResponse()
            error_response.say("This number is not configured. Please contact support.", voice="alice")
            error_response.hangup()
            return Response(content=str(error_response), media_type="application/xml")
        
        # Get user_id from phone number
        user_id = get_user_from_phone_number(call_data.from_number)
        print(f"📞 Call from {call_data.from_number} -> User: {user_id}, Company: {company_id}")
        
        # Log the call
        log_call_data(call_data)
        
        # Create session for this call (new call - no existing session)
        session_id = create_or_get_session(
            company_id=company_id, 
            source="voice", 
            identifier=None,  # New call, no existing session
            user_id=user_id  # Now we have user_id for cost tracking!
        )
        
        # Generate TwiML response
        response = VoiceResponse()
        
        # Welcome message
        response.say("Welcome to our AI assistant. Please wait while I connect you.", voice="alice")
        
        # Connect to voice stream
        stream_url = f"{BASE_URL}/voice/stream/{company_id}?session_id={session_id}"
        response.connect().stream(url=stream_url)
        
        print(f"📞 Voice call routed to AI: {call_data.call_sid} -> {company_id} -> Session: {session_id} -> User: {user_id}")
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        print(f"❌ Error handling voice call: {e}")
        # Return error TwiML
        error_response = VoiceResponse()
        error_response.say("We're experiencing technical difficulties. Please try again later.", voice="alice")
        error_response.hangup()
        return Response(content=str(error_response), media_type="application/xml")

def handle_call_status_helper(status_data: CallStatusData) -> Dict:
    """Handle call status updates from Twilio"""
    try:
        # Update call log
        success = update_call_status(status_data)
        
        # If call completed, deduct credits
        if success and status_data.call_status == "completed" and status_data.call_duration:
            try:
                # Get user_id from call session
                from session_data import session_metadata
                
                # Find session by call_sid (this would need to be stored during call creation)
                # For now, we'll use a simplified approach
                call_duration_minutes = max(1, status_data.call_duration // 60)  # Minimum 1 minute
                
                # Try to get user_id from the call session
                # This is a simplified approach - in production you'd store call_sid -> user_id mapping
                print(f"📞 Call completed: {status_data.call_sid}, duration: {call_duration_minutes} minutes")
                
                # For now, we'll skip credit deduction for voice calls since we don't have user_id
                # In production, you'd store call_sid -> user_id mapping during call creation
                print(f"⚠️ Skipping credit deduction - no user_id mapping for call {status_data.call_sid}")
                
            except Exception as e:
                print(f"❌ Error processing call credits: {e}")
        
        if success:
            return {"success": True, "message": "Call status updated"}
        else:
            return {"success": False, "error": "Failed to update call status"}
            
    except Exception as e:
        print(f"❌ Error handling call status: {e}")
        return {"success": False, "error": str(e)}

def handle_voice_stream_helper(stream_config: VoiceStreamConfig) -> Response:
    """Handle real-time voice streaming for AI agent"""
    try:
        from manage_twilio.websocket_voice import create_voice_twiml_with_websocket, get_websocket_url
        
        # Get user_id from session metadata if session_id is provided
        user_id = None
        if stream_config.session_id:
            from session_data import session_metadata
            session_meta = session_metadata.get(stream_config.session_id, {})
            user_id = session_meta.get("user_id")
        
        # Create session for this call (new or existing)
        session_id = create_or_get_session(
            company_id=stream_config.company_id, 
            source="voice", 
            identifier=stream_config.session_id,  # Can be None for new calls
            user_id=user_id  # Now we pass user_id for cost tracking!
        )
        
        # Get WebSocket URL with user_id parameter
        websocket_url = get_websocket_url(stream_config.company_id, session_id)
        if user_id:
            websocket_url += f"&user_id={user_id}"
        
        # Create TwiML that connects to WebSocket
        twiml_response = create_voice_twiml_with_websocket(
            stream_config.company_id, 
            session_id, 
            websocket_url
        )
        
        print(f"🎤 Voice stream configured for session: {session_id} with user_id: {user_id}")
        
        return Response(content=twiml_response, media_type="application/xml")
        
    except Exception as e:
        print(f"❌ Error in voice stream: {e}")
        error_response = VoiceResponse()
        error_response.say("I'm having trouble processing your request. Please try again.", voice="alice")
        return Response(content=str(error_response), media_type="application/xml")



#-----WhatsApp Helpers-----

async def handle_whatsapp_message_helper(message_data: WhatsAppMessageData) -> Response:
    """Handle incoming WhatsApp messages and route to AI agent"""
    try:
        # Extract company from phone number
        company_id = message_data.company_id or extract_company_from_phone_number(message_data.to_number)
        
        if not company_id:
            # Return error message
            resp = MessagingResponse()
            resp.message("❌ This number is not configured. Please contact support.")
            return Response(content=str(resp), media_type="application/xml")
        
        # Create session for this conversation
        session_id = create_or_get_session(company_id, "whatsapp", message_data.from_number, user_id=None)
        
        # Check if this is a training session
        from company.training.training import is_training_session
        if is_training_session(session_id):
            print(f"⚠️ Training session detected: {session_id}. Use /training/respond endpoint instead.")
            resp = MessagingResponse()
            resp.message("This is a training session. Please use the training interface instead.")
            return Response(content=str(resp), media_type="application/xml")
        
        # Store user message
        await store_message_in_history(
            session_id=session_id,
            company_id=company_id,
            message_type="user",
            content=message_data.body,
            metadata={
                "source": "whatsapp",
                "from_number": message_data.from_number,
                "message_sid": message_data.message_sid
            }
        )
        
        # Get AI response using the same logic as voice_agent_helper
        from main import get_agent_response_with_training
        
        # Get response with training data
        print(f"🤖 Getting AI response for WhatsApp message")
        ai_response = await get_agent_response_with_training(session_id, message_data.body)
        print(f"✅ AI response generated: {ai_response[:100]}...")
        
        # Store AI response
        await store_message_in_history(
            session_id=session_id,
            company_id=company_id,
            message_type="bot",
            content=ai_response,
            metadata={
                "source": "whatsapp",
                "to_number": message_data.from_number
            }
        )
        
        # Send response back via WhatsApp
        resp = MessagingResponse()
        resp.message(ai_response)
        
        print(f"📱 WhatsApp message processed: {message_data.message_sid}")
        
        return Response(content=str(resp), media_type="application/xml")
        
    except Exception as e:
        print(f"❌ Error handling WhatsApp message: {e}")
        resp = MessagingResponse()
        resp.message("❌ Sorry, there was an error processing your message. Please try again.")
        return Response(content=str(resp), media_type="application/xml")

#-----Configuration Helpers-----

async def handle_voice_call_with_ai_helper(session_id: str, user_text: str, company_id: str) -> str:
    """Handle voice call with AI using the same logic as voice_agent_helper"""
    try:
        # Check if this is a training session
        from company.training.training import is_training_session
        if is_training_session(session_id):
            print(f"⚠️ Training session detected: {session_id}. Use /training/respond endpoint instead.")
            return "This is a training session. Please use the training interface instead."
        
        # Get AI response using the same logic as voice_agent_helper
        from main import get_agent_response_with_training
        
        print(f"🤖 Getting AI response for voice call")
        ai_response = await get_agent_response_with_training(session_id, user_text)
        print(f"✅ AI response generated: {ai_response[:100]}...")
        
        return ai_response
        
    except Exception as e:
        print(f"❌ Error in voice call AI handler: {e}")
        return "I'm having trouble processing your request. Please try again."

def configure_phone_number_helper(phone_number: str, company_id: str, voice_url: str = None, sms_url: str = None) -> Dict:
    """Configure a phone number to route calls to AI agent"""
    try:
        print(f"⚙️ Configuring phone number {phone_number} for AI agent")
        
        # Default URLs if not provided
        if not voice_url:
            voice_url = f"{BASE_URL}/voice/incoming/{company_id}"
        if not sms_url:
            sms_url = f"{BASE_URL}/whatsapp/webhook"
        
        status_callback = f"{BASE_URL}/voice/status"
        
        print(f"🔗 Setting webhooks:")
        print(f"  Voice: {voice_url}")
        print(f"  SMS: {sms_url}")
        print(f"  Status: {status_callback}")
        
        # First, find the phone number SID from our database
        phone_record = supabase.table("phone_numbers").select("phone_number_sid, twilio_sid").eq("phone_number", phone_number).execute()
        
        phone_number_sid = None
        if phone_record.data:
            phone_number_sid = phone_record.data[0].get("phone_number_sid") or phone_record.data[0].get("twilio_sid")
        
        if not phone_number_sid:
            # Try to find it in Twilio directly
            client = master_client()
            numbers = client.incoming_phone_numbers.list(phone_number=phone_number)
            if numbers:
                phone_number_sid = numbers[0].sid
                print(f"📞 Found phone number SID in Twilio: {phone_number_sid}")
            else:
                raise HTTPException(status_code=404, detail=f"Phone number {phone_number} not found in Twilio")
        
        # Update phone number configuration in Twilio
        client = master_client()
        number = client.incoming_phone_numbers(phone_number_sid).update(
            voice_url=voice_url,
            sms_url=sms_url,
            status_callback=status_callback
        )
        
        print(f"✅ Updated Twilio configuration for {phone_number}")
        
        # Update database
        update_data = {
            "voice_url": voice_url,
            "sms_url": sms_url,
            "status_callback": status_callback,
            "configured_at": datetime.utcnow().isoformat()
        }
        
        # Try to update in phone_numbers table
        result = supabase.table("phone_numbers").update(update_data).eq("phone_number", phone_number).execute()
        
        # If not found in phone_numbers, try phone_number_users
        if not result.data:
            # For phone_number_users, we can't store webhook URLs, but we can note it's configured
            supabase.table("phone_number_users").update({
                "updated_at": datetime.utcnow().isoformat()
            }).eq("phone_number", phone_number).execute()
        
        print(f"💾 Updated database configuration for {phone_number}")
        
        return {
            "success": True,
            "message": "Phone number configured successfully",
            "phone_number": number.phone_number,
            "phone_number_sid": phone_number_sid,
            "voice_url": voice_url,
            "sms_url": sms_url,
            "status_callback": status_callback
        }
        
    except Exception as e:
        print(f"❌ Error configuring phone number: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to configure phone number: {str(e)}")

def get_phone_number_config_helper(phone_number_sid: str) -> Dict:
    """Get phone number configuration"""
    try:
        # Get from database
        result = supabase.table("phone_numbers").select("*").eq("twilio_sid", phone_number_sid).execute()
        
        if result.data:
            return {
                "success": True,
                "phone_number": result.data[0]
            }
        else:
            return {
                "success": False,
                "error": "Phone number not found"
            }
            
    except Exception as e:
        print(f"❌ Error getting phone number config: {e}")
        return {
            "success": False,
            "error": str(e)
        } 