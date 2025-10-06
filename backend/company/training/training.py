from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from pydantic import BaseModel
from authentication.authentication import get_current_user
from typing import Optional

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

class TrainingSessionCreate(BaseModel):
    """Model for creating a training session"""
    company_id: str
    session_name: str

class TrainingMessageCreate(BaseModel):
    """Model for creating a training message"""
    training_session_id: str
    message_type: str  # 'user' or 'agent'
    content: str

def is_training_session(session_id: str) -> bool:
    """Check if a session_id corresponds to a training session"""
    try:
        if not supabase:
            return False
        
        # Check if this session_id exists in training_sessions table
        result = supabase.table("training_sessions").select("id").eq("id", session_id).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"❌ Error checking if session is training session: {e}")
        return False

async def create_training_session_helper(session: TrainingSessionCreate, current_user: Optional[str] = Depends(get_current_user)):
    """Create a new training session for a company"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Verify user owns the company
        if current_user:
            company_check = supabase.table("companies").select("company_id").eq("company_id", session.company_id).eq("user_id", current_user).execute()
            if not company_check.data:
                raise HTTPException(403, "You don't own this company")
        
        # Create training session
        result = supabase.table("training_sessions").insert({
            "company_id": session.company_id,
            "session_name": session.session_name
        }).execute()
        
        if not result.data:
            raise HTTPException(500, "Failed to create training session")
        
        return {
            "success": True,
            "session_id": result.data[0]["id"],
            "message": "Training session created successfully"
        }
        
    except Exception as e:
        print(f"❌ Error creating training session: {e}")
        raise HTTPException(500, f"Error creating training session: {str(e)}")
    
async def add_training_message_helper(message: TrainingMessageCreate, current_user: Optional[str] = Depends(get_current_user)):
    """Add a training message to a training session"""
    """Add a message to a training session"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get the training session to verify ownership
        session_result = supabase.table("training_sessions").select("*, companies!inner(user_id)").eq("id", message.training_session_id).execute()
        
        if not session_result.data:
            raise HTTPException(404, "Training session not found")
        
        # Verify user owns the company
        if current_user:
            company_user_id = session_result.data[0]["companies"]["user_id"]
            if company_user_id != current_user:
                raise HTTPException(403, "You don't own this training session")
        
        # Check for duplicate message (same content, same session, same type)
        duplicate_check = supabase.table("training_messages").select("id").eq("training_session_id", message.training_session_id).eq("content", message.content).eq("message_type", message.message_type).execute()
        
        if duplicate_check.data:
            print(f"⚠️ Duplicate training message detected and skipped: {message.content[:50]}...")
            return {
                "success": True,
                "message_id": duplicate_check.data[0]["id"],
                "message": "Training message already exists (duplicate skipped)",
                "duplicate_skipped": True
            }
        
        # Get current message count for ordering
        message_count_result = supabase.table("training_messages").select("message_order").eq("training_session_id", message.training_session_id).execute()
        next_order = len(message_count_result.data) + 1
        
        print(f"✅ Adding new training message: {message.content[:50]}...")
        
        # Add the message
        result = supabase.table("training_messages").insert({
            "training_session_id": message.training_session_id,
            "message_type": message.message_type,
            "content": message.content,
            "message_order": next_order
        }).execute()
        
        if not result.data:
            raise HTTPException(500, "Failed to add training message")
        
        # Update session message count
        supabase.table("training_sessions").update({
            "total_messages": next_order,
            "last_training_date": "now()"
        }).eq("id", message.training_session_id).execute()
        
        return {
            "success": True,
            "message_id": result.data[0]["id"],
            "message": "Training message added successfully"
        }
        
    except Exception as e:
        print(f"❌ Error adding training message: {e}")
        raise HTTPException(500, f"Error adding training message: {str(e)}")
    

async def get_training_sessions_helper(company_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get all training sessions for a company"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Verify user owns the company
        if current_user:
            company_check = supabase.table("companies").select("company_id").eq("company_id", company_id).eq("user_id", current_user).execute()
            if not company_check.data:
                raise HTTPException(403, "You don't own this company")
        
        # Get training sessions
        result = supabase.table("training_sessions").select("*").eq("company_id", company_id).order("created_at", desc=True).execute()
        
        return {
            "success": True,
            "sessions": result.data
        }
        
    except Exception as e:
        print(f"❌ Error getting training sessions: {e}")
        raise HTTPException(500, f"Error getting training sessions: {str(e)}")
    

async def get_training_messages_helper(session_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get all messages from a training session"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get the training session to verify ownership
        session_result = supabase.table("training_sessions").select("*, companies!inner(user_id)").eq("id", session_id).execute()
        
        if not session_result.data:
            raise HTTPException(404, "Training session not found")
        
        # Verify user owns the company
        if current_user:
            company_user_id = session_result.data[0]["companies"]["user_id"]
            if company_user_id != current_user:
                raise HTTPException(403, "You don't own this training session")
        
        # Get messages
        result = supabase.table("training_messages").select("*").eq("training_session_id", session_id).order("message_order").execute()
        
        return {
            "success": True,
            "messages": result.data
        }
        
    except Exception as e:
        print(f"❌ Error getting training messages: {e}")
        raise HTTPException(500, f"Error getting training messages: {str(e)}")
    

async def get_training_response_helper(session_id: str, user_message: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get a pre-set response for training mode (no LLM cost)"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get the training session to verify ownership
        session_result = supabase.table("training_sessions").select("*, companies!inner(user_id)").eq("id", session_id).execute()
        
        if not session_result.data:
            raise HTTPException(404, "Training session not found")
        
        # Verify user owns the company
        if current_user:
            company_user_id = session_result.data[0]["companies"]["user_id"]
            if company_user_id != current_user:
                raise HTTPException(403, "You don't own this training session")
        
        # Get a random training response
        response_result = supabase.rpc("get_random_training_response", {"response_category": "general"}).execute()
        
        
        # Define fallback responses if database is empty
        fallback_responses = [
            "Got it",
            "Understood",
            "Noted",
            "I see",
            "Right",
            "Okay",
            "Sure",
            "Yes",
            "Mhm",
            "Uh-huh"
        ]
        
        if not response_result.data or response_result.data is None:
            # Use a random fallback response
            import random
            response = random.choice(fallback_responses)
            print(f"⚠️ Using fallback response: {response}")
        else:
            response = response_result.data
            print(f"✅ Using database response: {response}")
        
        # Check for duplicate user message
        user_duplicate_check = supabase.table("training_messages").select("id").eq("training_session_id", session_id).eq("content", user_message).eq("message_type", "user").execute()
        
        if user_duplicate_check.data:
            print(f"⚠️ Duplicate user message detected and skipped: {user_message[:50]}...")
            # Still add the agent response if it doesn't exist
            agent_duplicate_check = supabase.table("training_messages").select("id").eq("training_session_id", session_id).eq("content", response).eq("message_type", "agent").execute()
            
            if not agent_duplicate_check.data:
                # Add only the agent response
                message_count_result = supabase.table("training_messages").select("message_order").eq("training_session_id", session_id).execute()
                next_order = len(message_count_result.data) + 1
                
                supabase.table("training_messages").insert({
                    "training_session_id": session_id,
                    "message_type": "agent",
                    "content": response,
                    "message_order": next_order
                }).execute()
                print(f"✅ Added agent response only: {response[:50]}...")
            else:
                print(f"⚠️ Both user and agent messages already exist, skipping both")
            
            return {
                "success": True,
                "response": response,
                "message": "Training response generated (duplicates skipped)",
                "duplicate_skipped": True
            }
        
        # Store the user message
        message_count_result = supabase.table("training_messages").select("message_order").eq("training_session_id", session_id).execute()
        next_order = len(message_count_result.data) + 1
        
        print(f"✅ Adding new user message: {user_message[:50]}...")
        
        # Add user message to training_messages table ONLY
        supabase.table("training_messages").insert({
            "training_session_id": session_id,
            "message_type": "user",
            "content": user_message,
            "message_order": next_order
        }).execute()
        
        print(f"✅ Adding new agent response: {response[:50]}...")
        
        # Add agent response to training_messages table ONLY
        supabase.table("training_messages").insert({
            "training_session_id": session_id,
            "message_type": "agent",
            "content": response,
            "message_order": next_order + 1
        }).execute()
        
        print(f"✅ Training messages stored in training_messages table only (not conversation_history)")
        
        # Update session
        supabase.table("training_sessions").update({
            "total_messages": next_order + 1,
            "last_training_date": "now()"
        }).eq("id", session_id).execute()
        
        return {
            "success": True,
            "response": response,
            "message": "Training response generated"
        }
        
    except Exception as e:
        print(f"❌ Error getting training response: {e}")
        raise HTTPException(500, f"Error getting training response: {str(e)}")
    
async def get_system_prompt_helper(company_id: str):
    """Get the system prompt for a company"""
    try:
        # Get base system prompt
        base_prompt = get_system_prompt(company_id)
        
        # Get training data from database
        if supabase:
            training_result = supabase.rpc("get_company_training_data", {"company_uuid": company_id}).execute()
            
            # Handle different response formats
            training_data = None
            if hasattr(training_result, 'data'):
                if isinstance(training_result.data, list) and len(training_result.data) > 0:
                    training_data = training_result.data[0]
                elif isinstance(training_result.data, str):
                    training_data = training_result.data
                elif hasattr(training_result.data, '__getitem__'):
                    # Try to get the first item if it's indexable
                    try:
                        training_data = training_result.data[0]
                    except (IndexError, TypeError):
                        pass
            
            
            if training_data and training_data.strip():
                # Inject training data into the prompt
                enhanced_prompt = base_prompt + "\n\n" + "=== TRAINING DATA ===\n" + training_data + "\n\n" + "Based on the training data above, respond appropriately to user queries."
                return enhanced_prompt
            else:
                # Try alternative approach - query training data directly
                try:
                    # Get training sessions
                    sessions_result = supabase.table("training_sessions").select("id, session_name").eq("company_id", company_id).eq("is_active", True).execute()
                    
                    if sessions_result.data:
                        training_text = ""
                        for session in sessions_result.data:
                            # Get messages for this session
                            messages_result = supabase.table("training_messages").select("message_type, content").eq("training_session_id", session["id"]).order("message_order").execute()
                            print(f"messages_result for session {session['id']}:", messages_result)
                            
                            if messages_result.data:
                                training_text += f"\n\n--- Training Session: {session['session_name']} ---\n"
                                for msg in messages_result.data:
                                    training_text += f"{msg['message_type']}: {msg['content']}\n"
                        
                        if training_text.strip():
                            print("✅ Found training data via direct query")
                            enhanced_prompt = base_prompt + "\n\n" + "=== TRAINING DATA ===\n" + training_text + "\n\n" + "Based on the training data above, respond appropriately to user queries."
                            return enhanced_prompt
                except Exception as e:
                    print(f"❌ Alternative approach failed: {e}")
        
        return base_prompt
        
    except Exception as e:
        print(f"❌ Error getting system prompt with training: {e}")
        return get_system_prompt(company_id)  # Fallback to base prompt
        