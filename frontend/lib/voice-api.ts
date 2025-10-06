import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

export interface VoiceSession {
  session_id: string
}

export interface VoiceResponse {
  text: string
  audio: string // base64 encoded audio
}

export const startSession = async (companyId: string): Promise<string> => {
  try {
    console.log("Starting voice session for company:", companyId)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    // Get user ID for cost tracking
    const userId = session.user?.id
    if (!userId) {
      throw new Error("No user ID found in session")
    }

    // Using the correct endpoint from your backend message
    const response = await fetch(`${API_BASE_URL}/start-chat-session?company_id=${companyId}&user_id=${userId}`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    console.log("Voice session response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Voice session error response:", errorText)
      throw new Error(`Failed to start voice session: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Voice session response data:", JSON.stringify(data, null, 2))

    // Simplified response parsing - match chatbot API behavior
    if (!data.session_id) {
      console.error("No session_id found in voice session response. Full response:", data)
      throw new Error(`No session_id in voice session response. Received: ${JSON.stringify(data)}`)
    }

    console.log("Voice session initialized successfully:", data.session_id)
    return data.session_id
  } catch (error) {
    console.error("Error starting voice session:", error)

    // Provide more specific error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Unable to connect to voice service. Please check your internet connection.")
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Voice session request timed out. Please try again.")
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error("Failed to start voice session")
  }
}

import { checkConsent } from './consent-api'

export const sendVoice = async (sessionId: string, audioBlob: Blob): Promise<VoiceResponse> => {
  try {
    console.log("Sending voice for session:", sessionId, "Audio size:", audioBlob.size)

    // Check voice recording consent first
    const hasConsent = await checkConsent('voice_recording')
    if (!hasConsent) {
      throw new Error('Voice recording consent required. Please update your privacy settings.')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const formData = new FormData()
    formData.append("session_id", sessionId)
    formData.append("audio", audioBlob, "audio.wav")

    // Using the correct endpoint from your backend message
    const response = await fetch(`${API_BASE_URL}/agent/voice`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000), // 30 second timeout for voice processing
    })

    console.log("Voice response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Voice error response:", errorText)
      
      // Check for consent-related errors
      if (errorText.includes('consent required') || errorText.includes('consent')) {
        throw new Error('Voice recording consent required. Please update your privacy settings.')
      }
      
      throw new Error(`Voice API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Voice response data keys:", Object.keys(data))

    if (!data.text || !data.audio) {
      throw new Error("Invalid response format from voice API")
    }

    return {
      text: data.text,
      audio: data.audio,
    }
  } catch (error) {
    console.error("Error sending voice:", error)

    // Provide more specific error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Unable to connect to voice service. Please check your internet connection.")
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Voice processing timed out. Please try again with a shorter message.")
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error("Failed to process voice message")
  }
}

// Remove the testConnection function since /health doesn't exist
// Instead, we'll test by trying to start a session
export const testConnection = async (companyId: string): Promise<boolean> => {
  try {
    // Test connection by attempting to start a session
    await startSession(companyId)
    return true
  } catch (error) {
    console.error("Connection test failed:", error)
    return false
  }
}
