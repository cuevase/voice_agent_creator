import os
from dotenv import load_dotenv
from typing import Optional, List, Any
import httpx
from pydantic import BaseModel, Field
from typing import Dict
from fastapi import HTTPException, UploadFile, File
from fastapi import Request, BackgroundTasks
from fastapi.responses import PlainTextResponse
from fastapi import BackgroundTasks
from database_utils import get_sb
import uuid
import re
import io
import PyPDF2
from PIL import Image
import pytesseract
from datetime import datetime
import asyncio
from datetime import datetime

load_dotenv()

from twilio.rest import Client

MASTER_API_KEY = os.getenv("MASTER_API_KEY")
MASTER_API_SECRET = os.getenv("MASTER_API_SECRET")
MASTER_ACCOUNT_SID = os.getenv("MASTER_ACCOUNT_SID")
MASTER_AUTH_TOKEN = os.getenv("MASTER_AUTH_TOKEN")

NUMBERS_BASE = "https://numbers.twilio.com/v2/RegulatoryCompliance"

supabase = get_sb()

#-----Pydantic Models-----

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

#----HELPER FUNCTIONS----
def load_plan(bundle_sid: str) -> Optional[Dict[str, Any]]:
    """
    Look up your stored provisioning plan for this bundle:
    {
      'subaccount_sid': 'AC_sub...',
      'api_key_sid': 'SK...',
      'api_key_secret': '....',
      'address_sid': 'AD...',
      'country': 'MX',
      'number_type': 'local',
      'contains': None,
      'voice_url': 'https://yourapp/voice',
      'sms_url'  : 'https://yourapp/sms'
    }
    """
    # TODO: fetch from your DB (Supabase)
    return None

def get_document_type_sid_helper(document_type: str) -> str:
    """Get Twilio document type SID based on document type"""
    try:
        # Try to get the real SID from Twilio first
        real_sid = get_document_type_sid_from_twilio(document_type)
        if real_sid:
            return real_sid
        
        # Fallback to placeholder SIDs if Twilio fetch fails
        print(f"⚠️ Using fallback SID for document type '{document_type}'")
        document_type_mapping = {
            "business_registration": "OY1234567890abcdef1234567890abcdef12",  # Placeholder
            "utility_bill": "OYabcdef1234567890abcdef1234567890ab",          # Placeholder
            "government_communication": "OYfedcba0987654321fedcba0987654321fe", # Placeholder
            "government_id": "OY9876543210abcdef9876543210abcdef98",          # Placeholder
            "constancia_situacion_fiscal": "OY1234567890abcdef1234567890abcdef12",  # Same as business registration
            "address_proof": "OYabcdef1234567890abcdef1234567890ab"           # Same as utility bill
        }
        
        # Return the mapped SID or a default
        sid = document_type_mapping.get(document_type, "OY1234567890abcdef1234567890abcdef12")
        print(f"📄 Document type '{document_type}' mapped to fallback SID: {sid}")
        return sid
        
    except Exception as e:
        print(f"❌ Error getting document type SID: {e}")
        return "OY1234567890abcdef1234567890abcdef12"  # Default fallback

def get_twilio_document_types():
    """Fetch available document types from Twilio API"""
    try:
        client = master_client()
        
        # Try to fetch document types from Twilio
        try:
            # New API structure (v7+)
            document_types = client.numbers.v2.regulatory_compliance.supporting_document_types.list()
        except AttributeError:
            try:
                # Alternative API structure
                document_types = client.regulatory_compliance.v1.supporting_document_types.list()
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = "https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocumentTypes"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}"
                }
                
                response = httpx.get(url, headers=headers)
                if response.status_code != 200:
                    print(f"❌ Failed to fetch document types: {response.text}")
                    return []
                
                document_types = response.json().get("supporting_document_types", [])
        
        print(f"📋 Available Twilio document types: {len(document_types)}")
        for doc_type in document_types:
            # Handle both dictionary and object responses from Twilio
            try:
                # Try dictionary access first
                friendly_name = doc_type.get('friendly_name', 'Unknown')
                sid = doc_type.get('sid', 'No SID')
            except AttributeError:
                # Handle Twilio SDK object
                friendly_name = getattr(doc_type, 'friendly_name', 'Unknown')
                sid = getattr(doc_type, 'sid', 'No SID')
            
            print(f"  - {friendly_name}: {sid}")
        
        return document_types
        
    except Exception as e:
        print(f"❌ Error fetching document types: {e}")
        return []

def get_document_type_sid_from_twilio(document_type_name: str) -> str:
    """Get actual document type SID from Twilio based on friendly name"""
    try:
        document_types = get_twilio_document_types()
        
        # Map our document types to Twilio friendly names
        type_mapping = {
            "business_registration": ["Business Registration", "Business Registration Document"],
            "utility_bill": ["Utility Bill", "Address Proof", "Address Verification"],
            "government_communication": ["Government Communication", "Government Document"],
            "government_id": ["Government ID", "Identity Document"],
            "constancia_situacion_fiscal": ["Business Registration", "Tax Registration"],
            "address_proof": ["Utility Bill", "Address Proof", "Address Verification"]
        }
        
        # Get the friendly names to search for
        search_names = type_mapping.get(document_type_name, [document_type_name])
        
        # Find matching document type
        for doc_type in document_types:
            # Handle both dictionary and object responses from Twilio
            try:
                # Try dictionary access first
                friendly_name = doc_type.get('friendly_name', '').lower()
                machine_name = doc_type.get('machine_name', '').lower()
                sid = doc_type.get('sid')
            except AttributeError:
                # Handle Twilio SDK object
                friendly_name = getattr(doc_type, 'friendly_name', '').lower()
                machine_name = getattr(doc_type, 'machine_name', '').lower()
                sid = getattr(doc_type, 'sid', '')
            
            for search_name in search_names:
                if search_name.lower() in friendly_name or search_name.lower() in machine_name:
                    print(f"✅ Found document type '{document_type_name}' -> '{friendly_name}' (SID: {sid})")
                    return sid
        
        print(f"❌ No matching document type found for '{document_type_name}'")
        return None
        
    except Exception as e:
        print(f"❌ Error getting document type SID from Twilio: {e}")
        return None


def get_document_type_machine_name_from_twilio(document_type_name: str) -> str:
    """Get document type machine_name from Twilio by friendly name mapping"""
    try:
        document_types = get_twilio_document_types()
        
        # Map our document types to Twilio friendly names
        type_mapping = {
            "business_registration": ["Business Registration", "Business Registration Document"],
            "utility_bill": ["Utility Bill", "Address Proof", "Address Verification"],
            "government_communication": ["Government Communication", "Government Document"],
            "government_id": ["Government ID", "Identity Document"],
            "constancia_situacion_fiscal": ["Business Registration", "Tax Registration"],
            "address_proof": ["Utility Bill", "Address Proof", "Address Verification"]
        }
        
        # Get the friendly names to search for
        search_names = type_mapping.get(document_type_name, [document_type_name])
        
        # Find matching document type
        for doc_type in document_types:
            # Handle both dictionary and object responses from Twilio
            try:
                # Try dictionary access first
                friendly_name = doc_type.get('friendly_name', '').lower()
                machine_name = doc_type.get('machine_name', '').lower()
                sid = doc_type.get('sid')
            except AttributeError:
                # Handle Twilio SDK object
                friendly_name = getattr(doc_type, 'friendly_name', '').lower()
                machine_name = getattr(doc_type, 'machine_name', '').lower()
                sid = getattr(doc_type, 'sid', '')
            
            for search_name in search_names:
                if search_name.lower() in friendly_name or search_name.lower() in machine_name:
                    print(f"✅ Found document type '{document_type_name}' -> '{friendly_name}' (machine_name: {machine_name})")
                    return machine_name
        
        print(f"❌ No matching document type found for '{document_type_name}'")
        return None
        
    except Exception as e:
        print(f"❌ Error getting document type machine_name from Twilio: {e}")
        return None


def extract_text_from_pdf_helper(content: bytes) -> str:
    """Extract text from PDF content"""
    try:
        # Create PDF reader from bytes
        pdf_file = io.BytesIO(content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Extract text from all pages
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text.strip()
        
    except Exception as e:
        print(f"❌ Error extracting text from PDF: {e}")
        return ""

def extract_text_from_image_helper(content: bytes) -> str:
    """Extract text from image content using OCR"""
    try:
        # Open image from bytes
        image = Image.open(io.BytesIO(content))
        
        # Extract text using Tesseract OCR
        text = pytesseract.image_to_string(image, lang='spa+eng')
        
        return text.strip()
        
    except Exception as e:
        print(f"❌ Error extracting text from image: {e}")
        return ""


def extract_business_name_helper(text: str) -> str:
    """Extract business name from text"""
    try:
        # Common patterns for business names in Mexican documents
        patterns = [
            r'Razón Social:\s*([^\n]+)',
            r'Nombre de la Empresa:\s*([^\n]+)',
            r'Denominación:\s*([^\n]+)',
            r'Business Name:\s*([^\n]+)',
            r'Company Name:\s*([^\n]+)',
            r'RFC\s*[A-Z]{3,4}\d{6}[A-Z0-9]{3}\s*([^\n]+)',  # RFC followed by business name
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                business_name = match.group(1).strip()
                # Clean up common artifacts
                business_name = re.sub(r'[^\w\s\-\.]', '', business_name)
                if len(business_name) > 3:  # Minimum length check
                    return business_name
        
        # Fallback: look for words that might be business names
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if len(line) > 5 and len(line) < 100:  # Reasonable business name length
                if not any(keyword in line.lower() for keyword in ['rfc', 'fecha', 'folio', 'constancia']):
                    return line
        
        return ""
        
    except Exception as e:
        print(f"❌ Error extracting business name: {e}")
        return ""
    
def extract_address_helper(text: str) -> str:
    """Extract address from text"""
    try:
        # Common patterns for addresses in Mexican documents
        patterns = [
            r'Domicilio:\s*([^\n]+(?:\n[^\n]+)*)',
            r'Dirección:\s*([^\n]+(?:\n[^\n]+)*)',
            r'Address:\s*([^\n]+(?:\n[^\n]+)*)',
            r'Calle\s*([^\n]+(?:\n[^\n]+)*)',
            r'Colonia\s*([^\n]+(?:\n[^\n]+)*)',
            r'CP\s*\d{5}\s*([^\n]+)',  # Postal code followed by address
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                address = match.group(1).strip()
                # Clean up and format address
                address = re.sub(r'\s+', ' ', address)  # Remove extra spaces
                address = re.sub(r'[^\w\s\-\,\.]', '', address)  # Remove special chars except comma, dash, dot
                if len(address) > 10:  # Minimum address length
                    return address
        
        # Fallback: look for lines with common address indicators
        lines = text.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if any(indicator in line.lower() for indicator in ['calle', 'avenida', 'colonia', 'cp', 'mexico']):
                # Get next few lines as they might contain the full address
                address_lines = []
                for j in range(i, min(i + 3, len(lines))):
                    address_lines.append(lines[j].strip())
                address = ' '.join(address_lines)
                if len(address) > 10:
                    return address
        
        return ""
        
    except Exception as e:
        print(f"❌ Error extracting address: {e}")
        return ""

def extract_rfc_helper(text: str) -> str:
    """Extract RFC from text"""
    try:
        # RFC pattern for Mexican tax ID
        rfc_patterns = [
            r'RFC[:\s]*([A-Z]{3,4}\d{6}[A-Z0-9]{3})',
            r'([A-Z]{3,4}\d{6}[A-Z0-9]{3})',  # Just the RFC pattern
            r'Registro Federal de Contribuyentes[:\s]*([A-Z]{3,4}\d{6}[A-Z0-9]{3})',
        ]
        
        for pattern in rfc_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                rfc = match.group(1).upper()
                # Validate RFC format
                if re.match(r'^[A-Z]{3,4}\d{6}[A-Z0-9]{3}$', rfc):
                    return rfc
        
        return ""
        
    except Exception as e:
        print(f"❌ Error extracting RFC: {e}")
        return ""
    


def save_plan(bundle_sid: str, plan: Dict[str, Any]) -> None:
    # TODO: persist to DB
    pass

def master_client() -> Client:
    # Prefer API Key if provided
    if MASTER_API_KEY and MASTER_API_SECRET:
        return Client(MASTER_API_KEY, MASTER_API_SECRET, account_sid=MASTER_ACCOUNT_SID)
    return Client(MASTER_ACCOUNT_SID, MASTER_AUTH_TOKEN)

def subaccount_client(sub_sid: str, key_sid: Optional[str]=None, key_secret: Optional[str]=None) -> Client:
    # Recommended: use a subaccount-scoped API Key for all calls
    if key_sid and key_secret:
        return Client(key_sid, key_secret, account_sid=sub_sid)
    # Fallback to master creds (v2010 resources allow acting on subaccounts)
    return Client(MASTER_ACCOUNT_SID, MASTER_AUTH_TOKEN)

def numbers_v2_http(sub_sid: str, key_sid: str, key_secret: str) -> httpx.Client:
    # Numbers v2 endpoints accept API Key auth; keys must belong to the subaccount
    return httpx.Client(auth=(key_sid, key_secret), timeout=30.0)

#First get the regulatory requirements for a given country, number type, and end user type
def regulatory_requirements_helper(req: RequirementsReq):
    """
    Build a normalized schema your UI can render.
    Calls: Regulations (includeConstraints), End-User Types, Supporting Document Types.
    """
    print(req)
    if not (req.api_key_sid and req.api_key_secret):
        raise HTTPException(status_code=400, detail="api_key_sid and api_key_secret are required")

    with httpx.Client(
        base_url=NUMBERS_BASE,
        auth=(req.api_key_sid, req.api_key_secret),
        timeout=httpx.Timeout(connect=5, read=30, write=30, pool=30),
    ) as http:
        # (A) Regulations filtered to the exact (country, number_type, end_user_type)
        regs = http.get(
            "/Regulations",
            params={
                "IsoCountry": req.iso_country,
                "NumberType": req.number_type,
                "EndUserType": req.end_user_type,
                "IncludeConstraints": True,
            },
        )
        regs.raise_for_status()
        regsj = regs.json()
        results = regsj.get("results", [])
        if not results:
            return {"found": False, "schema": None, "message": "No regulation found for the given filters."}

        # Some countries can return >1; typically pick the first or expose all
        regulation = results[0]

        # (B) Catalogs for reference (labels/constraints)
        eut = http.get("/EndUserTypes")      # list
        sdt = http.get("/SupportingDocumentTypes")  # list
        eut.raise_for_status(); sdt.raise_for_status()
        eut_list = eut.json().get("end_user_types", [])
        sdt_list = sdt.json().get("supporting_document_types", [])

    # Normalize fields from the regulation payload (it contains 'requirements' with detailed fields)
    reqs = regulation.get("requirements", {})

    # End-user fields
    eu = reqs.get("end_user", [])
    end_user_fields: List[Dict[str, Any]] = []
    if eu:
        # usually a single dict in the list
        eu0 = eu[0]
        for f in eu0.get("detailed_fields", []):
            end_user_fields.append({
                "machine_name": f.get("machine_name"),
                "label": f.get("friendly_name"),
                "description": f.get("description"),
                "constraint": f.get("constraint", "String"),
                "required": True
            })

    # Supporting document requirements (can be a list of lists)
    doc_groups: List[Dict[str, Any]] = []
    for group in reqs.get("supporting_document", []):
        # each group is a list of alternatives (OR semantics)
        options = []
        for opt in group:
            accepted_docs = []
            for ad in opt.get("accepted_documents", []):
                fields = []
                for f in ad.get("detailed_fields", []):
                    fields.append({
                        "machine_name": f.get("machine_name"),
                        "label": f.get("friendly_name"),
                        "description": f.get("description"),
                        "constraint": f.get("constraint", "String"),
                        "required": True
                    })
                accepted_docs.append({
                    "name": ad.get("name"),       # e.g., "Address Validation", "Passport"
                    "type": ad.get("type"),       # e.g., "address", "document"
                    "url": ad.get("url"),         # may point to a DocumentType reference
                    "fields": fields,
                    "file_required": _determine_file_required(ad.get("name"), ad.get("type"))
                })
            options.append({
                "requirement_name": opt.get("requirement_name"),
                "description": opt.get("description"),
                "accepted_documents": accepted_docs
            })
        doc_groups.append({"any_of": options})

    normalized = {
        "regulation": {
            "sid": regulation.get("sid"),
            "friendly_name": regulation.get("friendly_name"),
            "iso_country": regulation.get("iso_country"),
            "number_type": regulation.get("number_type"),
            "end_user_type": regulation.get("end_user_type"),
        },
        "end_user_schema": end_user_fields,
        "document_schemas": doc_groups,
        "catalogs": {
            "end_user_types": eut_list,
            "supporting_document_types": sdt_list
        }
    }

    return {"found": True, "schema": normalized}

def _determine_file_required(doc_name: str, doc_type: str) -> bool:
    """
    Determine if a document requires file upload based on its name and type.
    """
    # Documents that typically require file uploads
    file_required_docs = [
        "utility_bill",
        "government_correspondence", 
        "government_issued_document",
        "business_registration",
        "tax_document",
        "birth_certificate",
        "personal_id_card",
        "passport",
        "driver_license",
        "bank_statement",
        "credit_card_statement",
        "loan_statement",
        "income_statement",
        "balance_sheet",
        "articles_of_incorporation",
        "articles_of_association",
        "corporate_registry",
        "court_register",
        "shareholders_registry",
        "company_by_laws",
        "annual_securities_report",
        "letter_of_authorization",
        "declaration_of_beneficial_ownership",
        "employment_pass",
        "work_permit",
        "health_insurance_certificate",
        "voter_registration",
        "birth_certificate",
        "maternity_passbook",
        "certificate_driving_record",
        "certificate_special_permanent_resident",
        "seal_certificate_call_transfer_service_agreement",
        "company_seal_certificate",
        "corporate_registry",
        "seal_certificate_call_transfer_service_agreement",
        "certificate_special_permanent_resident",
        "certificate_driving_record",
        "maternity_passbook",
        "tv_bill",
        "internet_bill",
        "gas_bill",
        "water_bill",
        "electricity_bill",
        "credit_card_statement",
        "articles_of_incorporation",
        "articles_of_association",
        "health_insurance_certificate",
        "voter_registration",
        "loan_statement",
        "tax_document",
        "birth_certificate",
        "letter_of_authorization",
        "other",
        "government_issued_proof_of_authorized_representative",
        "numbers_allocated_letter",
        "letter_of_declaration",
        "annual_securities_report",
        "court_register",
        "personal_id_card",
        "mobile_phone_bill",
        "employment_pass",
        "business_letterhead",
        "tax_notice",
        "international_protection_certificate",
        "government_correspondence",
        "other",
        "government_issued_document",
        "bank_statement",
        "tax_document",
        "birth_certificate",
        "letter_of_authorization",
        "carrier_form",
        "authorized_representative_1_address",
        "business_address",
        "emergency_address",
        "individual_address",
        "other_document_showing_the_business_financial_status",
        "balance_sheet",
        "income_statement",
        "declaration_of_beneficial_ownership",
        "utility_bill_of_authorized_representative",
        "tax_document_of_authorized_representative",
        "numbers_allocated_letter",
        "letter_of_declaration",
        "government_issued_proof_of_authorized_representative",
        "company_by_laws",
        "annual_securities_report",
        "court_register",
        "personal_id_card",
        "mobile_phone_bill",
        "employment_pass",
        "business_letterhead",
        "tax_notice",
        "international_protection_certificate",
        "government_correspondence",
        "other",
        "government_issued_document",
        "bank_statement",
        "tax_document",
        "birth_certificate",
        "letter_of_authorization"
    ]
    
    # Check if the document type is in the list of documents that require files
    if doc_type in file_required_docs:
        return True
    
    # Also check document names that indicate file uploads are needed
    file_indicators = [
        "bill", "statement", "certificate", "document", "correspondence", 
        "registration", "license", "passport", "card", "report", "registry",
        "incorporation", "association", "by-laws", "securities", "authorization",
        "declaration", "employment", "work permit", "insurance", "voter",
        "birth", "maternity", "driving", "permanent", "seal", "corporate",
        "court", "shareholders", "company", "annual", "personal", "mobile",
        "business", "tax", "international", "government", "bank", "credit",
        "loan", "income", "balance", "articles", "health", "voter", "letter",
        "declaration", "proof", "allocated", "representative", "authorized"
    ]
    
    doc_name_lower = doc_name.lower() if doc_name else ""
    for indicator in file_indicators:
        if indicator in doc_name_lower:
            return True
    
    # Default to requiring file for most document types except pure address validation
    return doc_type != "address"

def simplified_requirements(payload: Dict[str, Any]):
    """
    Input = the 'schema' object you showed above (or your handler can call the Twilio API and then pass it here).
    Output = trimmed, UI-friendly schema with TypeSIDs and flags for address/file needs.
    """
    if not payload.get("found") or "schema" not in payload:
        raise HTTPException(400, "Invalid input: expected {found: true, schema: {...}}")

    schema = payload["schema"]
    catalogs = schema.get("catalogs", {})
    sdt = catalogs.get("supporting_document_types", [])

    # Build a lookup: machine_name -> type_sid
    type_sid_by_machine = {t["machine_name"]: t["sid"] for t in sdt if "machine_name" in t and "sid" in t}

    # 1) End-user fields (only required ones)
    eu_fields = []
    for f in schema.get("end_user_schema", []):
        if f.get("required"):
            eu_fields.append({
                "name": f["machine_name"],
                "label": f.get("label") or f["machine_name"],
                "kind": f.get("constraint", "String"),
                "required": True
            })

    # 2) Document requirements - separate by requirement_name instead of grouping all together
    requirements_out: List[Dict[str, Any]] = []
    
    for group in schema.get("document_schemas", []):
        any_of = group.get("any_of", [])
        
        # Group documents by requirement_name
        requirements_by_name = {}
        
        for opt in any_of:
            requirement_name = opt.get("requirement_name", "unknown")
            if requirement_name not in requirements_by_name:
                requirements_by_name[requirement_name] = {
                    "requirement_name": requirement_name,
                    "description": opt.get("description", ""),
                    "documents": []
                }
            
            for ad in opt.get("accepted_documents", []):
                machine = ad.get("type")  # e.g., 'utility_bill'
                fields = ad.get("fields", [])
                needs_address = any(ff.get("machine_name") == "address_sids" for ff in fields)
                
                # Determine if file is required based on document type
                # Documents with type "document" typically require file upload
                # Documents with type "address" typically don't require file upload
                file_required = ad.get("file_required", False)
                
                document = {
                    "doc_label": ad.get("name"),
                    "doc_machine_name": machine,
                    "doc_type_sid": type_sid_by_machine.get(machine),  # may be None if not found
                    "file_required": file_required,
                    "needs_address_sid": needs_address,
                    "attributes_needed": [ff["machine_name"] for ff in fields]
                }
                requirements_by_name[requirement_name]["documents"].append(document)
        
        # Add each requirement to the output
        for requirement in requirements_by_name.values():
            requirements_out.append(requirement)

    simplified = {
        "regulation": schema["regulation"],
        "end_user_fields": eu_fields,
        "document_requirements": requirements_out
    }
    return simplified

def create_subaccount_helper(req: CreateSubaccountReq) -> str:
    """Create Twilio subaccount and return SID"""

    try:
        client = master_client()
        subaccount = client.api.accounts.create(friendly_name=req.friendly_name)
        return subaccount.sid
    except Exception as e:
        print(f"❌ Error creating subaccount: {e}")
        raise

def create_subaccount_api_key_helper(req: CreateApiKeyReq) -> tuple[str, str]:
    """Create API key for subaccount and return (sid, secret)"""
    try:
        client = master_client()
        key = client.new_keys.create(friendly_name=req.friendly_name)
        return key.sid, key.secret
    except Exception as e:
        print(f"❌ Error creating API key: {e}")
        raise

def create_address_helper(req: AddressReq):
    client = subaccount_client(req.subaccount_sid)
    address = client.api.accounts(req.subaccount_sid).addresses.create(
        customer_name=req.customer_name,
        street=req.street,
        city=req.city,
        region=req.region,
        postal_code=req.postal_code,
        iso_country=req.iso_country,
        friendly_name=req.friendly_name,
        emergency_enabled=req.emergency_enabled
    )
    return {"address_sid": address.sid}

def init_bundle_helper(req: BundleInitReq) -> str:
    """Initialize regulatory bundle and return bundle SID"""
    try:
        client = master_client()
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+) - include items directly in bundle creation
            bundle = client.numbers.v2.regulatory_compliance.bundles.create(
                friendly_name=req.friendly_name,
                email=req.email,
                iso_country=req.iso_country,
                number_type=req.number_type,
                end_user_type=req.end_user_type,
                regulation_sid=req.regulation_sid,
                status_callback=req.status_callback
            )
        except AttributeError:
            try:
                # Alternative API structure
                bundle = client.regulatory_compliance.v1.bundles.create(
                    friendly_name=req.friendly_name,
                    email=req.email,
                    iso_country=req.iso_country,
                    number_type=req.number_type,
                    end_user_type=req.end_user_type,
                    regulation_sid=req.regulation_sid,
                    status_callback=req.status_callback
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "FriendlyName": req.friendly_name,
                    "Email": req.email,
                    "IsoCountry": req.iso_country,
                    "NumberType": req.number_type,
                    "EndUserType": req.end_user_type,
                    "RegulationSid": req.regulation_sid,
                    "StatusCallback": req.status_callback
                }
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 201:
                    raise Exception(f"Failed to create bundle: {response.text}")
                
                bundle_data = response.json()
                return bundle_data["sid"]
        
        return bundle.sid
    except Exception as e:
        print(f"❌ Error initializing bundle: {e}")
        raise

def submit_bundle_helper(req: SubmitBundleReq) -> str:
    """Submit bundle for approval and return bundle SID"""
    try:
        client = master_client()
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            bundle = client.numbers.v2.regulatory_compliance.bundles(req.bundle_sid).update(
                status="submitted",
                status_callback=req.status_callback,
                email=req.email
            )
        except AttributeError:
            try:
                # Alternative API structure
                bundle = client.regulatory_compliance.v1.bundles(req.bundle_sid).update(
                    status="submitted",
                    status_callback=req.status_callback,
                    email=req.email
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/{req.bundle_sid}"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                data = {
                    "Status": "submitted",
                    "StatusCallback": req.status_callback,
            "Email": req.email
        }
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 200:
                    raise Exception(f"Failed to submit bundle: {response.text}")
                
                bundle_data = response.json()
                return bundle_data["sid"]
        
        return bundle.sid
    except Exception as e:
        print(f"❌ Error submitting bundle: {e}")
        raise
    

def create_end_user_helper(req: EndUserReq) -> str:
    """Create end user and return end user SID"""
    try:
        client = master_client()
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            end_user = client.numbers.v2.regulatory_compliance.end_users.create(
                friendly_name=req.friendly_name,
                type=req.end_user_type,
                attributes=req.attributes
            )
        except AttributeError:
            try:
                # Alternative API structure
                end_user = client.regulatory_compliance.v1.end_users.create(
                    friendly_name=req.friendly_name,
                    type=req.end_user_type,
                    attributes=req.attributes
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/EndUsers"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                data = {
            "FriendlyName": req.friendly_name,
                    "Type": req.end_user_type,
                    "Attributes": req.attributes
                }
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 201:
                    raise Exception(f"Failed to create end user: {response.text}")
                
                end_user_data = response.json()
                return end_user_data["sid"]
        
        return end_user.sid
    except Exception as e:
        print(f"❌ Error creating end user: {e}")
        raise
    


async def create_supporting_doc_helper(req: SupportingDocReq, file: Optional[UploadFile] = File(None)):
    # Create metadata first
    with numbers_v2_http(req.subaccount_sid, req.api_key_sid, req.api_key_secret) as http:
        payload = {
            "FriendlyName": req.friendly_name,
            "TypeSid": req.type_sid,
            "Attributes": httpx.dumps(req.attributes) if hasattr(httpx, "dumps") else str(req.attributes)
        }
        meta = http.post(f"{NUMBERS_BASE}/SupportingDocuments", data=payload)
        if meta.status_code >= 300:
            raise HTTPException(status_code=400, detail=meta.json())
        sd = meta.json()

        # Optional file upload (proof) if the Type requires it
        if file:
            content = await file.read()
            files = {"File": (file.filename, content, file.content_type or "application/octet-stream")}
            up = http.post(f"{NUMBERS_BASE}/SupportingDocuments/{sd['sid']}/Media", files=files)
            if up.status_code >= 300:
                raise HTTPException(status_code=400, detail=up.json())
        return sd
    

def bundle_assign_item_helper(req: AssignItemReq):
    """Assign item (end user or document) to bundle"""
    try:
        client = master_client()
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+) - use the correct endpoint
            bundle_item = client.numbers.v2.regulatory_compliance.bundles(req.bundle_sid).items.create(
                object_sid=req.item_sid
            )
        except AttributeError:
            try:
                # Alternative API structure
                bundle_item = client.regulatory_compliance.v1.bundles(req.bundle_sid).items.create(
                    object_sid=req.item_sid
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                # Use the correct endpoint: /v2/RegulatoryCompliance/Bundles/{bundle_sid}/Items
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/{req.bundle_sid}/Items"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                data = {
                    "ObjectSid": req.item_sid
                }
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 201:
                    raise Exception(f"Failed to assign item to bundle: {response.text}")
                
                bundle_item_data = response.json()
                return bundle_item_data["sid"]
        
        return bundle_item.sid
    except Exception as e:
        print(f"❌ Error assigning item to bundle: {e}")
        raise
    
def submit_bundle_helper(req: SubmitBundleReq):
    """Submit bundle for regulatory review and store in database"""
    try:
    # Optionally pre-evaluate before submitting to Twilio reviewers
        if req.evaluate_before_submit:
            print(f"🔍 Pre-evaluating bundle {req.bundle_sid}")
            # TODO: Add pre-evaluation logic if needed
        
        # Submit to Twilio
        client = subaccount_client(req.subaccount_sid, req.api_key_sid, req.api_key_secret)
        bundle = client.numbers.v2.regulatory_compliance.bundles(req.bundle_sid).update(
            status_callback=req.status_callback,
            email=req.email
        )
        
        print(f"✅ Bundle {req.bundle_sid} submitted for review")
        
        # Store bundle information in database
        from main import supabase
        from datetime import datetime
        
        # Only update the status and submitted_at fields
        update_data = {
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Update existing record instead of upserting
        try:
            supabase.table("regulatory_bundles").update(update_data).eq("bundle_sid", req.bundle_sid).execute()
            print(f"💾 Bundle {req.bundle_sid} status updated in database")
        except Exception as db_error:
            print(f"⚠️ Warning: Could not update bundle in database: {db_error}")
        
        # Check actual status from Twilio after submission
        try:
            import time
            time.sleep(2)  # Wait a moment for Twilio to process
            
            # Get bundle status from Twilio
            client = subaccount_client(req.subaccount_sid, req.api_key_sid, req.api_key_secret)
            bundle_status = client.numbers.v2.regulatory_compliance.bundles(req.bundle_sid).fetch()
            
            print(f"🔍 Twilio bundle status: {bundle_status.status}")
            
            # Update database with actual Twilio status
            actual_status_data = {
                "status": bundle_status.status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            supabase.table("regulatory_bundles").update(actual_status_data).eq("bundle_sid", req.bundle_sid).execute()
            print(f"💾 Updated database with actual Twilio status: {bundle_status.status}")
            
        except Exception as status_error:
            print(f"⚠️ Warning: Could not check Twilio status: {status_error}")
        
        return {
            "status": "success",
            "bundle_sid": req.bundle_sid,
            "message": "Bundle submitted for regulatory review",
            "bundle_status": bundle.status
        }
        
    except Exception as e:
        print(f"❌ Error submitting bundle: {e}")
        raise HTTPException(status_code=500, detail=f"Error submitting bundle: {str(e)}")
    

def search_numbers_helper(req: SearchNumbersReq):
    # Use classic v2010 AvailablePhoneNumbers for simplicity
    client = subaccount_client(req.subaccount_sid)
    country = req.country
    resource = client.api.accounts(req.subaccount_sid).available_phone_numbers(country).local
    if req.type.lower() == "mobile":
        resource = client.api.accounts(req.subaccount_sid).available_phone_numbers(country).mobile
    elif req.type.lower() in ("tollfree","toll-free","toll_free"):
        resource = client.api.accounts(req.subaccount_sid).available_phone_numbers(country).toll_free
    nums = resource.list(
        sms_enabled=req.sms_enabled,
        voice_enabled=req.voice_enabled,
        contains=req.contains,
        limit=20
    )
    return [{"phone_number": n.phone_number, "friendly_name": n.friendly_name, "iso_country": n.iso_country, "capabilities": n.capabilities} for n in nums]


def buy_number_helper(req: BuyNumberReq):
    """Buy a phone number and store in database"""
    try:
        # Use classic v2010 API for purchasing
        client = subaccount_client(req.subaccount_sid, req.api_key_sid, req.api_key_secret)
        
        # Purchase the number
        number = client.incoming_phone_numbers.create(
        phone_number=req.phone_number,
        address_sid=req.address_sid,
        bundle_sid=req.bundle_sid,
        voice_url=req.voice_url,
        sms_url=req.sms_url
    )
        
        print(f"✅ Purchased phone number: {req.phone_number}")
        
        # Store phone number information in database
        from main import supabase
        from datetime import datetime
        
        phone_data = {
            "phone_number_sid": number.sid,
            "phone_number": req.phone_number,
            "subaccount_sid": req.subaccount_sid,
            "bundle_sid": req.bundle_sid,
            "address_sid": req.address_sid,
            "voice_url": req.voice_url,
            "sms_url": req.sms_url,
            "status": "active",
            "purchased_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Try to store in database
        try:
            supabase.table("phone_numbers").upsert(phone_data).execute()
            print(f"💾 Phone number {req.phone_number} stored in database")
        except Exception as db_error:
            print(f"⚠️ Warning: Could not store phone number in database: {db_error}")
        
        return {
            "status": "success",
            "phone_number_sid": number.sid,
            "phone_number": req.phone_number,
            "message": "Phone number purchased successfully"
        }
        
    except Exception as e:
        print(f"❌ Error purchasing phone number: {e}")
        raise HTTPException(status_code=500, detail=f"Error purchasing phone number: {str(e)}")


def configure_number_helper(req: ConfigureNumberReq):
    client = subaccount_client(req.subaccount_sid)
    number = client.api.accounts(req.subaccount_sid).incoming_phone_numbers(req.phone_number_sid).update(
        voice_url=req.voice_url,
        sms_url=req.sms_url
    )
    return {"updated": True, "voice_url": number.voice_url, "sms_url": number.sms_url}

def provision_full_helper(req: FullProvisionReq):
    """
    Step 1: Create bundle and submit for regulatory approval.
    Number purchasing will happen after approval via callback.
    """
    # 1) subaccount
    acct = create_subaccount_helper(CreateSubaccountReq(friendly_name=req.company_name))
    sub_sid = acct["subaccount_sid"]

    # 2) API key (scoped)
    key = create_subaccount_api_key_helper(CreateApiKeyReq(subaccount_sid=sub_sid, friendly_name="server-key"))
    key_sid, key_secret = key["api_key_sid"], key["api_key_secret"]

    # 3) address
    addr = create_address_helper(AddressReq(
        subaccount_sid=sub_sid,
        customer_name=req.customer_name,
        street=req.street, city=req.city, region=req.region,
        postal_code=req.postal_code, iso_country=req.iso_country,
        friendly_name="Primary Address"
    ))
    address_sid = addr["address_sid"]

    # 4) bundle
    bundle = init_bundle_helper(BundleInitReq(
        subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
        friendly_name=f"{req.country}-{req.number_type}-{req.end_user_type}",
        email=req.contact_email, iso_country=req.country,
        number_type=req.number_type, end_user_type=req.end_user_type
    ))
    bundle_sid = bundle["sid"]

    # 5) end user
    end_user = create_end_user_helper(EndUserReq(
        subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
        end_user_type=req.end_user_type, friendly_name=req.company_name,
        attributes=req.end_user_attributes
    ))
    assign_end = bundle_assign_item_helper(AssignItemReq(
        subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
        bundle_sid=bundle_sid, item_sid=end_user["sid"], item_type="end-user"
    ))

    # 6) supporting docs (metadata only; upload files via /supporting-docs/create if needed)
    for sd in req.supporting_docs:
        sd_meta = create_supporting_doc_helper(
            SupportingDocReq(
                subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
                type_sid=sd["type_sid"], friendly_name=sd.get("friendly_name","Doc"), attributes=sd["attributes"]
            )
        )
        bundle_assign_item_helper(AssignItemReq(
            subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
            bundle_sid=bundle_sid, item_sid=sd_meta["sid"], item_type="supporting-document"
        ))

    # 7) pre-evaluate and submit
    submit = submit_bundle_helper(SubmitBundleReq(
        subaccount_sid=sub_sid, api_key_sid=key_sid, api_key_secret=key_secret,
        bundle_sid=bundle_sid, evaluate_before_submit=True, email=req.contact_email
    ))
    if submit.get("evaluation", {}).get("status") == "noncompliant":
        return {"status": "bundle-noncompliant", "details": submit["evaluation"]}

    # 8) Save provisioning plan for callback processing
    plan = {
        "subaccount_sid": sub_sid,
        "api_key_sid": key_sid,
        "api_key_secret": key_secret,
        "address_sid": address_sid,
        "bundle_sid": bundle_sid,
        "country": req.country,
        "number_type": req.number_type,
        "contains": req.contains,
        "voice_url": req.voice_url,
        "sms_url": req.sms_url,
        "company_name": req.company_name,
        "contact_email": req.contact_email
    }
    save_plan(bundle_sid, plan)

    return {
        "status": "bundle-submitted",
        "subaccount_sid": sub_sid,
        "api_key_sid": key_sid,
        "address_sid": address_sid,
        "bundle_sid": bundle_sid,
        "bundle_submitted": submit.get("submitted", False),
        "message": "Bundle submitted for regulatory approval. Number will be purchased automatically upon approval."
    }

async def bundle_status_callback_helper(request: Request, bg: BackgroundTasks):
    """Handle bundle status callbacks from Twilio and update database"""
    try:
        # Parse the callback data
        form_data = await request.form()
        bundle_sid = form_data.get("BundleSid")
        status = form_data.get("Status")
        status_reason = form_data.get("StatusReason")
        
        print(f"📞 Bundle status callback: {bundle_sid} -> {status}")
        
        # Update bundle status in database
        from main import supabase
        from datetime import datetime
        
        update_data = {
            "status": status,
            "status_reason": status_reason,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if status == "approved":
            update_data["approved_at"] = datetime.utcnow().isoformat()
        elif status == "rejected":
            update_data["rejected_at"] = datetime.utcnow().isoformat()
        
        try:
            supabase.table("regulatory_bundles").update(update_data).eq("bundle_sid", bundle_sid).execute()
            print(f"💾 Updated bundle {bundle_sid} status to {status}")
        except Exception as db_error:
            print(f"⚠️ Warning: Could not update bundle status in database: {db_error}")
        
        # If bundle is approved, trigger auto-provisioning
        if status == "approved":
            bg.add_task(_provision_after_approval_helper, bundle_sid)
        
        return PlainTextResponse("OK")
        
    except Exception as e:
        print(f"❌ Error in bundle status callback: {e}")
        return PlainTextResponse("Error", status_code=500)


def _provision_after_approval_helper(bundle_sid: str):
    """Auto-provision phone numbers after bundle approval"""
    try:
        from main import supabase
        
        # Get bundle information from database
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            print(f"❌ No bundle found for {bundle_sid}")
            return
        
        bundle_info = bundle.data[0]
        subaccount_sid = bundle_info["subaccount_sid"]
        
        # Check if auto-purchase is enabled
        if not bundle_info.get("auto_purchase", True):
            print(f"⏸️ Auto-purchase disabled for bundle {bundle_sid}")
            return
        
        print(f"🚀 Auto-provisioning numbers for approved bundle {bundle_sid}")
        
        # Get bundle details from Twilio
        client = subaccount_client(subaccount_sid)
        twilio_bundle = client.numbers.v2.regulatory_compliance.bundles(bundle_sid).fetch()
        
        # Search for available numbers
        available_numbers = client.available_phone_numbers(bundle_info.get("iso_country", "US")).local.list(
            voice_enabled=True,
            sms_enabled=True,
            limit=5
        )
        
        if not available_numbers:
            print(f"❌ No available numbers found for bundle {bundle_sid}")
            return
        
        # Purchase the first available number
        number_to_purchase = available_numbers[0]
        
        # Purchase the number
        purchased_number = client.incoming_phone_numbers.create(
            phone_number=number_to_purchase.phone_number,
            bundle_sid=bundle_sid,
            voice_url=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/voice/incoming/{bundle_info.get('company_id', 'default')}",
            sms_url=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/whatsapp/webhook"
        )
        
        print(f"✅ Auto-purchased number: {number_to_purchase.phone_number}")
        
        # Store in database
        phone_data = {
            "phone_number_sid": purchased_number.sid,
            "phone_number": number_to_purchase.phone_number,
            "subaccount_sid": subaccount_sid,
            "bundle_sid": bundle_sid,
            "company_id": bundle_info.get("company_id"),
            "status": "active",
            "auto_provisioned": True,
            "purchased_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("phone_numbers").upsert(phone_data).execute()
        print(f"💾 Auto-provisioned number stored in database")
        
    except Exception as e:
        print(f"❌ Error in auto-provisioning: {e}")
        import traceback
        traceback.print_exc()


async def upload_regulatory_document_helper(
    file: UploadFile,
    document_type: str,
    company_id: str,
    bundle_sid: str = None
):
    """Upload regulatory document to Supabase storage and extract data"""
    try:
        print(f"📤 Uploading regulatory document: {file.filename}")
        
        # Map frontend document type to backend type
        backend_document_type = map_document_type(document_type)
        print(f"🔄 Document type mapping: {document_type} → {backend_document_type}")
        
        # Generate unique file path
        file_id = str(uuid.uuid4())
        file_path = f"companies/{company_id}/documents/{file_id}/{file.filename}"
        
        # Read file content
        file_content = await file.read()
        
        # Upload to Supabase storage
        supabase.storage.from_('regulatory-documents').upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        print(f"✅ File uploaded to storage: {file_path}")
        
        # Extract data from document
        extracted_data = await extract_document_data_helper(file_content, backend_document_type, file.filename)
        
        # Store document record in database
        document_record = {
            "id": file_id,
            "company_id": company_id,
            "bundle_sid": bundle_sid,
            "document_type": backend_document_type,
            "original_document_type": document_type,  # Keep original for reference
            "file_path": file_path,
            "file_name": file.filename,
            "file_size": len(file_content),
            "content_type": file.content_type,
            "extracted_data": extracted_data,
            "status": "uploaded"
        }
        
        result = supabase.table("regulatory_documents").insert(document_record).execute()
        
        print(f"✅ Document record stored in database")
        
        return {
            "document_id": file_id,
            "file_path": file_path,
            "extracted_data": extracted_data,
            "status": "uploaded"
        }
        
    except Exception as e:
        print(f"❌ Error uploading regulatory document: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
async def extract_document_data_helper(
    file_content: bytes,
    document_type: str,
    file_name: str
) -> dict:
    """Extract data from uploaded document"""
    try:
        print(f"🔍 Extracting data from document: {file_name}")
        
        extracted_data = {
            "document_type": document_type,
            "file_name": file_name,
            "extraction_timestamp": datetime.now().isoformat()
        }
        
        # Extract address from address proof documents
        if document_type in ["utility_bill", "government_communication", "address_proof"]:
            # For now, we'll extract basic info - in production you'd use OCR
            address_info = extract_address_from_document(file_content, document_type)
            extracted_data["business_address"] = address_info.get("address", "")
            extracted_data["city"] = address_info.get("city", "")
            extracted_data["state"] = address_info.get("state", "")
            extracted_data["postal_code"] = address_info.get("postal_code", "")
            extracted_data["country"] = address_info.get("country", "")
            
            print(f"📍 Extracted address: {extracted_data['business_address']}")
        
        # Extract business info from business registration documents
        elif document_type in ["business_registration", "constancia_situacion_fiscal"]:
            business_info = extract_business_info_from_document(file_content, document_type)
            extracted_data["business_name"] = business_info.get("business_name", "")
            extracted_data["rfc"] = business_info.get("rfc", "")
            extracted_data["business_address"] = business_info.get("business_address", "")
            
            print(f"🏢 Extracted business info: {extracted_data['business_name']}")
        
        return extracted_data
        
    except Exception as e:
        print(f"❌ Error extracting document data: {e}")
        # Return basic data even if extraction fails
        return {
            "document_type": document_type,
            "file_name": file_name,
            "extraction_timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

def extract_address_from_document(file_content: bytes, document_type: str) -> dict:
    """Extract address information from document"""
    # This is a placeholder - in production you'd use OCR or document processing
    # For now, return a basic structure
    return {
        "address": "Extracted address from document",
        "city": "Extracted city",
        "state": "Extracted state", 
        "postal_code": "Extracted postal code",
        "country": "MX"  # Default to Mexico for now
    }

def extract_business_info_from_document(file_content: bytes, document_type: str) -> dict:
    """Extract business information from document"""
    # This is a placeholder - in production you'd use OCR or document processing
    # For now, return a basic structure
    return {
        "business_name": "Extracted business name",
        "rfc": "Extracted RFC",
        "business_address": "Extracted business address"
    }


async def create_complete_bundle_helper(
    company_id: str,
    business_name: str,
    contact_email: str,
    iso_country: str,
    number_type: str,
    end_user_type: str,
    document_ids: List[str]
):
    """Create complete regulatory bundle with all components"""
    try:
        print(f"🏢 Creating complete bundle for company: {company_id}")
        
        # Extract business address from uploaded documents
        business_address = await extract_business_address_from_documents(document_ids)
        print(f"📍 Extracted business address: {business_address}")
        
        # Step 1: Create subaccount
        subaccount_sid = create_subaccount_helper(CreateSubaccountReq(friendly_name=business_name))
        print(f"✅ Subaccount created: {subaccount_sid}")
        
        # Step 2: Create API keys
        api_key_sid, api_key_secret = create_subaccount_api_key_helper(CreateApiKeyReq(subaccount_sid=subaccount_sid, friendly_name="regulatory-bundle-key"))
        print(f"✅ API keys created: {api_key_sid}")
        
        # Step 3: Initialize bundle
        bundle_sid = init_bundle_helper(BundleInitReq(
            subaccount_sid=subaccount_sid,
            api_key_sid=api_key_sid,
            api_key_secret=api_key_secret,
            friendly_name=business_name,
            email=contact_email,
            iso_country=iso_country,
            number_type=number_type,
            end_user_type=end_user_type
        ))
        print(f"✅ Bundle initialized: {bundle_sid}")
        
        # Step 4: Create end user with correct attributes
        if end_user_type == "business":
            # For business end users, only use business_name (address is not a valid attribute)
            attributes = {
                "business_name": business_name
            }
        else:
            # For individual end users
            attributes = {
                "first_name": business_name.split()[0] if business_name else "Unknown",
                "last_name": " ".join(business_name.split()[1:]) if business_name and len(business_name.split()) > 1 else "Unknown"
            }
        
        end_user_sid = create_end_user_helper(EndUserReq(
            subaccount_sid=subaccount_sid,
            api_key_sid=api_key_sid,
            api_key_secret=api_key_secret,
            end_user_type=end_user_type,
            friendly_name=business_name,
            attributes=attributes
        ))
        print(f"✅ End user created: {end_user_sid}")
        
        # Step 5: Upload documents to Twilio
        document_sids = []
        print(f"📄 Processing {len(document_ids)} documents for Twilio upload")
        
        for document_id in document_ids:
            try:
                print(f"🔍 Looking up document: {document_id}")
                
                # Get document from database
                result = supabase.table("regulatory_documents").select("*").eq("id", document_id).execute()
                
                if not result.data:
                    print(f"❌ Document {document_id} not found in database, skipping")
                    continue
                
                document_data = result.data[0]
                print(f"✅ Found document: {document_data.get('file_name', 'Unknown')}")
                
                document_sid = await upload_document_to_twilio_helper(
                    document=document_data,
                    subaccount_sid=subaccount_sid,
                    api_key_sid=api_key_sid,
                    api_key_secret=api_key_secret
                )
                document_sids.append(document_sid)
                
                # Update document with Twilio SID
                supabase.table("regulatory_documents").update({
                    "document_sid": document_sid,
                    "status": "uploaded_to_twilio"
                }).eq("id", document_id).execute()
                
                print(f"✅ Document uploaded to Twilio: {document_sid}")
                
            except Exception as doc_error:
                print(f"❌ Error processing document {document_id}: {doc_error}")
                continue
        
        print(f"✅ Documents uploaded: {document_sids}")
        
        # Step 6: Store bundle in database
        bundle_data = {
            "bundle_sid": bundle_sid,
            "subaccount_sid": subaccount_sid,
            "api_key_sid": api_key_sid,
            "api_key_secret": api_key_secret,
            "company_id": company_id,
            "business_name": business_name,
            "business_address": business_address,  # Include business_address to satisfy NOT NULL constraint
            "contact_email": contact_email,
            "iso_country": iso_country,
            "number_type": number_type,
            "end_user_type": end_user_type,
            "end_user_sid": end_user_sid,
            "document_sids": document_sids,
            "status": "draft",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("regulatory_bundles").upsert(bundle_data).execute()
        print(f"✅ Bundle stored in database: {bundle_sid}")
        
        # Submit bundle for approval automatically
        print(f"📤 Submitting bundle for approval: {bundle_sid}")
        
        try:
            # Submit bundle for approval using the new helper
            submit_bundle_for_approval_helper(bundle_sid)
            print(f"✅ Bundle submitted for approval: {bundle_sid}")
            
            # Small delay to ensure Twilio processes the submission
            import time
            time.sleep(2)
            
            # Update database status to pending-review
            supabase.table("regulatory_bundles").update({
                "status": "pending-review",
                "submitted_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("bundle_sid", bundle_sid).execute()
            
            print(f"🎉 Bundle {bundle_sid} successfully created and submitted for regulatory approval!")
            
            return {
                "status": "success",
                "bundle_sid": bundle_sid,
                "end_user_sid": end_user_sid,
                "document_sids": document_sids,
                "message": "Regulatory bundle created and submitted for approval"
            }
            
        except Exception as e:
            print(f"❌ Error submitting bundle: {e}")
            # Still return success since documents were uploaded
            return {
                "status": "partial_success",
                "bundle_sid": bundle_sid,
                "end_user_sid": end_user_sid,
                "document_sids": document_sids,
                "message": "Bundle created and documents uploaded, but submission failed",
                "error": str(e)
            }
        
    except Exception as e:
        print(f"❌ Error creating complete bundle: {e}")
        raise

async def extract_business_address_from_documents(document_ids: List[str]) -> str:
    """Extract business address from uploaded documents"""
    try:
        print(f"🔍 Extracting business address from {len(document_ids)} documents")
        
        if not document_ids:
            print(f"⚠️ No document IDs provided")
            return "Address to be extracted from documents"
        
        for document_id in document_ids:
            try:
                # Get document from database
                result = supabase.table("regulatory_documents").select("*").eq("id", document_id).execute()
                
                if not result.data:
                    print(f"⚠️ Document {document_id} not found in database")
                    continue
                
                document_data = result.data[0]
                
                # Check if this document has address information
                extracted_data = document_data.get("extracted_data", {})
                business_address = extracted_data.get("business_address", "")
                
                if business_address and business_address.strip():
                    print(f"📍 Found business address: {business_address}")
                    return business_address
                    
            except Exception as doc_error:
                print(f"⚠️ Error processing document {document_id}: {doc_error}")
                continue
        
        # If no address found, return a default
        print(f"⚠️ No business address found in documents, using default")
        return "Address to be extracted from documents"
        
    except Exception as e:
        print(f"❌ Error extracting business address: {e}")
        return "Address to be extracted from documents"


async def upload_document_to_twilio_helper(
    document: dict,
    subaccount_sid: str,
    api_key_sid: str,
    api_key_secret: str
):
    """Upload document to Twilio and return document SID"""
    try:
        print(f"📄 Uploading document to Twilio: {document['file_name']}")
        
        # Get document type machine_name (not SID!)
        document_type_machine_name = get_document_type_machine_name_from_twilio(document["document_type"])
        if not document_type_machine_name:
            raise Exception(f"Could not find machine_name for document type: {document['document_type']}")
        
        print(f"📄 Document type '{document['document_type']}' mapped to machine_name: {document_type_machine_name}")
        
        # Filter attributes to only include Twilio-expected fields
        extracted_data = document.get("extracted_data", {})
        twilio_attributes = {}
        
        # For now, send minimal attributes to avoid mapping errors
        # We'll start with empty attributes and add specific ones as needed
        if document_type_machine_name == "business_registration":
            # Only include business_name for business registration
            if "business_name" in extracted_data:
                twilio_attributes["business_name"] = extracted_data["business_name"]
        elif document_type_machine_name == "utility_bill_of_authorized_representative":
            # For utility bills, we might not need any specific attributes
            # Start with empty attributes
            pass
        else:
            # For other document types, only include business_name if available
            if "business_name" in extracted_data:
                twilio_attributes["business_name"] = extracted_data["business_name"]
        
        print(f"📋 Filtered attributes for Twilio: {twilio_attributes}")
        
        # Upload document to Twilio using the correct client
        client = subaccount_client(subaccount_sid, api_key_sid, api_key_secret)
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            response = client.numbers.v2.regulatory_compliance.supporting_documents.create(
                friendly_name=document["file_name"],
                type=document_type_machine_name,  # Use machine_name, not SID!
                attributes=twilio_attributes  # Use filtered attributes
            )
        except AttributeError:
            try:
                # Alternative API structure
                response = client.regulatory_compliance.v1.supporting_documents.create(
                    friendly_name=document["file_name"],
                    type=document_type_machine_name,  # Use machine_name, not SID!
                    attributes=twilio_attributes  # Use filtered attributes
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "FriendlyName": document["file_name"],
                    "Type": document_type_machine_name,  # Use machine_name, not SID!
                    "Attributes": twilio_attributes  # Use filtered attributes
                }
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 201:
                    raise Exception(f"Failed to upload document: {response.text}")
                
                response_data = response.json()
                print(f"✅ Document uploaded to Twilio: {response_data['sid']}")
                return response_data["sid"]
        
        print(f"✅ Document uploaded to Twilio: {response.sid}")
        return response.sid
        
    except Exception as e:
        print(f"❌ Error uploading document to Twilio: {e}")
        raise


async def get_bundle_details_helper(bundle_sid: str):
    """Get regulatory bundle details and status"""
    try:
        # Get bundle from database
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_data = bundle.data[0]
        
        # Get associated documents
        documents = supabase.table("regulatory_documents").select("*").eq("bundle_sid", bundle_sid).execute()
        
        # Get phone numbers
        phone_numbers = supabase.table("phone_numbers").select("*").eq("bundle_sid", bundle_sid).execute()
        
        return {
            "bundle": bundle_data,
            "documents": documents.data,
            "phone_numbers": phone_numbers.data
        }
        
    except Exception as e:
        print(f"❌ Error getting bundle details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get bundle details: {str(e)}")

async def get_company_bundles_helper(company_id: str):
    """Get all regulatory bundles for a company"""
    try:
        bundles = supabase.table("regulatory_bundles").select("*").eq("company_id", company_id).execute()
        
        return {
            "company_id": company_id,
            "bundles": bundles.data
        }
        
    except Exception as e:
        print(f"❌ Error getting company bundles: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get company bundles: {str(e)}")
    

async def get_document_details_helper(document_id: str):
    """Get document details and extracted data"""
    try:
        document = supabase.table("regulatory_documents").select("*").eq("id", document_id).execute()
        
        if not document.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return document.data[0]
        
    except Exception as e:
        print(f"❌ Error getting document details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get document details: {str(e)}")
    
async def delete_document_helper(document_id: str):
    """Delete regulatory document from storage and database"""
    try:
        # Get document details
        document = supabase.table("regulatory_documents").select("file_path").eq("id", document_id).execute()
        
        if not document.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = document.data[0]["file_path"]
        
        # Delete from Supabase storage
        supabase.storage.from_('regulatory-documents').remove([file_path])
        
        # Delete from database
        supabase.table("regulatory_documents").delete().eq("id", document_id).execute()
        
        return {"status": "deleted", "document_id": document_id}
        
    except Exception as e:
        print(f"❌ Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
    

async def configure_auto_provision_helper(
    bundle_sid: str,
    auto_purchase: bool,
    reserve_on_pending: bool,
    search_criteria: dict
):
    """Configure auto-provisioning for a bundle"""
    try:
        config_record = {
            "bundle_sid": bundle_sid,
            "auto_purchase": auto_purchase,
            "reserve_on_pending": reserve_on_pending,
            "search_criteria": search_criteria
        }
        
        # Upsert configuration
        supabase.table("auto_provision_config").upsert(config_record).execute()
        
        return {
            "bundle_sid": bundle_sid,
            "auto_purchase": auto_purchase,
            "reserve_on_pending": reserve_on_pending,
            "search_criteria": search_criteria,
            "status": "configured"
        }
        
    except Exception as e:
        print(f"❌ Error configuring auto-provision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to configure auto-provision: {str(e)}")
    
async def submit_bundle_to_twilio_helper(bundle_sid: str):
    """Submit regulatory bundle to Twilio for approval"""
    try:
        # Get bundle details
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_data = bundle.data[0]
        
        # Submit to Twilio
        submit_req = SubmitBundleReq(
            subaccount_sid=bundle_data["subaccount_sid"],
            api_key_sid=bundle_data["api_key_sid"],
            api_key_secret=bundle_data["api_key_secret"],
            bundle_sid=bundle_sid,
            evaluate_before_submit=True
        )
        
        result = submit_bundle_helper(submit_req)
        
        # Update bundle status
        supabase.table("regulatory_bundles").update({
            "status": "submitted"
        }).eq("bundle_sid", bundle_sid).execute()
        
        return {
            "bundle_sid": bundle_sid,
            "status": "submitted",
            "twilio_response": result
        }
        
    except Exception as e:
        print(f"❌ Error submitting bundle: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit bundle: {str(e)}")
    

async def get_bundle_phone_numbers_helper(bundle_sid: str):
    """Get phone numbers associated with a bundle"""
    try:
        phone_numbers = supabase.table("phone_numbers").select("*").eq("bundle_sid", bundle_sid).execute()
        
        return {
            "bundle_sid": bundle_sid,
            "phone_numbers": phone_numbers.data
        }
        
    except Exception as e:
        print(f"❌ Error getting bundle phone numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get phone numbers: {str(e)}")
    

async def search_numbers_for_bundle_helper(bundle_sid: str, search_criteria: dict):
    """Search for available phone numbers for a bundle"""
    try:
        # Get bundle details
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle.data:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_data = bundle.data[0]
        
        # Search numbers
        search_req = SearchNumbersReq(
            subaccount_sid=bundle_data["subaccount_sid"],
            country=bundle_data["iso_country"],
            type=bundle_data["number_type"],
            contains=search_criteria.get("contains"),
            voice_enabled=search_criteria.get("voice_enabled", True),
            sms_enabled=search_criteria.get("sms_enabled", True)
        )
        
        result = search_numbers_helper(search_req)
        
        return {
            "bundle_sid": bundle_sid,
            "search_criteria": search_criteria,
            "available_numbers": result
        }
        
    except Exception as e:
        print(f"❌ Error searching numbers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search numbers: {str(e)}")
    

def assign_items_to_bundle_helper(
    bundle_sid: str,
    end_user_sid: str,
    document_sids: List[str]
):
    """Assign end user and documents to bundle"""
    try:
        print(f"🔗 Assigning items to bundle: {bundle_sid}")
        
        # Get bundle details to get subaccount info
        bundle_result = supabase.table("regulatory_bundles").select("subaccount_sid, api_key_sid, api_key_secret").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle_result.data:
            print(f"❌ Bundle {bundle_sid} not found in database")
            return
        
        bundle_data = bundle_result.data[0]
        subaccount_sid = bundle_data.get("subaccount_sid")
        api_key_sid = bundle_data.get("api_key_sid")
        api_key_secret = bundle_data.get("api_key_secret")
        
        if not all([subaccount_sid, api_key_sid, api_key_secret]):
            print(f"❌ Missing subaccount credentials for bundle {bundle_sid}")
            return
        
        # Assign end user to bundle
        assign_end_user_req = AssignItemReq(
            subaccount_sid=subaccount_sid,
            api_key_sid=api_key_sid,
            api_key_secret=api_key_secret,
            bundle_sid=bundle_sid,
            item_sid=end_user_sid,
            item_type="end-user"
        )
        bundle_assign_item_helper(assign_end_user_req)
        
        # Assign documents to bundle
        for document_sid in document_sids:
            assign_doc_req = AssignItemReq(
                subaccount_sid=subaccount_sid,
                api_key_sid=api_key_sid,
                api_key_secret=api_key_secret,
                bundle_sid=bundle_sid,
                item_sid=document_sid,
                item_type="supporting-document"
            )
            bundle_assign_item_helper(assign_doc_req)
        
        print(f"✅ All items assigned to bundle")
        
    except Exception as e:
        print(f"❌ Error assigning items to bundle: {e}")
        raise

def submit_bundle_for_approval_helper(bundle_sid: str):
    """Submit bundle for regulatory approval"""
    try:
        print(f"📤 Submitting bundle for approval: {bundle_sid}")
        
        # Get bundle details to get subaccount info
        bundle_result = supabase.table("regulatory_bundles").select("subaccount_sid, api_key_sid, api_key_secret, email, status_callback").eq("bundle_sid", bundle_sid).execute()
        
        if not bundle_result.data:
            print(f"❌ Bundle {bundle_sid} not found in database")
            return
        
        bundle_data = bundle_result.data[0]
        subaccount_sid = bundle_data.get("subaccount_sid")
        api_key_sid = bundle_data.get("api_key_sid")
        api_key_secret = bundle_data.get("api_key_secret")
        email = bundle_data.get("email")
        status_callback = bundle_data.get("status_callback")
        
        if not all([subaccount_sid, api_key_sid, api_key_secret]):
            print(f"❌ Missing subaccount credentials for bundle {bundle_sid}")
            return
        
        # Create client
        client = subaccount_client(subaccount_sid, api_key_sid, api_key_secret)
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            response = client.numbers.v2.regulatory_compliance.bundles(bundle_sid).update(
                status="pending-review"
            )
        except AttributeError:
            try:
                # Alternative API structure
                response = client.regulatory_compliance.v1.bundles(bundle_sid).update(
                    status="pending-review"
                )
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/{bundle_sid}"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "Status": "pending-review"
                }
                
                # Add optional fields if they exist
                if status_callback:
                    data["StatusCallback"] = status_callback
                if email:
                    data["Email"] = email
                
                response = httpx.post(url, headers=headers, json=data)
                if response.status_code != 200:
                    raise Exception(f"Failed to submit bundle: {response.text}")
                
                bundle_data = response.json()
                return bundle_data["sid"]
        
        print(f"✅ Bundle submitted for approval")
        return response.sid
        
    except Exception as e:
        print(f"❌ Error submitting bundle: {e}")
        raise
    


# Document type mapping for frontend to backend
DOCUMENT_TYPE_MAPPING = {
    "constancia_situacion_fiscal": "business_registration",
    "utility_bill": "utility_bill", 
    "government_communication": "government_communication",
    "address_proof": "utility_bill"  # Default for address proof documents
}

def map_document_type(frontend_type: str) -> str:
    """Map frontend document type to backend document type"""
    return DOCUMENT_TYPE_MAPPING.get(frontend_type, frontend_type)
    

# Background task for monitoring bundle status
async def monitor_bundle_statuses():
    """Background task that monitors all bundle statuses and updates them"""
    while True:
        try:
            print("🔄 Checking bundle statuses...")
            
            # Get all bundles that need status checking
            bundles = supabase.table("regulatory_bundles").select("*").execute().data
            
            for bundle in bundles:
                bundle_sid = bundle["bundle_sid"]
                current_status = bundle["status"]
                
                # Skip if already in final states
                if current_status in ["approved", "rejected", "failed"]:
                    continue
                
                # Check status from Twilio
                try:
                    twilio_status = await get_bundle_status_from_twilio(bundle_sid)
                    
                    if twilio_status != current_status:
                        # Update status in database
                        supabase.table("regulatory_bundles").update({
                            "status": twilio_status,
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("bundle_sid", bundle_sid).execute()
                        
                        print(f"✅ Bundle {bundle_sid} status updated: {current_status} → {twilio_status}")
                        
                        # If approved, trigger auto-provisioning
                        if twilio_status == "approved":
                            await handle_bundle_approval(bundle)
                    
                except Exception as e:
                    print(f"❌ Error checking status for bundle {bundle_sid}: {e}")
            
            # Wait 1 hour before next check
            await asyncio.sleep(3600)  # 1 hour
            
        except Exception as e:
            print(f"❌ Error in bundle status monitor: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes on error

async def get_bundle_status_from_twilio(bundle_sid: str) -> str:
    """Get bundle status from Twilio API"""
    try:
        client = master_client()
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            bundle = client.numbers.v2.regulatory_compliance.bundles(bundle_sid).fetch()
        except AttributeError:
            try:
                # Alternative API structure
                bundle = client.regulatory_compliance.v1.bundles(bundle_sid).fetch()
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/{bundle_sid}"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}"
                }
                
                response = httpx.get(url, headers=headers)
                if response.status_code != 200:
                    raise Exception(f"Failed to get bundle status: {response.text}")
                
                bundle_data = response.json()
                return bundle_data["status"]
        
        return bundle.status
    except Exception as e:
        print(f"❌ Error getting Twilio status for {bundle_sid}: {e}")
        raise

async def handle_bundle_approval(bundle: dict):
    """Handle bundle approval - auto-provision phone numbers"""
    try:
        bundle_sid = bundle["bundle_sid"]
        company_id = bundle["company_id"]
        
        print(f"🎉 Bundle {bundle_sid} approved! Starting auto-provisioning...")
        
        # Check if auto-provisioning is enabled
        auto_purchase = bundle.get("auto_purchase", True)
        
        if not auto_purchase:
            print(f"⚠️ Auto-purchase disabled for bundle {bundle_sid}")
            return
        
        # Get search criteria from bundle
        search_criteria = {
            "country": bundle["iso_country"],
            "type": bundle["number_type"],
            "voice_enabled": True,
            "sms_enabled": True
        }
        
        # Search for available numbers
        available_numbers = await search_numbers_for_bundle_helper(bundle_sid, search_criteria)
        
        if available_numbers and len(available_numbers) > 0:
            # Buy the first available number
            phone_number = available_numbers[0]["phone_number"]
            
            # Purchase the number
            purchase_result = await buy_number_for_bundle_helper(
                bundle_sid=bundle_sid,
                phone_number=phone_number,
                company_id=company_id
            )
            
            print(f"✅ Purchased number {phone_number} for bundle {bundle_sid}")
            
            # Update bundle with purchased number
            supabase.table("regulatory_bundles").update({
                "purchased_number": phone_number,
                "purchase_date": datetime.utcnow().isoformat()
            }).eq("bundle_sid", bundle_sid).execute()
            
        else:
            print(f"⚠️ No available numbers found for bundle {bundle_sid}")
            
    except Exception as e:
        print(f"❌ Error handling bundle approval: {e}")

async def buy_number_for_bundle_helper(bundle_sid: str, phone_number: str, company_id: str):
    """Buy a phone number for a bundle and configure it with AI agent webhooks"""
    try:
        print(f"📞 Purchasing and configuring number {phone_number} for AI agent")
        
        # Get bundle details
        bundle = supabase.table("regulatory_bundles").select("*").eq("bundle_sid", bundle_sid).execute().data[0]
        
        # Get BASE_URL for webhooks
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        
        # Configure webhook URLs for AI agent
        voice_url = f"{BASE_URL}/voice/incoming/{company_id}"
        sms_url = f"{BASE_URL}/whatsapp/webhook"
        status_callback = f"{BASE_URL}/voice/status"
        
        print(f"🔗 Configuring webhooks:")
        print(f"  Voice: {voice_url}")
        print(f"  SMS: {sms_url}")
        print(f"  Status: {status_callback}")
        
        # Buy number using Twilio with webhook configuration
        client = master_client()
        
        # Purchase number with proper configuration
        purchased_number = client.incoming_phone_numbers.create(
            phone_number=phone_number,
            bundle_sid=bundle_sid,
                voice_url=voice_url,
            sms_url=sms_url,
            status_callback=status_callback
        )
        
        print(f"✅ Purchased and configured number {phone_number} with Twilio SID: {purchased_number.sid}")
        
        # Store in phone_numbers table with all details
        supabase.table("phone_numbers").insert({
            "phone_number": phone_number,
            "phone_number_sid": purchased_number.sid,
            "bundle_sid": bundle_sid,
            "company_id": company_id,
            "country": bundle.get("iso_country", "MX"),
            "number_type": bundle.get("number_type", "local"),
            "capabilities": ["voice", "sms"],
            "voice_url": voice_url,
            "sms_url": sms_url,
            "status": "active",
            "purchased_at": datetime.utcnow().isoformat(),
            "twilio_sid": purchased_number.sid
        }).execute()
        
        print(f"💾 Stored number configuration in database")
        
        return purchased_number
        
    except Exception as e:
        print(f"❌ Error buying and configuring number: {e}")
        raise
    
def delete_bundle_helper(bundle_sid: str, subaccount_sid: str, api_key_sid: str, api_key_secret: str):
    """Delete a regulatory bundle from Twilio"""
    try:
        print(f"🗑️ Deleting bundle from Twilio: {bundle_sid}")
        
        client = subaccount_client(subaccount_sid, api_key_sid, api_key_secret)
        
        # Try different API structures based on Twilio SDK version
        try:
            # New API structure (v7+)
            client.numbers.v2.regulatory_compliance.bundles(bundle_sid).delete()
        except AttributeError:
            try:
                # Alternative API structure
                client.regulatory_compliance.v1.bundles(bundle_sid).delete()
            except AttributeError:
                # Fallback to direct API call
                import httpx
                import os
                
                account_sid = os.getenv("MASTER_ACCOUNT_SID")
                auth_token = os.getenv("MASTER_AUTH_TOKEN")
                
                url = f"https://numbers.twilio.com/v1/RegulatoryCompliance/Bundles/{bundle_sid}"
                headers = {
                    "Authorization": f"Basic {account_sid}:{auth_token}",
                    "Content-Type": "application/json"
                }
                
                response = httpx.delete(url, headers=headers)
                if response.status_code != 204:
                    raise Exception(f"Failed to delete bundle: {response.text}")
        
        print(f"✅ Bundle {bundle_sid} deleted from Twilio")
        
        # Also delete from database
        try:
            from main import supabase
            supabase.table("regulatory_bundles").delete().eq("bundle_sid", bundle_sid).execute()
            print(f"💾 Bundle {bundle_sid} deleted from database")
        except Exception as db_error:
            print(f"⚠️ Warning: Could not delete bundle from database: {db_error}")
        
        return {
            "status": "success",
            "bundle_sid": bundle_sid,
            "message": "Bundle deleted successfully"
        }
        
    except Exception as e:
        print(f"❌ Error deleting bundle: {e}")
        raise