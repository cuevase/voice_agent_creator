import { supabase } from "./supabase"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

export interface ConversationStatistics {
  total_messages: number
  user_messages: number
  bot_messages: number
  duration_minutes: number
  start_time: string
  end_time: string
}

export interface ConversationSession {
  session_id: string
  last_activity: string
  statistics: ConversationStatistics
  summary?: string
  summary_source?: string
}

export interface ConversationMessage {
  id: string
  session_id: string
  company_id: string
  message_type: "user" | "bot"
  content: string
  timestamp: string
  metadata: {
    input_type?: string
    response_type?: string
  }
}

export interface CompanySessionsResponse {
  sessions: ConversationSession[]
  total: number
  limit: number
  offset: number
  include_summaries: boolean
}

export interface ConversationHistoryResponse {
  messages: ConversationMessage[]
  total: number
  limit: number
  offset: number
}

export interface SessionSummaryResponse {
  session_id: string
  summary: {
    summary?: string
    company_id?: string
    created_at?: string
    updated_at?: string
  }
  message: string
}

export async function getCompanySessions(
  companyId: string,
  limit = 20,
  offset = 0,
  includeSummaries = true,
): Promise<CompanySessionsResponse> {
  try {
    console.log("Getting company sessions for:", companyId)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      include_summaries: includeSummaries.toString(),
    })

    const response = await fetch(`${API_BASE_URL}/conversation/company/${companyId}/sessions?${params}`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })

    console.log("Company sessions response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Company sessions error response:", errorText)
      throw new Error(`Failed to get company sessions: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Company sessions data:", data)

    return data
  } catch (error) {
    console.error("Error getting company sessions:", error)
    throw error
  }
}

export async function getConversationHistory(
  sessionId?: string,
  companyId?: string,
  limit = 50,
  offset = 0,
): Promise<ConversationHistoryResponse> {
  try {
    console.log("Getting conversation history for session:", sessionId, "company:", companyId)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    if (sessionId) {
      params.append("session_id", sessionId)
    }

    if (companyId) {
      params.append("company_id", companyId)
    }

    const response = await fetch(`${API_BASE_URL}/conversation/history?${params}`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })

    console.log("Conversation history response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Conversation history error response:", errorText)
      throw new Error(`Failed to get conversation history: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Conversation history data:", data)

    return data
  } catch (error) {
    console.error("Error getting conversation history:", error)
    throw error
  }
}

export async function getSessionSummary(sessionId: string): Promise<SessionSummaryResponse> {
  try {
    console.log("Getting session summary for:", sessionId)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/conversation/session/${sessionId}/summary`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
    })

    console.log("Session summary response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Session summary error response:", errorText)
      throw new Error(`Failed to get session summary: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Session summary data:", data)

    return data
  } catch (error) {
    console.error("Error getting session summary:", error)
    throw error
  }
}
