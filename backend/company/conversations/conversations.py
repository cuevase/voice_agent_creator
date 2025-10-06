from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from fastapi import HTTPException
from datetime import datetime
from openai import OpenAI
from session_data import session_metadata
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def get_conversation_history(
    session_id: str = None,
    company_id: str = None,
    limit: int = 50,
    offset: int = 0
):
    """Retrieve conversation history with optional filters"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        query = supabase.table("conversation_history").select("*")
        
        # Apply filters
        if session_id:
            query = query.eq("session_id", session_id)
        if company_id:
            query = query.eq("company_id", company_id)
        
        # Order by timestamp and apply pagination
        result = (query
                 .order("timestamp", desc=False)
                 .range(offset, offset + limit - 1)
                 .execute())
        
        return result.data or []
        
    except Exception as e:
        print(f"❌ Error retrieving conversation history: {e}")
        return []

async def get_session_summary(session_id: str):
    """Get summary statistics for a session"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        # Get all messages for session
        messages = await get_conversation_history(session_id=session_id, limit=1000)
        
        if not messages:
            return None
        
        # Calculate summary
        user_messages = [m for m in messages if m["message_type"] == "user"]
        bot_messages = [m for m in messages if m["message_type"] == "bot"]
        
        # Get session metadata
        session_info = session_metadata.get(session_id, {})
        
        summary = {
            "session_id": session_id,
            "company_id": messages[0]["company_id"] if messages else None,
            "total_messages": len(messages),
            "user_messages": len(user_messages),
            "bot_messages": len(bot_messages),
            "start_time": messages[0]["timestamp"] if messages else None,
            "end_time": messages[-1]["timestamp"] if messages else None,
            "session_type": session_info.get("type", "unknown"),
            "last_activity": messages[-1]["timestamp"] if messages else None
        }
        
        return summary
        
    except Exception as e:
        print(f"❌ Error getting session summary: {e}")
        return None

async def get_session_statistics(session_id: str) -> dict:
    """Get detailed statistics for a specific session"""
    try:
        if not supabase:
            return {}
        
        # Get message count and types
        result = supabase.table("conversation_history").select("message_type, timestamp").eq("session_id", session_id).execute()
        
        if not result.data:
            return {}
        
        user_messages = [msg for msg in result.data if msg['message_type'] == 'user']
        bot_messages = [msg for msg in result.data if msg['message_type'] == 'bot']
        
        # Get session duration
        timestamps = [msg['timestamp'] for msg in result.data]
        if timestamps:
            from datetime import datetime
            start_time = min(timestamps)
            end_time = max(timestamps)
            
            # Calculate duration
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
            except:
                duration_minutes = 0
        else:
            duration_minutes = 0
        
        return {
            "total_messages": len(result.data),
            "user_messages": len(user_messages),
            "bot_messages": len(bot_messages),
            "duration_minutes": duration_minutes,
            "start_time": min(timestamps) if timestamps else None,
            "end_time": max(timestamps) if timestamps else None
        }
        
    except Exception as e:
        print(f"❌ Error getting session statistics: {e}")
        return {}

async def cleanup_old_conversations(days_to_keep: int = 30):
    """Clean up old conversation history"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        from datetime import datetime, timedelta
        cutoff_date = (datetime.utcnow() - timedelta(days=days_to_keep)).isoformat()
        
        # Delete old messages
        result = supabase.table("conversation_history").delete().lt("timestamp", cutoff_date).execute()
        
        print(f"🧹 Cleaned up {len(result.data) if result.data else 0} old messages")
        return result.data
        
    except Exception as e:
        print(f"❌ Error cleaning up conversations: {e}")
        return None
    
async def generate_conversation_summary(session_id: str, company_id: str) -> str:
    """Generate an AI summary of a conversation using OpenAI"""
    try:
        if not os.getenv("OPENAI_API_KEY"):
            print("⚠️ OPENAI_API_KEY not found, skipping summary generation")
            return "Summary not available (OpenAI API key not configured)"
        
        # Get conversation messages
        messages_result = supabase.table("conversation_history").select("*").eq("session_id", session_id).order("timestamp").execute()
        
        if not messages_result.data:
            return "No messages found for this session"
        
        # Format conversation for OpenAI
        conversation_text = ""
        for msg in messages_result.data:
            role = "Usuario" if msg['message_type'] == 'user' else "Asistente"
            conversation_text += f"{role}: {msg['content']}\n\n"
        
        # Get company info for context
        company_result = supabase.table("companies").select("company_name").eq("company_id", company_id).execute()
        company_name = company_result.data[0]['company_name'] if company_result.data else "la empresa"
        
        # Create OpenAI prompt
        prompt = f"""
        Eres un asistente experto en resumir conversaciones. Analiza la siguiente conversación entre un cliente y el asistente de {company_name} y crea un resumen conciso en español que incluya:

        1. **Objetivo principal del cliente**: ¿Qué quería lograr o resolver?
        2. **Problemas o preguntas específicas**: ¿Qué problemas mencionó o qué preguntas hizo?
        3. **Soluciones proporcionadas**: ¿Qué ayuda o información recibió?
        4. **Resultado final**: ¿Se resolvió su consulta? ¿Quedó pendiente algo?
        5. **Notas importantes**: Cualquier detalle relevante para seguimiento

        Mantén el resumen profesional pero conversacional, en español, y máximo 3-4 oraciones.

        Conversación:
        {conversation_text}
        """
        
        # Call OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un experto en resumir conversaciones de atención al cliente en español."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        summary = response.choices[0].message.content.strip()
        print(f"🤖 Generated conversation summary for session {session_id}")
        return summary
        
    except Exception as e:
        print(f"❌ Error generating conversation summary: {e}")
        return f"Error generando resumen: {str(e)}"

async def update_session_summary_with_ai(session_id: str, company_id: str):
    """Update session summary with AI-generated summary"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        # Generate AI summary
        ai_summary = await generate_conversation_summary(session_id, company_id)
        
        # Update the session_summaries table
        supabase.table("session_summaries").update({
            "summary": ai_summary,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("session_id", session_id).execute()
        
        print(f"💾 Updated session summary with AI-generated content for session {session_id}")
        return ai_summary
        
    except Exception as e:
        print(f"❌ Error updating session summary: {e}")
        return None

#---------Endpoints---------

async def get_conversation_history_helper(session_id: str, company_id: str, limit: int = 50, offset: int = 0):
    """Get conversation history with optional filters"""
    try:
        messages = await get_conversation_history(
            session_id=session_id,
            company_id=company_id,
            limit=limit,
            offset=offset
        )
        
        return {
            "messages": messages,
            "total": len(messages),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        print(f"❌ Error in conversation history endpoint: {e}")
        raise HTTPException(500, f"Failed to retrieve conversation history: {str(e)}")
    

async def get_session_summary_helper(session_id: str):
    """Get summary statistics for a specific session with AI-generated summary"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get session summary from the session_summaries table
        result = supabase.table("session_summaries").select("*").eq("session_id", session_id).execute()
        
        if not result.data:
            # If no summary exists, try to get basic summary
            summary = await get_session_summary(session_id)
            if not summary:
                raise HTTPException(404, "Session not found")
            return summary
        
        summary_data = result.data[0]
        company_id = summary_data.get('company_id')
        
        # If no AI summary exists, generate one
        if not summary_data.get('summary') and company_id:
            ai_summary = await update_session_summary_with_ai(session_id, company_id)
            if ai_summary:
                summary_data['summary'] = ai_summary
        
        return {
            "session_id": session_id,
            "summary": summary_data,
            "message": "Session summary retrieved successfully"
        }
        
    except Exception as e:
        print(f"❌ Error in session summary endpoint: {e}")
        raise HTTPException(500, f"Failed to get session summary: {str(e)}")
    

async def get_company_sessions_helper(company_id: str, limit: int = 20, offset: int = 0, include_summaries: bool = False):
    """Get all sessions for a company with optional AI-generated summaries"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get unique session IDs for this company
        result = (supabase.table("conversation_history")
                 .select("session_id, timestamp")
                 .eq("company_id", company_id)
                 .order("timestamp", desc=True)
                 .execute())
        
        # Group by session_id and get latest timestamp for each
        sessions = {}
        for row in result.data:
            session_id = row["session_id"]
            if session_id not in sessions or row["timestamp"] > sessions[session_id]["last_activity"]:
                sessions[session_id] = {
                    "session_id": session_id,
                    "last_activity": row["timestamp"]
                }
        
        # Convert to list and apply pagination
        session_list = list(sessions.values())
        paginated_sessions = session_list[offset:offset + limit]
        
        # If summaries are requested, add them to each session
        if include_summaries:
            print(f"🤖 Generating summaries for {len(paginated_sessions)} sessions...")
            
            for session in paginated_sessions:
                session_id = session["session_id"]
                
                # Get session statistics
                stats = await get_session_statistics(session_id)
                session["statistics"] = stats
                
                # Try to get existing summary from session_summaries table
                summary_result = supabase.table("session_summaries").select("summary").eq("session_id", session_id).execute()
                
                if summary_result.data and summary_result.data[0].get('summary'):
                    # Use existing summary
                    session["summary"] = summary_result.data[0]['summary']
                    session["summary_source"] = "existing"
                else:
                    # Generate new summary
                    try:
                        ai_summary = await generate_conversation_summary(session_id, company_id)
                        session["summary"] = ai_summary
                        session["summary_source"] = "generated"
                        
                        # Store the generated summary in session_summaries table
                        try:
                            supabase.table("session_summaries").upsert({
                                "session_id": session_id,
                                "company_id": company_id,
                                "summary": ai_summary,
                                "updated_at": session["last_activity"]
                            }).execute()
                        except Exception as e:
                            print(f"⚠️ Could not store summary for session {session_id}: {e}")
                            
                    except Exception as e:
                        print(f"⚠️ Could not generate summary for session {session_id}: {e}")
                        session["summary"] = "Summary not available"
                        session["summary_source"] = "error"
        
        return {
            "sessions": paginated_sessions,
            "total": len(session_list),
            "limit": limit,
            "offset": offset,
            "include_summaries": include_summaries
        }
        
    except Exception as e:
        print(f"❌ Error in company sessions endpoint: {e}")
        raise HTTPException(500, f"Failed to get company sessions: {str(e)}")


async def cleanup_conversations_endpoint(days_to_keep: int = 30):
    """Clean up old conversation history (admin only)"""
    try:
        result = await cleanup_old_conversations(days_to_keep)
        
        return {
            "message": f"Cleaned up conversations older than {days_to_keep} days",
            "deleted_count": len(result) if result else 0
        }
        
    except Exception as e:
        print(f"❌ Error in cleanup endpoint: {e}")
        raise HTTPException(500, f"Failed to cleanup conversations: {str(e)}")


async def generate_session_summary_helper(session_id: str):
        
    """Manually trigger AI summary generation for a session"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get session info to find company_id
        session_result = supabase.table("session_summaries").select("company_id").eq("session_id", session_id).execute()
        
        if not session_result.data:
            # Try to get from conversation_history
            history_result = supabase.table("conversation_history").select("company_id").eq("session_id", session_id).limit(1).execute()
            if not history_result.data:
                raise HTTPException(404, "Session not found")
            company_id = history_result.data[0]['company_id']
        else:
            company_id = session_result.data[0]['company_id']
        
        # Generate AI summary
        ai_summary = await update_session_summary_with_ai(session_id, company_id)
        
        if ai_summary:
            return {
                "session_id": session_id,
                "summary": ai_summary,
                "message": "AI summary generated successfully"
            }
        else:
            raise HTTPException(500, "Failed to generate AI summary")
        
    except Exception as e:
        print(f"❌ Error generating session summary: {e}")
        raise HTTPException(500, f"Failed to generate session summary: {str(e)}")