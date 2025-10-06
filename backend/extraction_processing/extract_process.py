import os 
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI

from PyPDF2 import PdfReader
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

load_dotenv()

#------------Keys------------

PULPOO_API_KEY = os.getenv("PULPOO_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

#----------Clients------------

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
openai = OpenAI(api_key=OPENAI_API_KEY)


async def extract_text_from_pdf(pdf_content: bytes) -> str:
    """Extract text content from PDF bytes"""
    try:
        pdf_reader = PdfReader(io.BytesIO(pdf_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

async def process_pdf_with_openai(pdf_text: str, original_filename: str) -> str:
    """Use OpenAI to extract and clean information from PDF text"""
    try:
        prompt = f"""
        Please analyze the following PDF content and extract all important information in a clean, organized format.
        
        Original filename: {original_filename}
        
        Please extract and organize all relevant information from the PDF. This is a PDF that voice agents 
        will use to extract information from the company, so make sure to extract all relevant information
        and make it easy for them to extract. 
        
        Format the output in a clear, structured way that would be easy to read and reference.
        
        PDF Content:
        {pdf_text[:4000]}  # Limit to first 4000 chars to avoid token limits
        """
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional document analyzer. Extract and organize information clearly and concisely."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error processing with OpenAI: {e}")
        return f"Error processing document: {str(e)}"

async def create_processed_pdf(processed_text: str, original_filename: str) -> bytes:
    """Create a new PDF with the processed information"""
    try:
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Create custom style for processed content
        processed_style = ParagraphStyle(
            'ProcessedStyle',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=12,
            leading=14
        )
        
        # Build PDF content
        story = []
        
        # Add header
        header = Paragraph(f"Processed Document: {original_filename}", styles['Heading1'])
        story.append(header)
        story.append(Spacer(1, 20))
        
        # Add processed content
        paragraphs = processed_text.split('\n\n')
        for para in paragraphs:
            if para.strip():
                p = Paragraph(para.strip(), processed_style)
                story.append(p)
                story.append(Spacer(1, 6))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        print(f"Error creating processed PDF: {e}")
        # Return a simple error PDF
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.drawString(100, 750, f"Error processing {original_filename}")
        c.drawString(100, 730, f"Error: {str(e)}")
        c.save()
        buffer.seek(0)
        return buffer.getvalue()
    


async def process_and_upload_pdf(file_content: bytes, filename: str, client_folder: str, client_id: str = None) -> tuple[str, str]:
    """Process PDF with OpenAI and upload both original and processed versions"""
    try:
        # Check if it's a PDF
        if not filename.lower().endswith('.pdf'):
            # Not a PDF, upload as-is
            file_path_in_storage = f"{client_folder}/{filename}"
            result = supabase.storage.from_('client-files').upload(
                path=file_path_in_storage,
                file=file_content,
                file_options={"content-type": "application/octet-stream"}
            )
            return f"client-files/{file_path_in_storage}", ""
        
        # Process PDF with OpenAI
        pdf_text = await extract_text_from_pdf(file_content)
        if pdf_text:
            processed_text = await process_pdf_with_openai(pdf_text, filename)
            processed_pdf_content = await create_processed_pdf(processed_text, filename)
            
            # Upload original PDF
            original_path = f"{client_folder}/original_{filename}"
            supabase.storage.from_('client-files').upload(
                path=original_path,
                file=file_content,
                file_options={"content-type": "application/pdf"}
            )
            
            # Upload processed PDF
            processed_filename = f"processed_{filename}"
            processed_path = f"{client_folder}/{processed_filename}"
            supabase.storage.from_('client-files').upload(
                path=processed_path,
                file=processed_pdf_content,
                file_options={"content-type": "application/pdf"}
            )
            
            return f"client-files/{processed_path}", processed_text
        else:
            # Fallback: upload original if processing fails
            file_path_in_storage = f"{client_folder}/{filename}"
            result = supabase.storage.from_('client-files').upload(
                path=file_path_in_storage,
                file=file_content,
                file_options={"content-type": "application/pdf"}
            )
            return f"client-files/{file_path_in_storage}", ""
            
    except Exception as e:
        print(f"Error processing PDF {filename}: {e}")
        # Fallback: upload original
        file_path_in_storage = f"{client_folder}/{filename}"
        result = supabase.storage.from_('client-files').upload(
            path=file_path_in_storage,
            file=file_content,
            file_options={"content-type": "application/octet-stream"}
        )
        return f"client-files/{file_path_in_storage}", ""
