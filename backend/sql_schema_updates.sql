-- Update models table with new Deepgram STT Nova 2 and updated ElevenLabs pricing
-- Based on user's updated costs in Supabase

-- Update ElevenLabs Flash v2.5 TTS pricing (0.15 USD per minute)
UPDATE models 
SET price_per_unidad = 0.15,
    unidad = 'minutes',
    updated_at = NOW()
WHERE provider = 'elevenlabs' 
  AND model_name = 'eleven_flash_v2_5' 
  AND type = 'tts';

-- Add Deepgram STT Nova 2 model (0.0058 USD per minute)
INSERT INTO models (
    type,
    provider,
    model_name,
    unidad,
    price_per_unidad,
    currency,
    is_active,
    created_at,
    updated_at
) VALUES (
    'stt',
    'deepgram',
    'nova-2',
    'minutes',
    0.0058,
    'USD',
    true,
    NOW(),
    NOW()
) ON CONFLICT (provider, model_name, type) DO UPDATE SET
    price_per_unidad = EXCLUDED.price_per_unidad,
    unidad = EXCLUDED.unidad,
    updated_at = NOW();

-- Update credit_costs table to include the new models
INSERT INTO credit_costs (service_type, cost_per_unit, unit_description) VALUES
-- Deepgram STT Nova 2 (0.0058 USD per minute = 0.0058 * 100 = 0.58 credits per minute)
('deepgram_nova_2_stt', 1, 'per minute'),
-- ElevenLabs Flash v2.5 TTS (0.15 USD per minute = 0.15 * 100 = 15 credits per minute)
('elevenlabs_flash_v2_5_tts', 15, 'per minute')

ON CONFLICT (service_type) DO UPDATE SET
    cost_per_unit = EXCLUDED.cost_per_unit,
    unit_description = EXCLUDED.unit_description,
    updated_at = NOW();

-- Update existing ElevenLabs STT cost if it exists
UPDATE credit_costs 
SET cost_per_unit = 1,
    unit_description = 'per minute',
    updated_at = NOW()
WHERE service_type = 'elevenlabs_scribe_v1_stt';

-- Add ElevenLabs STT if it doesn't exist
INSERT INTO credit_costs (service_type, cost_per_unit, unit_description) VALUES
('elevenlabs_scribe_v1_stt', 1, 'per minute')
ON CONFLICT (service_type) DO NOTHING; 

-- Deepgram STT by characters (credits per 1 char). Set USD→MXN rate, e.g., 17 MXN/USD: 0.03 USD/1000 chars ≈ 0.51 MXN/1000 = 0.00051 credits/char
INSERT INTO credit_costs (service_type, cost_per_unit, unit_description, is_active)
VALUES ('deepgram_nova_2_stt_char', 0.00051, 'per character', true)
ON CONFLICT (service_type) DO UPDATE SET cost_per_unit=EXCLUDED.cost_per_unit, unit_description=EXCLUDED.unit_description, is_active=true, updated_at=NOW();

-- User voice preferences per company (Deepgram TTS model/voice)
CREATE TABLE IF NOT EXISTS public.user_company_voice_preferences (
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    tts_model_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_company_voice_preferences_pkey PRIMARY KEY (user_id, company_id)
);

-- Simple trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_company_voice_prefs ON public.user_company_voice_preferences;
CREATE TRIGGER set_updated_at_user_company_voice_prefs
BEFORE UPDATE ON public.user_company_voice_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS and policies so users can manage their own rows
ALTER TABLE public.user_company_voice_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own voice preferences per company" ON public.user_company_voice_preferences;
CREATE POLICY "Users can view their own voice preferences per company" ON public.user_company_voice_preferences
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert their own voice preferences per company" ON public.user_company_voice_preferences;
CREATE POLICY "Users can upsert their own voice preferences per company" ON public.user_company_voice_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own voice preferences per company" ON public.user_company_voice_preferences;
CREATE POLICY "Users can update their own voice preferences per company" ON public.user_company_voice_preferences
    FOR UPDATE USING (auth.uid() = user_id); 