from fastapi import HTTPException, Depends
from datetime import datetime
from main import supabase
from authentication.authentication import get_current_user
from typing import Optional
from pydantic import BaseModel


class ConsentUpdate(BaseModel):
    consent_type: str
    granted: bool


async def update_user_consent_helper(user_id: str, consent_update: ConsentUpdate, current_user: Optional[str] = Depends(get_current_user)):
    """Update user consent for data processing"""
    try:
        if not current_user or current_user != user_id:
            raise HTTPException(403, "Access denied")
        
        consent_data = {
            "user_id": user_id,
            "consent_type": consent_update.consent_type,
            "granted": consent_update.granted,
            "granted_at": datetime.utcnow().isoformat() if consent_update.granted else None,
            "revoked_at": datetime.utcnow().isoformat() if not consent_update.granted else None
        }
        
        # Upsert consent
        supabase.table("user_consents").upsert(consent_data).execute()
        
        return {"message": f"Consent updated for {consent_update.consent_type}"}
        
    except Exception as e:
        print(f"❌ Error updating consent: {e}")
        raise HTTPException(500, f"Failed to update consent: {str(e)}")
    

async def get_user_consents_helper(user_id: str, current_user: Optional[str] = Depends(get_current_user)):
    try:
        if not current_user or current_user != user_id:
            raise HTTPException(403, "Access denied")
        
        """Get user consents"""
        return supabase.table("user_consents").select("*").eq("user_id", user_id).execute()
    except Exception as e:
        print(f"❌ Error getting user consents: {e}")
        raise HTTPException(500, f"Failed to get user consents: {str(e)}")

async def export_user_data_helper(user_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Export all user data (GDPR right to data portability)"""
    try:
        if not current_user or current_user != user_id:
            raise HTTPException(403, "Access denied")
        
        # Get all user data
        companies = supabase.table("companies").select("*").eq("user_id", user_id).execute()
        conversations = supabase.table("conversation_history").select("*").eq("user_id", user_id).execute()
        consents = supabase.table("user_consents").select("*").eq("user_id", user_id).execute()
        processing_logs = supabase.table("data_processing_logs").select("*").eq("user_id", user_id).execute()
        
        export_data = {
            "user_id": user_id,
            "export_date": datetime.utcnow().isoformat(),
            "companies": companies.data,
            "conversations": conversations.data,
            "consents": consents.data,
            "processing_logs": processing_logs.data
        }
        
        return export_data
        
    except Exception as e:
        print(f"❌ Error exporting user data: {e}")
        raise HTTPException(500, f"Failed to export user data: {str(e)}")
    
async def delete_user_data_helper(user_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Delete all user data (GDPR right to be forgotten)"""
    try:
        if not current_user or current_user != user_id:
            raise HTTPException(403, "Access denied")
        
        # Delete user's companies and all related data
        companies_result = supabase.table("companies").select("company_id").eq("user_id", user_id).execute()
        
        for company in companies_result.data:
            company_id = company["company_id"]
            
            # Delete related data
            supabase.table("conversation_history").delete().eq("company_id", company_id).execute()
            supabase.table("session_summaries").delete().eq("company_id", company_id).execute()
            supabase.table("document_embeddings").delete().eq("company_id", company_id).execute()
            supabase.table("tools").delete().eq("company_id", company_id).execute()
            supabase.table("prompts").delete().eq("company_id", company_id).execute()
            supabase.table("training_sessions").delete().eq("company_id", company_id).execute()
            supabase.table("workers").delete().eq("company_id", company_id).execute()
            supabase.table("whatsapp_configs").delete().eq("company_id", company_id).execute()
            supabase.table("interest").delete().eq("company_id", company_id).execute()
        
        # Delete companies
        supabase.table("companies").delete().eq("user_id", user_id).execute()
        
        # Delete user consents
        supabase.table("user_consents").delete().eq("user_id", user_id).execute()
        
        # Delete processing logs
        supabase.table("data_processing_logs").delete().eq("user_id", user_id).execute()
        
        return {"message": "All user data deleted successfully"}
        
    except Exception as e:
        print(f"❌ Error deleting user data: {e}")
        raise HTTPException(500, f"Failed to delete user data: {str(e)}")