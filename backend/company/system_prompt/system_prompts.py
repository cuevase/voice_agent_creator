from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from fastapi import Depends
from main import PromptCreate
from tools import get_system_prompt
from database_utils import get_sb

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)


def create_system_prompt_helper(company_id: str, prompt: PromptCreate, sb: Client = Depends(get_sb)):
    prompt_res = sb.table("prompts").insert({
        "company_id": company_id,  # change to "company_id" if that's the column name
        "name": prompt.name,
        "description": prompt.description
    }).execute()
    prompt_id = prompt_res.data[0]["id"]
    company_name = sb.table("companies").select("company_name").eq("company_id", company_id).execute()
    # Create prompt version
    version_data = prompt.version_data
    version_res = sb.table("prompt_versions").insert({
        "prompt_id": prompt_id,
        "version": version_data.version,
        "content": version_data.content,
        "locale": "es-MX",
        "channel": "voice",
        "model_prefs": {"model": "gemini-2.5-flash"},
        "variables": {"company_id": company_id, "company_name": company_name.data[0]["company_name"]},
    }).execute()
    version_id = version_res.data[0]["id"]

    # Set this version as the active one
    sb.table("prompts").update({
        "active_version_id": version_id
    }).eq("id", prompt_id).execute()


    return {"message": "Prompt and version created", "prompt_id": prompt_id}

async def get_prompts_helper(company_id: str):
    """Get prompts of a company"""
    prompts = supabase.table('prompts').select('*').eq('company_id', company_id).execute()
    result = []
    for prompt in prompts.data:
        get_prompt_content = supabase.table('prompt_versions').select('*').eq('prompt_id', prompt['id']).execute()
        prompt_content = get_prompt_content.data[0]['content']
        get_prompt_variables = supabase.table('prompt_versions').select('*').eq('prompt_id', prompt['id']).execute()
        prompt_variables = get_prompt_variables.data[0]['variables']
        print(prompt_variables)
        result.append({
            "prompt_id": prompt['id'],
            "prompt_name": prompt['name'],
            "active": prompt['active'],
            "prompt_content": prompt_content,
            "prompt_variables": prompt_variables
        })
    return {"message": "Prompts fetched successfully", "data": result}

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
        
