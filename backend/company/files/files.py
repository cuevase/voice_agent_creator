from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from pydantic import BaseModel
from extraction_processing.extract_process import process_and_upload_pdf, create_processed_pdf, create_processed_pdf
from web_crawling.web_crawling import crawl_website_content
import json
import uuid
from fastapi import UploadFile
from fastapi import Depends
from main import get_current_user
from typing import Optional


load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

class CompanyFileUpdate(BaseModel):
    """Model for updating company files"""
    action: str  # "add_files", "remove_files", "add_urls", "remove_urls"
    files: Optional[list[UploadFile]] = None  # For adding files
    file_paths_to_remove: Optional[list[str]] = None  # For removing files
    urls_to_add: Optional[list[str]] = None  # For adding URLs
    urls_to_remove: Optional[list[str]] = None  # For removing URLs
    additional_text: Optional[str] = None  # For ad


async def manage_files_helper(company_id: str, action: str, files: list[UploadFile] = None, file_paths_to_remove: list[str] = None, urls_to_add: list[str] = None, urls_to_remove: list[str] = None, additional_text: str = None, current_user: Optional[str] = Depends(get_current_user)):
    """Manage company files with consent and audit logging"""
    try:
        if not current_user:
            raise HTTPException(401, "Authentication required")
        
        # Check if user owns the company
        company_check = supabase.table("companies").select("company_id").eq("company_id", company_id).eq("user_id", current_user).execute()
        if not company_check.data:
            raise HTTPException(403, "Access denied to this company")
        
        # Check user consent for file processing
        consent_check = supabase.table("user_consents").select("granted").eq("user_id", current_user).eq("consent_type", "file_processing").execute()
        if not consent_check.data or not consent_check.data[0].get("granted"):
            raise HTTPException(403, "File processing consent required")
        
        
        # Continue with existing file management logic
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Verify company exists and user has access
        company_result = supabase.table("companies").select("*").eq("company_id", company_id).execute()
        if not company_result.data:
            raise HTTPException(404, "Company not found")
        
        company = company_result.data[0]
        
        # Check if user is authenticated and owns this company
        if current_user:
            if company.get("user_id") != current_user:
                raise HTTPException(403, "You don't have permission to modify this company")
        else:
            raise HTTPException(401, "Authentication required to modify company files")
        
        # Get current company data - ensure they are lists
        current_files = company.get("files", [])
        current_urls = company.get("urls", [])
        current_additional_text = company.get("additional_text", "") or ""
        
        print(f"🔍 Debug - current_files type: {type(current_files)}, value: {current_files}")
        print(f"🔍 Debug - current_urls type: {type(current_urls)}, value: {current_urls}")
        
        # Ensure files and urls are lists, not strings
        if isinstance(current_files, str):
            print(f"⚠️ current_files is string, converting to empty list")
            current_files = []
        elif not isinstance(current_files, list):
            print(f"⚠️ current_files is {type(current_files)}, converting to empty list")
            current_files = []
            
        if isinstance(current_urls, str):
            print(f"⚠️ current_urls is string, converting to empty list")
            current_urls = []
        elif not isinstance(current_urls, list):
            print(f"⚠️ current_urls is {type(current_urls)}, converting to empty list")
            current_urls = []
        
        # Create client folder name
        client_folder = f"{company['company_name'].lower().replace(' ', '_')}_{company_id[:8]}"
        
        updated_files = current_files.copy()
        updated_urls = current_urls.copy()
        updated_additional_text = current_additional_text
        
        # Process based on action
        if action == "add_files":
            if not files:
                raise HTTPException(400, "No files provided for add_files action")
            
            for file in files:
                try:
                    file_content = await file.read()
                    file_path, processed_text = await process_and_upload_pdf(
                        file_content, 
                        file.filename, 
                        client_folder
                    )
                    updated_files.append(file_path)
                    
                    # Add processed text to additional text for RAG
                    if processed_text:
                        updated_additional_text += f"\n\nProcessed content from {file.filename}:\n{processed_text}"
                    
                    print(f"✅ Added file: {file.filename}")
                    
                except Exception as e:
                    print(f"❌ Error processing file {file.filename}: {e}")
                    raise HTTPException(500, f"Error processing file {file.filename}: {str(e)}")
        
        elif action == "remove_files":
            if not file_paths_to_remove:
                raise HTTPException(400, "No file paths provided for remove_files action")
            
            try:
                paths_to_remove = json.loads(file_paths_to_remove)
            except json.JSONDecodeError:
                raise HTTPException(400, "Invalid JSON format for file_paths_to_remove")
            
            for file_path in paths_to_remove:
                if file_path in updated_files:
                    updated_files.remove(file_path)
                    
                    # Try to delete from storage
                    try:
                        # Remove "client-files/" prefix for storage path
                        storage_path = file_path.replace("client-files/", "")
                        supabase.storage.from_('client-files').remove([storage_path])
                        print(f"✅ Removed file from storage: {file_path}")
                    except Exception as e:
                        print(f"⚠️ Could not remove file from storage: {e}")
                    
                    print(f"✅ Removed file: {file_path}")
                else:
                    print(f"⚠️ File not found in company files: {file_path}")
        
        elif action == "add_urls":
            if not urls_to_add:
                raise HTTPException(400, "No URLs provided for add_urls action")
            
            try:
                urls_to_add_list = json.loads(urls_to_add)
            except json.JSONDecodeError:
                raise HTTPException(400, "Invalid JSON format for urls_to_add")
            
            for url in urls_to_add_list:
                if url not in updated_urls:
                    try:
                        # Crawl the website
                        print(f"🌐 Crawling website: {url}")
                        crawl_result = await crawl_website_content(url.strip(), max_pages=5)
                        
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
                            
                            # Add PDF file path to files
                            updated_files.append(f"client-files/{pdf_file_path}")
                            
                            # Add URL to URLs list
                            updated_urls.append(url)
                            
                            # Add the website content to additional text for RAG
                            updated_additional_text += f"\n\nWebsite content from {url}:\n{website_content}"
                            
                            print(f"✅ Added URL and crawled content: {url}")
                            print(f"📄 Crawled {crawl_result.get('pages_crawled', 0)} pages")
                            
                        else:
                            print(f"❌ Website crawling failed for {url}: {crawl_result['error']}")
                            raise HTTPException(500, f"Failed to crawl website {url}: {crawl_result['error']}")
                            
                    except Exception as e:
                        print(f"❌ Error processing URL {url}: {e}")
                        raise HTTPException(500, f"Error processing URL {url}: {str(e)}")
                else:
                    print(f"⚠️ URL already exists: {url}")
        
        elif action == "remove_urls":
            if not urls_to_remove:
                raise HTTPException(400, "No URLs provided for remove_urls action")
            
            try:
                urls_to_remove_list = json.loads(urls_to_remove)
            except json.JSONDecodeError:
                raise HTTPException(400, "Invalid JSON format for urls_to_remove")
            
            for url in urls_to_remove_list:
                if url in updated_urls:
                    updated_urls.remove(url)
                    print(f"✅ Removed URL: {url}")
                else:
                    print(f"⚠️ URL not found: {url}")
        
        elif action == "add_text":
            if not additional_text:
                raise HTTPException(400, "No additional text provided")
            
            # Create a text file with the additional text
            text_filename = f"additional_notes_{uuid.uuid4().hex[:8]}.txt"
            text_file_path = f"{client_folder}/{text_filename}"
            
            try:
                # Upload text file to Supabase Storage
                supabase.storage.from_('client-files').upload(
                    path=text_file_path,
                    file=additional_text.encode('utf-8'),
                    file_options={"content-type": "text/plain"}
                )
                
                # Add text file path to files
                updated_files.append(f"client-files/{text_file_path}")
                
                # Add the text content to additional text for RAG
                updated_additional_text += f"\n\nAdditional notes:\n{additional_text}"
                
                print(f"✅ Added text notes: {text_filename}")
                
            except Exception as e:
                print(f"❌ Error storing additional text: {e}")
                raise HTTPException(500, f"Error storing additional text: {str(e)}")
        
        else:
            raise HTTPException(400, f"Invalid action: {action}. Valid actions: add_files, remove_files, add_urls, remove_urls, add_text")
        
        # Update company record
        update_data = {
            "files": updated_files,
            "urls": updated_urls,
            "additional_text": updated_additional_text
        }
        
        update_result = supabase.table("companies").update(update_data).eq("company_id", company_id).execute()
        
        if update_result.data:
            return {
                "message": f"Company files updated successfully",
                "action": action,
                "company_id": company_id,
                "files_count": len(updated_files),
                "urls_count": len(updated_urls),
                "updated_files": updated_files,
                "updated_urls": updated_urls
            }
        else:
            raise HTTPException(500, "Failed to update company files")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error managing company files: {e}")
        raise HTTPException(500, f"Failed to manage company files: {str(e)}")
    

async def get_company_files_helper(company_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get company files and URLs"""
    try:
        if not supabase:
            raise HTTPException(500, "Supabase not configured")
        
        # Get company data
        company_result = supabase.table("companies").select("*").eq("company_id", company_id).execute()
        if not company_result.data:
            raise HTTPException(404, "Company not found")
        
        company = company_result.data[0]
        
        # Check if user is authenticated and owns this company
        if current_user:
            if company.get("user_id") != current_user:
                raise HTTPException(403, "You don't have permission to view this company")
        
        return {
            "company_id": company_id,
            "company_name": company.get("company_name"),
            "files": company.get("files", []) or [],
            "urls": company.get("urls", []) or [],
            "additional_text": company.get("additional_text", "") or "",
            "files_count": len(company.get("files", []) or []),
            "urls_count": len(company.get("urls", []) or [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting company files: {e}")
        raise HTTPException(500, f"Failed to get company files: {str(e)}")