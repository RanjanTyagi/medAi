import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from './admin-service'
import { logger } from './logger'

export interface SecurityConfig {
  maxRequestsPerMinute: number
  maxRequestsPerHour: number
  maxRequestsPerDay: number
  blockDuration: number // in minutes
  enableDDoSProtection: boolean
  enableSecurityHeaders: boolean
  trustedOrigins: string[]
}

export interface RateLimitInfo {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

export class SecurityService {
  private static rateLimitStore = new Map<string, RateLimitInfo>()
  private static blockedIPs = new Map<string, number>() // IP -> block until timestamp
  private static suspiciousActivity = new Map<string, number>() // IP -> suspicious count

  private static config: SecurityConfig = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    blockDuration: 15, // 15 minutes
    enableDDoSProtection: true,
    enableSecurityHeaders: true,
    trustedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'https://vercel.app',
      'https://*.vercel.app'
    ]
  }

  // Security Headers
  static getSecurityHeaders(): Record<string, string> {
    return {
      // HTTPS and Transport Security
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Content Security Policy
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.supabase.co https://*.supabase.co https://generativelanguage.googleapis.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '),
      
      // XSS Protection
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Additional Security Headers
      'Permissions-Policy': [
        'camera=(), microphone=(), geolocation=(), payment=()',
        'usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      ].join(', '),
      
      // CORS and Origin
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      
      // Cache Control for sensitive endpoints
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }

  // Rate Limiting
  static checkRateLimit(
    identifier: string, 
    endpoint: string,
    customLimits?: Partial<SecurityConfig>
  ): { allowed: boolean; resetTime: number; remaining: number } {
    const limits = { ...this.config, ...customLimits }
    const now = Date.now()
    const windowStart = now - (60 * 1000) // 1 minute window
    
    const key = `${identifier}:${endpoint}`
    const current = this.rateLimitStore.get(key)
    
    // Check if IP is blocked
    const blockUntil = this.blockedIPs.get(identifier)
    if (blockUntil && now < blockUntil) {
      return {
        allowed: false,
        resetTime: blockUntil,
        remaining: 0
      }
    }
    
    // Clean up expired blocks
    if (blockUntil && now >= blockUntil) {
      this.blockedIPs.delete(identifier)
    }
    
    // Initialize or update rate limit info
    if (!current || current.resetTime < windowStart) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + (60 * 1000),
        blocked: false
      })
      return {
        allowed: true,
        resetTime: now + (60 * 1000),
        remaining: limits.maxRequestsPerMinute - 1
      }
    }
    
    // Check if limit exceeded
    if (current.count >= limits.maxRequestsPerMinute) {
      // Block IP if repeatedly hitting limits
      const suspicious = this.suspiciousActivity.get(identifier) || 0
      this.suspiciousActivity.set(identifier, suspicious + 1)
      
      if (suspicious >= 3) {
        const blockUntil = now + (limits.blockDuration * 60 * 1000)
        this.blockedIPs.set(identifier, blockUntil)
        
        // Log security event
        this.logSecurityEvent('RATE_LIMIT_EXCEEDED', identifier, {
          endpoint,
          count: current.count,
          blockDuration: limits.blockDuration
        })
      }
      
      return {
        allowed: false,
        resetTime: current.resetTime,
        remaining: 0
      }
    }
    
    // Update count
    current.count++
    this.rateLimitStore.set(key, current)
    
    return {
      allowed: true,
      resetTime: current.resetTime,
      remaining: limits.maxRequestsPerMinute - current.count
    }
  }

  // DDoS Protection
  static detectDDoSPattern(identifier: string, userAgent?: string): boolean {
    const now = Date.now()
    const windowStart = now - (5 * 60 * 1000) // 5 minute window
    
    // Check for rapid requests from same IP
    const recentRequests = Array.from(this.rateLimitStore.entries())
      .filter(([key]) => key.startsWith(identifier))
      .reduce((total, [, info]) => total + (info.resetTime > windowStart ? info.count : 0), 0)
    
    // Suspicious patterns
    const suspiciousPatterns = [
      recentRequests > 500, // Too many requests in 5 minutes
      !userAgent || userAgent.length < 10, // Missing or suspicious user agent
      userAgent?.includes('bot') && !this.isLegitimateBot(userAgent), // Suspicious bots
    ]
    
    const isDDoS = suspiciousPatterns.filter(Boolean).length >= 2
    
    if (isDDoS) {
      this.logSecurityEvent('DDOS_DETECTED', identifier, {
        recentRequests,
        userAgent,
        patterns: suspiciousPatterns
      })
      
      // Block IP for longer duration
      const blockUntil = now + (60 * 60 * 1000) // 1 hour
      this.blockedIPs.set(identifier, blockUntil)
    }
    
    return isDDoS
  }

  // Bot Detection
  private static isLegitimateBot(userAgent: string): boolean {
    const legitimateBots = [
      'Googlebot',
      'Bingbot',
      'Slackbot',
      'TwitterBot',
      'facebookexternalhit',
      'LinkedInBot'
    ]
    
    return legitimateBots.some(bot => userAgent.includes(bot))
  }

  // Input Validation and Sanitization
  static validateInput(input: any, type: 'email' | 'uuid' | 'text' | 'number'): boolean {
    if (input === null || input === undefined) return false
    
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      text: /^[\w\s\-.,!?()]+$/,
      number: /^\d+(\.\d+)?$/
    }
    
    return patterns[type]?.test(String(input)) || false
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim()
  }

  // Security Event Logging
  static async logSecurityEvent(
    event: string,
    identifier: string,
    details: any,
    userId?: string
  ): Promise<void> {
    try {
      await AdminService.logAction(
        userId || 'system',
        `SECURITY_${event}`,
        'security',
        identifier,
        {
          event,
          identifier,
          details,
          timestamp: new Date().toISOString()
        }
      )
      
      logger.warn(`Security event: ${event}`, {
        event,
        identifier,
        details,
        userId
      })
    } catch (error) {
      logger.error('Failed to log security event', error as Error)
    }
  }

  // IP Geolocation and Risk Assessment
  static assessIPRisk(ip: string, userAgent?: string): 'low' | 'medium' | 'high' {
    // Basic risk assessment based on patterns
    let riskScore = 0
    
    // Check for suspicious IP patterns
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      riskScore += 1 // Private IP (could be proxy/VPN)
    }
    
    // Check user agent
    if (!userAgent || userAgent.length < 20) {
      riskScore += 2
    }
    
    // Check if IP has been blocked before
    if (this.blockedIPs.has(ip)) {
      riskScore += 3
    }
    
    // Check suspicious activity history
    const suspicious = this.suspiciousActivity.get(ip) || 0
    riskScore += Math.min(suspicious, 3)
    
    if (riskScore >= 6) return 'high'
    if (riskScore >= 3) return 'medium'
    return 'low'
  }

  // Session Security
  static validateSession(sessionToken: string): boolean {
    // Basic session validation
    if (!sessionToken || sessionToken.length < 32) return false
    
    // Check for suspicious session patterns
    const suspiciousPatterns = [
      sessionToken.includes('..'),
      sessionToken.includes('/'),
      sessionToken.includes('\\'),
      !/^[a-zA-Z0-9+/=]+$/.test(sessionToken)
    ]
    
    return !suspiciousPatterns.some(Boolean)
  }

  // Clean up expired entries
  static cleanup(): void {
    const now = Date.now()
    
    // Clean rate limit store
    for (const [key, info] of this.rateLimitStore.entries()) {
      if (info.resetTime < now - (60 * 60 * 1000)) { // 1 hour old
        this.rateLimitStore.delete(key)
      }
    }
    
    // Clean blocked IPs
    for (const [ip, blockUntil] of this.blockedIPs.entries()) {
      if (now >= blockUntil) {
        this.blockedIPs.delete(ip)
      }
    }
    
    // Clean suspicious activity (reset after 24 hours)
    for (const [ip, count] of this.suspiciousActivity.entries()) {
      if (count > 0 && Math.random() < 0.1) { // 10% chance to reset
        this.suspiciousActivity.set(ip, Math.max(0, count - 1))
      }
    }
  }
}