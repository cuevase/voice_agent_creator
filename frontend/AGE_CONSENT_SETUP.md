# Age Consent Database Setup

## Database Schema

Create the `age_consent` table in Supabase:

```sql
CREATE TABLE age_consent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent BOOLEAN NOT NULL DEFAULT true,
  consent_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE age_consent ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own age consent" ON age_consent
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own age consent" ON age_consent
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own age consent" ON age_consent
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own age consent" ON age_consent
  FOR DELETE USING (auth.uid() = user_id);
```

## API Endpoints

### POST /api/age/{user_id}
- **Purpose**: Save user's age consent (exact endpoint you provided)
- **Authentication**: Required
- **URL Parameter**: user_id (UUID)
- **Request Body**: None
- **Response**: 
```json
{
  "message": "Age posted successfully"
}
```

### GET /api/age/{user_id}
- **Purpose**: Check if user has provided age consent (exact endpoint you provided)
- **Authentication**: Required
- **URL Parameter**: user_id (UUID)
- **Response**: 
```json
{
  "message": "User is 16 years or older"
}
```
or
```json
{
  "message": "No age consent"
}
```

These endpoints match your exact Python implementation:
```python
@app.post("/age/{user_id}")
async def post_age_consent(user_id: str):
    """Post user age"""
    supabase.table("age_consent").insert({"user_id": user_id, "consent": True}).execute()
    return {"message": "Age posted successfully"}

@app.get("/age/{user_id}")
async def get_age(user_id: str):
    """Get user age"""
    user_age = supabase.table("age_consent").select("*").eq("user_id", user_id).execute()
    if user_age["data"][0]["consent"] == True:
        return {"message": "User is 16 years or older"}
    else:
        return {"message": "No age consent"}
```

## Implementation Details

### Age Consent Flow:
1. User successfully logs in (Google or Email)
2. System checks if user has provided age consent
3. If no consent, age consent modal appears immediately
4. User must check "I am 16 years or older" checkbox
5. User clicks "Confirm & Continue"
6. Age consent is saved to database
7. User can now use the application
8. If user cancels, they are redirected to home page

### Features:
- ✅ Shows age consent modal immediately after login
- ✅ Works for both Google OAuth and email login
- ✅ Saves consent to database with user ID
- ✅ GDPR compliant consent tracking
- ✅ Clear age requirement messaging
- ✅ Non-dismissible modal for post-login flow
- ✅ Redirects to home if user doesn't consent

### User Experience:
- Modal appears immediately after successful login
- Welcome message for new users
- Clear explanation of age requirement (16+)
- Checkbox must be checked to proceed
- No cancel option for post-login flow
- Page reloads after consent to refresh state
- Redirects to home if user doesn't consent 