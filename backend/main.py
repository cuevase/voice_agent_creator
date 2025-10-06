import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header, Request, Response, BackgroundTasks, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import uuid
from elevenlabs import ElevenLabs
from dotenv import load_dotenv
import google.generativeai as genai
import base64
from io import BytesIO
import json
import re
import aiohttp
import asyncio
from urllib.parse import urljoin
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from create import chunk_text
from create import supabase
from extraction_processing.extract_process import process_and_upload_pdf
from extraction_processing.vectors.vector import store_embeddings_in_supabase
from fastapi import APIRouter
from supabase import create_client, Client
from pulpoo import crear_tarea_pulpoo
from datetime import datetime
# OpenAI for natural response generation
from openai import OpenAI
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import trafilatura
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io
import tempfile
import os
from urllib.robotparser import RobotFileParser
import time
import re
# Twilio for WhatsApp integration
from twilio.twiml.messaging_response import MessagingResponse
from fastapi import Request
import stripe
import google.generativeai as genai

# Add phone number service import

# Initialize phone number service

load_dotenv()

#-------ENVIRONMENT VARIABLES-------


API_BASE_URL = os.getenv("API_BASE_URL")
PULPOO_API_KEY = os.getenv("PULPOO_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
elevenlabs = ElevenLabs(api_key=ELEVENLABS_API_KEY)
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
stripe.api_key = STRIPE_SECRET_KEY
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")  # Frontend URL for redirects
# Validate required environment variables

#-------FASTAPI APP AND ROUTER-------
router = APIRouter()
app = FastAPI()


# ===== AUTHENTICATION FUNCTIONS =====

from authentication.authentication import get_current_user
from database_utils import get_sb

# Import all the functions we need
from create import (
    supabase,
    get_company_info,
    get_time_slots,
    create_client_with_files,
    create_worker,
    create_time_slot,
    create_appointment,
    search_documents
)
from tools import (
    get_gemini_tools,
    get_system_prompt,
    search_company_documents,
    format_rag_context,
    get_company_documents_from_storage,
    inject_company_documents_to_prompt
)

#-------Pydantic Models-------

class PromptFragment(BaseModel):
    name: str
    content: str
    position: int  # e.g., 0 for top, 1, etc.

class PromptVersionCreate(BaseModel):
    version: int
    content: str
    locale: Optional[str] = "es-MX"
    channel: Optional[str] = "voice"
    model_prefs: Optional[dict] = {"model": "gemini-2.5-flash"}
    fragments: Optional[List[PromptFragment]] = []

class PromptCreate(BaseModel):
    name: str
    description: Optional[str] = None
    version_data: PromptVersionCreate


class ToolArgCreate(BaseModel):
    name: str
    type: str  
    location: str  
    required: bool = True
    description: Optional[str] = None
    example: Optional[str] = None
    enum_vals: Optional[List[str]] = None

class ToolCreate(BaseModel):
    name: str
    description: Optional[str] = None
    method: str
    endpoint_template: str
    api_connection_id: str  
    args: Optional[List[ToolArgCreate]] = []

class Worker(BaseModel):
    worker_name: str
    worker_email: str
    worker_role: str
    worker_available: bool
    company_id: str

class APIAuthConfig(BaseModel):
    type: Optional[str]  
    token: Optional[str]
    headers: Optional[Dict[str, str]]

class APIConnectionCreate(BaseModel):
    name: str
    api_base_url: str
    auth: Optional[APIAuthConfig] = None

class WhatsAppConfig(BaseModel):
    """Model for WhatsApp configuration"""
    company_id: str
    twilio_number: str
    is_active: bool = True
    welcome_message: Optional[str] = None

class PaymentsEnableIn(BaseModel):
    provider: str              
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    currency: str = "MXN"
    # Returned from your provider connect flow:
    stripe_connected_account_id: Optional[str] = None
    mp_access_token: Optional[str] = None
    mp_refresh_token: Optional[str] = None


class TrainingSessionCreate(BaseModel):
    """Model for creating a training session"""
    company_id: str
    session_name: str

class TrainingMessageCreate(BaseModel):
    """Model for creating a training message"""
    training_session_id: str
    message_type: str  
    content: str

class ConsentUpdate(BaseModel):
    consent_type: str
    granted: bool

class CookieConsent(BaseModel):
    essential_cookies: bool = True
    analytics_cookies: bool = False
    marketing_cookies: bool = False
    third_party_cookies: bool = False

class PhoneNumberRequest(BaseModel):
    country_code: str = "US"
    region: Optional[str] = None
    capabilities: List[str] = ["voice"]
    regulatory_bundle: str = "basic"


#Twilio Models

class CreateSubaccountReq(BaseModel):
    friendly_name: str = Field(..., example="ACME SA de CV")

class CreateApiKeyReq(BaseModel):
    subaccount_sid: str
    friendly_name: str = "server-key"

class AddressReq(BaseModel):
    subaccount_sid: str
    api_key_sid: Optional[str] = None
    api_key_secret: Optional[str] = None
    customer_name: str
    street: str
    city: str
    region: str
    postal_code: str
    iso_country: str
    friendly_name: Optional[str] = "Primary Address"
    emergency_enabled: Optional[bool] = False  # optional

class BundleInitReq(BaseModel):
    subaccount_sid: str
    api_key_sid: str
    api_key_secret: str
    friendly_name: str
    email: str
    iso_country: Optional[str] = None
    number_type: Optional[str] = None  # local|mobile|toll-free|national (per regulation)
    end_user_type: Optional[str] = None  # individual|business
    regulation_sid: Optional[str] = None
    status_callback: Optional[str] = None

class EndUserReq(BaseModel):
    subaccount_sid: str
    api_key_sid: str
    api_key_secret: str
    end_user_type: str  # e.g., business or individual (check End-User Types)
    friendly_name: str
    attributes: Dict[str, str]  # required keys depend on End-User Type

class SupportingDocReq(BaseModel):
    subaccount_sid: str
    api_key_sid: str
    api_key_secret: str
    type_sid: str  # Supporting Document Type SID (from docs/types API)
    friendly_name: str
    attributes: Dict[str, str]  # e.g., document_number, issuer, etc.

class AssignItemReq(BaseModel):
    subaccount_sid: str
    api_key_sid: str
    api_key_secret: str
    bundle_sid: str
    item_sid: str   # EndUser SID (begins IT...) or Supporting Document SID (begins RD...)
    item_type: str  # end-user | supporting-document

class SubmitBundleReq(BaseModel):
    subaccount_sid: str
    api_key_sid: str
    api_key_secret: str
    bundle_sid: str
    status_callback: Optional[str] = None
    email: Optional[str] = None
    evaluate_before_submit: bool = True

class SearchNumbersReq(BaseModel):
    subaccount_sid: str
    country: str     # e.g., "MX", "US"
    type: str        # local|mobile|tollfree
    contains: Optional[str] = None
    voice_enabled: bool = True
    sms_enabled: bool = True

class BuyNumberReq(BaseModel):
    subaccount_sid: str
    api_key_sid: Optional[str] = None
    api_key_secret: Optional[str] = None
    phone_number: str           # E.164
    address_sid: Optional[str]  # AD...
    bundle_sid: Optional[str]   # BU...
    voice_url: Optional[str] = None
    sms_url: Optional[str] = None

class ConfigureNumberReq(BaseModel):
    subaccount_sid: str
    phone_number_sid: str  # PN...
    voice_url: Optional[str] = None
    sms_url: Optional[str] = None

class FullProvisionReq(BaseModel):
    company_name: str
    country: str
    number_type: str
    end_user_type: str
    contact_email: str
    # address
    customer_name: str
    street: str
    city: str
    region: str
    postal_code: str
    iso_country: str
    # end-user attributes required by type
    end_user_attributes: Dict[str, str]
    # supporting docs: provide type_sid + attributes (file upload via separate call)
    supporting_docs: List[Dict[str, Dict[str, str]]] = []  # [{type_sid: "...", attributes:{...}}]
    contains: Optional[str] = None
    voice_url: Optional[str] = None
    sms_url: Optional[str] = None

class RequirementsReq(BaseModel):
    iso_country: str     # e.g., "MX"
    number_type: str     # "local" | "mobile" | "national" | "toll-free"
    end_user_type: str   # "business" | "individual"
    api_key_sid: Optional[str] = None
    api_key_secret: Optional[str] = None

class AutoProvisionConfig(BaseModel):
    # what to do when bundle becomes approved
    auto_purchase: bool = True
    reserve_on_pending: bool = False  # if you want to attempt purchase earlier

# Global session storage
from session_data import sessions, session_metadata
    

# Import models from create.py
from create import Client, SearchQuery, Worker, WorkerSchedule, TimeSlot

# Create main app
app = FastAPI(
    title="Agent Creator API",
    description="Combined API for voice agents and business operations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== CHATBOT ENDPOINTS =====
from chatbot.chatbot.chatbot import chatbot_start_session_helper, chatbot_send_message_helper

# ===== VOICE AGENT ENDPOINTS =====

@app.post("/start-chat-session")
async def start_chat_session(company_id: str, mode: str = "text", user_id: str = None):
    """Start a new chat session for a company"""
    return await chatbot_start_session_helper(company_id, mode, user_id)

@app.post("/send-message")
async def send_message(session_id: str, message: str):
    return await chatbot_send_message_helper(session_id, message)

# ===== Company ENDPOINTS =====

from company.workers.workers import create_worker_helper
from company.company.company import create_company_helper, get_user_companies_helper, get_company_by_id_helper, delete_company_helper
from company.system_prompt.system_prompts import create_system_prompt_helper, get_prompts_helper
from company.company_tools.company_tools import create_company_tool_helper, add_check_availability_tool_to_company_helper, add_create_appointment_tool_to_company_helper, create_appointment_tool_helper, check_availability_tool_helper


@app.get("/get_workers")
async def get_workers_endpoint(company_id: str):
    """Get workers of a company"""
    result = supabase.table("workers").select("*").eq("company_id", company_id).execute()
    return result.data

@app.get("/get_company_info")
async def get_company_info_endpoint(company_id: str):
    """Get company info"""
    return await get_company_info(company_id)

@app.get("/get_time_slots")
async def get_time_slots_endpoint(company_id: str):
    """Get time slots of a company"""
    return await get_time_slots(company_id)

@app.post("/create_worker")
async def create_worker(worker: Worker):
    return await create_worker_helper(worker)
    
@app.post("/create_time_slot")
async def create_time_slot_endpoint(time_slot: TimeSlot):
    """Create a new time slot"""
    return await create_time_slot(time_slot)

@app.post("/create_appointment")
async def create_appointment_endpoint(company_id: str, day: str, start_time: str):
    """Create an appointment for a worker"""
    return await create_appointment(company_id, day, start_time)

@app.post("/search_documents")
async def search_documents_endpoint(search_query: SearchQuery):
    """Search through client documents using vector similarity"""
    return await search_documents(search_query)

@app.post("/create_company")
async def create_client_with_files(
    name: str = Form(...),
    email: str = Form(...),
    files: list[UploadFile] = File(default=[]), 
    additional_text: str = Form(None),
    website_url: str = Form(None),  # Optional website URL for crawling
    max_crawl_pages: int = Form(5),  # Optional: max pages to crawl (default 5)
    language: str = Form("es"),  # Optional: language code (default Spanish)
    current_user: Optional[str] = Depends(get_current_user)  # Get authenticated user
):
    return await create_company_helper(name, email, files, additional_text, website_url, max_crawl_pages, language, current_user)
    
@app.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await delete_company_helper(company_id, current_user)

@app.get("/companies/user/{user_id}")
async def get_user_companies(
    user_id: str,
    limit: int = 50,
    offset: int = 0
):
    """Get all companies for a specific user ID"""
    return await get_user_companies_helper(user_id, limit, offset)

@app.get("/companies/{company_id}")
async def get_company_by_id(
    company_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await get_company_by_id_helper(company_id, current_user)


@router.post("/companies/{company_id}/system-prompt")
def create_prompt(company_id: str, prompt: PromptCreate, sb: Client = Depends(get_sb)):
    return create_system_prompt_helper(company_id, prompt, sb)


@app.get("/get_prompts")
async def get_prompts(company_id: str):
    return await get_prompts_helper(company_id)


@router.post("/companies/{company_id}/tools")
def create_tool(company_id: str, tool: ToolCreate, sb: Client = Depends(get_sb)):
    return create_company_tool_helper(company_id, tool, sb)


@app.post("/add_check_availability_tool_to_company")
async def add_check_availability_tool_to_company(company_id: str):
    return await add_check_availability_tool_to_company_helper(company_id)


@app.post("/add_create_appointment_tool_to_company")
async def add_create_appointment_tool_to_company(company_id: str):
    """Add create appointment tool to a company"""
    return await add_create_appointment_tool_to_company_helper(company_id)


@app.post("/create_appointment_tool")
async def create_appointment(company_id: str, day: str, start_time: str):
    """Create an appointment for a company"""
    return await create_appointment_tool_helper(company_id, day, start_time)


@app.post("/add_delete_appointment_tool")
async def add_delete_appointment_tool_to_company(company_id: str):
    """Add delete appointment tool to a company"""
    # TODO: Implement delete appointment tool addition
    return {"message": "Delete appointment tool not yet implemented", "company_id": company_id}


@app.get("/check_availability")
async def check_availability(company_id: str, day: str, start_time: str):
    return await check_availability_tool_helper(company_id, day, start_time)


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Check database connection
        supabase.table("companies").select("count").limit(1).execute()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "services": {
                "database": "connected",
                "background_workers": "running"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.get("/check_if_tools_exist")
async def check_if_tools_exist(company_id: str):
    """Check if tools exist for a company"""
    tools = supabase.table('tools').select('*').eq('company_id', company_id).execute()
    if not tools.data:
        return {"message": "Tools not found", "company_id": company_id}
    return {"message": "Tools fetched successfully", "data": tools.data}


@app.post("/lead_generator")
async def lead_generator(company_id: str):
    """Generate leads for a company"""
    return {"message": "Lead generator not yet implemented", "company_id": company_id}

@app.get("/activate_prompt_for_company")
def activate_prompt_for_company(company_id:str, prompt_id:str):
    #first deactivate all prompts for the company
    deactivate_result = supabase.table("prompts").update({"active": False}).eq("company_id", company_id).execute()
    #then activate the new prompt
    activate_result = supabase.table("prompts").update({"active": True}).eq("company_id", company_id).eq("id", prompt_id).execute()
    if activate_result.data:
        return "prompt activated"
    else:
        return "prompt not activated"

# ===== MAIN ENDPOINTS =====

@app.get("/")
async def root():
    return {
        "message": "Agent Creator API",
        "version": "1.0.0",
        "endpoints": {
            "voice_agent": {
                "start_session": "POST /start-chat-session",
                "send_message": "POST /send-message", 
                "voice_agent": "POST /agent/voice"
            },
            "chatbot": {
                "start_session": "POST /chatbot/start-session",
                "send_message": "POST /chatbot/send-message"
            },
            "conversation_history": {
                "get_history": "GET /conversation/history",
                "session_summary": "GET /conversation/session/{session_id}/summary",
                "company_sessions": "GET /conversation/company/{company_id}/sessions",
                "cleanup": "DELETE /conversation/cleanup"
            },
            "business_logic": {
                "get_workers": "GET /get_workers",
                "get_company_info": "GET /get_company_info",
                "create_company": "POST /create_company",
                "search_documents": "POST /search_documents"
            }
        },
        "docs": "/docs"
    }

# ===== CONVERSATION FUNCTIONS =====

from company.storage.storage import store_message_in_history_helper
from company.conversations.conversations import get_conversation_history_helper, get_session_summary_helper, get_session_statistics, cleanup_old_conversations, get_company_sessions_helper, cleanup_conversations_endpoint, generate_session_summary_helper


async def store_message_in_history(
    session_id: str, 
    company_id: str, 
    message_type: str, 
    content: str,
    metadata: dict = None
):
    return await store_message_in_history_helper(company_id, session_id, message_type, content, metadata)


@app.get("/conversation/history")
async def get_conversation_history_endpoint(
    session_id: str = None,
    company_id: str = None,
    limit: int = 50,
    offset: int = 0
):
    return await get_conversation_history_helper(session_id, company_id, limit, offset)

@app.get("/conversation/session/{session_id}/summary")
async def get_session_summary_endpoint(session_id: str):
    """Get summary statistics for a specific session with AI-generated summary"""
    return await get_session_summary_helper(session_id)

@app.get("/conversation/company/{company_id}/sessions")
async def get_company_sessions_endpoint(
    company_id: str,
    limit: int = 20,
    offset: int = 0,
    include_summaries: bool = False  # Optional parameter to include AI summaries
):
    return await get_company_sessions_helper(company_id, limit, offset, include_summaries)

@app.delete("/conversation/cleanup")
async def cleanup_conversations_endpoint(days_to_keep: int = 30):
    """Clean up old conversation history (admin only)"""
    return await cleanup_conversations_endpoint(days_to_keep)


@app.post("/conversation/session/{session_id}/generate-summary")
async def generate_session_summary_endpoint(session_id: str):
    return await generate_session_summary_helper(session_id)
    

app.include_router(router)


@app.get("/get_check_availability_and_schedule_tool")
def get_check_availability_and_schedule_tool( company_id:str):
    result = supabase.table("tools").select("*").eq("name", "check_availability").execute()
    if result.data:
        return "tool found"
    else:
        return "tool not found"
    


# ===== COMPANY FILE MANAGEMENT ENDPOINTS =====

from company.files.files import manage_files_helper, get_company_files_helper

@app.post("/companies/{company_id}/files")
async def manage_company_files(
    company_id: str,
    action: str = Form(...),
    files: Optional[list[UploadFile]] = File(None),
    file_paths_to_remove: Optional[str] = Form(None),  # JSON string of file paths
    urls_to_add: Optional[str] = Form(None),  # JSON string of URLs
    urls_to_remove: Optional[str] = Form(None),  # JSON string of URLs
    additional_text: Optional[str] = Form(None),
    current_user: Optional[str] = Depends(get_current_user)
):
    return await manage_files_helper(company_id, action, files, file_paths_to_remove, urls_to_add, urls_to_remove, additional_text, current_user)
    

@app.get("/companies/{company_id}/files")
async def get_company_files(
    company_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await get_company_files_helper(company_id, current_user)

# ===== TRAINING MODE ENDPOINTS =====
from company.training.training import create_training_session_helper, add_training_message_helper, get_training_sessions_helper, get_training_messages_helper, get_training_response_helper, is_training_session


@app.post("/training/sessions")
async def create_training_session(
    session: TrainingSessionCreate,
    current_user: Optional[str] = Depends(get_current_user)
):
    """Create a new training session for a company"""
    return await create_training_session_helper(session, current_user)

@app.post("/training/messages")
async def add_training_message(
    message: TrainingMessageCreate,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await add_training_message_helper(message, current_user)

@app.get("/training/sessions/{company_id}")
async def get_training_sessions(
    company_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get all training sessions for a company"""
    return await get_training_sessions_helper(company_id, current_user)

@app.get("/training/messages/{session_id}")
async def get_training_messages(
    session_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
   return await get_training_messages_helper(session_id, current_user)

@app.post("/training/respond")
async def get_training_response(
    session_id: str,
    user_message: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get a pre-set response for training mode (no LLM cost)"""
    return await get_training_response_helper(session_id, user_message, current_user)

# ===== MODIFIED SYSTEM PROMPT FUNCTION =====

from company.system_prompt.system_prompts import get_system_prompt_helper

async def get_system_prompt_with_training(company_id: str) -> str:
    """Get system prompt with training data injected"""
    return await get_system_prompt_helper(company_id)

# ===== MODIFIED AGENT RESPONSE FUNCTION =====
async def initialize_gemini_model_async():
    return genai.GenerativeModel('gemini-2.5-flash-lite')

async def start_chat_async(model):
    """Async wrapper for start_chat"""
    return model.start_chat(history=[])

async def get_system_prompt_with_training_async(company_id: str) -> str:
    """Async wrapper for system prompt function"""
    return get_system_prompt_with_training(company_id)

async def initialize_gemini_model_async():
    """Async wrapper for model initialization"""
    return genai.GenerativeModel('gemini-2.5-flash')


from agent.agent import get_agent_response_with_training_helper

async def get_agent_response_with_training(session_id: str, user_text: str, user_id: str = None, company_id: str = None) -> str:
    """Get response from agent with training data included"""
    return await get_agent_response_with_training_helper(session_id, user_text, user_id=user_id, company_id=company_id)



# ===== MODIFIED EXISTING ENDPOINTS TO USE TRAINING DATA =====

from voice_agent.frontend.voice_agent import voice_agent_helper

@app.post("/agent/voice")
async def voice_agent(session_id: str = Form(...), audio: UploadFile = File(...)):
    """Voice agent with training data included"""
    return await voice_agent_helper(session_id, audio)

@app.post("/agent/voice/text")
async def voice_agent_text(session_id: str = Form(...), user_text: str = Form(...)):
    """Voice agent endpoint that accepts transcribed text and returns AI response"""
    from voice_agent_text import voice_agent_text_helper
    return await voice_agent_text_helper(session_id, user_text)

@app.get("/api/credits/check-voice-session")
async def check_voice_session_credits(current_user: str = Depends(get_current_user)):
    """Check if user has enough credits to start a voice session"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        from credits_helper import get_user_credits
        user_credits = get_user_credits(current_user)
        
        if not user_credits:
            return {
                "can_start_session": False,
                "reason": "no_credit_account",
                "message": "No credit account found. Please purchase credits first."
            }
        
        credits_balance = user_credits.get("credits_balance", 0)
        
        if credits_balance <= 0:
            return {
                "can_start_session": False,
                "reason": "insufficient_credits",
                "message": "No credits available. Please purchase credits to start a voice session.",
                "credits_balance": credits_balance
            }
        
        return {
            "can_start_session": True,
            "credits_balance": credits_balance,
            "message": "Sufficient credits available."
        }
        
    except Exception as e:
        print(f"❌ Error checking voice session credits: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/companies/{company_id}/api-connections")
async def create_api_connection(company_id: str, conn: APIConnectionCreate, sb: Client = Depends(get_sb)):
    conn_data = {
        "company_id": company_id,  # or "company_id" if your Supabase column is named that
        "name": conn.name,
        "api_base_url": conn.api_base_url,
        "auth": conn.auth.dict() if conn.auth else None
    }

    created = sb.table("api_connections").insert(conn_data).execute().data[0]
    return {"message": "API connection created", "api_connection_id": created["id"]}

from consent.consents import update_user_consent_helper, get_user_consents_helper, export_user_data_helper, delete_user_data_helper

@app.delete("/users/{user_id}/data")
async def delete_user_data(
    user_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await delete_user_data_helper(user_id, current_user)


@app.post("/users/{user_id}/consent")
async def update_user_consent(
    user_id: str,
    consent_update: ConsentUpdate,
    current_user: Optional[str] = Depends(get_current_user)
):
   return await update_user_consent_helper(user_id, consent_update, current_user)


@app.get("/users/{user_id}/consents")
async def get_user_consents(
    user_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await get_user_consents_helper(user_id, current_user)

@app.get("/users/{user_id}/data-export")
async def export_user_data(
    user_id: str,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await export_user_data_helper(user_id, current_user)

async def log_data_processing(
    user_id: str,
    company_id: str,
    action_type: str,
    data_type: str,
    third_party_service: Optional[str] = None
):
    """Log data processing for audit trail"""
    try:
        # Skip logging if user_id is not a valid UUID
        if user_id == "unknown" or user_id == "default" or not user_id:
            return {"message": "Processing logged successfully (skipped invalid user_id)"}
        
        log_data = {
            "user_id": user_id,
            "company_id": company_id,
            "action_type": action_type,
            "data_type": data_type,
            "third_party_service": third_party_service,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("data_processing_logs").insert(log_data).execute()
        
        return {"message": "Processing logged successfully"}
        
    except Exception as e:
        print(f"❌ Error logging data processing: {e}")
        # Don't fail the main operation if logging fails
        return {"message": "Processing completed (logging failed)"}

# Add cookie consent models and endpoints after the existing consent management code

from consent.cookies.cookies import save_cookie_consent_helper, get_cookie_consent_helper, revoke_cookie_consent_helper, get_cookie_policy_helper

@app.post("/api/cookie-consent")
async def save_cookie_consent(
    consent: CookieConsent,
    current_user: Optional[str] = Depends(get_current_user)
):
    return await save_cookie_consent_helper(consent, current_user)

@app.get("/api/cookie-consent")
async def get_cookie_consent(
    current_user: Optional[str] = Depends(get_current_user)
):
    return await get_cookie_consent_helper(current_user)

@app.delete("/api/cookie-consent")
async def revoke_cookie_consent(
    current_user: Optional[str] = Depends(get_current_user)
):
    return await revoke_cookie_consent_helper(current_user)

@app.get("/api/cookie-policy")
async def get_cookie_policy():
    """Get detailed cookie policy information"""
    return await get_cookie_policy_helper()

from consent.age.age import get_age, post_age_consent_helper

@app.get("/age/{user_id}")
async def get_age_consent(user_id: str):
    return await get_age(user_id)

@app.post("/age/{user_id}")
async def post_age_consent(user_id: str):
    return await post_age_consent_helper(user_id)

#-----------Whatsapp trial endpoints

from fastapi.responses import PlainTextResponse


from chatbot.whatsapp.whatsapp import send_template_helper, create_template_helper, receive_webhook_helper

@app.post("/whatsapp/send-template")
async def send_template(payload: dict):
    return await send_template_helper(payload)

@app.post("/whatsapp/create-template")
async def create_template(payload: dict):
    return await create_template_helper(payload)


@app.post("/whatsapp/webhook")
async def receive_webhook(request: Request):
    return await receive_webhook_helper(request)


#-------Twilio Endpoints-------

from manage_twilio.twilio import (regulatory_requirements_helper, 
                                  create_subaccount_helper, 
                                  create_subaccount_api_key_helper, 
                                  create_address_helper, 
                                  init_bundle_helper, 
                                  create_end_user_helper, 
                                  create_supporting_doc_helper, 
                                  bundle_assign_item_helper, 
                                  submit_bundle_helper, 
                                  search_numbers_helper, 
                                  buy_number_helper, 
                                  configure_number_helper, 
                                  provision_full_helper, 
                                  bundle_status_callback_helper, 
                                  simplified_requirements,
                                  upload_regulatory_document_helper,
                                  create_complete_bundle_helper,
                                  get_bundle_details_helper,
                                  get_company_bundles_helper,
                                  get_document_details_helper,
                                  delete_document_helper,
                                  configure_auto_provision_helper,
                                  get_bundle_phone_numbers_helper,
                                  bundle_status_callback_helper,
                                  get_bundle_phone_numbers_helper,
                                  search_numbers_for_bundle_helper,
                                  submit_bundle_to_twilio_helper,
                                  )

from manage_twilio.calls import (
    handle_incoming_voice_call_helper, 
    handle_call_status_helper, 
    handle_voice_stream_helper, 
    handle_whatsapp_message_helper,
    configure_phone_number_helper,
    get_phone_number_config_helper,
    handle_voice_call_with_ai_helper,
    IncomingCallData,
    CallStatusData,
    VoiceStreamConfig,
    WhatsAppMessageData, 

)
# Import the modern voice WebSocket handler
from manage_twilio.websocket_voice import handle_voice_websocket
from twilio.twiml.voice_response import VoiceResponse
from twilio.twiml.messaging_response import MessagingResponse

@app.get("/get_regulatory_requirements")
def get_regulatory_requirements(iso_country: str, number_type: str, end_user_type: str):
    api_key_sid = os.getenv("MASTER_API_KEY_SID")
    api_key_secret = os.getenv("MASTER_API_KEY_SECRET")
    print(api_key_sid, api_key_secret)
    req = RequirementsReq(iso_country=iso_country, number_type=number_type, end_user_type=end_user_type, api_key_sid=api_key_sid, api_key_secret=api_key_secret)
    return simplified_requirements(regulatory_requirements_helper(req))

@app.post("/twilio/subaccounts/create")
def create_subaccount(req: CreateSubaccountReq):
    return create_subaccount_helper(req)

@app.post("/twilio/subaccounts/api-keys/create")
def create_api_key(req: CreateApiKeyReq):
    return create_subaccount_api_key_helper(req)

@app.post("/twilio/subaccounts/addresses/create")
def create_address(req: AddressReq):
    return create_address_helper(req)

@app.post("/twilio/regulatory/bundles/init")
def init_bundle(req: BundleInitReq):
    return init_bundle_helper(req)

@app.post("/twilio/regulatory/bundles/end-users/create")
def create_end_user(req: EndUserReq):
    return create_end_user_helper(req)

@app.post("/twilio/regulatory/bundles/supporting-docs/create")
def create_supporting_doc(req: SupportingDocReq):
    return create_supporting_doc_helper(req)

@app.post("/twilio/regulatory/bundles/item-assignments/create")
def bundle_assign_item(req: AssignItemReq):
    return bundle_assign_item_helper(req)

@app.post("/twilio/regulatory/bundles/submit")
def submit_bundle(req: SubmitBundleReq):
    return submit_bundle_helper(req)

@app.post("/twilio/numbers/search")
def search_numbers(req: SearchNumbersReq):
    return search_numbers_helper(req)

@app.post("/twilio/numbers/buy")
def buy_number(req: BuyNumberReq):
    return buy_number_helper(req)

@app.post("/twilio/numbers/configure")
def configure_number(req: ConfigureNumberReq):
    return configure_number_helper(req)

@app.post("/twilio/numbers/provision")
def provision_number(req: FullProvisionReq):
    return provision_full_helper(req)

@app.post("/twilio/numbers/bundles/status-callback")
def bundle_status_callback(request: Request, bg: BackgroundTasks):
    return bundle_status_callback_helper(request, bg)

@app.get("/twilio/bundle/{bundle_sid}/status")
def get_bundle_status(bundle_sid: str):
    """Get the status of a bundle and associated phone number if provisioned."""
    from manage_twilio.twilio import load_plan
    
    plan = load_plan(bundle_sid)
    if not plan:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # TODO: Fetch current bundle status from Twilio API
    # For now, return the saved plan
    return {
        "bundle_sid": bundle_sid,
        "plan": plan,
        "message": "Bundle status retrieved. Check Twilio console for current status."
    }

@app.post("/api/regulatory/documents/upload")
async def upload_regulatory_document(
    file: UploadFile,
    document_type: str = Form(...),
    company_id: str = Form(...),
    current_user: str = Depends(get_current_user)
):
    """Upload regulatory document to Supabase storage and extract data"""
    return await upload_regulatory_document_helper(file, document_type, company_id)

@app.post("/api/regulatory/bundles/create")
async def create_regulatory_bundle(
    company_id: str = Form(...),
    business_name: str = Form(...),
    contact_email: str = Form(...),
    iso_country: str = Form(...),
    number_type: str = Form(...),
    end_user_type: str = Form(...),
    document_ids: List[str] = Form(...),  # Array of uploaded document IDs
    current_user: dict = Depends(get_current_user)
):
    """Create complete regulatory bundle with all components"""
    try:
        # Proceed with bundle creation first
        result = await create_complete_bundle_helper(
            company_id, business_name, contact_email,
            iso_country, number_type, end_user_type, document_ids
        )

        # Deduct credits only on successful creation+submission
        try:
            if result and result.get("status") == "success":
                from credits_helper import bundle_creation_with_credits
                credit_result = await bundle_creation_with_credits(current_user, company_id)
                print(f"✅ Credits deducted after bundle creation: {credit_result['credits_used']} credits")
            else:
                print("⚠️ Skipping credit deduction: bundle creation did not complete successfully")
        except Exception as billing_error:
            # Do not fail the request if billing fails; just log for follow-up
            print(f"⚠️ Bundle created but credit deduction failed: {billing_error}")

        return result
        
    except HTTPException as e:
        # Re-raise HTTP exceptions (like insufficient credits)
        raise e
    except Exception as e:
        print(f"❌ Error creating regulatory bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/regulatory/bundles/{bundle_sid}")
async def get_regulatory_bundle(
    bundle_sid: str,
    current_user: str = Depends(get_current_user)
):
    """Get regulatory bundle details and status"""
    return await get_bundle_details_helper(bundle_sid)

@app.get("/api/regulatory/bundles/company/{company_id}")
async def get_company_bundles(
    company_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get all regulatory bundles for a company"""
    return await get_company_bundles_helper(company_id)

@app.get("/api/regulatory/documents/{document_id}")
async def get_document_details(
    document_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get document details and extracted data"""
    return await get_document_details_helper(document_id)

@app.delete("/api/regulatory/documents/{document_id}")
async def delete_regulatory_document(
    document_id: str,
    current_user: str = Depends(get_current_user)
):
    """Delete regulatory document from storage and database"""
    return await delete_document_helper(document_id)

@app.post("/api/regulatory/bundles/{bundle_sid}/auto-provision")
async def configure_auto_provision(
    bundle_sid: str,
    auto_purchase: bool = Form(True),
    reserve_on_pending: bool = Form(False),
    current_user: str = Depends(get_current_user)
):
    """Configure auto-provisioning for a bundle"""
    try:
        # Get bundle to verify company ownership
        bundle = supabase.table("regulatory_bundles").select("company_id").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        company_id = bundle.data[0]["company_id"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Update auto-provision settings
        supabase.table("regulatory_bundles").update({
            "auto_purchase": auto_purchase,
            "reserve_on_pending": reserve_on_pending,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "message": "Auto-provision settings updated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error configuring auto-provision: {e}")
        raise HTTPException(status_code=500, detail=f"Error configuring auto-provision: {str(e)}")

@app.get("/api/regulatory/bundles/{bundle_sid}/phone-numbers")
async def get_bundle_phone_numbers(
    bundle_sid: str,
    current_user: str = Depends(get_current_user)
):
    """Get all phone numbers associated with a regulatory bundle"""
    try:
        # Get bundle to verify company ownership
        bundle = supabase.table("regulatory_bundles").select("company_id").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        company_id = bundle.data[0]["company_id"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Get phone numbers
        phone_numbers = supabase.table("phone_numbers").select("*").eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "phone_numbers": phone_numbers.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting bundle phone numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting bundle phone numbers: {str(e)}")

@app.post("/api/regulatory/bundles/{bundle_sid}/search-numbers")
async def search_available_numbers(
    bundle_sid: str,
    search_criteria: dict = Form(...),
    current_user: str = Depends(get_current_user)
):
    """Search for available phone numbers for a bundle"""
    return await search_numbers_for_bundle_helper(bundle_sid, search_criteria)

#-------Twilio Bundle Status Endpoints-------


@app.get("/twilio/bundle/{bundle_sid}/status")
def get_bundle_status(bundle_sid: str):
    """Get the status of a bundle from your database"""
    return get_bundle_status_from_db_helper(bundle_sid)



#-------Call Handling Endpoints-------

@app.post("/voice/incoming/{company_id}")
async def handle_incoming_call(company_id: str, request: Request):
    """Handle incoming voice calls and route to AI agent"""
    try:
        # Get Twilio parameters
        form_data = await request.form()
        call_sid = form_data.get("CallSid")
        from_number = form_data.get("From")
        to_number = form_data.get("To")
        
        # Create call data
        call_data = IncomingCallData(
            call_sid=call_sid,
            from_number=from_number,
            to_number=to_number,
            company_id=company_id
        )
        
        return handle_incoming_voice_call_helper(call_data)
        
    except Exception as e:
        print(f"❌ Error handling incoming call: {e}")
        error_response = VoiceResponse()
        error_response.say("We're experiencing technical difficulties. Please try again later.", voice="alice")
        error_response.hangup()
        return Response(content=str(error_response), media_type="application/xml")

@app.post("/voice/status")
async def handle_call_status(request: Request):
    """Handle call status updates from Twilio"""
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid")
        call_status = form_data.get("CallStatus")
        call_duration = form_data.get("CallDuration")
        recording_url = form_data.get("RecordingUrl")
        
        status_data = CallStatusData(
            call_sid=call_sid,
            call_status=call_status,
            call_duration=int(call_duration) if call_duration else None,
            recording_url=recording_url
        )
        
        return handle_call_status_helper(status_data)
        
    except Exception as e:
        print(f"❌ Error handling call status: {e}")
        return {"success": False, "error": str(e)}

@app.get("/voice/stream/{company_id}")
async def voice_stream(company_id: str, session_id: str = None):
    """WebSocket endpoint for real-time voice streaming"""
    try:
        stream_config = VoiceStreamConfig(
            company_id=company_id,
            session_id=session_id
        )
        
        return handle_voice_stream_helper(stream_config)
        
    except Exception as e:
        print(f"❌ Error in voice stream: {e}")
        error_response = VoiceResponse()
        error_response.say("I'm having trouble processing your request. Please try again.", voice="alice")
        return Response(content=str(error_response), media_type="application/xml")

@app.websocket("/voice/websocket/{company_id}/{session_id}")
async def voice_websocket(websocket: WebSocket, company_id: str, session_id: str):
    """WebSocket endpoint for real-time voice streaming with Twilio"""
    # Extract user_id from query parameters
    user_id = websocket.query_params.get("user_id")
    await handle_voice_websocket(websocket, session_id, company_id, user_id)

@app.post("/whatsapp/webhook")
async def handle_whatsapp_webhook(request: Request):
    """Handle incoming WhatsApp messages via Twilio"""
    try:
        form_data = await request.form()
        message_sid = form_data.get("MessageSid")
        from_number = form_data.get("From")
        to_number = form_data.get("To")
        body = form_data.get("Body", "")
        
        message_data = WhatsAppMessageData(
            message_sid=message_sid,
            from_number=from_number,
            to_number=to_number,
            body=body
        )
        
        return handle_whatsapp_message_helper(message_data)
        
    except Exception as e:
        print(f"❌ Error handling WhatsApp webhook: {e}")
        resp = MessagingResponse()
        resp.message("❌ Sorry, there was an error processing your message. Please try again.")
        return Response(content=str(resp), media_type="application/xml")

@app.post("/phone-numbers/{phone_number_sid}/configure")
async def configure_phone_number_endpoint(
    phone_number_sid: str,
    company_id: str,
    voice_url: str = None,
    sms_url: str = None
):
    """Configure a phone number to route calls to AI agent"""
    return configure_phone_number_helper(phone_number_sid, company_id, voice_url, sms_url)

@app.get("/phone-numbers/{phone_number_sid}/config")
async def get_phone_number_config_endpoint(phone_number_sid: str):
    """Get phone number configuration"""
    return get_phone_number_config_helper(phone_number_sid)

@app.get("/test_websocket")
async def test_websocket():
    """Serve the WebSocket test page"""
    return FileResponse("test_websocket.html")

@app.get("/static/test_websocket.html")
async def test_websocket_static():
    """Serve the WebSocket test page from static directory"""
    return FileResponse("test_websocket.html")

@app.get("/test_deepgram_websocket")
async def test_deepgram_websocket():
    """Serve the Deepgram WebSocket test page"""
    return FileResponse("test_deepgram_websocket.html")

# Import Deepgram WebSocket handler
from deepgram_websocket_handler import handle_deepgram_websocket

@app.websocket("/deepgram/websocket/test")
async def deepgram_websocket_test(websocket: WebSocket):
    """WebSocket endpoint for testing Deepgram real-time transcription"""
    await handle_deepgram_websocket(websocket, "test")

#-------Model Preferences Endpoints-------

from pydantic import BaseModel

class UserModelPreferences(BaseModel):
    tts_model_id: str
    stt_model_id: str

class CompanyModelDefaults(BaseModel):
    company_id: str
    tts_model_id: str
    stt_model_id: str

@app.post("/api/companies/{company_id}/set-default-models")
def set_company_default_models(company_id: str, defaults: CompanyModelDefaults):
    """Set default models for a company (called when company is created)"""
    try:
        # Get ElevenLabs model IDs
        tts_model = supabase.table("models").select("id").eq("type", "tts").eq("provider", "elevenlabs").eq("model_name", "eleven_flash_v2_5").execute()
        stt_model = supabase.table("models").select("id").eq("type", "stt").eq("provider", "elevenlabs").eq("model_name", "scribe_v1").execute()
        
        if not tts_model.data or not stt_model.data:
            raise HTTPException(status_code=404, detail="Default models not found")
        
        tts_model_id = tts_model.data[0]["id"]
        stt_model_id = stt_model.data[0]["id"]
        
        # Insert company defaults
        company_defaults = {
            "company_id": company_id,
            "tts_model_id": tts_model_id,
            "stt_model_id": stt_model_id
        }
        
        result = supabase.table("company_model_defaults").upsert(company_defaults).execute()
        
        return {
            "status": "success",
            "message": "Company default models set",
            "defaults": {
                "tts_model_id": tts_model_id,
                "stt_model_id": stt_model_id
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting company defaults: {str(e)}")

@app.get("/api/models/available")
def get_available_models():
    """Get all available models for user selection"""
    try:
        # Add retry logic for Supabase connection issues
        import time
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                models = supabase.table("models").select("*").eq("is_active", True).execute()
                break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt == max_retries - 1:
                    raise e
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
        
        if not models.data:
            # If no models in database, return empty structure
            return {
                "status": "success",
                "models": {
                    "tts": [],
                    "stt": [],
                    "llm": [],
                    "tool": []
                },
                "message": "No models found in database"
            }
        
        # Group by type for easier frontend handling
        grouped_models = {
            "tts": [],
            "stt": [],
            "llm": [],
            "tool": []
        }
        
        for model in models.data:
            model_type = model.get("type", "unknown")
            if model_type in grouped_models:
                grouped_models[model_type].append(model)
        
        return {
            "status": "success",
            "models": grouped_models
        }
        
    except Exception as e:
        print(f"Error in get_available_models: {str(e)}")
        # Return a fallback response instead of failing completely
        return {
            "status": "error",
            "models": {
                "tts": [],
                "stt": [],
                "llm": [],
                "tool": []
            },
            "error": f"Error fetching models: {str(e)}"
        }

@app.get("/api/users/{user_id}/model-preferences")
def get_user_model_preferences(user_id: str):
    """Get user's current model preferences"""
    try:
        # Try to get user preferences
        preferences = supabase.table("user_model_preferences").select("*").eq("user_id", user_id).execute()
        
        if preferences.data:
            return {
                "status": "success",
                "preferences": preferences.data[0]
            }
        else:
            # Get company defaults if user has no preferences
            user_company = supabase.table("companies").select("company_id").eq("user_id", user_id).execute()
            if user_company.data:
                company_id = user_company.data[0]["company_id"]
                defaults = supabase.table("company_model_defaults").select("*").eq("company_id", company_id).execute()
                
                if defaults.data:
                    return {
                        "status": "success",
                        "preferences": {
                            "user_id": user_id,
                            "tts_model_id": defaults.data[0]["tts_model_id"],
                            "stt_model_id": defaults.data[0]["stt_model_id"],
                            "using_company_defaults": True
                        }
                    }
            
            raise HTTPException(status_code=404, detail="No preferences or company defaults found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching preferences: {str(e)}")

@app.post("/api/users/{user_id}/model-preferences")
def set_user_model_preferences(user_id: str, preferences: UserModelPreferences):
    """Set user's model preferences"""
    try:
        # Validate that the models exist
        tts_model = supabase.table("models").select("id").eq("id", preferences.tts_model_id).eq("is_active", True).execute()
        stt_model = supabase.table("models").select("id").eq("id", preferences.stt_model_id).eq("is_active", True).execute()
        
        if not tts_model.data or not stt_model.data:
            raise HTTPException(status_code=400, detail="Invalid model IDs provided")
        
        # Upsert user preferences
        user_prefs = {
            "user_id": user_id,
            "tts_model_id": preferences.tts_model_id,
            "stt_model_id": preferences.stt_model_id
        }
        
        result = supabase.table("user_model_preferences").upsert(user_prefs).execute()
        
        return {
            "status": "success",
            "message": "User model preferences updated",
            "preferences": user_prefs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting preferences: {str(e)}")

@app.get("/api/users/{user_id}/effective-models")
def get_effective_models(user_id: str):
    """Get the actual models that will be used for this user (preferences or company defaults)"""
    try:
        # First try user preferences
        preferences = supabase.table("user_model_preferences").select("*").eq("user_id", user_id).execute()
        
        if preferences.data:
            tts_model_id = preferences.data[0]["tts_model_id"]
            stt_model_id = preferences.data[0]["stt_model_id"]
            source = "user_preferences"
        else:
            # Fall back to company defaults - try different ways to find user's company
            user_company = None
            
            # Method 1: Check if user is admin of a company
            admin_company = supabase.table("companies").select("company_id").eq("user_id", user_id).execute()
            if admin_company.data:
                user_company = admin_company.data[0]
                company_id = user_company["company_id"]  # Use the correct column name
            else:
                # Method 2: Check if there's a user-company relationship table (if you have one)
                # For now, we'll use a fallback approach
                
                # If no company found, create default response with hardcoded ElevenLabs models
                print(f"No company found for user {user_id}, using fallback defaults")
                
                # Get ElevenLabs models as fallback
                tts_fallback = supabase.table("models").select("*").eq("type", "tts").eq("provider", "elevenlabs").eq("model_name", "eleven_flash_v2_5").execute()
                stt_fallback = supabase.table("models").select("*").eq("type", "stt").eq("provider", "elevenlabs").eq("model_name", "scribe_v1").execute()
                
                if tts_fallback.data and stt_fallback.data:
                    return {
                        "status": "success",
                        "effective_models": {
                            "tts": tts_fallback.data[0],
                            "stt": stt_fallback.data[0],
                            "source": "system_defaults"
                        }
                    }
                else:
                    raise HTTPException(status_code=404, detail="No models available and no company defaults found")
            
            if not user_company:
                raise HTTPException(status_code=404, detail="User company not found")
            
            company_id = user_company["company_id"]
            defaults = supabase.table("company_model_defaults").select("*").eq("company_id", company_id).execute()
            
            if not defaults.data:
                # If no company defaults, try to create them automatically
                print(f"No company defaults found for company {company_id}, creating defaults")
                
                # Get ElevenLabs model IDs
                tts_model = supabase.table("models").select("id").eq("type", "tts").eq("provider", "elevenlabs").eq("model_name", "eleven_flash_v2_5").execute()
                stt_model = supabase.table("models").select("id").eq("type", "stt").eq("provider", "elevenlabs").eq("model_name", "scribe_v1").execute()
                
                if tts_model.data and stt_model.data:
                    # Create company defaults
                    company_defaults = {
                        "company_id": company_id,
                        "tts_model_id": tts_model.data[0]["id"],
                        "stt_model_id": stt_model.data[0]["id"]
                    }
                    
                    supabase.table("company_model_defaults").insert(company_defaults).execute()
                    
                    tts_model_id = tts_model.data[0]["id"]
                    stt_model_id = stt_model.data[0]["id"]
                else:
                    raise HTTPException(status_code=404, detail="Default models not available")
            else:
                tts_model_id = defaults.data[0]["tts_model_id"]
                stt_model_id = defaults.data[0]["stt_model_id"]
            
            source = "company_defaults"
        
        # Get model details
        tts_model = supabase.table("models").select("*").eq("id", tts_model_id).execute()
        stt_model = supabase.table("models").select("*").eq("id", stt_model_id).execute()
        
        return {
            "status": "success",
            "effective_models": {
                "tts": tts_model.data[0] if tts_model.data else None,
                "stt": stt_model.data[0] if stt_model.data else None,
                "source": source
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_effective_models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching effective models: {str(e)}")

@app.post("/api/models/initialize")
def initialize_models():
    """Initialize models table with default models if empty"""
    try:
        # Check if models table has data
        existing_models = supabase.table("models").select("id").limit(1).execute()
        
        if existing_models.data:
            return {
                "status": "success",
                "message": "Models already exist",
                "count": len(existing_models.data)
            }
        
        # Insert default models
        default_models = [
            # TTS Models
            {
                "type": "tts",
                "provider": "elevenlabs",
                "model_name": "eleven_flash_v2_5",
                "unidad": "minutes",
                "price_per_unidad": 0.15,
                "currency": "USD",
                "is_active": True
            },
            {
                "type": "tts",
                "provider": "elevenlabs", 
                "model_name": "eleven_turbo_v2",
                "unidad": "characters",
                "price_per_unidad": 0.000030,
                "currency": "USD",
                "is_active": True
            },
            # STT Models
            {
                "type": "stt",
                "provider": "elevenlabs",
                "model_name": "scribe_v1",
                "unidad": "minutes",
                "price_per_unidad": 0.000278,
                "currency": "USD",
                "is_active": True
            },
            {
                "type": "stt",
                "provider": "deepgram",
                "model_name": "nova-2",
                "unidad": "minutes",
                "price_per_unidad": 0.0058,
                "currency": "USD",
                "is_active": True
            },
            {
                "type": "stt",
                "provider": "openai",
                "model_name": "whisper-1",
                "unidad": "minutes",
                "price_per_unidad": 0.006,
                "currency": "USD",
                "is_active": True
            },
            # LLM Models
            {
                "type": "llm",
                "provider": "google",
                "model_name": "gemini-pro",
                "unidad": "tokens",
                "price_per_unidad": 0.0000005,
                "currency": "USD",
                "is_active": True
            },
            {
                "type": "llm",
                "provider": "openai",
                "model_name": "gpt-4o-mini",
                "unidad": "tokens", 
                "price_per_unidad": 0.000015,
                "currency": "USD",
                "is_active": True
            },
            # Tool Models
            {
                "type": "tool",
                "provider": "google",
                "model_name": "gemini-pro",
                "unidad": "tokens",
                "price_per_unidad": 0.0000005,
                "currency": "USD",
                "is_active": True
            }
        ]
        
        result = supabase.table("models").insert(default_models).execute()
        
        return {
            "status": "success",
            "message": "Models initialized successfully",
            "inserted_count": len(default_models)
        }
        
    except Exception as e:
        print(f"Error initializing models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error initializing models: {str(e)}")

#-------Company Cost Endpoints-------

def verify_company_admin(user_id: str, company_id: str) -> bool:
    """Verify user is admin of the company"""
    try:
        # Handle None user_id
        if not user_id:
            print(f"Error: user_id is None for company {company_id}")
            return False
        
        print(f"Verifying admin: user_id={user_id}, company_id={company_id}")
        
        company = supabase.table("companies").select("user_id").eq("company_id", company_id).eq("user_id", user_id).execute()
        
        is_admin = bool(company.data)
        print(f"Admin verification result: {is_admin}")
        
        return is_admin
    except Exception as e:
        print(f"Error verifying company admin: {e}")
        return False

@app.get("/api/companies/{company_id}/monthly-costs")
def get_company_monthly_costs(company_id: str, current_user: str = Depends(get_current_user)):
    """Get aggregated monthly costs for a company"""
    try:
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Get all user costs for this company
        user_costs = supabase.table("user_costs").select("*").eq("company_id", company_id).execute()
        
        if not user_costs.data:
            return {
                "status": "success",
                "monthly_costs": [],
                "message": "No cost data found for this company"
            }
        
        # Aggregate by month
        monthly_totals = {}
        for cost in user_costs.data:
            month = cost["month_year"]
            if month not in monthly_totals:
                monthly_totals[month] = {
                    "month_year": month,
                    "total_cost_usd": 0,
                    "tts_cost_usd": 0,
                    "stt_cost_usd": 0,
                    "llm_cost_usd": 0,
                    "tool_cost_usd": 0,
                    "active_users": 0
                }
            
            monthly_totals[month]["total_cost_usd"] += cost["total_cost_usd"]
            monthly_totals[month]["tts_cost_usd"] += cost["tts_cost_usd"]
            monthly_totals[month]["stt_cost_usd"] += cost["stt_cost_usd"]
            monthly_totals[month]["llm_cost_usd"] += cost["llm_cost_usd"]
            monthly_totals[month]["tool_cost_usd"] += cost["tool_cost_usd"]
            monthly_totals[month]["active_users"] += 1
        
        # Convert to list and sort by month (newest first)
        monthly_costs = list(monthly_totals.values())
        monthly_costs.sort(key=lambda x: x["month_year"], reverse=True)
        
        return {
            "status": "success",
            "monthly_costs": monthly_costs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting company monthly costs: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching company costs: {str(e)}")

@app.get("/api/companies/{company_id}/usage-breakdown")
def get_company_usage_breakdown(
    company_id: str, 
    limit: int = 100,
    current_user: str = Depends(get_current_user)
):
    """Get detailed usage breakdown for a company"""
    try:
        # Debug authentication
        print(f"Debug: current_user = {current_user}")
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: Not a company admin. User: {current_user}, Company: {company_id}"
            )
        
        # Get usage data with model info only (no user join)
        usage_data = supabase.table("user_model_usage").select("""
            *,
            models:model_id (
                type,
                provider,
                model_name,
                unidad,
                price_per_unidad
            )
        """).eq("company_id", company_id).order("created_at", desc=True).limit(limit).execute()
        
        if not usage_data.data:
            return {
                "status": "success",
                "usage_breakdown": [],
                "message": "No usage data found for this company"
            }
        
        # Get user emails separately to avoid join issues
        user_ids = list(set([item["user_id"] for item in usage_data.data if item["user_id"]]))
        
        # Format the response without user emails (since auth.users table doesn't exist)
        usage_breakdown = []
        for item in usage_data.data:
            usage_breakdown.append({
                "id": item["id"],
                "user_id": item["user_id"],
                "user_email": f"User {item['user_id'][:8]}..." if item["user_id"] else "Unknown User",
                "model_type": item["models"]["type"] if item["models"] else "unknown",
                "provider": item["models"]["provider"] if item["models"] else "unknown",
                "model_name": item["models"]["model_name"] if item["models"] else "unknown",
                "usage_amount": item["usage_amount"],
                "cost_usd": item["cost_usd"],
                "created_at": item["created_at"],
                "metadata": item.get("metadata", {})
            })
        
        return {
            "status": "success",
            "usage_breakdown": usage_breakdown
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting company usage breakdown: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching usage breakdown: {str(e)}")

@app.get("/api/companies/{company_id}/user-costs")
def get_company_user_costs(
    company_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get individual user costs within a company"""
    try:
        # Debug authentication
        print(f"Debug: current_user = {current_user}")
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: Not a company admin. User: {current_user}, Company: {company_id}"
            )
        
        # Get user costs without join first
        user_costs = supabase.table("user_costs").select("*").eq("company_id", company_id).order("total_cost_usd", desc=True).execute()
        
        if not user_costs.data:
            return {
                "status": "success",
                "user_costs": [],
                "message": "No user cost data found for this company"
            }
        
        # Get user emails separately to avoid join issues
        user_ids = list(set([cost["user_id"] for cost in user_costs.data if cost["user_id"]]))
        
        # Format the response without user emails (since auth.users table doesn't exist)
        formatted_costs = []
        for cost in user_costs.data:
            formatted_costs.append({
                "user_id": cost["user_id"],
                "user_email": f"User {cost['user_id'][:8]}..." if cost["user_id"] else "Unknown User",
                "month_year": cost["month_year"],
                "total_cost_usd": cost["total_cost_usd"],
                "tts_cost_usd": cost["tts_cost_usd"],
                "stt_cost_usd": cost["stt_cost_usd"],
                "llm_cost_usd": cost["llm_cost_usd"],
                "tool_cost_usd": cost["tool_cost_usd"]
            })
        
        return {
            "status": "success",
            "user_costs": formatted_costs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting company user costs: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching user costs: {str(e)}")

@app.get("/api/companies/{company_id}/cost-summary")
def get_company_cost_summary(
    company_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get overall cost summary for a company"""
    try:
        # Debug authentication
        print(f"Debug: current_user = {current_user}")
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: Not a company admin. User: {current_user}, Company: {company_id}"
            )
        
        # Get all user costs for this company
        user_costs = supabase.table("user_costs").select("*").eq("company_id", company_id).execute()
        
        if not user_costs.data:
            return {
                "status": "success",
                "cost_summary": {
                    "total_cost_usd": 0,
                    "tts_cost_usd": 0,
                    "stt_cost_usd": 0,
                    "llm_cost_usd": 0,
                    "tool_cost_usd": 0,
                    "total_users": 0,
                    "total_months": 0,
                    "average_cost_per_user": 0,
                    "average_cost_per_month": 0
                },
                "message": "No cost data found for this company"
            }
        
        # Calculate totals
        total_cost = sum(cost["total_cost_usd"] for cost in user_costs.data)
        total_tts = sum(cost["tts_cost_usd"] for cost in user_costs.data)
        total_stt = sum(cost["stt_cost_usd"] for cost in user_costs.data)
        total_llm = sum(cost["llm_cost_usd"] for cost in user_costs.data)
        total_tool = sum(cost["tool_cost_usd"] for cost in user_costs.data)
        
        # Get unique users and months
        unique_users = len(set(cost["user_id"] for cost in user_costs.data))
        unique_months = len(set(cost["month_year"] for cost in user_costs.data))
        
        # Calculate averages
        avg_cost_per_user = total_cost / unique_users if unique_users > 0 else 0
        avg_cost_per_month = total_cost / unique_months if unique_months > 0 else 0
        
        cost_summary = {
            "total_cost_usd": total_cost,
            "tts_cost_usd": total_tts,
            "stt_cost_usd": total_stt,
            "llm_cost_usd": total_llm,
            "tool_cost_usd": total_tool,
            "total_users": unique_users,
            "total_months": unique_months,
            "average_cost_per_user": avg_cost_per_user,
            "average_cost_per_month": avg_cost_per_month
        }
        
        return {
            "status": "success",
            "cost_summary": cost_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting company cost summary: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching cost summary: {str(e)}")

# Temporary test endpoint (remove in production)
@app.get("/api/test/companies/{company_id}/cost-summary")
def test_company_cost_summary(company_id: str):
    """Temporary test endpoint for company cost summary without authentication"""
    try:
        print(f"Test endpoint called for company: {company_id}")
        
        # Get all user costs for this company
        user_costs = supabase.table("user_costs").select("*").eq("company_id", company_id).execute()
        
        if not user_costs.data:
            return {
                "status": "success",
                "cost_summary": {
                    "total_cost_usd": 0,
                    "tts_cost_usd": 0,
                    "stt_cost_usd": 0,
                    "llm_cost_usd": 0,
                    "tool_cost_usd": 0,
                    "total_users": 0,
                    "total_months": 0,
                    "average_cost_per_user": 0,
                    "average_cost_per_month": 0
                },
                "message": "No cost data found for this company"
            }
        
        # Calculate totals
        total_cost = sum(cost["total_cost_usd"] for cost in user_costs.data)
        total_tts = sum(cost["tts_cost_usd"] for cost in user_costs.data)
        total_stt = sum(cost["stt_cost_usd"] for cost in user_costs.data)
        total_llm = sum(cost["llm_cost_usd"] for cost in user_costs.data)
        total_tool = sum(cost["tool_cost_usd"] for cost in user_costs.data)
        
        # Get unique users and months
        unique_users = len(set(cost["user_id"] for cost in user_costs.data))
        unique_months = len(set(cost["month_year"] for cost in user_costs.data))
        
        # Calculate averages
        avg_cost_per_user = total_cost / unique_users if unique_users > 0 else 0
        avg_cost_per_month = total_cost / unique_months if unique_months > 0 else 0
        
        cost_summary = {
            "total_cost_usd": total_cost,
            "tts_cost_usd": total_tts,
            "stt_cost_usd": total_stt,
            "llm_cost_usd": total_llm,
            "tool_cost_usd": total_tool,
            "total_users": unique_users,
            "total_months": unique_months,
            "average_cost_per_user": avg_cost_per_user,
            "average_cost_per_month": avg_cost_per_month
        }
        
        return {
            "status": "success",
            "cost_summary": cost_summary
        }
        
    except Exception as e:
        print(f"Error in test company cost summary: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching cost summary: {str(e)}")

# Temporary test endpoint for user costs (remove in production)
@app.get("/api/test/companies/{company_id}/user-costs")
def test_company_user_costs(company_id: str):
    """Temporary test endpoint for company user costs without authentication"""
    try:
        print(f"Test user-costs endpoint called for company: {company_id}")
        
        # Get user costs without join first
        user_costs = supabase.table("user_costs").select("*").eq("company_id", company_id).order("total_cost_usd", desc=True).execute()
        
        if not user_costs.data:
            return {
                "status": "success",
                "user_costs": [],
                "message": "No user cost data found for this company"
            }
        
        # Get user emails separately to avoid join issues
        user_ids = list(set([cost["user_id"] for cost in user_costs.data if cost["user_id"]]))
        
        # Format the response without user emails (since auth.users table doesn't exist)
        formatted_costs = []
        for cost in user_costs.data:
            formatted_costs.append({
                "user_id": cost["user_id"],
                "user_email": f"User {cost['user_id'][:8]}..." if cost["user_id"] else "Unknown User",
                "month_year": cost["month_year"],
                "total_cost_usd": cost["total_cost_usd"],
                "tts_cost_usd": cost["tts_cost_usd"],
                "stt_cost_usd": cost["stt_cost_usd"],
                "llm_cost_usd": cost["llm_cost_usd"],
                "tool_cost_usd": cost["tool_cost_usd"]
            })
        
        return {
            "status": "success",
            "user_costs": formatted_costs
        }
        
    except Exception as e:
        print(f"Error in test company user costs: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching user costs: {str(e)}")

# Phone number management endpoints
@app.post("/api/phone-numbers/register")
async def register_phone_number(
    phone_number: str,
    company_id: str,
    is_primary: bool = False,
    current_user: str = Depends(get_current_user)
):
    """Register a phone number for a user"""
    try:
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Check if phone number already exists
        existing = supabase.table("phone_number_users").select("*").eq("phone_number", phone_number).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Register the phone number
        phone_data = {
            "phone_number": phone_number,
            "user_id": current_user,
            "company_id": company_id,
            "is_primary": is_primary
        }
        
        result = supabase.table("phone_number_users").insert(phone_data).execute()
        
        print(f"✅ Registered phone number {phone_number} for user {current_user}")
        return {"status": "success", "message": "Phone number registered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error registering phone number: {e}")
        raise HTTPException(status_code=500, detail=f"Error registering phone number: {str(e)}")

@app.get("/api/phone-numbers/user/{user_id}")
async def get_user_phone_numbers(
    user_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get all phone numbers for a user"""
    try:
        # Verify user can access this data
        if current_user != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get phone numbers from the phone_numbers table
        result = supabase.table("phone_numbers").select("*").eq("user_id", user_id).execute()
        
        return {
            "status": "success",
            "phone_numbers": result.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting user phone numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting phone numbers: {str(e)}")

@app.delete("/api/phone-numbers/{phone_number}")
async def delete_phone_number(
    phone_number: str,
    current_user: str = Depends(get_current_user)
):
    """Delete a phone number registration"""
    try:
        # Verify user owns this phone number
        existing = supabase.table("phone_numbers").select("*").eq("phone_number", phone_number).eq("user_id", current_user).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Phone number not found or not owned by user")
        
        supabase.table("phone_numbers").delete().eq("phone_number", phone_number).execute()
        
        print(f"✅ Deleted phone number {phone_number} for user {current_user}")
        return {"status": "success", "message": "Phone number deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting phone number: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting phone number: {str(e)}")

# Periodic cleanup task for chat sessions
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    print("🚀 Starting application...")
    from manage_twilio.twilio import monitor_bundle_statuses
    # Start background tasks
    asyncio.create_task(periodic_cleanup())
    asyncio.create_task(monitor_bundle_statuses())
    
    print("✅ Application started successfully")

async def periodic_cleanup():
    """Periodically clean up old chat sessions"""
    while True:
        try:
            # Import the cleanup function from agent module
            from agent.agent import cleanup_chat_sessions
            # Temporarily disable cleanup to prevent session loss
            # await cleanup_chat_sessions()
            print("🧹 Periodic cleanup disabled to prevent session loss")
        except Exception as e:
            print(f"❌ Error in periodic cleanup: {e}")
        
        # Wait 5 minutes before next cleanup
        await asyncio.sleep(300)  # 5 minutes

# Regulatory Bundle Management Endpoints
@app.get("/api/regulatory/bundles/{company_id}")
async def get_company_regulatory_bundles(
    company_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get all regulatory bundles for a company"""
    try:
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Get bundles from database
        bundles = supabase.table("regulatory_bundles").select("*").eq("company_id", company_id).execute()
        
        return {
            "status": "success",
            "bundles": bundles.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting regulatory bundles: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting regulatory bundles: {str(e)}")

@app.get("/api/regulatory/bundles/{bundle_sid}/status")
async def get_bundle_status_endpoint(
    bundle_sid: str,
    current_user: str = Depends(get_current_user)
):
    """Get detailed status of a specific regulatory bundle"""
    try:
        # Get bundle from database
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_info = bundle.data[0]
        company_id = bundle_info["company_id"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Get associated phone numbers
        phone_numbers = supabase.table("phone_numbers").select("*").eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "bundle": bundle_info,
            "phone_numbers": phone_numbers.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting bundle status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting bundle status: {str(e)}")

@app.get("/api/regulatory/bundles/{bundle_sid}/phone-numbers")
async def get_bundle_phone_numbers(
    bundle_sid: str,
    current_user: str = Depends(get_current_user)
):
    """Get all phone numbers associated with a regulatory bundle"""
    try:
        # Get bundle to verify company ownership
        bundle = supabase.table("regulatory_bundles").select("company_id").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        company_id = bundle.data[0]["company_id"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Get phone numbers
        phone_numbers = supabase.table("phone_numbers").select("*").eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "phone_numbers": phone_numbers.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting bundle phone numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting bundle phone numbers: {str(e)}")

@app.post("/api/regulatory/bundles/{bundle_sid}/auto-provision")
async def configure_auto_provision(
    bundle_sid: str,
    auto_purchase: bool = True,
    reserve_on_pending: bool = False,
    current_user: str = Depends(get_current_user)
):
    """Configure auto-provisioning settings for a bundle"""
    try:
        # Get bundle to verify company ownership
        bundle = supabase.table("regulatory_bundles").select("company_id").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        company_id = bundle.data[0]["company_id"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Update auto-provision settings
        supabase.table("regulatory_bundles").update({
            "auto_purchase": auto_purchase,
            "reserve_on_pending": reserve_on_pending,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "message": "Auto-provision settings updated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error configuring auto-provision: {e}")
        raise HTTPException(status_code=500, detail=f"Error configuring auto-provision: {str(e)}")

@app.post("/api/regulatory/bundles/{bundle_sid}/check-status")
async def check_bundle_status(
    bundle_sid: str,
    current_user: str = Depends(get_current_user)
):
    """Manually check and update bundle status"""
    try:
        # Get bundle to verify company ownership
        bundle = supabase.table("regulatory_bundles").select("company_id, status").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        company_id = bundle.data[0]["company_id"]
        current_status = bundle.data[0]["status"]
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Check status from Twilio
        from manage_twilio.twilio import get_bundle_status_from_twilio
        twilio_status = await get_bundle_status_from_twilio(bundle_sid)
        
        # Update if status changed
        if twilio_status != current_status:
            supabase.table("regulatory_bundles").update({
                "status": twilio_status,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("bundle_sid", bundle_sid).execute()
            
            # If approved, trigger auto-provisioning
            if twilio_status == "approved":
                from manage_twilio.twilio import handle_bundle_approval
                await handle_bundle_approval(bundle.data[0])
        
        return {
            "status": "success",
            "bundle_sid": bundle_sid,
            "previous_status": current_status,
            "current_status": twilio_status,
            "updated": twilio_status != current_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error checking bundle status: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking bundle status: {str(e)}")

@app.post("/api/regulatory/bundles/webhook")
async def regulatory_bundle_webhook(request: Request):
    """Webhook for Twilio regulatory bundle status updates"""
    try:
        # Parse webhook data
        form_data = await request.form()
        bundle_sid = form_data.get("BundleSid")
        status = form_data.get("Status")
        
        print(f"📞 Webhook received for bundle {bundle_sid}: {status}")
        
        if bundle_sid and status:
            # Update bundle status in database
            supabase.table("regulatory_bundles").update({
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("bundle_sid", bundle_sid).execute()
            
            # If approved, trigger auto-provisioning
            if status == "approved":
                bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute().data[0]
                from manage_twilio.twilio import handle_bundle_approval
                await handle_bundle_approval(bundle)
            
            print(f"✅ Bundle {bundle_sid} status updated to {status}")
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"❌ Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

@app.get("/api/phone-numbers/company/{company_id}")
async def get_company_phone_numbers(
    company_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get all phone numbers for a company"""
    try:
        print(f"🔍 Debug: Getting phone numbers for company_id={company_id}, current_user={current_user}")
        
        # Check if user is authenticated
        if not current_user:
            print("❌ No authenticated user found")
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            print(f"❌ Access denied: User {current_user} is not admin of company {company_id}")
            
            # Additional debug: Check if company exists
            company_check = supabase.table("companies").select("company_id, user_id, company_name").eq("company_id", company_id).execute()
            if not company_check.data:
                print(f"❌ Company {company_id} does not exist")
                raise HTTPException(status_code=404, detail="Company not found")
            else:
                actual_owner = company_check.data[0].get("user_id")
                company_name = company_check.data[0].get("company_name", "Unknown")
                print(f"❌ Company {company_id} ({company_name}) belongs to user {actual_owner}, not {current_user}")
                raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        print(f"✅ Admin verification passed for user {current_user}")
        
        # Get phone numbers from the phone_numbers table for this company
        result = supabase.table("phone_numbers").select("*").eq("company_id", company_id).execute()
        print(f"📞 Found {len(result.data)} phone numbers in phone_numbers table")
        
        # Also get phone numbers from regulatory bundles
        bundles = supabase.table("regulatory_bundles").select("bundle_sid, purchased_number, business_name, status, purchase_date, auto_provisioned").eq("company_id", company_id).execute()
        print(f"📋 Found {len(bundles.data)} regulatory bundles")
        
        # Combine both sources
        all_phone_numbers = []
        
        # Add regular phone numbers
        for phone in result.data:
            all_phone_numbers.append({
                "phone_number": phone["phone_number"],
                "source": "registered",
                "status": phone.get("status", "active"),
                "created_at": phone.get("created_at"),
                "purchase_date": phone.get("purchase_date"),
                "is_primary": phone.get("is_primary", False),
                "user_id": phone.get("user_id"),
                "company_id": phone["company_id"],
                "twilio_sid": phone.get("twilio_sid"),
                "capabilities": phone.get("capabilities", [])
            })
        
        # Add purchased numbers from bundles (avoid duplicates)
        existing_numbers = {phone["phone_number"] for phone in all_phone_numbers}
        
        for bundle in bundles.data:
            if bundle.get("purchased_number") and bundle["purchased_number"] not in existing_numbers:
                all_phone_numbers.append({
                    "phone_number": bundle["purchased_number"],
                    "source": "regulatory_bundle",
                    "status": "active" if bundle.get("status") == "approved" else "pending",
                    "bundle_sid": bundle["bundle_sid"],
                    "business_name": bundle.get("business_name"),
                    "bundle_status": bundle.get("status"),
                    "purchase_date": bundle.get("purchase_date"),
                    "auto_provisioned": bundle.get("auto_provisioned", False),
                    "company_id": company_id
                })
        
        print(f"✅ Returning {len(all_phone_numbers)} total phone numbers")
        
        return {
            "status": "success",
            "company_id": company_id,
            "phone_numbers": all_phone_numbers,
            "total_count": len(all_phone_numbers)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting company phone numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting company phone numbers: {str(e)}")

@app.get("/api/debug/user-companies")
async def debug_user_companies(current_user: str = Depends(get_current_user)):
    """Debug endpoint to check what companies a user has access to"""
    try:
        print(f"🔍 Debug: Checking companies for user {current_user}")
        
        # Get all companies for this user
        companies = supabase.table("companies").select("company_id, company_name, user_id").eq("user_id", current_user).execute()
        
        print(f"📊 User {current_user} has access to {len(companies.data)} companies:")
        for company in companies.data:
            print(f"  - Company ID: {company['company_id']}, Name: {company.get('company_name', 'Unknown')}")
        
        return {
            "status": "success",
            "user_id": current_user,
            "companies": companies.data,
            "total_count": len(companies.data)
        }
        
    except Exception as e:
        print(f"❌ Error getting user companies: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting user companies: {str(e)}")

@app.get("/api/debug/auth-test")
async def debug_auth_test(
    authorization: str = Header(None),
    current_user: str = Depends(get_current_user)
):
    """Debug endpoint to test authentication"""
    return {
        "status": "success",
        "authorization_header_present": authorization is not None,
        "authorization_header_format": authorization[:50] if authorization else None,
        "current_user": current_user,
        "authenticated": current_user is not None
    }

@app.post("/api/phone-numbers/{phone_number}/configure")
async def configure_phone_number_for_ai(
    phone_number: str,
    company_id: str = Form(...),
    current_user: str = Depends(get_current_user)
):
    """Configure an existing phone number to work with AI agent"""
    try:
        # Check if user is authenticated
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Verify user is company admin
        if not verify_company_admin(current_user, company_id):
            raise HTTPException(status_code=403, detail="Access denied: Not a company admin")
        
        # Configure the phone number
        from manage_twilio.calls import configure_phone_number_helper
        result = configure_phone_number_helper(phone_number, company_id)
        
        return {
            "status": "success",
            "message": f"Phone number {phone_number} configured for AI agent",
            "configuration": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error configuring phone number: {e}")
        raise HTTPException(status_code=500, detail=f"Error configuring phone number: {str(e)}")

@app.get("/api/debug/phone-lookup/{phone_number}")
async def debug_phone_lookup(phone_number: str):
    """Debug endpoint to test phone number to company/user lookup"""
    try:
        from manage_twilio.calls import extract_company_from_phone_number, get_user_from_phone_number
        
        company_id = extract_company_from_phone_number(phone_number)
        user_id = get_user_from_phone_number(phone_number)
        
        # Also check what's in the database
        phone_numbers_result = supabase.table("phone_numbers").select("*").eq("phone_number", phone_number).execute()
        phone_users_result = supabase.table("phone_number_users").select("*").eq("phone_number", phone_number).execute()
        
        return {
            "status": "success",
            "phone_number": phone_number,
            "lookup_results": {
                "company_id": company_id,
                "user_id": user_id
            },
            "database_records": {
                "phone_numbers_table": phone_numbers_result.data,
                "phone_number_users_table": phone_users_result.data
            }
        }
        
    except Exception as e:
        print(f"❌ Error in phone lookup: {e}")
        raise HTTPException(status_code=500, detail=f"Error in phone lookup: {str(e)}")

@app.get("/api/debug/document-types")
async def debug_document_types():
    """Debug endpoint to check available Twilio document types"""
    try:
        from manage_twilio.twilio import get_twilio_document_types
        
        document_types = get_twilio_document_types()
        
        return {
            "status": "success",
            "document_types": document_types,
            "count": len(document_types)
        }
    except Exception as e:
        print(f"❌ Error fetching document types: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching document types: {str(e)}")

@app.delete("/api/regulatory/bundles/{bundle_sid}")
async def delete_regulatory_bundle(
    bundle_sid: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a regulatory bundle from Twilio and database"""
    try:
        # Get bundle details from database
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_data = bundle.data[0]
        
        # Verify user has access to this bundle
        if bundle_data.get("company_id") != current_user.get("company_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete from Twilio and database
        from manage_twilio.twilio import delete_bundle_helper
        
        result = delete_bundle_helper(
            bundle_sid=bundle_sid,
            subaccount_sid=bundle_data["subaccount_sid"],
            api_key_sid=bundle_data["api_key_sid"],
            api_key_secret=bundle_data["api_key_secret"]
        )
        
        return result
        
    except Exception as e:
        print(f"❌ Error deleting regulatory bundle: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting bundle: {str(e)}")

@app.post("/api/regulatory/bundles/{bundle_sid}/submit")
async def submit_bundle_for_approval(
    bundle_sid: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually submit a bundle for regulatory approval"""
    try:
        # Get bundle details from database
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_data = bundle.data[0]
        
        # Verify user has access to this bundle
        if bundle_data.get("company_id") != current_user.get("company_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if bundle is in draft status
        if bundle_data.get("status") != "draft":
            raise HTTPException(status_code=400, detail=f"Bundle is not in draft status. Current status: {bundle_data.get('status')}")
        
        # Submit bundle for approval
        from manage_twilio.twilio import submit_bundle_for_approval_helper
        
        result = submit_bundle_for_approval_helper(bundle_sid)
        
        # Update database with pending-review status
        supabase.table("regulatory_bundles").update({
            "status": "pending-review",
            "submitted_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("bundle_sid", bundle_sid).execute()
        
        return {
            "status": "success",
            "bundle_sid": bundle_sid,
            "message": "Bundle submitted for regulatory approval",
            "new_status": "pending-review"
        }
        
    except Exception as e:
        print(f"❌ Error submitting bundle for approval: {e}")
        raise HTTPException(status_code=500, detail=f"Error submitting bundle: {str(e)}")

# Credit system endpoints
@app.get("/api/credits/balance")
async def get_credit_balance(current_user: str = Depends(get_current_user)):
    """Get current credit balance for user"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        result = supabase.table("user_credits").select("*").eq("user_id", current_user).execute()
        
        if not result.data:
            # Create new credit record if doesn't exist
            # Get company_id from user's companies
            company_result = supabase.table("companies").select("company_id").eq("user_id", current_user).limit(1).execute()
            company_id = company_result.data[0]["company_id"] if company_result.data else None
            
            supabase.table("user_credits").insert({
                "user_id": current_user,
                "company_id": company_id,
                "credits_balance": 0,
                "total_credits_purchased": 0,
                "total_credits_used": 0
            }).execute()
            return {"credits_balance": 0, "total_purchased": 0, "total_used": 0}
        
        credit_data = result.data[0]
        return {
            "credits_balance": credit_data["credits_balance"],
            "total_purchased": credit_data["total_credits_purchased"],
            "total_used": credit_data["total_credits_used"]
        }
        
    except Exception as e:
        print(f"❌ Error getting credit balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/credits/packages")
async def get_credit_packages():
    """Get available credit packages"""
    try:
        result = supabase.table("credit_packages").select("*").eq("is_active", True).execute()
        return {"packages": result.data}
        
    except Exception as e:
        print(f"❌ Error getting credit packages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/credits/checkout")
async def create_credit_checkout(
    package_id: str,
    current_user: str = Depends(get_current_user)
):
    """Create Stripe checkout session for credit purchase"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Get package details
        package_result = supabase.table("credit_packages").select("*").eq("id", package_id).execute()
        if not package_result.data:
            raise HTTPException(status_code=404, detail="Package not found")
        
        package_data = package_result.data[0]
        
        # Get company_id from user's companies
        company_result = supabase.table("companies").select("company_id").eq("user_id", current_user).limit(1).execute()
        company_id = company_result.data[0]["company_id"] if company_result.data else None
        
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'mxn',
                    'product_data': {
                        'name': f"{package_data['name']} - {package_data['credits_amount']} Credits",
                        'description': f"Purchase {package_data['credits_amount']} credits for your AI agent"
                    },
                    'unit_amount': package_data['price_cents'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{BASE_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{BASE_URL}/payment/cancel",
            metadata={
                'user_id': current_user,
                'company_id': company_id,
                'package_id': package_id,
                'credits_amount': package_data['credits_amount'],
                'package_name': package_data['name']
            }
        )
        
        return {"checkout_url": checkout_session.url}
        
    except Exception as e:
        print(f"❌ Error creating checkout: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/credits/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook for successful payments"""
    try:
        print(f"🔔 Stripe webhook received")
        
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        print(f"🔔 Payload length: {len(payload)}")
        print(f"🔔 Signature header: {sig_header[:50] if sig_header else 'None'}...")
        
        # Check if webhook secret is configured
        webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        if not webhook_secret:
            print(f"❌ STRIPE_WEBHOOK_SECRET not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        
        print(f"🔔 Webhook secret configured: {webhook_secret[:10]}...")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            print(f"🔔 Event verified successfully: {event['type']}")
        except Exception as verify_error:
            print(f"❌ Webhook signature verification failed: {verify_error}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            print(f"🔔 Processing checkout.session.completed")
            print(f"🔔 Session metadata: {session.get('metadata', {})}")
            
            # Add credits to user account
            user_id = session['metadata']['user_id']
            company_id = session['metadata']['company_id']
            credits_amount = int(session['metadata']['credits_amount'])
            package_name = session['metadata']['package_name']
            
            print(f"🔔 Adding {credits_amount} credits for user {user_id}")
            
            try:
                # First, get current user credits
                print(f"🔔 Fetching current user credits...")
                current_credits_result = supabase.table("user_credits").select("credits_balance, total_credits_purchased").eq("user_id", user_id).execute()
                
                current_balance = 0
                current_purchased = 0
                
                if current_credits_result.data:
                    # Use the first record (should be the most recent)
                    current_balance = current_credits_result.data[0].get("credits_balance", 0)
                    current_purchased = current_credits_result.data[0].get("total_credits_purchased", 0)
                    print(f" Current balance: {current_balance}, Current purchased: {current_purchased}")
                else:
                    print(f" No existing credit record found, creating new one")
                
                # Calculate new values
                new_balance = current_balance + credits_amount
                new_purchased = current_purchased + credits_amount
                
                print(f"🔔 New balance will be: {new_balance}, New purchased: {new_purchased}")
                
                # Update user credits using upsert with user_id as the unique key
                print(f"🔔 Updating user credits in database...")
                result = supabase.table("user_credits").upsert({
                    "user_id": user_id,
                    "company_id": company_id,
                    "credits_balance": new_balance,
                    "total_credits_purchased": new_purchased,
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="user_id").execute()  # ← THIS IS THE KEY FIX!
                
                print(f"✅ User credits updated: {result}")
                
                # Log transaction
                print(f"🔔 Logging transaction...")
                transaction_result = supabase.table("credit_transactions").insert({
                    "user_id": user_id,
                    "company_id": company_id,
                    "transaction_type": "purchase",
                    "credits_amount": credits_amount,
                    "stripe_payment_intent_id": session['payment_intent'],
                    "description": f"Credit purchase - {package_name} ({credits_amount} credits)"
                }).execute()
                print(f"✅ Transaction logged: {transaction_result}")
                
                print(f"✅ Credits added successfully: {credits_amount} for user {user_id}")
                
            except Exception as db_error:
                print(f"❌ Database error: {db_error}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
        else:
            print(f"🔔 Ignoring event type: {event['type']}")
        
        return {"status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/credits/use")
async def use_credits(
    usage_type: str,
    amount: int,
    description: str = None,
    current_user: str = Depends(get_current_user)
):
    """Use credits for a specific service"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Calculate credits needed based on usage type
        credits_needed = calculate_credits_needed(usage_type, amount)
        
        # Get current balance
        result = supabase.table("user_credits").select("credits_balance").eq("user_id", current_user).execute()
        
        if not result.data:
            raise HTTPException(status_code=402, detail="No credit account found")
        
        current_balance = result.data[0]["credits_balance"]
        
        # Check if user has enough credits
        if current_balance < credits_needed:
            raise HTTPException(
                status_code=402, 
                detail=f"Insufficient credits. Need {credits_needed}, have {current_balance}"
            )
        
        # Get company_id from user's companies
        company_result = supabase.table("companies").select("id").eq("user_id", current_user).limit(1).execute()
        company_id = company_result.data[0]["id"] if company_result.data else None
        
        # Deduct credits
        supabase.table("user_credits").update({
            "credits_balance": current_balance - credits_needed,
            "total_credits_used": supabase.raw(f"total_credits_used + {credits_needed}"),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("user_id", current_user).execute()
        
        # Log transaction
        supabase.table("credit_transactions").insert({
            "user_id": current_user,
            "company_id": company_id,
            "transaction_type": "usage",
            "credits_amount": -credits_needed,
            "description": description or f"{usage_type} usage ({amount} units)"
        }).execute()
        
        return {
            "credits_used": credits_needed,
            "remaining_credits": current_balance - credits_needed,
            "usage_type": usage_type,
            "amount": amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error using credits: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/credits/transactions")
async def get_credit_transactions(
    limit: int = 50,
    offset: int = 0,
    current_user: str = Depends(get_current_user)
):
    """Get credit transaction history"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        result = supabase.table("credit_transactions").select("*").eq("user_id", current_user).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return {"transactions": result.data}
        
    except Exception as e:
        print(f"❌ Error getting transactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/credit-tables")
async def debug_credit_tables():
    """Debug endpoint to check if credit tables exist"""
    try:
        # Check if user_credits table exists
        try:
            user_credits_result = supabase.table("user_credits").select("count").limit(1).execute()
            user_credits_exists = True
        except Exception as e:
            user_credits_exists = False
            user_credits_error = str(e)
        
        # Check if credit_transactions table exists
        try:
            transactions_result = supabase.table("credit_transactions").select("count").limit(1).execute()
            transactions_exists = True
        except Exception as e:
            transactions_exists = False
            transactions_error = str(e)
        
        # Check if credit_packages table exists
        try:
            packages_result = supabase.table("credit_packages").select("count").limit(1).execute()
            packages_exists = True
        except Exception as e:
            packages_exists = False
            packages_error = str(e)
        
        # Check if credit_costs table exists
        try:
            costs_result = supabase.table("credit_costs").select("count").limit(1).execute()
            costs_exists = True
        except Exception as e:
            costs_exists = False
            costs_error = str(e)
        
        return {
            "user_credits": {
                "exists": user_credits_exists,
                "error": user_credits_error if not user_credits_exists else None
            },
            "credit_transactions": {
                "exists": transactions_exists,
                "error": transactions_error if not transactions_exists else None
            },
            "credit_packages": {
                "exists": packages_exists,
                "error": packages_error if not packages_exists else None
            },
            "credit_costs": {
                "exists": costs_exists,
                "error": costs_error if not costs_exists else None
            },
            "stripe_webhook_secret": "configured" if os.getenv('STRIPE_WEBHOOK_SECRET') else "missing"
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/credits/costs")
async def get_credit_costs():
    """Get all active credit costs"""
    try:
        result = supabase.table("credit_costs").select("*").eq("is_active", True).order("service_type").execute()
        return {"costs": result.data}
    except Exception as e:
        print(f"❌ Error getting credit costs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/credits/costs")
async def update_credit_cost(
    service_type: str,
    cost_per_unit: float,
    unit_description: str,
    current_user: str = Depends(get_current_user)
):
    try:
        print(f"🔧 Updating credit cost: {service_type} -> {cost_per_unit} ({unit_description})")
        supabase.table("credit_costs").upsert({
            "service_type": service_type,
            "cost_per_unit": cost_per_unit,
            "unit_description": unit_description,
            "is_active": True,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Error updating credit cost: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def calculate_credits_needed(usage_type: str, amount: int) -> int:
    """Calculate credits needed for a specific usage"""
    
    print(f"💰 MAIN CALCULATION: Starting credit calculation for {usage_type} with {amount} units")
    
    credit_costs = {
        # Voice/SMS
        "voice_call": 1,      # per minute
        "sms": 1,             # per message
        "whatsapp": 1,        # per message
        
        # AI Models (per 1K tokens)
        "gpt-4": 60,          # per 1K tokens
        "gpt-3.5-turbo": 2,   # per 1K tokens
        "gemini-pro": 1,      # per 1K tokens
        "claude": 2,          # per 1K tokens
        
        # Document Processing
        "document_upload": 5,  # per document
        "pdf_processing": 10,  # per document
        
        # Regulatory Bundle
        "bundle_creation": 100, # per bundle
        "phone_number_purchase": 100, # per number
        
        # General AI response
        "ai_response": 2,      # per response
    }
    
    base_cost = credit_costs.get(usage_type, 1)
    print(f"💰 MAIN CALCULATION: Base cost for {usage_type}: {base_cost} credits per unit")
    
    # For AI models, calculate based on token usage
    if usage_type in ["gpt-4", "gpt-3.5-turbo", "gemini-pro", "claude"]:
        credits_needed = max(1, amount // 1000 * base_cost)
        print(f"💰 MAIN TOKEN CALCULATION: {amount} tokens / 1000 * {base_cost} = {credits_needed} credits")
    else:
        credits_needed = base_cost * amount
        print(f"💰 MAIN UNIT CALCULATION: {amount} units * {base_cost} = {credits_needed} credits")
    
    print(f"💰 MAIN FINAL CALCULATION: {usage_type} with {amount} units = {credits_needed} credits needed")
    return credits_needed

from deepgram_tts_websocket import handle_deepgram_tts_websocket

@app.websocket("/tts/deepgram/stream")
async def deepgram_tts_stream(websocket: WebSocket):
    await handle_deepgram_tts_websocket(websocket)

from pydantic import BaseModel

class UserCompanyVoicePref(BaseModel):
    tts_model_id: str

@app.get("/api/voice-prefs/{company_id}/{user_id}")
def get_user_company_voice_pref(company_id: str, user_id: str):
    """Return the user's preferred Deepgram TTS model for a company.
    Fallback order: user_company_voice_preferences → company_model_defaults.tts_model_id → 'aura-2-estrella-es'
    """
    try:
        pref = supabase.table("user_company_voice_preferences").select("tts_model_id").eq("company_id", company_id).eq("user_id", user_id).execute()
        print(f"🔊 PREFERENCE FOR VOICE 1: {pref.data}")
        if pref.data:
            print(f"🔊 PREFERENCE FOR VOICE 2: {pref.data[0]["tts_model_id"]}")
            return {"tts_model_id": pref.data[0]["tts_model_id"], "source": "user_company_voice_preferences"}
        # fallback to company defaults if present
        defaults = supabase.table("company_model_defaults").select("tts_model_id").eq("company_id", company_id).execute()
        if defaults.data:
            return {"tts_model_id": defaults.data[0]["tts_model_id"], "source": "company_model_defaults"}
        # final fallback
        return {"tts_model_id": "aura-2-celeste-es", "source": "fallback"}
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch voice preference: {str(e)}")

@app.post("/api/voice-prefs/{company_id}/{user_id}")
def set_user_company_voice_pref(company_id: str, user_id: str, body: UserCompanyVoicePref):
    """Set or update the user's preferred Deepgram TTS model for a company."""
    try:
        # optionally validate that model exists in models table if you catalog them there; for now, trust input
        row = {"company_id": company_id, "user_id": user_id, "tts_model_id": body.tts_model_id}
        supabase.table("user_company_voice_preferences").upsert(row).execute()
        return {"status": "success", "preferences": row}
    except Exception as e:
        raise HTTPException(500, f"Failed to set voice preference: {str(e)}")