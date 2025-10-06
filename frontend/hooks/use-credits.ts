import { useState, useCallback, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { 
  getCreditBalance, 
  useCredits as useCreditsAPI, 
  type CreditBalance,
  type CreditUsage,
  type CreditUsageResponse,
  CREDIT_COSTS,
  type CreditUsageType
} from "@/lib/credits-api"

export function useCredits() {
  const auth = useAuth()
  const user = auth?.user || null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null)

  console.log('🔍 useCredits: Hook initialized with:', {
    auth: !!auth,
    user: !!user,
    creditBalance
  })

  // Load current credit balance
  const loadBalance = useCallback(async () => {
    if (!auth || !user?.id) return

    try {
      setLoading(true)
      setError(null)
      const balance = await getCreditBalance()
      
      // Check if balance is valid (not null/empty)
      if (balance && typeof balance.credits_balance === 'number' && balance.credits_balance >= 0) {
        console.log('🔍 useCredits: Valid balance loaded:', balance)
        setCreditBalance(balance)
        return balance
      } else {
        console.log('🔍 useCredits: Empty or invalid balance from backend, using fallback')
        // Set fallback balance with some demo credits for testing
        const fallbackBalance = {
          credits_balance: 100, // Give some demo credits for testing
          total_purchased: 100,
          total_used: 0
        }
        setCreditBalance(fallbackBalance)
        return fallbackBalance
      }
    } catch (err) {
      console.error("🔍 useCredits: Error loading credit balance:", err)
      setError("Failed to load credit balance")
      throw err
    } finally {
      setLoading(false)
    }
  }, [auth, user?.id])

  // Auto-load balance when user is authenticated
  useEffect(() => {
    if (auth && user?.id && !creditBalance) {
      console.log('🔍 useCredits: Auto-loading balance for user:', user.id)
      loadBalance()
    }
  }, [auth, user?.id, creditBalance, loadBalance])

  // Use credits for a specific service
  const useCreditsForService = useCallback(async (
    usageType: CreditUsageType,
    amount: number,
    description: string
  ): Promise<CreditUsageResponse> => {
    if (!auth || !user?.id) {
      throw new Error("User not authenticated")
    }

    try {
      setLoading(true)
      setError(null)

      const usage: CreditUsage = {
        usage_type: usageType,
        amount,
        description
      }

      const result = await useCreditsAPI(usage)
      
      // Update local balance
      if (creditBalance) {
        setCreditBalance({
          ...creditBalance,
          credits_balance: result.remaining_credits,
          total_used: creditBalance.total_used + result.credits_used
        })
      }

      return result
    } catch (err) {
      console.error("Error using credits:", err)
      setError("Failed to use credits")
      throw err
    } finally {
      setLoading(false)
    }
  }, [auth, user?.id, creditBalance])

  // Check if user has enough credits for a service
  const hasEnoughCredits = useCallback((usageType: CreditUsageType, amount: number = 1): boolean => {
    console.log('🔍 hasEnoughCredits: Checking credits:', {
      creditBalance,
      usageType,
      amount,
      requiredCredits: CREDIT_COSTS[usageType] * amount
    })
    
    if (!creditBalance) {
      console.log('🔍 hasEnoughCredits: No credit balance available')
      return false
    }
    
    const requiredCredits = CREDIT_COSTS[usageType] * amount
    const hasEnough = creditBalance.credits_balance >= requiredCredits
    
    console.log('🔍 hasEnoughCredits: Result:', {
      currentBalance: creditBalance.credits_balance,
      requiredCredits,
      hasEnough
    })
    
    return hasEnough
  }, [creditBalance])

  // Get required credits for a service
  const getRequiredCredits = useCallback((usageType: CreditUsageType, amount: number = 1): number => {
    return CREDIT_COSTS[usageType] * amount
  }, [])

  // Voice call credit usage
  const useVoiceCallCredits = useCallback(async (durationMinutes: number): Promise<CreditUsageResponse> => {
    return useCreditsForService('voice_call', durationMinutes, `Voice call (${durationMinutes} minutes)`)
  }, [useCreditsForService])

  // AI response credit usage
  const useAIResponseCredits = useCallback(async (model: string, tokens: number): Promise<CreditUsageResponse> => {
    let usageType: CreditUsageType = 'ai_response'
    
    // Determine usage type based on model
    if (model.includes('gpt-4')) {
      usageType = 'gpt4'
    } else if (model.includes('gpt-3.5')) {
      usageType = 'gpt35'
    } else if (model.includes('gemini')) {
      usageType = 'gemini_pro'
    } else if (model.includes('claude')) {
      usageType = 'claude'
    }

    const tokenThousands = Math.ceil(tokens / 1000)
    return useCreditsForService(usageType, tokenThousands, `${model} response (${tokens} tokens)`)
  }, [useCreditsForService])

  // Document upload credit usage
  const useDocumentUploadCredits = useCallback(async (documentType: string): Promise<CreditUsageResponse> => {
    return useCreditsForService('document_upload', 1, `Document upload (${documentType})`)
  }, [useCreditsForService])

  // Bundle creation credit usage
  const useBundleCreationCredits = useCallback(async (bundleType: string): Promise<CreditUsageResponse> => {
    return useCreditsForService('bundle_creation', 1, `Regulatory bundle creation (${bundleType})`)
  }, [useCreditsForService])

  // Phone number purchase credit usage
  const usePhoneNumberCredits = useCallback(async (phoneNumber: string): Promise<CreditUsageResponse> => {
    return useCreditsForService('phone_number', 1, `Phone number purchase (${phoneNumber})`)
  }, [useCreditsForService])

  // SMS credit usage
  const useSMSCredits = useCallback(async (messageCount: number = 1): Promise<CreditUsageResponse> => {
    return useCreditsForService('sms', messageCount, `SMS message${messageCount > 1 ? 's' : ''} (${messageCount})`)
  }, [useCreditsForService])

  // WhatsApp credit usage
  const useWhatsAppCredits = useCallback(async (messageCount: number = 1): Promise<CreditUsageResponse> => {
    return useCreditsForService('whatsapp', messageCount, `WhatsApp message${messageCount > 1 ? 's' : ''} (${messageCount})`)
  }, [useCreditsForService])

  return {
    // State
    loading,
    error,
    creditBalance,
    
    // Actions
    loadBalance,
    useCreditsForService,
    hasEnoughCredits,
    getRequiredCredits,
    
    // Service-specific functions
    useVoiceCallCredits,
    useAIResponseCredits,
    useDocumentUploadCredits,
    useBundleCreationCredits,
    usePhoneNumberCredits,
    useSMSCredits,
    useWhatsAppCredits,
    
    // Constants
    CREDIT_COSTS
  }
} 