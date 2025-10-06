export interface Company {
  company_id: string // UUID string
  company_name: string
  company_email: string
  additional_text?: string
  website_url?: string // Add optional website URL
  files: string[]
}

export interface Worker {
  worker_id: string
  worker_name: string
  worker_email: string
  worker_role: string
  available: boolean
  company_id: string
  created_at?: string
}

export interface TimeSlot {
  id: string
  worker_id: string // UUID string
  day: string
  start_time: string
  end_time: string
  available: boolean
}

export interface SearchQuery {
  query: string
  client_id: string // UUID string
}
