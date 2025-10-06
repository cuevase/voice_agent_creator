from supabase import create_client, Client
import os   
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def get_age(user_id: str):
    """Get user age"""
    user_age = supabase.table("age_consent").select("*").eq("user_id", user_id).execute().data[0]
    print(user_age)
    if user_age["consent"] == True:
        return {"message": "User is 16 years or older"}
    else:
        return {"message": "No age consent"}
    
async def post_age_consent_helper(user_id: str):
    """Post user age"""
    supabase.table("age_consent").insert({"user_id": user_id, "consent": True}).execute()
    return {"message": "Age posted successfully"}