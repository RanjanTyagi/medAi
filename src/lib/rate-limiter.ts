import { NextRequest } from 'next/server'
import { SecurityService } from './security-service'
import { logger } from './logger'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
  onLimitReached?: (req: NextRequest, identifier: string) => void
}

export class RateLimiter {
  private config: RateLimitConfig
  private requests: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => this.getClientIdentifier(req),
      onLimitReached: (req, identifier) => {
        logger.warn('Rate limit exceeded', {
          identifier,
          path: req.nextUrl.pathname,
          userAgent: req.headers.get('user-agent')
        })
      },
      ...config
    }
  }

  private getClientIdentifier(req: NextRequest): string {
    // Try to get user ID from headers (set by middleware)
    const userId = req.headers.get('x-user-id')
    if (userId) return `user:${userId}`

    // Fall back to IP address
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    return `ip:${ip}`
  }

  async checkLimit(req: NextRequest): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
    totalHits: number
  }> {
    const identifier = this.config.keyGenerator!(req)
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // Get or create request record
    let record = this.requests.get(identifier)
    
    // Reset if window has passed
    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime: now + this.config.windowMs
      }
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxRequests) {
      // Log security event for repeated violations
      if (record.count === this.config.maxRequests) {
        await SecurityService.logSecurityEvent('RATE_LIMIT_EXCEEDED', identifier, {
          path: req.nextUrl.pathname,
          userAgent: req.headers.get('user-agent'),
          maxRequests: this.config.maxRequests,
          windowMs: this.config.windowMs
        })
      }

      this.config.onLimitReached?.(req, identifier)
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        totalHits: record.count
      }
    }

    // Increment counter
    record.count++
    this.requests.set(identifier, record)

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.resetTime,
      totalHits: record.count
    }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.requests.entries()) {
      if (record.resetTime <= now) {
        this.requests.delete(key)
      }
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limiter
  api: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  }),

  // Authentication endpoints (more restrictive)
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    onLimitReached: async (req, identifier) => {
      await SecurityService.logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', identifier, {
        path: req.nextUrl.pathname,
        userAgent: req.headers.get('user-agent'),
        severity: 'high'
      })
    }
  }),

  // AI diagnosis endpoints (resource intensive)
  diagnosis: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    onLimitReached: async (req, identifier) => {
      await SecurityService.logSecurityEvent('DIAGNOSIS_RATE_LIMIT_EXCEEDED', identifier, {
        path: req.nextUrl.pathname,
        userAgent: req.headers.get('user-agent')
      })
    }
  }),

  // File upload endpoints
  upload: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20
  }),

  // Admin endpoints (very restrictive)
  admin: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    onLimitReached: async (req, identifier) => {
      await SecurityService.logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', identifier, {
        path: req.nextUrl.pathname,
        userAgent: req.headers.get('user-agent'),
        severity: 'critical'
      })
    }
  })
}

// Middleware helper function
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (req: NextRequest) => {
    const result = await limiter.checkLimit(req)
    
    if (!result.allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': limiter['config'].maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString()
        }
      })
    }

    return {
      headers: {
        'X-RateLimit-Limit': limiter['config'].maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString()
      }
    }
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  Object.values(rateLimiters).forEach(limiter => limiter.cleanup())
}, 5 * 60 * 1000)