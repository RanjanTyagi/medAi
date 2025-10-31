import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError,
  RateLimitError 
} from '@/types/api'
import { SecurityService } from './security-service'

// Error logging utility
export function logError(error: Error, context?: Record<string, unknown>): void {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context,
  }

  // In production, you would send this to a logging service
  console.error('Application Error:', errorInfo)
}

// Enhanced error response utility with security logging
export async function createErrorResponse(
  error: AppError | Error,
  request?: NextRequest
): Promise<NextResponse> {
  let statusCode = 500
  let code = 'INTERNAL_ERROR'
  let message = 'An unexpected error occurred'
  let logSecurityEvent = false

  const ip = request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || 'unknown'
  const userAgent = request?.headers.get('user-agent') || ''
  const userId = request?.headers.get('x-user-id')

  if (error instanceof AppError) {
    statusCode = error.statusCode
    code = error.code
    message = error.message
    
    // Log security events for authentication/authorization errors
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent = true
    }
  } else if (error instanceof ZodError) {
    statusCode = 400
    code = 'VALIDATION_ERROR'
    message = 'Invalid input data'
  }

  // Check for potential security threats in error messages
  const securityPatterns = [
    /sql/i,
    /injection/i,
    /script/i,
    /xss/i,
    /csrf/i,
    /unauthorized/i,
    /forbidden/i
  ]

  if (securityPatterns.some(pattern => pattern.test(error.message))) {
    logSecurityEvent = true
  }

  // Log security events
  if (logSecurityEvent) {
    await SecurityService.logSecurityEvent(
      `API_ERROR_${code}`,
      ip,
      {
        endpoint: request?.url,
        method: request?.method,
        error: error.message,
        statusCode,
        userAgent
      },
      userId
    )
  }

  // Log the error with security context
  logError(error, {
    url: request?.url,
    method: request?.method,
    userAgent,
    ip,
    userId,
    securityEvent: logSecurityEvent
  })

  // Sanitize error message for production
  const sanitizedMessage = process.env.NODE_ENV === 'development' ? message : 
    (statusCode >= 500 ? 'Internal Server Error' : message)

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message: sanitizedMessage,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
        }),
      },
    },
    { status: statusCode }
  )
}

// Async error wrapper for API routes
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args[0] as NextRequest
      return createErrorResponse(error as Error, request)
    }
  }
}

// Validation error formatter
export function formatZodError(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  
  error.issues.forEach((err) => {
    const path = err.path.join('.')
    fieldErrors[path] = err.message
  })
  
  return fieldErrors
}

// Custom error classes factory
export function createValidationError(message: string, field?: string): ValidationError {
  return new ValidationError(message, field)
}

export function createAuthenticationError(message?: string): AuthenticationError {
  return new AuthenticationError(message)
}

export function createAuthorizationError(message?: string): AuthorizationError {
  return new AuthorizationError(message)
}

export function createNotFoundError(resource?: string): NotFoundError {
  return new NotFoundError(resource)
}

export function createConflictError(message: string): ConflictError {
  return new ConflictError(message)
}

export function createRateLimitError(message?: string): RateLimitError {
  return new RateLimitError(message)
}

// Error boundary utility for React components
export class ErrorBoundary extends Error {
  constructor(
    message: string,
    public componentStack?: string,
    public errorBoundary?: string
  ) {
    super(message)
    this.name = 'ErrorBoundary'
  }
}

// Retry utility with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries) {
        throw lastError
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      )
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Circuit breaker utility
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private maxFailures: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }
}

// Enhanced rate limiter utility with security features
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private violations: Map<string, number> = new Map()
  private blockedUntil: Map<string, number> = new Map()

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000, // 1 minute
    private blockDuration: number = 900000, // 15 minutes
    private maxViolations: number = 3
  ) {}

  async isAllowed(identifier: string, endpoint?: string): Promise<boolean> {
    const now = Date.now()
    
    // Check if currently blocked
    const blockedUntil = this.blockedUntil.get(identifier)
    if (blockedUntil && now < blockedUntil) {
      return false
    }
    
    // Remove expired block
    if (blockedUntil && now >= blockedUntil) {
      this.blockedUntil.delete(identifier)
    }
    
    const windowStart = now - this.windowMs
    
    // Get existing requests for this identifier
    const requests = this.requests.get(identifier) || []
    
    // Filter out requests outside the current window
    const validRequests = requests.filter(time => time > windowStart)
    
    // Check if under the limit
    if (validRequests.length >= this.maxRequests) {
      // Increment violations
      const violations = this.violations.get(identifier) || 0
      this.violations.set(identifier, violations + 1)
      
      // Block if too many violations
      if (violations >= this.maxViolations) {
        this.blockedUntil.set(identifier, now + this.blockDuration)
        
        // Log security event
        await SecurityService.logSecurityEvent(
          'RATE_LIMIT_VIOLATIONS_EXCEEDED',
          identifier,
          {
            endpoint,
            violations: violations + 1,
            blockDuration: this.blockDuration,
            maxRequests: this.maxRequests
          }
        )
      }
      
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const requests = this.requests.get(identifier) || []
    const validRequests = requests.filter(time => time > windowStart)
    
    return Math.max(0, this.maxRequests - validRequests.length)
  }

  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    return oldestRequest + this.windowMs
  }

  isBlocked(identifier: string): boolean {
    const blockedUntil = this.blockedUntil.get(identifier)
    return blockedUntil ? Date.now() < blockedUntil : false
  }

  getBlockedUntil(identifier: string): number | undefined {
    return this.blockedUntil.get(identifier)
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    
    // Clean up old requests
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > now - this.windowMs)
      if (validRequests.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validRequests)
      }
    }
    
    // Clean up expired blocks
    for (const [key, blockedUntil] of this.blockedUntil.entries()) {
      if (now >= blockedUntil) {
        this.blockedUntil.delete(key)
        this.violations.delete(key) // Reset violations after block expires
      }
    }
  }
}

// Input validation and sanitization utilities
export function validateInput(input: any, type: 'email' | 'uuid' | 'text' | 'number' | 'json'): boolean {
  if (input === null || input === undefined) return false
  
  try {
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input))
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input))
      case 'text':
        return typeof input === 'string' && input.length > 0 && input.length < 10000
      case 'number':
        return !isNaN(Number(input)) && isFinite(Number(input))
      case 'json':
        JSON.parse(String(input))
        return true
      default:
        return false
    }
  } catch {
    return false
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .trim()
}

// Global rate limiter instances
export const globalRateLimiter = new RateLimiter(100, 60000) // 100 requests per minute
export const authRateLimiter = new RateLimiter(5, 900000, 3600000, 2) // 5 requests per 15 minutes, block for 1 hour after 2 violations
export const uploadRateLimiter = new RateLimiter(10, 60000) // 10 uploads per minute
export const adminRateLimiter = new RateLimiter(50, 60000, 1800000, 3) // 50 requests per minute for admin
export const diagnosisRateLimiter = new RateLimiter(10, 60000, 900000, 2) // 10 diagnosis requests per minute

// Cleanup expired entries every 5 minutes
setInterval(() => {
  globalRateLimiter.cleanup()
  authRateLimiter.cleanup()
  uploadRateLimiter.cleanup()
  adminRateLimiter.cleanup()
  diagnosisRateLimiter.cleanup()
}, 300000)

// Handle API errors (alias for createErrorResponse)
export async function handleApiError(
  error: AppError | Error,
  request?: NextRequest
): Promise<NextResponse> {
  return await createErrorResponse(error, request)
}