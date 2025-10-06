from fastapi import Form, File, UploadFile
from company.training.training import is_training_session
from session_data import session_metadata
import time
from main import get_agent_response_with_training
from company.storage.storage import store_message_in_history_helper
from audio.audio import synthesize_audio_response
from main import supabase


async def voice_agent_text_helper(session_id: str = Form(...), user_text: str = Form(...)):
    """
    Voice agent endpoint that accepts transcribed text instead of audio.
    This integrates with the existing LLM and ElevenLabs workflow.
    """
    try:
        print(f"🎤 Voice agent (text) called for session: {session_id}")
        
        # Check if this is a training session - if so, don't process here
        if is_training_session(session_id):
            print(f"⚠️ Training session detected: {session_id}. Use /training/respond endpoint instead.")
            return {"error": "This is a training session. Use the /training/respond endpoint instead.", "hasAudioResponse": False, "audioLength": 0, "hasTextResponse": False, "textResponse": "", "audio": None}
        
        print(f"📝 Received text: {user_text[:100]}...")
        
        # Log voice processing for audit trail
        session_metadata_info = session_metadata.get(session_id, {})
        print(f"👤 Session metadata: {session_metadata_info}")
        company_id = session_metadata_info.get("company_id")
        user_id = session_metadata_info.get("user_id")  # Extract user_id from session
        
        print(f"👤 Session metadata: user_id={user_id}, company_id={company_id}")
        
        # If session metadata is empty, try to create the session
        if not session_metadata_info:
            print(f"⚠️ No session metadata found, attempting to create session")
            from manage_twilio.calls import create_or_get_session
            # Try to extract company_id and user_id from session_id or use defaults
            # For now, use default values - this should be improved
            company_id = "default"
            user_id = None
            actual_session_id = create_or_get_session(company_id, "voice", session_id, user_id=user_id)
            print(f"👤 Created session with ID: {actual_session_id}")
            # Update metadata
            session_metadata_info = session_metadata.get(actual_session_id, {})
            user_id = session_metadata_info.get("user_id")
            company_id = session_metadata_info.get("company_id", "default")
            print(f"👤 Updated session metadata: user_id={user_id}, company_id={company_id}")
        
        # If we still don't have a valid company_id, try to find it from the session
        if not company_id or company_id == "default":
            # Check if the session_id itself is a valid UUID and might be a company_id
            import re
            uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
            if uuid_pattern.match(session_id):
                # The session_id might actually be a company_id
                company_id = session_id
                print(f"👤 Using session_id as company_id: {company_id}")
            else:
                # Try to get company_id from the session metadata using the original session_id
                original_session_metadata = session_metadata.get(session_id, {})
                if original_session_metadata:
                    company_id = original_session_metadata.get("company_id")
                    user_id = original_session_metadata.get("user_id")
                    print(f"👤 Found original session metadata: company_id={company_id}, user_id={user_id}")
        
        # If we still don't have a valid company_id, try to find it from the database
        if not company_id or company_id == "default":
            try:
                # Try to find the session in the database
                from main import supabase
                session_result = supabase.table("session_summaries").select("company_id").eq("session_id", session_id).execute()
                if session_result.data:
                    company_id = session_result.data[0]["company_id"]
                    print(f"👤 Found company_id from database: {company_id}")
            except Exception as e:
                print(f"⚠️ Error finding company_id from database: {e}")
        
        # Final fallback - use a default company_id
        if not company_id or company_id == "default":
            company_id = "81fa9a0b-7be0-485a-a8a5-6003b2cceace"  # Use a known company_id
            print(f"👤 Using fallback company_id: {company_id}")
        
        print(f"👤 Final session metadata: user_id={user_id}, company_id={company_id}")
        
        # Check credits before processing
        if user_id:
            try:
                from credits_helper import get_user_credits
                user_credits = await get_user_credits(user_id)
                if user_credits and user_credits.get("credits_balance", 0) <= 0:
                    print(f"❌ Insufficient credits for user {user_id}. Cannot process voice request.")
                    return {
                        "error": "insufficient_credits", 
                        "message": "No credits available. Please purchase credits to continue.",
                        "hasAudioResponse": False, 
                        "audioLength": 0, 
                        "hasTextResponse": False, 
                        "textResponse": "", 
                        "audio": None
                    }
            except Exception as e:
                print(f"⚠️ Error checking credits: {e}")
                # Continue processing even if credit check fails
        
        if not user_text or user_text.strip() == "":
            print(f"❌ No text provided")
            return {"error": "No text provided", "hasAudioResponse": False, "audioLength": 0, "hasTextResponse": False, "textResponse": "", "audio": None}
        
        # Get response with training data
        print(f"🤖 Getting response with training data")
        start_time = time.time()
        response = await get_agent_response_with_training(session_id, user_text, user_id=user_id, company_id=company_id)
        end_time = time.time()
        print(f"⏱️ get_agent_response_with_training took {end_time - start_time} seconds")
        print(f"🤖 Response: {response[:100]}...")

        # Synthesize audio response immediately
        print(f"🔊 Synthesizing audio response with user_id={user_id}, company_id={company_id}, session_id={session_id}")
        start_time = time.time()
        try:
            from main import supabase
            language_code = supabase.table("companies").select("language").eq("company_id", company_id).execute().data[0]["language"]
        except Exception as e:
            print(f"⚠️ Error getting language code, using default: {e}")
            language_code = "es"  # Default to Spanish
        model = "deepgram_aura_v2"
        # If streaming TTS is active for this session, skip REST TTS to avoid double audio and billing
        if session_metadata_info.get("tts_stream_active"):
            print("🔇 Streaming TTS active; skipping REST TTS synthesis")
            audio_response = ""
        else:
            from audio.audio import choose_model_for_tts
            audio_response = await choose_model_for_tts(model, response, language_code, user_id, company_id, session_id)
        end_time = time.time()
        print(f"⏱️ synthesize_audio_response took {end_time - start_time} seconds")
        print(f"🎵 Audio response length: {len(audio_response)} chars")

        # Store messages in background (non-blocking)
        async def store_messages_background():
            try:
                start_time = time.time()
                await store_message_in_history_helper(company_id, session_id, "user", user_text)
                await store_message_in_history_helper(company_id, session_id, "bot", response)
                end_time = time.time()
                print(f"⏱️ Storing messages took {end_time - start_time} seconds")
            except Exception as e:
                print(f"⚠️ Background message storage failed: {e}")
        
        # Start background task (don't await it)
        import asyncio
        asyncio.create_task(store_messages_background())
        
        result = {
            "hasAudioResponse": True if audio_response else False,
            "audioLength": len(audio_response) if audio_response else 0,
            "hasTextResponse": True if response else False,
            "textResponse": response,
            "audio": audio_response
        }
        print(f"✅ SUCCESS: Returning response with audioLength={len(audio_response) if audio_response else 0}")
        return result
        
    except Exception as e:
        print(f"❌ Error in voice_agent_text: {e}")
        import traceback
        traceback.print_exc()
        error_result = {"error": str(e), "hasAudioResponse": False, "audioLength": 0, "hasTextResponse": False, "textResponse": "", "audio": None}
        print(f"❌ ERROR: Returning empty response due to exception: {str(e)}")
        return error_result 