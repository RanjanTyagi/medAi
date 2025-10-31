export type UserRole = 'patient' | 'doctor' | 'admin'

export type ReportStatus = 'pending' | 'reviewed' | 'verified' | 'rejected'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Diagnosis {
  condition: string
  confidence: number
  severity: 'mild' | 'moderate' | 'severe'
  description?: string
}

export interface DiagnosisResult {
  diagnoses: Diagnosis[]
  recommendations: string[]
  confidence: number
  severity: 'low' | 'moderate' | 'high'
  timestamp: string
}

export interface Report {
  id: string
  user_id: string
  symptoms: string
  image_url?: string
  ai_output: DiagnosisResult
  status: ReportStatus
  created_at: string
  updated_at: string
  doctorNotes?: DoctorNote[]
}

export interface DoctorNote {
  id: string
  report_id: string
  doctor_id: string
  note: string
  verified: boolean
  created_at: string
  doctor?: User
}

export interface CreateReportData {
  symptoms: string
  imageFile?: File
}

export interface ReportFilters {
  status?: ReportStatus
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

// Re-export validation types
export * from './validation'
export * from './api'
export * from './database'
