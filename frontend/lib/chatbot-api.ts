import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

export interface ChatSession {
  session_id: string
}

export interface ChatMessage {
  text: string
}

export interface ChatResponse {
  text: string
}

export const startChatSession = async (companyId: string): Promise<string> => {
  try {
    console.log("Starting chat session for company:", companyId)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    // Get user ID for cost tracking
    const userId = session.user?.id
    if (!userId) {
      throw new Error("No user ID found in session")
    }

    const response = await fetch(`${API_BASE_URL}/chatbot/start-session?company_id=${companyId}&user_id=${userId}`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    console.log("Chat session response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Chat session error response:", errorText)
      throw new Error(`Failed to start chat session: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Chat session data:", data)

    if (!data.session_id) {
      throw new Error("No session_id in response")
    }

    return data.session_id
  } catch (error) {
    console.error("Error starting chat session:", error)

    // Provide more specific error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Unable to connect to chat service. Please check your internet connection.")
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.")
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error("Failed to start chat session")
  }
}

export const sendChatMessage = async (sessionId: string, message: string): Promise<ChatResponse> => {
  try {
    console.log("Sending chat message for session:", sessionId, "Message:", message)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const params = new URLSearchParams({
      session_id: sessionId,
      message: message,
    })

    const response = await fetch(`${API_BASE_URL}/chatbot/send-message?${params}`, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout for message processing
    })

    console.log("Chat message response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Chat message error response:", errorText)
      throw new Error(`Chat API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Chat response data keys:", Object.keys(data))
    console.log("Chat response data:", data)

    // Handle different possible response formats
    let responseText: string

    if (data.text) {
      responseText = data.text
    } else if (data.response) {
      responseText = data.response
    } else if (data.message) {
      responseText = data.message
    } else if (data.content) {
      responseText = data.content
    } else if (typeof data === "string") {
      responseText = data
    } else if (data.data && data.data.text) {
      responseText = data.data.text
    } else if (data.data && typeof data.data === "string") {
      responseText = data.data
    } else {
      console.error("Unexpected response format:", data)
      throw new Error(`Invalid response format from chat API. Received: ${JSON.stringify(data)}`)
    }

    return {
      text: responseText,
    }
  } catch (error) {
    console.error("Error sending chat message:", error)

    // Provide more specific error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Unable to connect to chat service. Please check your internet connection.")
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Message processing timed out. Please try again with a shorter message.")
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error("Failed to process chat message")
  }
}

// Test connection for chatbot
export const testChatConnection = async (companyId: string): Promise<boolean> => {
  try {
    // Test connection by attempting to start a session
    await startChatSession(companyId)
    return true
  } catch (error) {
    console.error("Chat connection test failed:", error)
    return false
  }
}
