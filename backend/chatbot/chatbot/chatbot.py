from fastapi import HTTPException
from supabase import create_client, Client
import os   
from dotenv import load_dotenv
import uuid
import google.generativeai as genai
from tools import get_system_prompt, search_company_documents, format_rag_context, get_company_documents_from_storage
from session_data import session_metadata
from company.storage.storage import store_message_in_history_helper
from manage_tools.manage_tools import dispatch_tool_with_router
from audio.audio import convert_api_response_to_natural_language
from session_data import sessions, session_metadata
from company.training.training import is_training_session
import re
from datetime import datetime
from manage_tools.manage_tools import ToolRouter

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def initialize_gemini_model_async():
    """Initialize the Gemini model for the chatbot."""
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-exp',  # Use the working model
            generation_config={
                "max_output_tokens": 300,  # Limit to ~150-200 words
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40
            }
        )
        print("✅ Gemini model initialized.")
        return model
    except Exception as e:
        print(f"❌ Error initializing Gemini model: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, "Failed to initialize Gemini model.")

async def get_system_prompt_with_training(company_id: str):
    """Get the system prompt for the company, incorporating training data if available."""
    try:
        print(f"💬 Fetching system prompt for company {company_id} with training data...")
        system_prompt = get_system_prompt(company_id)
        
        # If training session is active, append training data
        if is_training_session(company_id):
            training_data = supabase.table("training_data").select("*").eq("company_id", company_id).execute()
            if training_data.data:
                training_prompts = [item["prompt"] for item in training_data.data]
                if training_prompts:
                    system_prompt += "\n\nTraining Data:\n" + "\n".join(training_prompts)
                    print(f"   Training data appended to system prompt.")
                else:
                    print(f"   No training data found for company {company_id}.")
            else:
                print(f"   No training data found for company {company_id}.")
        else:
            print(f"   No training session active for company {company_id}.")

        print(f"💬 System prompt for company {company_id}:")
        print(f"   '{system_prompt[:100]}{'...' if len(system_prompt) > 100 else ''}'")
        return system_prompt
    except Exception as e:
        print(f"❌ Error fetching system prompt with training: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to get system prompt with training: {str(e)}")

async def chatbot_start_session_helper(company_id: str, mode: str = "text", user_id: str = None):
    """Start a new chat session for a company"""
    try:
        session_id = str(uuid.uuid4())
        
        # Create basic session metadata immediately
        sessions[session_id] = None  # Placeholder
        session_metadata[session_id] = {
            "company_id": company_id,
            "user_id": user_id,
            "mode": mode,
            "created_at": datetime.utcnow().isoformat()
        }
        
        print(f"✅ Created session: {session_id} with user_id: {user_id}")
        
        # Pre-warm the chat session in the background (non-blocking)
        async def pre_warm_background():
            try:
                from agent.agent import pre_warm_chat_session
                await pre_warm_chat_session(session_id, company_id, user_id)
            except Exception as e:
                print(f"❌ Error in background pre-warming: {e}")
        
        # Start pre-warming in background (don't await)
        import asyncio
        asyncio.create_task(pre_warm_background())
        
        return {"session_id": session_id}
        
    except Exception as e:
        print(f"❌ Error in start_chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to start chat session: {str(e)}")



async def chatbot_send_message_helper(session_id: str, message: str):
    """Send a text message to the AI agent"""
    chat_session = sessions.get(session_id)
    if not chat_session:
        raise HTTPException(404, "Chat session not found")
    
    print("effectively hereeeeeeee")
    
    # Get company_id from session metadata
    session_info = session_metadata.get(session_id, {})
    company_id = session_info.get("company_id", "default")
    
    # Store user message in history
    await store_message_in_history_helper(
        session_id=session_id,
        company_id=company_id,
        message_type="user",
        content=message,
        metadata={"input_type": "text"}
    )
    
    # Perform RAG search for relevant company information
    search_results = await search_company_documents(company_id, message)
    
    if search_results:
        print(f"🔍 Found {len(search_results)} relevant documents for text query")
        rag_context = format_rag_context(message, search_results)
        enhanced_query = f"Company ID: {company_id}\n\nUser Question: {message}\n\n{rag_context}"
    else:
        print(f"🔍 No relevant documents found for text query")
        # Fallback: Get company documents from storage
        company_docs = get_company_documents_from_storage(company_id)
        if company_docs:
            enhanced_query = f"Company ID: {company_id}\n\nUser Question: {message}\n\nCompany Documents:\n{company_docs}"
            print(f"📄 Enhanced query with company documents from storage")
        else:
            enhanced_query = f"Company ID: {company_id}\n\nUser Question: {message}"
            print(f"📄 No company documents available, using original query with company context")
    
    # Handle response using the same approach as get_agent_response
    try:
        response = chat_session.send_message(enhanced_query)
        
        # Check for finish_reason error
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:  # 1 = STOP
                print(f"⚠️ Warning: finish_reason = {candidate.finish_reason}")
                if candidate.finish_reason == 12:
                    print(f"❌ Tool schema error detected")
                    return {"response": "I'm having trouble with the tool configuration. Please try again later."}
        
        # Safely collect only text parts - avoid .text entirely
        response_text = ""
        parts = getattr(response, "parts", [])
        
        for part in parts:
            if hasattr(part, 'text') and part.text:
                response_text += part.text + " "
            elif hasattr(part, 'function_call'):
                # For function calls, actually execute them
                fc = part.function_call
                name = getattr(fc, 'name', 'unknown_function')
                args = getattr(fc, 'args', {})
                
                print(f"🔧 Function call details:")
                print(f"   Name: '{name}'")
                print(f"   Args type: {type(args)}")
                print(f"   Args: {args}")
                
                # Skip empty function calls
                if not name or name.strip() == "":
                    print(f"⚠️ Skipping empty function call")
                    continue
                
                print(f"🔧 Executing function: {name} with args: {args}")
                
                # Actually dispatch the tool using router
                result = await dispatch_tool_with_router(name, args, company_id, None, session_id)
                
                # Get company language for natural language conversion
                from tools import get_company_language
                language_code = get_company_language(company_id)
                
                # Convert API response to natural language
                if isinstance(result, dict):
                    natural_response = convert_api_response_to_natural_language(result, name, enhanced_query, language_code)
                else:
                    natural_response = str(result)
                response_text += natural_response + ". "
        
        if not response_text.strip():
            response_text = "He procesado tu solicitud."
        
        # Store bot response in history
        await store_message_in_history_helper(
            session_id=session_id,
            company_id=company_id,
            message_type="bot",
            content=response_text,
            metadata={"input_type": "text", "response_type": "text"}
        )
        
        return {"response": response_text}
        
    except Exception as e:
        print(f"❌ Error handling response: {e}")
        import traceback
        traceback.print_exc()
        
        # Store error response in history
        error_message = "Estoy teniendo problemas para procesar tu solicitud en este momento. Por favor, intenta de nuevo."
        await store_message_in_history_helper(
            session_id=session_id,
            company_id=company_id,
            message_type="bot",
            content=error_message,
            metadata={"input_type": "text", "response_type": "error"}
        )
        
        return {"response": error_message}