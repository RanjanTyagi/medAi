import { User, Report, DiagnosisResult } from './index'

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Authentication API types
export interface AuthResponse {
  user: User
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  role?: 'patient' | 'doctor' | 'admin'
}

// Report API types
export interface CreateReportRequest {
  symptoms: string
  imageFile?: File
}

export interface CreateReportResponse {
  report: Report
  aiAnalysis: DiagnosisResult
}

export interface GetReportsRequest {
  status?: 'pending' | 'reviewed' | 'verified' | 'rejected'
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export type GetReportsResponse = PaginatedResponse<Report>

export interface UpdateReportStatusRequest {
  status: 'reviewed' | 'verified' | 'rejected'
  note?: string
}

// Doctor Note API types
export interface CreateDoctorNoteRequest {
  reportId: string
  note: string
  verified?: boolean
}

export interface UpdateDoctorNoteRequest {
  note?: string
  verified?: boolean
}

// File Upload API types
export interface FileUploadRequest {
  file: File
  type: 'medical-image' | 'document'
}

export interface FileUploadResponse {
  url: string
  filename: string
  size: number
  type: string
}

// Admin API types
export interface GetUsersRequest {
  role?: 'patient' | 'doctor' | 'admin'
  search?: string
  page?: number
  limit?: number
}

export type GetUsersResponse = PaginatedResponse<User>

export interface UpdateUserRoleRequest {
  userId: string
  role: 'patient' | 'doctor' | 'admin'
}

export interface SystemMetrics {
  totalUsers: number
  totalReports: number
  pendingReports: number
  verifiedReports: number
  rejectedReports: number
  averageProcessingTime: number
  aiAccuracyRate: number
  doctorVerificationRate: number
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export interface GetAuditLogsRequest {
  userId?: string
  action?: string
  resource?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export type GetAuditLogsResponse = PaginatedResponse<AuditLog>

// AI Service API types
export interface AIAnalysisRequest {
  symptoms: string
  imageUrl?: string
  patientAge?: number
  patientGender?: 'male' | 'female' | 'other'
  medicalHistory?: string[]
}

export interface AIAnalysisResponse {
  analysis: DiagnosisResult
  processingTime: number
  modelVersion: string
  confidence: number
}

// Notification types
export interface Notification {
  id: string
  userId: string
  type: 'report_verified' | 'report_rejected' | 'new_report' | 'system_alert'
  title: string
  message: string
  read: boolean
  data?: Record<string, unknown>
  createdAt: string
}

export interface CreateNotificationRequest {
  userId: string
  type: Notification['type']
  title: string
  message: string
  data?: Record<string, unknown>
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'notification' | 'report_update' | 'user_status' | 'system_message'
  payload: unknown
  timestamp: string
}

export interface ReportUpdateMessage {
  reportId: string
  status: 'pending' | 'reviewed' | 'verified' | 'rejected'
  updatedBy: string
  note?: string
}

// Error types
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
    this.name = 'RateLimitError'
  }
}