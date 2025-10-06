import { supabase } from "./supabase"
import { Tool } from "./api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

export interface ToolArgCreate {
  name: string
  type: "string" | "integer" | "number" | "boolean"
  location: "query" | "body" | "path"
  required: boolean
  description?: string
  example?: string
  enum_vals?: string[]
}

export interface ApiConnectionCreate {
  name: string
  api_base_url: string
  auth: {
    type?: "bearer" | "basic" | "none"
    token?: string
    headers?: Record<string, string>
  }
}

export interface ToolCreate {
  name: string
  description?: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  endpoint_template: string
  api_base_url: string
  auth: {
    type: "bearer" | "basic" | "none"
    token?: string
    headers?: Record<string, string>
  }
  args?: ToolArgCreate[]
}

export async function createApiConnection(companyId: string, connectionData: ApiConnectionCreate): Promise<string> {
  try {
    console.log("Creating API connection for company:", companyId, "Connection data:", connectionData)
    console.log("API connection payload being sent:", JSON.stringify(connectionData, null, 2))

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/companies/${companyId}/api-connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(connectionData),
    })

    console.log("API connection response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API connection error response:", errorText)
      console.error("Full error details - Status:", response.status, "Headers:", Object.fromEntries(response.headers.entries()))
      throw new Error(`Failed to create API connection: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log("API connection created successfully:", result)
    return result.api_connection_id
  } catch (error) {
    console.error("Error creating API connection:", error)
    throw error
  }
}

export async function createCustomTool(companyId: string, toolData: ToolCreate): Promise<any> {
  try {
    console.log("Creating custom tool for company:", companyId, "Tool data:", toolData)

    // Step 1: Create API connection first
    const apiConnectionData: ApiConnectionCreate = {
      name: `${toolData.name}_api_connection`,
      api_base_url: toolData.api_base_url,
      auth: {
        type: toolData.auth.type,
        token: toolData.auth.token || "",
        headers: toolData.auth.type === "bearer" && toolData.auth.token 
          ? { "Authorization": `Bearer ${toolData.auth.token}` }
          : toolData.auth.type === "basic" && toolData.auth.token
          ? { "Authorization": `Basic ${btoa(toolData.auth.token)}` }
          : {}
      }
    }

    console.log("Step 1: Creating API connection...")
    const apiConnectionId = await createApiConnection(companyId, apiConnectionData)
    console.log("API connection created with ID:", apiConnectionId)

    // Step 2: Create the tool with the API connection ID
    const toolPayload = {
      name: toolData.name,
      description: toolData.description,
      method: toolData.method,
      endpoint_template: toolData.endpoint_template,
      api_connection_id: apiConnectionId,
      args: toolData.args
    }

    console.log("Step 2: Creating tool with API connection ID...")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("No authenticated session found")
    }

    const response = await fetch(`${API_BASE_URL}/companies/${companyId}/tools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(toolPayload),
    })

    console.log("Custom tool response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Custom tool error response:", errorText)
      throw new Error(`Failed to create custom tool: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log("Custom tool created successfully:", result)
    return result
  } catch (error) {
    console.error("Error creating custom tool:", error)
    throw error
  }
}

export async function getCompanyTools(companyId: string): Promise<Tool[]> {
  try {
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
      throw new Error("Failed to get company tools")
    }

    const result = await response.json()
    return result.data || []
  } catch (error) {
    console.error("Error getting company tools:", error)
    throw error
  }
}
