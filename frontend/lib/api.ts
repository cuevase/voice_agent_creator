import { supabase } from './supabase'

// Real API functions using your backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

export interface CreateCompanyData {
  name: string
  email: string
  files: File[]
  additionalText?: string
  website_url?: string // Add optional website URL
  language?: string // Add optional language field
}

export interface CreateWorkerData {
  worker_name: string
  worker_email: string
  worker_role: string
  worker_available: boolean
  company_id: string
}

export interface CreateTimeSlotData {
  worker_id: string // Change from number to string for UUID
  day: string
  start_time: string
  end_time: string
  available: boolean
}

export interface PromptFragment {
  name: string
  content: string
  position: number
}

export interface PromptVersionCreate {
  version: number
  content: string
  locale?: string
  model_prefs?: {
    model: string
  }
  fragments?: PromptFragment[]
}

export interface PromptCreate {
  name: string
  description?: string
  version_data: PromptVersionCreate
}

export interface ExistingPrompt {
  prompt_id: string
  prompt_name: string
  prompt_content: string
  prompt_variables: any
  active: boolean
}

export interface Tool {
  id: string
  company_id: string
  api_connection_id: string
  name: string
  description: string
  method: string
  endpoint_template: string
  enabled: boolean
  version: number
  schema_cache: any
  created_at: string
  updated_at: string
}

export interface ToolsResponse {
  message: string
  data?: Tool[]
  company_id?: string
}

export interface Worker {
  worker_id: string
  worker_name: string
  worker_email: string
  worker_role: string
  worker_available: boolean
  company_id: string
  created_at?: string
}

export interface Company {
  company_id: string
  company_name: string
  company_email: string
  created_at: string
  files: string[]
  additional_text?: string
  website_url?: string
  user_id: string
}

export interface UserCompaniesResponse {
  companies: Company[]
  total: number
  limit: number
  offset: number
  user_id: string
  message: string
}

export interface CompanyFile {
  file_path: string
  file_name: string
  file_type: string
  file_size?: number
  created_at: string
  content_type: 'file' | 'url' | 'text'
}

export interface CompanyFilesResponse {
  message: string
  data: {
    files: CompanyFile[]
    urls: string[]
    additional_text?: string
  }
}

export interface FileManagementRequest {
  action: 'add_files' | 'remove_files' | 'add_urls' | 'remove_urls' | 'add_text'
  files?: File[]
  file_paths_to_remove?: string[]
  urls_to_add?: string[]
  urls_to_remove?: string[]
  additional_text?: string
}

export async function createCompany(data: CreateCompanyData) {
  console.log("🚀 createCompany API called with data:", data)
  
  // Get the current session to extract the access token
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    console.error("❌ No authenticated session found")
    throw new Error("No authenticated session found")
  }

  console.log("✅ Authenticated session found, user:", session.user?.email)

  const formData = new FormData()
  formData.append("name", data.name)
  formData.append("email", data.email)
  if (data.additionalText) {
    formData.append("additional_text", data.additionalText)
  }
  if (data.website_url) {
    formData.append("website_url", data.website_url)
  }
  if (data.language) {
    formData.append("language", data.language)
    console.log("Sending language parameter:", data.language) // Debug log
  } else {
    console.log("No language parameter provided, using default") // Debug log
  }
  data.files.forEach((file) => {
    formData.append("files", file)
  })

  console.log("FormData contents:") // Debug log
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`)
  }

  console.log("🌐 Making API request to:", `${API_BASE_URL}/create_company`)
  
  const response = await fetch(`${API_BASE_URL}/create_company`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: formData,
  })

  console.log("📡 API response status:", response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ Create company error:", errorText)
    throw new Error("Failed to create company")
  }

  const responseData = await response.json()
  console.log("📦 API response data:", responseData)
  
  // Set default models for the new company (critical for cost tracking)
  if (responseData.company_id) {
    try {
      console.log("🎯 Setting default models for company:", responseData.company_id)
      const modelsResponse = await fetch(`${API_BASE_URL}/companies/${responseData.company_id}/set-default-models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_id: responseData.company_id,
          tts_model_id: "", // Will be auto-filled with ElevenLabs
          stt_model_id: ""  // Will be auto-filled with ElevenLabs
        })
      })
      
      if (modelsResponse.ok) {
        console.log("✅ Default models set for company")
      } else {
        console.error("❌ Failed to set default models:", await modelsResponse.text())
      }
    } catch (error) {
      console.error("❌ Error setting default models:", error)
      // Don't fail company creation if model setup fails
    }
  }
  
  return responseData
}

export async function getCompanyInfo(companyId: string) {
  const response = await fetch(`${API_BASE_URL}/get_company_info?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get company info")
  }

  return response.json()
}

export async function createWorker(data: CreateWorkerData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/create_worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Create worker error:", errorText)
    throw new Error("Failed to create worker")
  }

  return response.json()
}

export async function createTimeSlot(data: CreateTimeSlotData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/create_time_slot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data), // worker_id is now already a string UUID
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Create time slot error:", errorText)
    throw new Error("Failed to create time slot")
  }

  return response.json()
}

export async function getWorkers(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/get_workers?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get workers error:", errorText)
    throw new Error("Failed to get workers")
  }

  const result = await response.json()
  console.log("Get workers raw response:", result)
  return result || []
}

export async function getTimeSlots(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/get_time_slots?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get time slots error:", errorText)
    throw new Error("Failed to get time slots")
  }

  const result = await response.json()
  console.log("Get time slots raw response:", result)
  return result.data || result || []
}

export async function searchDocuments(query: string, clientId: string) {
  const response = await fetch(`${API_BASE_URL}/search_documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({
      query,
      client_id: clientId,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to search documents")
  }

  return response.json()
}

export async function createSystemPrompt(companyId: string, promptData: PromptCreate) {
  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/system-prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(promptData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create system prompt: ${response.status} ${errorText}`)
  }

  return response.json()
}

export async function getCompanyPrompts(companyId: string): Promise<ExistingPrompt[]> {
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/get_prompts?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get company prompts error:", errorText)
    throw new Error("Failed to fetch company prompts")
  }

  const result = await response.json()
  console.log("Get company prompts raw response:", result)
  return result.data || []
}

export async function activatePrompt(companyId: string, promptId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/activate_prompt_for_company?company_id=${companyId}&prompt_id=${promptId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Activate prompt error:", errorText)
    throw new Error("Failed to activate prompt")
  }

  const result = await response.text()
  console.log("Activate prompt response:", result)
}

export async function getCompanyFiles(companyId: string): Promise<CompanyFilesResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  console.log("🔍 Fetching company files for companyId:", companyId)
  console.log("🔍 Using session token:", session.access_token ? "Present" : "Missing")

  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/files`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  console.log("🔍 Response status:", response.status)
  console.log("🔍 Response headers:", Object.fromEntries(response.headers.entries()))

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ Get company files error:", errorText)
    console.error("❌ Response status:", response.status)
    throw new Error("Failed to fetch company files")
  }

  const result = await response.json()
  console.log("✅ Get company files raw response:", result)
  console.log("✅ Response type:", typeof result)
  console.log("✅ Response keys:", Object.keys(result))
  
  // Transform the backend response to match our expected interface
  const transformedResponse: CompanyFilesResponse = {
    message: "Files fetched successfully",
    data: {
      files: [],
      urls: [],
      additional_text: ""
    }
  }

  // Handle files - convert file paths to CompanyFile objects
  if (result.files && Array.isArray(result.files)) {
    transformedResponse.data.files = result.files.map((filePath: string, index: number) => ({
      file_path: filePath,
      file_name: filePath.split('/').pop() || `file_${index}`,
      file_type: filePath.split('.').pop() || 'unknown',
      created_at: new Date().toISOString(), // Backend doesn't provide this, so we use current time
      content_type: 'file' as const
    }))
  }

  // Handle URLs - convert string "[]" to actual array
  if (result.urls) {
    try {
      // If urls is a string representation of an array, parse it
      if (typeof result.urls === 'string') {
        const parsedUrls = JSON.parse(result.urls)
        transformedResponse.data.urls = Array.isArray(parsedUrls) ? parsedUrls : []
      } else if (Array.isArray(result.urls)) {
        transformedResponse.data.urls = result.urls
      } else {
        transformedResponse.data.urls = []
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse URLs:", result.urls)
      transformedResponse.data.urls = []
    }
  }

  // Handle additional text
  if (result.additional_text) {
    transformedResponse.data.additional_text = result.additional_text
  }

  console.log("✅ Transformed response:", transformedResponse)
  return transformedResponse
}

import { checkConsent } from './consent-api'

export async function manageCompanyFiles(companyId: string, request: FileManagementRequest): Promise<any> {
  // Check file processing consent first
  const hasConsent = await checkConsent('file_processing')
  if (!hasConsent) {
    throw new Error('File processing consent required. Please update your privacy settings.')
  }

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const formData = new FormData()
  formData.append("action", request.action)

  // Add files if present
  if (request.files) {
    request.files.forEach((file) => {
      formData.append("files", file)
    })
  }

  // Add other parameters
  if (request.file_paths_to_remove) {
    formData.append("file_paths_to_remove", JSON.stringify(request.file_paths_to_remove))
  }

  if (request.urls_to_add) {
    formData.append("urls_to_add", JSON.stringify(request.urls_to_add))
  }

  if (request.urls_to_remove) {
    formData.append("urls_to_remove", JSON.stringify(request.urls_to_remove))
  }

  if (request.additional_text) {
    formData.append("additional_text", request.additional_text)
  }

  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/files`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Manage company files error:", errorText)
    
    // Check for consent-related errors
    if (errorText.includes('consent required') || errorText.includes('consent')) {
      throw new Error('File processing consent required. Please update your privacy settings.')
    }
    
    throw new Error("Failed to manage company files")
  }

  const result = await response.json()
  console.log("Manage company files response:", result)
  return result
}

export async function getCompanyTools(companyId: string): Promise<ToolsResponse> {
  // Get the current session to extract the access token
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/check_if_tools_exist?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get company tools error:", errorText)
    throw new Error("Failed to fetch company tools")
  }

  const result = await response.json()
  console.log("Get company tools raw response:", result)
  return result.data || []
}

export async function getCompanyWorkers(companyId: string): Promise<Worker[]> {
  // Get the current session to extract the access token
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/get_workers?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get company workers error:", errorText)
    throw new Error("Failed to fetch company workers")
  }

  return response.json()
}

export async function checkIfToolsExist(companyId: string): Promise<Tool[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/check_if_tools_exist?company_id=${companyId}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Check if tools exist error:", errorText)
    throw new Error("Failed to check if tools exist")
  }

  const result = await response.json()
  console.log("Check if tools exist raw response:", result)
  return result || []
}

export async function enableSchedulingTool(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/add_check_availability_tool_to_company?company_id=${companyId}`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to enable scheduling tool: ${response.status} ${errorText}`)
  }

  return response.json()
}

export async function enableCreateAppointmentTool(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/add_create_appointment_tool_to_company?company_id=${companyId}`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to enable create appointment tool: ${response.status} ${errorText}`)
  }

  return response.json()
}

export async function getUserCompanies(userId: string, limit: number = 50, offset: number = 0): Promise<UserCompaniesResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/companies/user/${userId}?limit=${limit}&offset=${offset}`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get user companies error:", errorText)
    throw new Error("Failed to fetch user companies")
  }

  const result = await response.json()
  console.log("Get user companies response:", result)
  return result
}

export interface WhatsAppConfig {
  company_id: string
  twilio_number: string
  is_active: boolean
  welcome_message: string
}

export async function getWhatsAppConfig(companyId: string): Promise<WhatsAppConfig | null> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/whatsapp`, {
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null // No configuration found
    }
    const errorText = await response.text()
    console.error("Get WhatsApp config error:", errorText)
    throw new Error("Failed to fetch WhatsApp configuration")
  }

  const result = await response.json()
  console.log("Get WhatsApp config response:", result)
  return result
}

export async function configureWhatsApp(companyId: string, config: WhatsAppConfig): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Configure WhatsApp error:", errorText)
    throw new Error("Failed to configure WhatsApp")
  }

  const result = await response.json()
  console.log("Configure WhatsApp response:", result)
  return result
}

// Training interfaces
export interface TrainingSession {
  id: string
  session_name: string
  company_id: string
  total_messages: number
  created_at: string
}

export interface TrainingMessage {
  id: string
  training_session_id: string
  message_type: 'user' | 'agent'
  content: string
  message_order: number
  created_at: string
}

export interface CreateTrainingSessionData {
  company_id: string
  session_name: string
}

export interface CreateTrainingMessageData {
  training_session_id: string
  message_type: 'user' | 'agent'
  content: string
}

export interface TrainingResponse {
  success: boolean
  response: string
  message: string
}

// Training API functions
export async function createTrainingSession(data: CreateTrainingSessionData): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Create training session error:", errorText)
    throw new Error("Failed to create training session")
  }

  return response.json()
}

export async function getTrainingSessions(companyId: string): Promise<TrainingSession[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/sessions/${companyId}`, {
    method: "GET",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get training sessions error:", errorText)
    throw new Error("Failed to get training sessions")
  }

  const result = await response.json()
  return result.sessions || []
}

export async function deleteTrainingSession(sessionId: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Delete training session error:", errorText)
    throw new Error("Failed to delete training session")
  }

  return response.json()
}

export async function createTrainingMessage(data: CreateTrainingMessageData): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Create training message error:", errorText)
    throw new Error("Failed to create training message")
  }

  return response.json()
}

export async function getTrainingMessages(sessionId: string): Promise<TrainingMessage[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/messages/${sessionId}`, {
    method: "GET",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get training messages error:", errorText)
    throw new Error("Failed to get training messages")
  }

  const result = await response.json()
  return result.messages || []
}

export async function getTrainingResponse(sessionId: string, userMessage: string): Promise<TrainingResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error("No authenticated session found")
  }

  const response = await fetch(`${API_BASE_URL}/training/respond?session_id=${sessionId}&user_message=${encodeURIComponent(userMessage)}`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Get training response error:", errorText)
    throw new Error("Failed to get training response")
  }

  return response.json()
}
