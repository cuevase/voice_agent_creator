from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

def get_sb() -> Client:
    """Get Supabase client"""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key) 