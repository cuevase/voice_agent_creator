import { getUserConsents } from './consent-api'

export interface ErrorHandlerOptions {
  showConsentModal?: (type: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing') => void
  redirectToLogin?: () => void
  showErrorMessage?: (message: string) => void
}

// Standard error handling for all endpoints
export const handleApiError = (error: Error, options: ErrorHandlerOptions = {}) => {
  const { showConsentModal, redirectToLogin, showErrorMessage } = options

  console.error('API Error:', error)

  // Check for consent-related errors
  if (error.message.includes('consent required') || error.message.includes('consent')) {
    if (showConsentModal) {
      // Determine consent type from error message
      if (error.message.includes('voice')) {
        showConsentModal('voice_recording')
      } else if (error.message.includes('file')) {
        showConsentModal('file_processing')
      } else if (error.message.includes('ai') || error.message.includes('training')) {
        showConsentModal('ai_training')
      } else if (error.message.includes('payment')) {
        showConsentModal('payment_processing')
      } else {
        // Default to voice recording if type can't be determined
        showConsentModal('voice_recording')
      }
    }
    return
  }

  // Check for authentication errors
  if (error.message.includes('Access denied') || error.message.includes('unauthorized') || error.message.includes('401')) {
    if (redirectToLogin) {
      redirectToLogin()
    }
    return
  }

  // Handle other errors
  if (showErrorMessage) {
    showErrorMessage(error.message)
  }
}

// Check consent before performing actions
export const checkConsentBeforeAction = async (
  consentType: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing',
  action: () => Promise<void>,
  showConsentModal?: (type: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing') => void
) => {
  try {
    const consents = await getUserConsents()
    if (!consents[consentType]) {
      if (showConsentModal) {
        showConsentModal(consentType)
      } else {
        throw new Error(`${consentType} consent required. Please update your privacy settings.`)
      }
      return
    }
    
    await action()
  } catch (error) {
    if (error instanceof Error) {
      handleApiError(error, { showConsentModal })
    }
  }
}

// Standard API call wrapper with error handling
export const apiCall = async <T>(
  apiFunction: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> => {
  try {
    return await apiFunction()
  } catch (error) {
    if (error instanceof Error) {
      handleApiError(error, options)
    }
    return null
  }
} 