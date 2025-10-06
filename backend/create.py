import os 
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
import uuid
from openai import OpenAI
import tiktoken
import json
from extraction_processing.extract_process import process_and_upload_pdf, extract_text_from_pdf, process_pdf_with_openai, create_processed_pdf
from extraction_processing.vectors.vector import store_embeddings_in_supabase, search_similar_chunks, count_tokens, chunk_text, get_embedding
from tools import get_gemini_tools, get_system_prompt





load_dotenv()   

#------------Keys------------

PULPOO_API_KEY = os.getenv("PULPOO_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

#----------Clients------------

# Initialize Supabase client only if credentials are available
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase client initialized successfully in create.py")
    except Exception as e:
        print(f"⚠️ Warning: Failed to initialize Supabase client in create.py: {e}")
        supabase = None
else:
    print("⚠️ Warning: Supabase credentials not found in create.py. Some features may not work.")
    print(f"SUPABASE_URL: {'Set' if SUPABASE_URL else 'Missing'}")
    print(f"SUPABASE_KEY: {'Set' if SUPABASE_KEY else 'Missing'}")

openai_client = OpenAI(api_key=OPENAI_API_KEY)

app1 = FastAPI()


app1.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#------------Models------------

class Client(BaseModel):
    name: str
    url_company: str
    files: list[str]  # These will be Supabase Storage file paths
    email: str
    phone: str

class SearchQuery(BaseModel):
    query: str
    client_id: str

class Worker(BaseModel):
    worker_name: str
    worker_email: str
    worker_role: str
    worker_available: bool
    company_id: str


class WorkerSchedule(BaseModel):
    worker_id: str
    schedule: str

class TimeSlot(BaseModel):
    worker_id: str
    day: str
    start_time: str
    end_time: str
    available: bool





#------------Get Endpoints------------

@app1.get("/get_workers")
async def get_workers(company_id: str):
    """Get workers of a company"""
    if not supabase:
        raise HTTPException(500, "Supabase not configured")
    result = supabase.table('workers').select('*').eq('company_id', company_id).execute()
    return {"message": "Workers fetched successfully", "data": result.data}

@app1.get("/get_company_info")
async def get_company_info(company_id: str):
    """Get company info"""
    if not supabase:
        raise HTTPException(500, "Supabase not configured")
    result = supabase.table('companies').select('*').eq('company_id', company_id).execute()
    return {"message": "Company info fetched successfully", "data": result.data}

@app1.get("/get_time_slots")
async def get_time_slots(company_id: str):
    """Get time slots of a company"""
    if not supabase:
        raise HTTPException(500, "Supabase not configured")
    get_workers = supabase.table('workers').select('*').eq('company_id', company_id).execute()
    workers = get_workers.data
    result = supabase.table('worker_availability').select('*').in_('worker_id', [worker['worker_id'] for worker in workers]).execute()
    return {"message": "Time slots fetched successfully", "data": result.data}

@app1.get("/check_availability")
async def check_availability(company_id: str, day: str, start_time: str):
    """Get availability of a company"""
    if not supabase:
        raise HTTPException(500, "Supabase not configured")
    get_workers = supabase.table('workers').select('*').eq('company_id', company_id).execute()
    workers = get_workers.data
    result = supabase.table('worker_availability').select('*').eq('worker_id', workers[0]['worker_id']).eq('day', day).eq('start_time', start_time).eq('available', True).execute()
    return {"message": "Availability fetched successfully", "data": result.data}


#------------Endpoints to create------------

#Create client with files
@app1.post("/create_company")
async def create_client_with_files(
    name: str = Form(...),
    email: str = Form(...),
    files: list[UploadFile] = File(None), #make them optional as well 
    additional_text: str = Form(None)  
):
    """Create a client and upload their files to Supabase Storage in a client-specific folder with PDF processing and RAG"""
    try:
        # Create a sanitized folder name from client name
        import re
        safe_client_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
        client_folder = f"{safe_client_name}_{uuid.uuid4().hex[:8]}"
        
        # Upload and process all files
        uploaded_paths = []
        all_processed_texts = []
        
        for file in files:
            # Read file content
            file_content = await file.read()
            
            # Process and upload file (PDFs will be processed with OpenAI)
            file_path, processed_text = await process_and_upload_pdf(file_content, file.filename, client_folder)
            uploaded_paths.append(file_path)
            
            if processed_text:
                all_processed_texts.append(processed_text)
        
        # Handle additional text input if provided
        if additional_text and additional_text.strip():
            try:
                # Create a text file with the additional text
                text_filename = f"additional_notes_{uuid.uuid4().hex[:8]}.txt"
                text_file_path = f"{client_folder}/{text_filename}"
                
                # Upload text file to Supabase Storage
                supabase.storage.from_('client-files').upload(
                    path=text_file_path,
                    file=additional_text.encode('utf-8'),
                    file_options={"content-type": "text/plain"}
                )
                
                # Add text file path to uploaded paths
                uploaded_paths.append(f"client-files/{text_file_path}")
                
                # Add the text content to processed texts for RAG
                all_processed_texts.append(additional_text)
                
                print(f"Stored additional text as: {text_filename}")
                
            except Exception as e:
                print(f"Error storing additional text: {e}")
                # Continue with client creation even if text storage fails
        
        # Create client record first to get client_id
        client_result = supabase.table('companies').insert({
            'company_name': name,
            'company_email': email,
            'additional_text': additional_text,
            'files': uploaded_paths
        }).execute()

        print("Client created successfully in supabase")
        
        client_id = client_result.data[0]['company_id'] if client_result.data else None
        print(f"Client ID: {client_id}")
        
        # Check if total word count exceeds 400 for RAG system
        total_text = " ".join(all_processed_texts)
        print(f"Total text: {total_text}")
        word_count = len(total_text.split())

        print(f"Total word count: {word_count}")
        
        rag_created = False
        chunks = []
        if word_count > 400 and client_id:
            print(f"Total word count: {word_count} - Creating RAG system...")
            
            # Chunk the combined text
            chunks = chunk_text(total_text)
            
            # Store embeddings in Supabase
            rag_created = await store_embeddings_in_supabase(chunks, client_id, "combined_processed_files")
        print("now returning final stuff")
        return {
            "message": "Client created successfully with files uploaded and processed",
            "data": client_result.data,
            "uploaded_files": uploaded_paths,
            "client_folder": client_folder,
            "word_count": word_count,
            "rag_created": rag_created,
            "chunks_created": len(chunks) if rag_created else 0,
            "additional_text_stored": additional_text is not None and additional_text.strip() != ""
        }
        
    except Exception as e:
        return {"error": str(e)}
    
#Create worker for company
@app1.post("/create_worker")
async def create_worker(worker: Worker):
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
    
@app1.post("/create_time_slot")
async def create_time_slot(time_slot: TimeSlot):
    """Create a time slot for a worker"""
    try:
        # Insert the time slot data into Supabase
        result = supabase.table('worker_availability').insert({
            'worker_id': time_slot.worker_id,
            'day': time_slot.day,
            'start_time': time_slot.start_time,
            'end_time': time_slot.end_time,
            'available': time_slot.available,
        }).execute()

        return {"message": "Time slot created successfully", "data": result.data}
        
    except Exception as e:
        return {"error": str(e)}
    

@app1.post("/create_appointment")
async def create_appointment(company_id: str, day: str, start_time: str):
    """Create an appointment for a worker"""
    get_workers = supabase.table('workers').select('*').eq('company_id', company_id).execute()
    workers = get_workers.data
    result = supabase.table('worker_availability').select('*').eq('worker_id', workers[0]['worker_id']).eq('day', day).eq('start_time', start_time).eq('available', True).execute()
    if result.data:
        return {"message": "Time slot already exists", "data": result.data}
    
    try:
        # Insert the appointment data into Supabase
        result = supabase.table('worker_availability').eq('worker_id', workers[0]['worker_id']).eq('day', day).eq('start_time', start_time).update({
            'available': False,
        }).execute()
        return {"message": "Appointment created successfully", "data": result.data}
    
    except Exception as e:
        return {"error": str(e)}

@app1.post("/search_documents")
async def search_documents(search_query: SearchQuery):
    """Search through client documents using vector similarity"""
    try:
        similar_chunks = await search_similar_chunks(search_query.query, search_query.client_id)
        
        return {
            "query": search_query.query,
            "results": similar_chunks,
            "total_results": len(similar_chunks)
        }
        
    except Exception as e:
        return {"error": str(e)}

# Voice agent endpoints are now handled in gemini_agent.py
# Use the endpoints from gemini_agent.py for voice functionality


