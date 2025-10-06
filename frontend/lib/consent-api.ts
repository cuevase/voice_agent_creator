import { supabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

// Debug: Log the API base URL (remove this in production)
console.log('Consent API Base URL:', API_BASE_URL)
console.log('Environment check - NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL)
console.log('Full consent URL will be:', `${API_BASE_URL}/users/{userId}/consents`)

// Debug: Log the API base URL (remove this in production)
console.log('Consent API Base URL:', API_BASE_URL)
console.log('Environment check - NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL)

export interface UserConsents {
  voice_recording: boolean
  file_processing: boolean
  ai_training: boolean
  payment_processing: boolean
}

export interface ConsentUpdateRequest {
  consent_type: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing'
  granted: boolean
}

// Get current user ID from Supabase session
const getCurrentUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) {
    throw new Error('No authenticated user found')
  }
  return session.user.id
}

// Get JWT token from Supabase session
const getJwtToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No authenticated session found')
  }
  return session.access_token
}

// Update user consent
export const updateConsent = async (consentType: ConsentUpdateRequest['consent_type'], granted: boolean): Promise<void> => {
  try {
    const userId = await getCurrentUserId()
    const jwtToken = await getJwtToken()

    console.log('Updating consent:', { userId, consentType, granted, API_BASE_URL })

    const response = await fetch(`${API_BASE_URL}/users/${userId}/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        consent_type: consentType,  // "voice_recording", "file_processing", etc.
        granted: granted           // true/false
      })
    })

    console.log('Consent update response status:', response.status)

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Consent endpoint not found - backend may not be implemented yet')
        // For now, just log the action without throwing an error
        console.log(`Consent ${consentType} set to ${granted} (backend not implemented)`)
        return
      }
      
      const error = await response.json().catch(() => ({ detail: 'Failed to update consent' }))
      throw new Error(error.detail || 'Failed to update consent')
    }

    return response.json()
  } catch (error) {
    console.error('Error updating consent:', error)
    // Don't throw error if it's a network/404 issue - just log it
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      console.warn('Network error updating consent - backend may not be available')
      return
    }
    throw error
  }
}

// Get user consents
export const getUserConsents = async (): Promise<UserConsents> => {
  try {
    const userId = await getCurrentUserId()
    const jwtToken = await getJwtToken()

    console.log('Fetching user consents for userId:', userId)

    const response = await fetch(`${API_BASE_URL}/users/${userId}/consents`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'ngrok-skip-browser-warning': 'true'
      }
    })

    console.log('Get consents response status:', response.status)
    console.log('Get consents response URL:', response.url)

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Consents endpoint not found - backend may not be implemented yet')
        // Return default consents if endpoint doesn't exist
        return {
          voice_recording: false,
          file_processing: false,
          ai_training: false,
          payment_processing: false
        }
      }
      
      // Try to get the response text to see what we're actually receiving
      const responseText = await response.text()
      console.error('Error response text:', responseText)
      
      // Try to parse as JSON, but don't fail if it's not JSON
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch (e) {
        errorData = { detail: `HTTP ${response.status}: ${responseText.substring(0, 100)}...` }
      }
      
      throw new Error(errorData.detail || 'Failed to get user consents')
    }

    const responseData = await response.json()
    console.log('Received consents from backend:', responseData)
    
    // Transform Supabase response to expected format
    // Backend returns: { data: [{ user_id, consent_type, granted }, ...] }
    // Frontend expects: { voice_recording: boolean, file_processing: boolean, ... }
    
    const consents: UserConsents = {
      voice_recording: false,
      file_processing: false,
      ai_training: false,
      payment_processing: false
    }
    
    if (responseData.data && Array.isArray(responseData.data)) {
      responseData.data.forEach((consent: any) => {
        if (consent.consent_type && consent.granted !== undefined) {
          consents[consent.consent_type as keyof UserConsents] = Boolean(consent.granted)
        }
      })
    }
    
    console.log('Transformed consents:', consents)
    return consents
  } catch (error) {
    console.error('Error getting user consents:', error)
    // Return default consents if API fails
    return {
      voice_recording: false,
      file_processing: false,
      ai_training: false,
      payment_processing: false
    }
  }
}

// Check specific consent
export const checkConsent = async (consentType: ConsentUpdateRequest['consent_type']): Promise<boolean> => {
  try {
    const consents = await getUserConsents()
    return consents[consentType] || false
  } catch (error) {
    console.error(`Error checking ${consentType} consent:`, error)
    return false
  }
}

// Export user data
export const exportUserData = async (): Promise<any> => {
  try {
    const userId = await getCurrentUserId()
    const jwtToken = await getJwtToken()

    const response = await fetch(`${API_BASE_URL}/users/${userId}/data-export`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'ngrok-skip-browser-warning': 'true'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to export user data' }))
      throw new Error(errorData.detail || 'Failed to export user data')
    }

    const data = await response.json()

    // Download as JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    return data
  } catch (error) {
    console.error('Error exporting user data:', error)
    throw error
  }
}

// Delete user data
export const deleteUserData = async (): Promise<void> => {
  try {
    const userId = await getCurrentUserId()
    const jwtToken = await getJwtToken()

    const response = await fetch(`${API_BASE_URL}/users/${userId}/data`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'ngrok-skip-browser-warning': 'true'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to delete user data' }))
      throw new Error(errorData.detail || 'Failed to delete user data')
    }

    return response.json()
  } catch (error) {
    console.error('Error deleting user data:', error)
    throw error
  }
} 