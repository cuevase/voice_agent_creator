-- Phone Number to AI Agent Connection Fixes
-- Run these in your Supabase SQL Editor

-- 1. Create database function to get user from phone number (optional - for backwards compatibility)
CREATE OR REPLACE FUNCTION get_user_from_phone(phone_number_input text)
RETURNS uuid AS $$
DECLARE
    result uuid;
BEGIN
    -- Try to get user from phone_number_users table first
    SELECT user_id INTO result
    FROM phone_number_users 
    WHERE phone_number = phone_number_input 
    LIMIT 1;
    
    -- If not found, try phone_numbers table
    IF result IS NULL THEN
        SELECT user_id INTO result
        FROM phone_numbers 
        WHERE phone_number = phone_number_input 
        LIMIT 1;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to get company from phone number (optional - for backwards compatibility)
CREATE OR REPLACE FUNCTION get_company_from_phone(phone_number_input text)
RETURNS uuid AS $$
DECLARE
    result uuid;
BEGIN
    -- Try to get company from phone_numbers table first
    SELECT company_id INTO result
    FROM phone_numbers 
    WHERE phone_number = phone_number_input 
    LIMIT 1;
    
    -- If not found, try phone_number_users table
    IF result IS NULL THEN
        SELECT company_id INTO result
        FROM phone_number_users 
        WHERE phone_number = phone_number_input 
        LIMIT 1;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Add phone_number column to companies table (for backwards compatibility if needed)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS phone_number text;

-- 4. Make sure phone_numbers table has all required columns
ALTER TABLE public.phone_numbers 
ADD COLUMN IF NOT EXISTS voice_url text,
ADD COLUMN IF NOT EXISTS sms_url text,
ADD COLUMN IF NOT EXISTS status_callback text,
ADD COLUMN IF NOT EXISTS configured_at timestamp with time zone;

-- 5. Create indexes for faster phone number lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_lookup ON public.phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_number_users_lookup ON public.phone_number_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_companies_phone_lookup ON public.companies(phone_number) WHERE phone_number IS NOT NULL;

-- 6. Create a view to easily see all phone numbers and their configurations
CREATE OR REPLACE VIEW phone_number_configurations AS
SELECT 
    pn.phone_number,
    pn.company_id,
    c.company_name,
    pn.voice_url,
    pn.sms_url,
    pn.status,
    pn.bundle_sid,
    pn.purchased_at,
    'phone_numbers' as source
FROM phone_numbers pn
LEFT JOIN companies c ON pn.company_id = c.company_id

UNION ALL

SELECT 
    pnu.phone_number,
    pnu.company_id,
    c.company_name,
    NULL as voice_url,
    NULL as sms_url,
    'registered' as status,
    NULL as bundle_sid,
    pnu.created_at as purchased_at,
    'phone_number_users' as source
FROM phone_number_users pnu
LEFT JOIN companies c ON pnu.company_id = c.company_id;

-- 7. Insert sample webhook configuration for testing (optional)
-- UPDATE phone_numbers 
-- SET 
--     voice_url = CONCAT('https://your-domain.com/voice/incoming/', company_id),
--     sms_url = 'https://your-domain.com/whatsapp/webhook',
--     status_callback = 'https://your-domain.com/voice/status'
-- WHERE voice_url IS NULL; 