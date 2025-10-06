import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

// Check if required environment variables are set
if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn('NEXT_PUBLIC_API_BASE_URL not set. Credit system may not work properly.')
}

// Types for credit system
export interface CreditBalance {
  credits_balance: number
  total_purchased: number
  total_used: number
}

export interface CreditPackage {
  id: string
  name: string
  credits_amount: number
  price_cents: number
  is_active: boolean
}

export interface CreditTransaction {
  id: string
  transaction_type: 'purchase' | 'usage' | 'refund'
  credits_amount: number
  description: string
  created_at: string
}

export interface CreditUsage {
  usage_type: string
  amount: number
  description: string
}

export interface CheckoutResponse {
  checkout_url: string
}

export interface CreditUsageResponse {
  credits_used: number
  remaining_credits: number
  usage_type: string
  amount: number
}

// Get current credit balance
export const getCreditBalance = async (): Promise<CreditBalance> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    if (!API_BASE_URL) {
      throw new Error("API base URL not configured")
    }

    const t0 = Date.now()
    const response = await fetch(`${API_BASE_URL}/api/credits/balance`, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })
    const t1 = Date.now()
    console.log(`⏱️ getCreditBalance fetch ms=${t1 - t0}`)

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = 'Unable to read error response'
      }
      
      console.error('Credit balance API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: `${API_BASE_URL}/api/credits/balance`
      })
      
      throw new Error(`Failed to get credit balance: ${response.status} - ${errorText}`)
    }

    const t2 = Date.now()
    const result = await response.json()
    console.log(`⏱️ getCreditBalance parse ms=${Date.now() - t2}`)
    return result
  } catch (error) {
    console.error("Error getting credit balance:", error)
    throw error
  }
}

// Get available credit packages
export const getCreditPackages = async (): Promise<{ packages: CreditPackage[] }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    if (!API_BASE_URL) {
      throw new Error("API base URL not configured")
    }

    const t0 = Date.now()
    const response = await fetch(`${API_BASE_URL}/api/credits/packages`, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })
    const t1 = Date.now()
    console.log(`⏱️ getCreditPackages fetch ms=${t1 - t0}`)

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = 'Unable to read error response'
      }
      
      console.error('Credit packages API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: `${API_BASE_URL}/api/credits/packages`
      })
      
      throw new Error(`Failed to get credit packages: ${response.status} - ${errorText}`)
    }

    const t2 = Date.now()
    const result = await response.json()
    console.log(`⏱️ getCreditPackages parse ms=${Date.now() - t2}`)
    return result
  } catch (error) {
    console.error("Error getting credit packages:", error)
    throw error
  }
}

// Create Stripe checkout session
export const createCreditCheckout = async (packageId: string): Promise<CheckoutResponse> => {
  console.log('🔍 createCreditCheckout: Function called with packageId:', packageId)
  
  try {
    console.log('🔍 createCreditCheckout: Getting Supabase session...')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.error('🔍 createCreditCheckout: No authenticated session found')
      throw new Error("No authenticated session found")
    }
    
    console.log('🔍 createCreditCheckout: Session found, user ID:', session.user?.id)

    if (!API_BASE_URL) {
      console.error('🔍 createCreditCheckout: API base URL not configured')
      throw new Error("API base URL not configured")
    }

    const successUrl = typeof window !== 'undefined' ? `${window.location.origin}/?tab=credits&payment=success` : 'https://pulpooplaygroundrevisedfront.onrender.com/?tab=credits&payment=success'
    const cancelUrl = typeof window !== 'undefined' ? `${window.location.origin}/?tab=credits&payment=cancelled` : 'https://pulpooplaygroundrevisedfront.onrender.com/?tab=credits&payment=cancelled'

    const requestBody = {
      success_url: successUrl,
      cancel_url: cancelUrl
    }

    console.log('🔍 createCreditCheckout: Making request to:', `${API_BASE_URL}/api/credits/checkout?package_id=${packageId}`)
    console.log('🔍 createCreditCheckout: Request body:', requestBody)
    console.log('🔍 createCreditCheckout: Auth token present:', !!session.access_token)
    console.log('🔍 createCreditCheckout: API base URL:', API_BASE_URL)

    const t0 = Date.now()
    const response = await fetch(`${API_BASE_URL}/api/credits/checkout?package_id=${packageId}`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody)
    })
    const t1 = Date.now()
    console.log(`⏱️ createCreditCheckout fetch ms=${t1 - t0}`)

    console.log('🔍 createCreditCheckout: Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    })

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = 'Unable to read error response'
      }
      
      console.error('🔍 createCreditCheckout: API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: `${API_BASE_URL}/api/credits/checkout?package_id=${packageId}`,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      throw new Error(`Failed to create checkout: ${response.status} - ${errorText}`)
    }

    const t2 = Date.now()
    const result = await response.json()
    console.log(`⏱️ createCreditCheckout parse ms=${Date.now() - t2}`)
    console.log('🔍 createCreditCheckout: Success response:', result)
    return result
  } catch (error) {
    console.error("Error creating checkout:", error)
    throw error
  }
}

// Use credits for a service
export const useCredits = async (usage: CreditUsage): Promise<CreditUsageResponse> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    if (!API_BASE_URL) {
      throw new Error("API base URL not configured")
    }

    const t0 = Date.now()
    const response = await fetch(`${API_BASE_URL}/api/credits/use`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(usage)
    })
    const t1 = Date.now()
    console.log(`⏱️ useCredits fetch ms=${t1 - t0}`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to use credits: ${response.status} - ${errorText}`)
    }

    const t2 = Date.now()
    const result = await response.json()
    console.log(`⏱️ useCredits parse ms=${Date.now() - t2}`)
    return result
  } catch (error) {
    console.error("Error using credits:", error)
    throw error
  }
}

// Get credit transaction history
export const getCreditTransactions = async (): Promise<{ transactions: CreditTransaction[] }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    if (!API_BASE_URL) {
      throw new Error("API base URL not configured")
    }

    const t0 = Date.now()
    const response = await fetch(`${API_BASE_URL}/api/credits/transactions`, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })
    const t1 = Date.now()
    console.log(`⏱️ getCreditTransactions fetch ms=${t1 - t0}`)

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = 'Unable to read error response'
      }
      
      // Log the full error for debugging
      console.error('Credit transactions API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: `${API_BASE_URL}/api/credits/transactions`
      })
      
      throw new Error(`Failed to get transactions: ${response.status} - ${errorText}`)
    }

    const t2 = Date.now()
    const result = await response.json()
    console.log(`⏱️ getCreditTransactions parse ms=${Date.now() - t2}`)
    return result
  } catch (error) {
    console.error("Error getting transactions:", error)
    throw error
  }
}

// Credit usage constants
export const CREDIT_COSTS = {
  voice_call: 1, // per minute
  sms: 1, // per message
  whatsapp: 1, // per message
  ai_response: 2, // per response
  gpt4: 60, // per 1K tokens
  gpt35: 2, // per 1K tokens
  gemini_pro: 1, // per 1K tokens
  claude: 2, // per 1K tokens
  document_upload: 5, // per document
  bundle_creation: 50, // per bundle
  phone_number: 100, // per number
} as const

export type CreditUsageType = keyof typeof CREDIT_COSTS 