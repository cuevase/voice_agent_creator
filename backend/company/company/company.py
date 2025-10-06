from fastapi import Form, File, UploadFile, Depends
from typing import Optional
from main import get_current_user
import uuid
from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from company.files.files import process_and_upload_pdf
from extraction_processing.vectors.vector import chunk_text, store_embeddings_in_supabase
from extraction_processing.extract_process import create_processed_pdf, process_and_upload_pdf
from web_crawling.web_crawling import crawl_website_content

from fastapi import HTTPException

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)


async def create_company_helper(
    name: str = Form(...),
    email: str = Form(...),
    files: list[UploadFile] = File(default=[]), 
    additional_text: str = Form(None),
    website_url: str = Form(None),  # Optional website URL for crawling
    max_crawl_pages: int = Form(5),  # Optional: max pages to crawl (default 5)
    language: str = Form("es"),  # Optional: language code (default Spanish)
    current_user: Optional[str] = Depends(get_current_user) 
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
        
        # Handle files if provided
        if files:
            for file in files:
                # Read file content
                file_content = await file.read()
                
                # Process and upload file (PDFs will be processed with OpenAI)
                file_path, processed_text = await process_and_upload_pdf(
                    file_content, 
                    file.filename, 
                    client_folder
                )
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
        
        # Handle website crawling if URL is provided
        website_content = None
        if website_url and website_url.strip():
            try:
                print(f"🌐 Starting website crawl for: {website_url}")
                
                # Crawl the website
                crawl_result = await crawl_website_content(website_url.strip(), max_pages=max_crawl_pages)
                
                if "error" not in crawl_result:
                    website_content = crawl_result["content"]
                    
                    # Convert website content to PDF
                    pdf_filename = f"website_content_{uuid.uuid4().hex[:8]}.pdf"
                    pdf_file_path = f"{client_folder}/{pdf_filename}"
                    
                    # Convert content to PDF
                    pdf_bytes = await create_processed_pdf(website_content, pdf_filename)
                    
                    # Upload PDF to Supabase Storage
                    supabase.storage.from_('client-files').upload(
                        path=pdf_file_path,
                        file=pdf_bytes,
                        file_options={"content-type": "application/pdf"}
                    )
                    
                    # Add PDF file path to uploaded paths
                    uploaded_paths.append(f"client-files/{pdf_file_path}")
                    
                    # Add the website content to processed texts for RAG
                    all_processed_texts.append(website_content)
                    
                    print(f"✅ Website content crawled and stored as: {pdf_filename}")
                    print(f"📄 Crawled {crawl_result.get('pages_crawled', 0)} pages")
                    
                else:
                    print(f"❌ Website crawling failed: {crawl_result['error']}")
                    
            except Exception as e:
                print(f"❌ Error crawling website: {e}")
                # Continue with client creation even if website crawling fails
        
        # Create client record first to get client_id
        company_data = {
            'company_name': name,
            'company_email': email,
            'additional_text': additional_text,
            'files': uploaded_paths
        }
        
        # Add user_id if user is authenticated
        if current_user:
            company_data['user_id'] = current_user
            print(f"🔐 Creating company for authenticated user: {current_user}")
        else:
            print("⚠️ No authenticated user found - creating company without user_id")
        
        # Add language setting
        company_data['language'] = language
        print(f"🌍 Setting company language to: {language}")
        
        client_result = supabase.table('companies').insert(company_data).execute()

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
            "additional_text_stored": additional_text is not None and additional_text.strip() != "",
            "website_crawled": website_content is not None,
            "website_url": website_url if website_url and website_url.strip() else None,
            "user_id": current_user,  # Include user_id in response
            "authenticated": current_user is not None,
            "language": language  # Include language in response
        }
        
    except Exception as e:
        return {"error": str(e)}
    


async def get_user_companies_helper(user_id: str, limit: int = 50, offset: int = 0):
    """Get all companies for a specific user ID"""
    """Get all companies for a specific user ID"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Query companies for the specific user
        result = (supabase.table("companies")
                 .select("*")
                 .eq("user_id", user_id) 
                 .order("created_at", desc=True)
                 .range(offset, offset + limit - 1)
                 .execute())
        
        if not result.data:
            return {
                "companies": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
                "user_id": user_id,
                "message": "No companies found for this user"
            }
        
        # Get total count for pagination
        count_result = (supabase.table("companies")
                       .select("company_id", count="exact")
                       .eq("user_id", user_id)
                       .execute())
        
        total_count = count_result.count if hasattr(count_result, 'count') else len(result.data)
        
        return {
            "companies": result.data,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "user_id": user_id,
            "message": f"Found {len(result.data)} companies for user"
        }
        
    except Exception as e:
        print(f"❌ Error getting user companies: {e}")
        raise HTTPException(500, f"Failed to get user companies: {str(e)}")


async def get_company_by_id_helper(company_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get a specific company by ID (only if user owns it)"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get the company
        result = supabase.table("companies").select("*").eq("company_id", company_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Company not found")
        
        company = result.data[0]
        
        # Check if user is authenticated and owns this company
        if current_user:
            if company.get("user_id") != current_user:
                raise HTTPException(403, "You don't have permission to view this company")
        else:
            # If not authenticated, still allow access (for backward compatibility)
            print("⚠️ Unauthenticated access to company - consider requiring auth")
        
        return {
            "company": company,
            "user_id": current_user,
            "authenticated": current_user is not None,
            "message": "Company retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting company: {e}")
        raise HTTPException(500, f"Failed to get company: {str(e)}")
    

async def delete_company_helper(company_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Delete a company (only if user owns it)"""
    try:
        if not current_user:
            raise HTTPException(401, "Authentication required to delete companies")
        
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # First check if the company exists and user owns it
        result = supabase.table("companies").select("user_id").eq("company_id", company_id).execute()
        
        if not result.data:
            raise HTTPException(404, "Company not found")
        
        company = result.data[0]
        
        if company.get("user_id") != current_user:
            raise HTTPException(403, "You don't have permission to delete this company")
        
        # Delete the company
        delete_result = supabase.table("companies").delete().eq("company_id", company_id).execute()
        
        return {
            "message": "Company deleted successfully",
            "company_id": company_id,
            "user_id": current_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting company: {e}")
        raise HTTPException(500, f"Failed to delete company: {str(e)}")