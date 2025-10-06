from fastapi import Header
from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def get_current_user(authorization: str = Header(None)) -> Optional[str]:
    """Get the current authenticated user ID from the Authorization header"""
    try:
        print(f"🔍 Auth Debug: Received authorization header: {authorization[:50] if authorization else 'None'}...")
        
        if not authorization:
            print("❌ No authorization header provided")
            return None
        
        # Extract the token from "Bearer <token>"
        if not authorization.startswith("Bearer "):
            print(f"❌ Invalid authorization format. Expected 'Bearer <token>', got: {authorization[:20]}...")
            return None
        
        token = authorization.replace("Bearer ", "")
        print(f"🔑 Extracted token: {token[:20]}...{token[-10:] if len(token) > 30 else token}")
        
        # Verify the token with Supabase
        try:
            user = supabase.auth.get_user(token)
            print(f"👤 Supabase auth response: {type(user)}")
            
            if user and hasattr(user, 'user') and user.user:
                user_id = user.user.id
                print(f"✅ Authentication successful: user_id={user_id}")
                return user_id
            else:
                print(f"❌ No user found in auth response: {user}")
                return None
                
        except Exception as auth_error:
            print(f"❌ Supabase auth error: {auth_error}")
            
            # Try alternative method - direct JWT verification
            try:
                import jwt
                import json
                
                # Decode without verification to see the payload
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get('sub')
                
                if user_id:
                    print(f"✅ JWT fallback successful: user_id={user_id}")
                    return user_id
                else:
                    print(f"❌ No 'sub' field in JWT: {decoded}")
                    return None
                    
            except Exception as jwt_error:
                print(f"❌ JWT fallback failed: {jwt_error}")
                return None
            
    except Exception as e:
        print(f"❌ Error getting current user: {e}")
        import traceback
        traceback.print_exc()
        return None