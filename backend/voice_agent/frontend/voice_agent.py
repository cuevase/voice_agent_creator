from fastapi import Form, File, UploadFile
from company.training.training import is_training_session
from session_data import session_metadata
import time
from main import get_agent_response_with_training
from company.storage.storage import store_message_in_history_helper
from audio.audio import transcribe_audio_file, synthesize_audio_response
from main import supabase


async def voice_agent_helper(session_id: str = Form(...), audio: UploadFile = File(...)):
    try:
        
        # Check if this is a training session - if so, don't process here
        if is_training_session(session_id):
            print(f"⚠️ Training session detected: {session_id}. Use /training/respond endpoint instead.")
            return {"error": "This is a training session. Use the /training/respond endpoint instead.", "text": "", "audio": None}
        
        audio_bytes = await audio.read()
        
        # Log voice processing for audit trail
        session_metadata_info = session_metadata.get(session_id, {})
        company_id = session_metadata_info.get("company_id", "default")
        user_id = session_metadata_info.get("user_id")  # Extract user_id from session
        
        
        # Log data processing
        
        
        #Count time of every function call and record
        start_time = time.time()
        user_text = transcribe_audio_file(audio_bytes, user_id=user_id, company_id=company_id, session_id=session_id)
        end_time = time.time()
        language_code = supabase.table("companies").select("language").eq("company_id", company_id).execute().data[0]["language"]
        

        if not user_text or user_text.strip() == "":
            print(f"❌ No transcription result")
            return {"error": "No se pudo transcribir el audio", "text": "", "audio": None}
        

        # Get response with training data
        start_time = time.time()
        response = await get_agent_response_with_training(session_id, user_text, user_id=user_id, company_id=company_id)
        end_time = time.time()

        # Store in conversation history
        start_time = time.time()
        await store_message_in_history_helper(company_id, session_id, "user", user_text)
        await store_message_in_history_helper(company_id, session_id, "bot", response)
        end_time = time.time()

        # Synthesize audio response
        start_time = time.time()
        model = "deepgram_aura_v2"
        from audio.audio import choose_model_for_tts
        print("🔊 CHOOSING MODEL FOR TTS")
        audio_response = choose_model_for_tts(model, response, language_code, user_id, company_id, session_id)
        end_time = time.time()
        
        return {
            "text": response,
            "audio": audio_response
        }
        
    except Exception as e:
        print(f"❌ Error in voice_agent: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "text": "", "audio": None}