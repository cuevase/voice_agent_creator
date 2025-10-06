import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

// Types for model management
export interface Model {
  id: string
  type: 'tts' | 'stt' | 'llm'
  provider: string
  model_name: string
  unidad: string
  price_per_unidad: number
  currency: string
}

export interface AvailableModelsResponse {
  status: string
  models: {
    tts: Model[]
    stt: Model[]
    llm: Model[]
  }
}

export interface EffectiveModelsResponse {
  status: string
  effective_models: {
    tts: Model
    stt: Model
    source: 'user_preferences' | 'company_defaults'
  }
}

export interface UserModelPreferences {
  ttsModelId: string
  sttModelId: string
}

export interface UserCost {
  month_year: string
  total_cost_usd: number
  tts_cost_usd: number
  stt_cost_usd: number
  llm_cost_usd: number
}

export interface UserUsage {
  id: string
  user_id: string
  model_id: string
  usage_amount: number
  cost_usd: number
  created_at: string
  models: {
    type: string
    provider: string
    model_name: string
    unidad: string
    price_per_unidad: number
  }
}

// Get available models
export const getAvailableModels = async (): Promise<AvailableModelsResponse> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/api/models/available`, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get available models: ${response.status} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting available models:", error)
    throw error
  }
}

// Get user's effective models (user preferences or company defaults)
export const getUserEffectiveModels = async (userId: string): Promise<EffectiveModelsResponse> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/effective-models`, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get user models: ${response.status} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting user models:", error)
    throw error
  }
}

// Update user model preferences
export const updateUserModelPreferences = async (userId: string, preferences: UserModelPreferences): Promise<any> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/model-preferences`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tts_model_id: preferences.ttsModelId,
        stt_model_id: preferences.sttModelId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to update user preferences: ${response.status} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error updating user model preferences:", error)
    throw error
  }
}

// Get user monthly costs
export const getUserMonthlyCosts = async (userId: string): Promise<UserCost[]> => {
  try {
    const { data, error } = await supabase
      .from('user_costs')
      .select('*')
      .eq('user_id', userId)
      .order('month_year', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error getting user monthly costs:", error)
    throw error
  }
}

// Get user usage details
export const getUserUsageDetails = async (userId: string, limit: number = 50): Promise<UserUsage[]> => {
  try {
    const { data, error } = await supabase
      .from('user_model_usage')
      .select(`
        *,
        models:model_id (
          type,
          provider,
          model_name,
          unidad,
          price_per_unidad
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error getting user usage details:", error)
    throw error
  }
} 