from main import session_metadata, sessions
from fastapi import HTTPException
from manage_tools.manage_tools import fetch_gemini_tools_and_router, build_gemini_tools_from_supabase, dispatch_tool_with_router
from audio.audio import convert_api_response_to_natural_language, truncate_response_for_voice
import asyncio
import time
import re
from main import initialize_gemini_model_async, get_system_prompt_with_training
from manage_tools.manage_tools import ToolRouter

# Global cache for chat sessions
chat_sessions = {}  # session_id -> chat_object
chat_session_metadata = {}  # session_id -> {company_id, system_prompt, tools}

async def get_agent_response_with_training_helper(session_id: str, user_text: str, user_id: str = None, company_id: str = None):
    """Get response from agent with training data included"""
    print(f"🔍 Looking for session: {session_id}")
    print(f"🔍 Available sessions: {list(sessions.keys())}")
    print(f"🔍 Available chat sessions: {list(chat_sessions.keys())}")
    
    session_info = sessions.get(session_id)
    if not session_info:
        print(f"❌ Session {session_id} not found in sessions dictionary")
        raise HTTPException(404, "Chat session not found")

    # Get company_id from session metadata
    session_metadata_info = session_metadata.get(session_id, {})
    company_id_from_session = session_metadata_info.get("company_id", "default")
    effective_company_id = company_id or company_id_from_session

    # Upfront balance gate (non-deducting)
    if user_id and effective_company_id:
        try:
            from credits_helper import get_user_credits
            bal_t0 = time.time()
            user_credits = await get_user_credits(user_id)
            print(f"⏱️ LLM BALANCE CHECK: {time.time() - bal_t0:.3f}s")
            if user_credits and user_credits.get("credits_balance", 0) <= 0:
                print(f"❌ LLM: Insufficient credits for user {user_id}. Blocking request.")
                raise HTTPException(402, "No credits available. Please purchase credits to continue.")
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ LLM balance check error (continuing): {e}")
    else:
        print(f"⚠️ AI CREDITS: Skipping balance check - missing user_id or company_id")
        print(f"⚠️ AI CREDITS: user_id={user_id}, company_id={effective_company_id}")

    try:
        # Check if we have a cached chat session
        if session_id in chat_sessions and chat_sessions[session_id] is not None:
            print(f"✅ Using cached chat session for {session_id}")
            chat = chat_sessions[session_id]
            tools = chat_session_metadata[session_id]["tools"]
            router = chat_session_metadata[session_id]["router"]
        else:
            print(f"⏳ Chat session not ready yet for {session_id}, creating on-demand...")
            
            # Create session on-demand if pre-warming didn't complete
            await pre_warm_chat_session(session_id, effective_company_id, user_id)
            
            # Check again after pre-warming
            if session_id in chat_sessions and chat_sessions[session_id] is not None:
                print(f"✅ Chat session created on-demand for {session_id}")
                chat = chat_sessions[session_id]
                tools = chat_session_metadata[session_id]["tools"]
                router = chat_session_metadata[session_id]["router"]
            else:
                print(f"❌ Failed to create chat session for {session_id}")
                raise HTTPException(500, "Failed to initialize chat session")

        # Send message and get response
        start_time = time.time()
        response = chat.send_message(user_text, tools=tools)
        end_time = time.time()
        print(f"🔍 Response received in {end_time - start_time:.2f} seconds")

        # Track LLM usage and deduct credits in background
        async def track_llm_usage_background():
            if user_id and effective_company_id:
                try:
                    from main import supabase
                    from credits_helper import check_and_use_credits
                    
                    bg_t0 = time.time()
                    print("🧵 LLM BG: started")
                    
                    # Extract token usage from response
                    input_tokens = 0
                    output_tokens = 0
                    total_tokens = 0
                    
                    if hasattr(response, 'usage_metadata'):
                        input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                        output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                        total_tokens = input_tokens + output_tokens
                        print(f"🧵 LLM BG: usage_metadata tokens input={input_tokens} output={output_tokens} total={total_tokens}")
                    else:
                        # Fallback: estimate tokens based on text length
                        system_prompt = chat_session_metadata[session_id]["system_prompt"]
                        total_tokens = (len(user_text) + len(system_prompt)) // 4
                        print(f"🧵 LLM BG: fallback token estimate total={total_tokens}")
                    
                    # Telemetry
                    if total_tokens > 0:
                        tele_t0 = time.time()
                        supabase.rpc('track_model_usage', {
                            'p_user_id': user_id,
                            'p_company_id': effective_company_id,
                            'p_session_id': session_id,
                            'p_model_type': 'llm',
                            'p_provider': 'google',
                            'p_model_name': 'gemini-pro',
                            'p_usage_amount': total_tokens,
                            'p_metadata': {
                                'input_tokens': input_tokens,
                                'output_tokens': output_tokens,
                                'total_tokens': total_tokens,
                                'user_message_length': len(user_text)
                            }
                        }).execute()
                        print(f"🧵 LLM BG: telemetry done in {time.time()-tele_t0:.3f}s")
                    else:
                        print(f"🧵 LLM BG: skip telemetry (no tokens)")
                    
                    # Background credit deduction (using token count)
                    if total_tokens > 0:
                        deduct_t0 = time.time()
                        try:
                            credit_res = await check_and_use_credits(
                                user_id, effective_company_id, 'gemini-pro', float(total_tokens),
                                f"AI response using gemini-pro ({total_tokens} tokens)"
                            )
                            print(f"🧵 LLM BG: deducted {credit_res['credits_used']} credits in {time.time()-deduct_t0:.3f}s; remaining={credit_res['remaining_credits']}")
                        except Exception as ce:
                            print(f"❌ LLM CREDIT BG error: {ce}")
                    else:
                        print("🧵 LLM BG: skip deduction (0 tokens)")
                    
                    print(f"🧵 LLM BG: finished in {time.time()-bg_t0:.3f}s")
                except Exception as e:
                    print(f"❌ Error tracking/deducting LLM in background: {e}")
            else:
                print(f"⚠️ Skipping LLM cost tracking - missing user_id or company_id")

        # Start background tracking + deduction
        asyncio.create_task(track_llm_usage_background())
        print("🧵 LLM BG: scheduled")

        # Check for finish_reason error
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:  # 1 = STOP
                print(f"⚠️ Warning: finish_reason = {candidate.finish_reason}")
                if candidate.finish_reason == 12:
                    print(f"❌ Tool schema error detected")
                    return "I'm having trouble with the tool configuration. Please try again later."
        
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
                result = await dispatch_tool_with_router(name, args, effective_company_id, user_id, session_id)
                
                # Get company language for natural language conversion
                from tools import get_company_language
                language_code = get_company_language(effective_company_id)
                
                # Convert API response to natural language
                if isinstance(result, dict):
                    natural_response = convert_api_response_to_natural_language(result, name, user_text, language_code)
                else:
                    natural_response = str(result)
                response_text += natural_response + ". "

        if not response_text.strip():
            response_text = "He procesado tu solicitud."
        
        # Truncate if too long for voice synthesis
        truncated_response = truncate_response_for_voice(response_text, max_words=150)

        if len(truncated_response.split()) < len(response_text.split()):
            print(f"📝 Response truncated from {len(response_text.split())} to {len(truncated_response.split())} words")
        
        return truncated_response
        
    except Exception as e:
        print(f"❌ Error in get_agent_response_with_training: {e}")
        import traceback
        traceback.print_exc()
        return "Estoy teniendo problemas para procesar tu solicitud en este momento. Por favor, intenta de nuevo."

# Cleanup function to remove old chat sessions
async def cleanup_chat_sessions():
    """Remove chat sessions that are no longer active"""
    current_sessions = set(sessions.keys())
    cached_sessions = set(chat_sessions.keys())
    
    # Remove sessions that are no longer active
    for session_id in cached_sessions - current_sessions:
        del chat_sessions[session_id]
        del chat_session_metadata[session_id]
        print(f"🧹 Cleaned up chat session: {session_id}")

async def pre_warm_chat_session(session_id: str, company_id: str, user_id: str = None):
    """Pre-warm a chat session by initializing it in the background"""
    try:
        print(f"🔥 Pre-warming chat session for {session_id}")
        
        # Check credits before pre-warming
        if user_id:
            try:
                from credits_helper import get_user_credits
                user_credits = await get_user_credits(user_id)
                if user_credits and user_credits.get("credits_balance", 0) <= 0:
                    print(f"❌ Insufficient credits for user {user_id}. Skipping pre-warm.")
                    return {"error": "insufficient_credits", "message": "No credits available"}
            except Exception as e:
                print(f"⚠️ Error checking credits during pre-warm: {e}")
                # Continue with pre-warm even if credit check fails
        
        # Parallelize tools/router, system prompt, and model initialization
        parallel_t0 = time.time()
        print("🚀 Pre-warm: launching parallel tasks (tools/router, system prompt, model init)")
        tools_task = asyncio.to_thread(fetch_gemini_tools_and_router, company_id)
        prompt_task = get_system_prompt_with_training(company_id)
        model_task = initialize_gemini_model_async()
        (tools_rows, router_spec), system_prompt, model = await asyncio.gather(tools_task, prompt_task, model_task)
        print(f"✅ Pre-warm parallel phase took {time.time() - parallel_t0:.2f} seconds")

        # Build tools from rows
        tools_build_t0 = time.time()
        tools = build_gemini_tools_from_supabase(tools_rows, company_id)
        print(f"🔍 Tools built in {time.time() - tools_build_t0:.2f} seconds")
        
        # Create router with allowed domains
        router_t0 = time.time()
        allowed_domains = [
            re.escape(router_spec["api_base_url"].split("://",1)[-1].split("/")[0]),
            "39e547b6a29c\\.ngrok-free\\.app",  # Allow ngrok domain
            "localhost",
            "127\\.0\\.0\\.1"
        ] if router_spec else []
        router = ToolRouter(router_spec, allowed_domains=allowed_domains) if router_spec else None
        print(f"🔍 Router built in {time.time() - router_t0:.2f} seconds")

        # Add important instructions to system prompt
        additional_instructions = """

IMPORTANT INSTRUCTIONS:
- Keep your responses concise and under 50 words. Be direct and to the point.
- NEVER dictate or read out IDs, serial numbers, or very large numbers to users.
- NEVER EVER read out loud the id of a company or user. 
- If you need to reference an ID or number, say something like "I've processed your request" or "Your information has been updated" instead of reading the actual ID.
- Focus on providing helpful, actionable information rather than technical details.
- Use natural, conversational language that's easy to understand when spoken aloud.
"""
        system_prompt = (system_prompt or "") + additional_instructions
        print(f"🔍 System prompt prepared (length={len(system_prompt)} chars)")
        
        # Create chat and seed system prompt
        chat_t0 = time.time()
        chat = model.start_chat(history=[])
        chat.send_message(system_prompt)  # Send system prompt once
        print(f"🔍 Chat initialized with system prompt in {time.time() - chat_t0:.2f} seconds")
        
        # Cache the chat session and metadata
        chat_sessions[session_id] = chat
        chat_session_metadata[session_id] = {
            "company_id": company_id,
            "system_prompt": system_prompt,
            "tools": tools,
            "router": router
        }
        print(f"🔥 Pre-warmed chat session for {session_id}")
        
    except Exception as e:
        print(f"❌ Error pre-warming chat session {session_id}: {e}")
        import traceback
        traceback.print_exc()