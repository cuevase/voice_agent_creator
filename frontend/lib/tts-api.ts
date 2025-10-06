import { supabase } from '@/lib/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export interface VoiceModel {
  id: string
  name?: string
  model_name?: string
  provider: string
  type: string
  language?: string
  description?: string
}

export async function getAvailableVoiceModels(): Promise<VoiceModel[]> {
  if (!API_BASE_URL) throw new Error('API base URL is not configured')
  const { data: { session } } = await supabase.auth.getSession()
  const t0 = Date.now()
  const res = await fetch(`${API_BASE_URL}/api/models/available`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    cache: 'no-store',
  })
  console.log(`⏱️ getAvailableVoiceModels fetch ms=${Date.now() - t0}`)
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`)
  const t1 = Date.now()
  const payload = await res.json()
  console.log(`⏱️ getAvailableVoiceModels parse ms=${Date.now() - t1}`)
  const modelsBlock = payload?.models
  let list: any[] = []
  if (Array.isArray(payload)) list = payload
  else if (Array.isArray(modelsBlock)) list = modelsBlock
  else if (Array.isArray(modelsBlock?.tts)) list = modelsBlock.tts
  else list = []
  return list.map((m: any) => ({
    id: m.id,
    type: m.type,
    provider: m.provider,
    model_name: m.model_name ?? m.name ?? m.model ?? undefined,
    name: m.name ?? m.model_name ?? m.id,
    language: m.language,
    description: m.description,
  }))
}

export async function getUserVoicePref(companyId: string, userId: string): Promise<{ model: string | null }> {
  if (!API_BASE_URL) throw new Error('API base URL is not configured')
  const { data: { session } } = await supabase.auth.getSession()
  const t0 = Date.now()
  const res = await fetch(`${API_BASE_URL}/api/voice-prefs/${companyId}/${userId}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    cache: 'no-store',
  })
  console.log(`⏱️ getUserVoicePref fetch ms=${Date.now() - t0}`)
  if (!res.ok) return { model: null }
  const t1 = Date.now()
  const data = await res.json()
  console.log(`⏱️ getUserVoicePref parse ms=${Date.now() - t1}`)
  // accept either { model: id } or { tts_model_id: id }
  const modelId = data?.model ?? data?.tts_model_id ?? null
  return { model: modelId }
}

export async function saveUserVoicePref(companyId: string, userId: string, modelId: string): Promise<void> {
  if (!API_BASE_URL) throw new Error('API base URL is not configured')
  const { data: { session } } = await supabase.auth.getSession()
  const t0 = Date.now()
  const res = await fetch(`${API_BASE_URL}/api/voice-prefs/${companyId}/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ tts_model_id: modelId }),
  })
  console.log(`⏱️ saveUserVoicePref fetch ms=${Date.now() - t0}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to save preference: ${res.status} ${text}`)
  }
} 