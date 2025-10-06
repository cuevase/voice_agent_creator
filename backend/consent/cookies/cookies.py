

from authentication.authentication import get_current_user
from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from typing import Optional
from pydantic import BaseModel
from fastapi import Depends
from datetime import datetime
from fastapi import HTTPException
from fastapi import Request

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

class CookieConsent(BaseModel):
    essential_cookies: bool = True
    analytics_cookies: bool = False
    marketing_cookies: bool = False
    third_party_cookies: bool = False

async def save_cookie_consent_helper(
        consent: CookieConsent,
    current_user: Optional[str] = Depends(get_current_user)
):
    """Save user cookie consent preferences"""
    try:
        user_id = current_user or "anonymous"
        
        consent_data = {
            "user_id": user_id,
            "essential_cookies": consent.essential_cookies,
            "analytics_cookies": consent.analytics_cookies,
            "marketing_cookies": consent.marketing_cookies,
            "third_party_cookies": consent.third_party_cookies,
            "consent_date": datetime.utcnow().isoformat(),
            "ip_address": Request.client.host if Request else None,
            "user_agent": Request.headers.get("user-agent") if Request else None
        }
        
        # Save to database
        supabase.table("cookie_consents").upsert(consent_data).execute()
        
        return {"message": "Cookie preferences saved successfully"}
        
    except Exception as e:
        print(f"❌ Error saving cookie consent: {e}")
        raise HTTPException(500, f"Failed to save cookie preferences: {str(e)}")


async def get_cookie_consent_helper(
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get user cookie consent preferences"""
    try:
        user_id = current_user or "anonymous"
        
        result = supabase.table("cookie_consents") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("consent_date", desc=True) \
            .limit(1) \
            .execute()
        
        if result.data:
            return result.data[0]
        else:
            # Return default preferences if no consent recorded
            return {
                "user_id": user_id,
                "essential_cookies": True,
                "analytics_cookies": False,
                "marketing_cookies": False,
                "third_party_cookies": False,
                "consent_date": None
            }
            
    except Exception as e:
        print(f"❌ Error getting cookie consent: {e}")
        raise HTTPException(500, f"Failed to get cookie preferences: {str(e)}")
    
async def revoke_cookie_consent_helper(
    current_user: Optional[str] = Depends(get_current_user)
):
    """Revoke all cookie consent (GDPR right to withdraw consent)"""
    try:
        user_id = current_user or "anonymous"
        
        # Mark all consents as revoked
        revoked_consent = {
            "user_id": user_id,
            "essential_cookies": True,  # Essential cookies cannot be revoked
            "analytics_cookies": False,
            "marketing_cookies": False,
            "third_party_cookies": False,
            "consent_date": datetime.utcnow().isoformat(),
            "revoked_at": datetime.utcnow().isoformat(),
            "ip_address": Request.client.host if Request else None,
            "user_agent": Request.headers.get("user-agent") if Request else None
        }
        
        supabase.table("cookie_consents").insert(revoked_consent).execute()
        
        return {"message": "Cookie consent revoked successfully"}
        
    except Exception as e:
        print(f"❌ Error revoking cookie consent: {e}")
        raise HTTPException(500, f"Failed to revoke cookie consent: {str(e)}")
        

async def get_cookie_policy_helper():
    """Get detailed cookie policy information"""
    return {
        "cookie_policy": {
            "last_updated": "2024-01-01",
            "essential_cookies": {
                "name": "Essential Cookies",
                "description": "Required for the website to function properly",
                "cookies": [
                    {
                        "name": "session_token",
                        "purpose": "Authentication and session management",
                        "duration": "Session",
                        "provider": "Internal"
                    },
                    {
                        "name": "csrf_token",
                        "purpose": "Security protection against cross-site request forgery",
                        "duration": "Session",
                        "provider": "Internal"
                    },
                    {
                        "name": "language_preference",
                        "purpose": "Remember user language preference",
                        "duration": "1 year",
                        "provider": "Internal"
                    }
                ]
            },
            "analytics_cookies": {
                "name": "Analytics Cookies",
                "description": "Help us understand how visitors use our website",
                "cookies": [
                    {
                        "name": "_ga",
                        "purpose": "Google Analytics - Track website usage",
                        "duration": "2 years",
                        "provider": "Google Analytics"
                    },
                    {
                        "name": "_gid",
                        "purpose": "Google Analytics - Track user sessions",
                        "duration": "24 hours",
                        "provider": "Google Analytics"
                    },
                    {
                        "name": "_gat",
                        "purpose": "Google Analytics - Throttle request rate",
                        "duration": "1 minute",
                        "provider": "Google Analytics"
                    }
                ]
            },
            "marketing_cookies": {
                "name": "Marketing Cookies",
                "description": "Used to deliver personalized advertisements",
                "cookies": [
                    {
                        "name": "stripe_cookies",
                        "purpose": "Stripe payment processing and fraud prevention",
                        "duration": "1 year",
                        "provider": "Stripe"
                    },
                    {
                        "name": "email_tracking",
                        "purpose": "Track email campaign performance",
                        "duration": "1 year",
                        "provider": "Email Service"
                    }
                ]
            },
            "third_party_cookies": {
                "name": "Third-party Cookies",
                "description": "Used by external services for functionality",
                "cookies": [
                    {
                        "name": "elevenlabs_session",
                        "purpose": "ElevenLabs voice processing session",
                        "duration": "Session",
                        "provider": "ElevenLabs"
                    },
                    {
                        "name": "openai_session",
                        "purpose": "OpenAI AI processing session",
                        "duration": "Session",
                        "provider": "OpenAI"
                    },
                    {
                        "name": "gemini_session",
                        "purpose": "Google Gemini AI processing session",
                        "duration": "Session",
                        "provider": "Google"
                    },
                    {
                        "name": "twilio_session",
                        "purpose": "Twilio WhatsApp integration session",
                        "duration": "Session",
                        "provider": "Twilio"
                    }
                ]
            }
        },
        "how_to_manage": {
            "browser_settings": "You can manage cookies through your browser settings",
            "preferences_page": "Use our cookie preferences page to manage consent",
            "contact": "Contact us for questions about cookie usage"
        }
    }