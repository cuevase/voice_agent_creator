import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

// Types for company cost management
export interface CompanyCost {
  month_year: string
  total_cost_usd: number
  tts_cost_usd: number
  stt_cost_usd: number
  llm_cost_usd: number
  active_users: number
}

export interface CompanyUserCost {
  user_id: string
  user_email: string
  total_cost_usd: number
  tts_cost_usd: number
  stt_cost_usd: number
  llm_cost_usd: number
  usage_count: number
}

export interface CompanyUsage {
  id: string
  user_id: string
  user_email: string
  model_id: string
  usage_amount: number
  cost_usd: number
  created_at: string
  models?: {
    type: string
    provider: string
    model_name: string
    unidad: string
    price_per_unidad: number
  }
}

export interface CompanyCostSummary {
  total_cost_usd: number
  tts_cost_usd: number
  stt_cost_usd: number
  llm_cost_usd: number
  total_users: number
  total_months: number
  average_cost_per_user: number
  average_cost_per_month: number
}

export interface MonthlyCostsResponse {
  status: string
  monthly_costs: CompanyCost[]
}

export interface CostSummaryResponse {
  status: string
  cost_summary: CompanyCostSummary
}

export interface UsageBreakdownResponse {
  status: string
  usage_breakdown: CompanyUsage[]
}

export interface UserCostsResponse {
  status: string
  user_costs: CompanyUserCost[]
}

// Get user token from Supabase session
const getUserToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Error getting user token:', error)
    return null
  }
}

// All company users can access company costs (no admin check needed)
export const isCompanyAdmin = async (companyId: string, userId: string): Promise<boolean> => {
  // All users of a company can access company costs
  return true
}

// Get company cost summary (admin only)
export const getCompanyCostSummary = async (companyId: string): Promise<CompanyCostSummary> => {
  try {
    const userToken = await getUserToken()
    if (!userToken) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${API_BASE_URL}/api/companies/${companyId}/cost-summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch cost summary: ${response.status}`)
    }

    const data: CostSummaryResponse = await response.json()
    
    if (data.status !== 'success') {
      throw new Error('Failed to get cost summary')
    }

    return data.cost_summary
  } catch (error) {
    console.error("Error getting company cost summary:", error)
    throw error
  }
}

// Get monthly costs (admin only)
export const getCompanyMonthlyCosts = async (companyId: string): Promise<CompanyCost[]> => {
  try {
    const userToken = await getUserToken()
    if (!userToken) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${API_BASE_URL}/api/companies/${companyId}/monthly-costs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch monthly costs: ${response.status}`)
    }

    const data: MonthlyCostsResponse = await response.json()
    
    if (data.status !== 'success') {
      throw new Error('Failed to get monthly costs')
    }

    return data.monthly_costs
  } catch (error) {
    console.error("Error getting company monthly costs:", error)
    throw error
  }
}

// Get company usage details (admin only)
export const getCompanyUsageDetails = async (companyId: string, limit: number = 50): Promise<CompanyUsage[]> => {
  try {
    const userToken = await getUserToken()
    if (!userToken) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${API_BASE_URL}/api/companies/${companyId}/usage-breakdown?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch usage breakdown: ${response.status}`)
    }

    const data: UsageBreakdownResponse = await response.json()
    
    if (data.status !== 'success') {
      throw new Error('Failed to get usage breakdown')
    }

    return data.usage_breakdown
  } catch (error) {
    console.error("Error getting company usage details:", error)
    throw error
  }
}

// Get company users with their cost summaries (admin only)
export const getCompanyUsersWithCosts = async (companyId: string): Promise<CompanyUserCost[]> => {
  try {
    const userToken = await getUserToken()
    if (!userToken) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${API_BASE_URL}/api/companies/${companyId}/user-costs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user costs: ${response.status}`)
    }

    const data: UserCostsResponse = await response.json()
    
    if (data.status !== 'success') {
      throw new Error('Failed to get user costs')
    }

    return data.user_costs
  } catch (error) {
    console.error("Error getting company users with costs:", error)
    throw error
  }
} 