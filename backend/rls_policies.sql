-- RLS Policies for Regulatory Bundle System
-- Run these in your Supabase SQL Editor

-- 1. REGULATORY_BUNDLES Table
-- Enable RLS
ALTER TABLE public.regulatory_bundles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view bundles for their company
CREATE POLICY "Users can view company regulatory bundles" ON public.regulatory_bundles
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can create bundles for their company
CREATE POLICY "Users can create regulatory bundles" ON public.regulatory_bundles
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update bundles for their company
CREATE POLICY "Users can update company regulatory bundles" ON public.regulatory_bundles
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- 2. REGULATORY_DOCUMENTS Table
-- Enable RLS
ALTER TABLE public.regulatory_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents for their company
CREATE POLICY "Users can view company regulatory documents" ON public.regulatory_documents
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can create documents for their company
CREATE POLICY "Users can create regulatory documents" ON public.regulatory_documents
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update documents for their company
CREATE POLICY "Users can update company regulatory documents" ON public.regulatory_documents
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete documents for their company
CREATE POLICY "Users can delete company regulatory documents" ON public.regulatory_documents
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- 3. PHONE_NUMBERS Table
-- Enable RLS
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view phone numbers for their company
CREATE POLICY "Users can view company phone numbers" ON public.phone_numbers
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can create phone numbers for their company
CREATE POLICY "Users can create company phone numbers" ON public.phone_numbers
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update phone numbers for their company
CREATE POLICY "Users can update company phone numbers" ON public.phone_numbers
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete phone numbers for their company
CREATE POLICY "Users can delete company phone numbers" ON public.phone_numbers
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- 4. AUTO_PROVISION_CONFIG Table
-- Enable RLS
ALTER TABLE public.auto_provision_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view auto-provision config for their bundles
CREATE POLICY "Users can view auto provision config" ON public.auto_provision_config
FOR SELECT USING (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy: Users can create auto-provision config for their bundles
CREATE POLICY "Users can create auto provision config" ON public.auto_provision_config
FOR INSERT WITH CHECK (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy: Users can update auto-provision config for their bundles
CREATE POLICY "Users can update auto provision config" ON public.auto_provision_config
FOR UPDATE USING (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- 5. BUNDLE_DOCUMENTS Table
-- Enable RLS
ALTER TABLE public.bundle_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view bundle documents for their company
CREATE POLICY "Users can view bundle documents" ON public.bundle_documents
FOR SELECT USING (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy: Users can create bundle documents for their company
CREATE POLICY "Users can create bundle documents" ON public.bundle_documents
FOR INSERT WITH CHECK (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- 6. BUNDLE_STATUS_UPDATES Table
-- Enable RLS
ALTER TABLE public.bundle_status_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view status updates for their bundles
CREATE POLICY "Users can view bundle status updates" ON public.bundle_status_updates
FOR SELECT USING (
  bundle_sid IN (
    SELECT bundle_sid FROM public.regulatory_bundles rb
    JOIN public.companies c ON rb.company_id = c.company_id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy: System can create status updates (for webhooks)
CREATE POLICY "System can create bundle status updates" ON public.bundle_status_updates
FOR INSERT WITH CHECK (true);

-- 7. REGULATORY_REQUIREMENTS Table (Public read access)
-- Enable RLS
ALTER TABLE public.regulatory_requirements ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view regulatory requirements
CREATE POLICY "Authenticated users can view regulatory requirements" ON public.regulatory_requirements
FOR SELECT USING (auth.role() = 'authenticated');

-- 8. PHONE_NUMBER_USERS Table (if you keep it)
-- Enable RLS
ALTER TABLE public.phone_number_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own phone number registrations
CREATE POLICY "Users can view their own phone numbers" ON public.phone_number_users
FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can create their own phone number registrations
CREATE POLICY "Users can create their own phone numbers" ON public.phone_number_users
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own phone number registrations
CREATE POLICY "Users can update their own phone numbers" ON public.phone_number_users
FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own phone number registrations
CREATE POLICY "Users can delete their own phone numbers" ON public.phone_number_users
FOR DELETE USING (user_id = auth.uid());

-- 9. Storage Policies for regulatory-documents bucket
-- Create the storage bucket first
INSERT INTO storage.buckets (id, name, public) 
VALUES ('regulatory-documents', 'regulatory-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload documents for their company
CREATE POLICY "Users can upload regulatory documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'regulatory-documents' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view documents for their company
CREATE POLICY "Users can view company regulatory documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'regulatory-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update documents for their company
CREATE POLICY "Users can update company regulatory documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'regulatory-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete documents for their company
CREATE POLICY "Users can delete company regulatory documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'regulatory-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.companies 
    WHERE user_id = auth.uid()
  )
);

-- 10. Service Role Policies (for backend operations)
-- These allow the backend to perform operations on behalf of users

-- Allow service role to read all regulatory data (for monitoring and webhooks)
CREATE POLICY "Service role can read regulatory bundles" ON public.regulatory_bundles
FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update regulatory bundles" ON public.regulatory_bundles
FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can read regulatory documents" ON public.regulatory_documents
FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update regulatory documents" ON public.regulatory_documents
FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage phone numbers" ON public.phone_numbers
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage bundle status updates" ON public.bundle_status_updates
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow service role to access storage
CREATE POLICY "Service role can manage storage" ON storage.objects
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role'); 