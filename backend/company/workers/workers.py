from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from main import Worker

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)


async def create_worker_helper(worker: Worker):
    """Create a worker for a company"""
    try:
        # Insert the worker data into Supabase
        result = supabase.table('workers').insert({
            'worker_name': worker.worker_name,
            'worker_email': worker.worker_email,
            'worker_role': worker.worker_role,
            'available': worker.worker_available,
            'company_id': worker.company_id
        }).execute()
        
        return {"message": "Worker created successfully", "data": result.data}
        
    except Exception as e:
        return {"error": str(e)}
    