import { z } from 'zod'

// User validation schemas
export const userRoleSchema = z.enum(['patient', 'doctor', 'admin'])

export const userRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
  confirmPassword: z.string(),
  role: userRoleSchema.optional().default('patient'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const userProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
})

export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const passwordUpdateSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Report validation schemas
export const reportStatusSchema = z.enum(['pending', 'reviewed', 'verified', 'rejected'])

export const diagnosisSchema = z.object({
  condition: z.string().min(1, 'Condition name is required'),
  confidence: z.number().min(0, 'Confidence must be between 0 and 1').max(1, 'Confidence must be between 0 and 1'),
  severity: z.enum(['mild', 'moderate', 'severe']),
  description: z.string().optional(),
})

export const diagnosisResultSchema = z.object({
  diagnoses: z.array(diagnosisSchema).min(1, 'At least one diagnosis is required'),
  recommendations: z.array(z.string()).min(1, 'At least one recommendation is required'),
  confidence: z.number().min(0, 'Overall confidence must be between 0 and 1').max(1, 'Overall confidence must be between 0 and 1'),
  severity: z.enum(['low', 'moderate', 'high']),
  timestamp: z.string(),
})

export const createReportSchema = z.object({
  symptoms: z.string().min(10, 'Please provide more detailed symptoms (at least 10 characters)').max(5000, 'Symptoms description is too long'),
  imageFile: z.instanceof(File).optional(),
})

export const reportFiltersSchema = z.object({
  status: reportStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
})

// Doctor note validation schemas
export const createDoctorNoteSchema = z.object({
  reportId: z.string().uuid('Invalid report ID'),
  note: z.string().min(10, 'Note must be at least 10 characters').max(2000, 'Note is too long'),
  verified: z.boolean().optional().default(false),
})

export const updateDoctorNoteSchema = z.object({
  note: z.string().min(10, 'Note must be at least 10 characters').max(2000, 'Note is too long').optional(),
  verified: z.boolean().optional(),
})

export const updateReportStatusSchema = z.object({
  status: reportStatusSchema,
  note: z.string().optional(),
})

// File validation schemas
export const imageFileSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().optional().default(10 * 1024 * 1024), // 10MB
  allowedTypes: z.array(z.string()).optional().default(['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']),
})

// API response validation
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: apiErrorSchema.optional(),
  })

// Admin validation schemas
export const userRoleUpdateSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: userRoleSchema,
})

export const systemConfigSchema = z.object({
  aiConfidenceThreshold: z.number().min(0).max(1).optional(),
  maxFileSize: z.number().min(1024).optional(), // in bytes
  allowedFileTypes: z.array(z.string()).optional(),
  maxReportsPerDay: z.number().min(1).optional(),
})

// Search and pagination schemas
export const paginationSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Search query is too long'),
  filters: z.record(z.string(), z.unknown()).optional(),
})

// Type inference helpers
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>
export type UserLoginInput = z.infer<typeof userLoginSchema>
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>

export type CreateReportInput = z.infer<typeof createReportSchema>
export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>
export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>

export type CreateDoctorNoteInput = z.infer<typeof createDoctorNoteSchema>
export type UpdateDoctorNoteInput = z.infer<typeof updateDoctorNoteSchema>

export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>
export type SystemConfigInput = z.infer<typeof systemConfigSchema>

export type PaginationInput = z.infer<typeof paginationSchema>
export type SearchInput = z.infer<typeof searchSchema>

// Additional admin validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: userRoleSchema,
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: userRoleSchema.optional(),
  emailConfirmed: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
})

export const auditLogFilterSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>