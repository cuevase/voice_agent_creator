from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from company.conversations.conversations import update_session_summary_with_ai

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)


async def store_message_in_history_helper(company_id: str, session_id: str, message_type: str, content: str, metadata: dict = None):
    """Store a single message in conversation history"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        # Get current timestamp
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat()
        
        # Generate UUID for the id column
        import uuid
        message_id = str(uuid.uuid4())
        
        # Prepare message data
        message_data = {
            "id": message_id,  # Explicitly set the UUID
            "session_id": session_id,
            "company_id": company_id,
            "message_type": message_type,  # 'user' or 'bot'
            "content": content,
            "timestamp": timestamp,
            "metadata": metadata or {}
        }
        
        # Insert into conversation_history table
        result = supabase.table("conversation_history").insert(message_data).execute()
        
        
        # Check if we should generate AI summary (after 5+ messages or when user says goodbye)
        if message_type == "user":
            # Count total messages for this session
            count_result = supabase.table("conversation_history").select("id", count="exact").eq("session_id", session_id).execute()
            total_messages = count_result.count if hasattr(count_result, 'count') else len(count_result.data or [])
            
            # Generate summary if conversation seems to be ending or has enough messages
            goodbye_indicators = ["adiós", "hasta luego", "gracias", "chao", "bye", "goodbye", "nos vemos"]
            is_goodbye = any(indicator in content.lower() for indicator in goodbye_indicators)
            
            if is_goodbye or total_messages >= 8:
                # Generate AI summary in background
                try:
                    await update_session_summary_with_ai(session_id, company_id)
                except Exception as summary_error:
                    print(f"⚠️ Error generating summary: {summary_error}")
        
        return result.data[0] if result.data else None
        
    except Exception as e:
        print(f"❌ Error storing message: {e}")
        return None
