-- Comprehensive RLS Policies for All Tables
-- Enable RLS on all tables and create appropriate policies

-- ============================================
-- USER-OWNED DATA (Users can manage their own)
-- ============================================

-- age_consent
ALTER TABLE public.age_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own age consent" ON public.age_consent
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own age consent" ON public.age_consent
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own age consent" ON public.age_consent
    FOR UPDATE USING (auth.uid() = user_id);

-- cookie_consent
ALTER TABLE public.cookie_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cookie consent" ON public.cookie_consent
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cookie consent" ON public.cookie_consent
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cookie consent" ON public.cookie_consent
    FOR UPDATE USING (auth.uid() = user_id);

-- user_consents
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own consents" ON public.user_consents
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own consents" ON public.user_consents
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own consents" ON public.user_consents
    FOR UPDATE USING (auth.uid() = user_id);

-- user_model_preferences
ALTER TABLE public.user_model_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own model preferences" ON public.user_model_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own model preferences" ON public.user_model_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own model preferences" ON public.user_model_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- user_credits (READ-ONLY for users, service role can modify)
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credit balance" ON public.user_credits
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all credits" ON public.user_credits
    FOR ALL USING (auth.role() = 'service_role');

-- credit_transactions (READ-ONLY for users, service role can modify)
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all transactions" ON public.credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- credit_packages (PUBLIC READ, service role can modify)
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active credit packages" ON public.credit_packages
    FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage all packages" ON public.credit_packages
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- COMPANY-OWNED DATA (Users can manage their companies)
-- ============================================

-- companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own companies" ON public.companies
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own companies" ON public.companies
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own companies" ON public.companies
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own companies" ON public.companies
    FOR DELETE USING (auth.uid() = user_id);

-- api_connections
ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage API connections for their companies" ON public.api_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = api_connections.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- prompts
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage prompts for their companies" ON public.prompts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = prompts.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- prompt_versions
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage prompt versions for their companies" ON public.prompt_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.prompts 
            JOIN public.companies ON companies.company_id = prompts.company_id
            WHERE prompts.id = prompt_versions.prompt_id 
            AND companies.user_id = auth.uid()
        )
    );

-- tools
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tools for their companies" ON public.tools
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = tools.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- tool_args
ALTER TABLE public.tool_args ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tool args for their companies" ON public.tool_args
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tools 
            JOIN public.companies ON companies.company_id = tools.company_id
            WHERE tools.id = tool_args.tool_id 
            AND companies.user_id = auth.uid()
        )
    );

-- company_model_defaults
ALTER TABLE public.company_model_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage model defaults for their companies" ON public.company_model_defaults
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = company_model_defaults.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- conversation_history
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view conversations for their companies" ON public.conversation_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = conversation_history.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all conversations" ON public.conversation_history
    FOR ALL USING (auth.role() = 'service_role');

-- session_summaries
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view sessions for their companies" ON public.session_summaries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = session_summaries.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all sessions" ON public.session_summaries
    FOR ALL USING (auth.role() = 'service_role');

-- document_embeddings
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage embeddings for their companies" ON public.document_embeddings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = document_embeddings.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- training_sessions
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage training sessions for their companies" ON public.training_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = training_sessions.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- training_messages
ALTER TABLE public.training_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage training messages for their companies" ON public.training_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.training_sessions 
            JOIN public.companies ON companies.company_id = training_sessions.company_id
            WHERE training_sessions.id = training_messages.training_session_id 
            AND companies.user_id = auth.uid()
        )
    );

-- workers
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage workers for their companies" ON public.workers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = workers.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- worker_availability
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage worker availability for their companies" ON public.worker_availability
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workers 
            JOIN public.companies ON companies.company_id = workers.company_id
            WHERE workers.worker_id = worker_availability.worker_id 
            AND companies.user_id = auth.uid()
        )
    );

-- whatsapp_configs
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage WhatsApp configs for their companies" ON public.whatsapp_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = whatsapp_configs.company_id 
            AND companies.user_id = auth.uid()
        )
    );

-- ============================================
-- REGULATORY DATA (Company-owned, service role access)
-- ============================================

-- regulatory_bundles
ALTER TABLE public.regulatory_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view bundles for their companies" ON public.regulatory_bundles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = regulatory_bundles.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all bundles" ON public.regulatory_bundles
    FOR ALL USING (auth.role() = 'service_role');

-- regulatory_documents
ALTER TABLE public.regulatory_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view documents for their companies" ON public.regulatory_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = regulatory_documents.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all documents" ON public.regulatory_documents
    FOR ALL USING (auth.role() = 'service_role');

-- bundle_documents
ALTER TABLE public.bundle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view bundle documents for their companies" ON public.bundle_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.regulatory_bundles 
            JOIN public.companies ON companies.company_id = regulatory_bundles.company_id
            WHERE regulatory_bundles.bundle_sid = bundle_documents.bundle_sid 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all bundle documents" ON public.bundle_documents
    FOR ALL USING (auth.role() = 'service_role');

-- bundle_status_updates
ALTER TABLE public.bundle_status_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view status updates for their companies" ON public.bundle_status_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.regulatory_bundles 
            JOIN public.companies ON companies.company_id = regulatory_bundles.company_id
            WHERE regulatory_bundles.bundle_sid = bundle_status_updates.bundle_sid 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all status updates" ON public.bundle_status_updates
    FOR ALL USING (auth.role() = 'service_role');

-- auto_provision_config
ALTER TABLE public.auto_provision_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view auto provision config for their companies" ON public.auto_provision_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.regulatory_bundles 
            JOIN public.companies ON companies.company_id = regulatory_bundles.company_id
            WHERE regulatory_bundles.bundle_sid = auto_provision_config.bundle_sid 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all auto provision config" ON public.auto_provision_config
    FOR ALL USING (auth.role() = 'service_role');

-- regulatory_requirements (PUBLIC READ, service role can modify)
ALTER TABLE public.regulatory_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view regulatory requirements" ON public.regulatory_requirements
    FOR SELECT USING (true);
CREATE POLICY "Service role can manage all requirements" ON public.regulatory_requirements
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- PHONE NUMBER DATA (Company-owned, service role access)
-- ============================================

-- phone_numbers
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view phone numbers for their companies" ON public.phone_numbers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = phone_numbers.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all phone numbers" ON public.phone_numbers
    FOR ALL USING (auth.role() = 'service_role');

-- phone_number_users
ALTER TABLE public.phone_number_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view phone number users for their companies" ON public.phone_number_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.companies 
            WHERE companies.company_id = phone_number_users.company_id 
            AND companies.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role can manage all phone number users" ON public.phone_number_users
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SYSTEM DATA (Service role only)
-- ============================================

-- models (PUBLIC READ, service role can modify)
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active models" ON public.models
    FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage all models" ON public.models
    FOR ALL USING (auth.role() = 'service_role');

-- training_responses (PUBLIC READ, service role can modify)
ALTER TABLE public.training_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active training responses" ON public.training_responses
    FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage all training responses" ON public.training_responses
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- USAGE/COST DATA (User-owned, service role access)
-- ============================================

-- user_costs
ALTER TABLE public.user_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own costs" ON public.user_costs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all costs" ON public.user_costs
    FOR ALL USING (auth.role() = 'service_role');

-- user_model_usage
ALTER TABLE public.user_model_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own model usage" ON public.user_model_usage
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all model usage" ON public.user_model_usage
    FOR ALL USING (auth.role() = 'service_role');

-- data_processing_logs
ALTER TABLE public.data_processing_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own data processing logs" ON public.data_processing_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all data processing logs" ON public.data_processing_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- INDEXES FOR BETTER PERFORMANCE
-- ============================================

-- User-based queries
CREATE INDEX IF NOT EXISTS idx_age_consent_user_id ON public.age_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON public.cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_costs_user_id ON public.user_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_model_usage_user_id ON public.user_model_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_data_processing_logs_user_id ON public.data_processing_logs(user_id);

-- Company-based queries
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_company_id ON public.api_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_prompts_company_id ON public.prompts(company_id);
CREATE INDEX IF NOT EXISTS idx_tools_company_id ON public.tools(company_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_company_id ON public.conversation_history(company_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_company_id ON public.session_summaries(company_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_company_id ON public.document_embeddings(company_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_company_id ON public.training_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_company_id ON public.workers(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_company_id ON public.whatsapp_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_bundles_company_id ON public.regulatory_bundles(company_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_company_id ON public.regulatory_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_company_id ON public.phone_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_users_company_id ON public.phone_number_users(company_id);

-- Regulatory bundle queries
CREATE INDEX IF NOT EXISTS idx_bundle_documents_bundle_sid ON public.bundle_documents(bundle_sid);
CREATE INDEX IF NOT EXISTS idx_bundle_status_updates_bundle_sid ON public.bundle_status_updates(bundle_sid);
CREATE INDEX IF NOT EXISTS idx_auto_provision_config_bundle_sid ON public.auto_provision_config(bundle_sid);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_history_timestamp ON public.conversation_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_summaries_updated_at ON public.session_summaries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_costs_month_year ON public.user_costs(month_year); 