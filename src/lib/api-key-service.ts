import { createClient } from '@supabase/supabase-js'
import { EncryptionService } from './encryption-service'
import { SecurityService } from './security-service'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ApiKey {
  id: string
  name: string
  keyHash: string
  userId: string
  permissions: string[]
  rateLimit: number
  expiresAt?: Date
  lastUsed?: Date
  isActive: boolean
  createdAt: Date
}

export interface ApiKeyUsage {
  keyId: string
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  ip: string
  userAgent: string
  timestamp: Date
}

export class ApiKeyService {
  // Create a new API key
  static async createApiKey(
    userId: string,
    name: string,
    permissions: string[],
    rateLimit: number = 1000,
    expiresAt?: Date
  ): Promise<{ success: boolean; apiKey?: string; keyId?: string; error?: string }> {
    try {
      // Generate API key
      const apiKey = EncryptionService.generateApiKey()
      const keyHash = EncryptionService.hashData(apiKey)

      // Store in database
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name,
          key_hash: keyHash,
          user_id: userId,
          permissions,
          rate_limit: rateLimit,
          expires_at: expiresAt?.toISOString(),
          is_active: true
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create API key', error)
        return { success: false, error: 'Failed to create API key' }
      }

      // Log API key creation
      await SecurityService.logAction(
        userId,
        'CREATE_API_KEY',
        'api_key',
        data.id,
        {
          name,
          permissions,
          rateLimit,
          expiresAt: expiresAt?.toISOString()
        }
      )

      logger.info('API key created', {
        userId,
        keyId: data.id,
        name,
        permissions
      })

      return {
        success: true,
        apiKey, // Return the actual key only once
        keyId: data.id
      }

    } catch (error) {
      logger.error('API key creation failed', error as Error)
      return { success: false, error: 'API key creation failed' }
    }
  }

  // Validate API key and return key info
  static async validateApiKey(apiKey: string): Promise<{
    valid: boolean
    keyInfo?: ApiKey
    error?: string
  }> {
    try {
      // Validate key format
      if (!EncryptionService.validateApiKeyFormat(apiKey)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      const keyHash = EncryptionService.hashData(apiKey)

      // Find key in database
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return { valid: false, error: 'API key not found or inactive' }
      }

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { valid: false, error: 'API key expired' }
      }

      // Update last used timestamp
      await supabase
        .from('api_keys')
        .update({ last_used: new Date().toISOString() })
        .eq('id', data.id)

      const keyInfo: ApiKey = {
        id: data.id,
        name: data.name,
        keyHash: data.key_hash,
        userId: data.user_id,
        permissions: data.permissions,
        rateLimit: data.rate_limit,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        lastUsed: new Date(),
        isActive: data.is_active,
        createdAt: new Date(data.created_at)
      }

      return { valid: true, keyInfo }

    } catch (error) {
      logger.error('API key validation failed', error as Error)
      return { valid: false, error: 'API key validation failed' }
    }
  }

  // Check if API key has specific permission
  static hasPermission(keyInfo: ApiKey, permission: string): boolean {
    return keyInfo.permissions.includes(permission) || keyInfo.permissions.includes('*')
  }

  // Rate limit check for API key
  static async checkRateLimit(keyInfo: ApiKey, endpoint: string): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
  }> {
    try {
      const identifier = `api_key:${keyInfo.id}`
      const result = SecurityService.checkRateLimit(identifier, endpoint, {
        maxRequestsPerMinute: keyInfo.rateLimit,
        maxRequestsPerHour: keyInfo.rateLimit * 60,
        maxRequestsPerDay: keyInfo.rateLimit * 60 * 24,
        blockDuration: 15,
        enableDDoSProtection: true,
        enableSecurityHeaders: false,
        trustedOrigins: []
      })

      return result

    } catch (error) {
      logger.error('API key rate limit check failed', error as Error)
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000
      }
    }
  }

  // Log API key usage
  static async logUsage(
    keyInfo: ApiKey,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    ip: string,
    userAgent: string
  ): Promise<void> {
    try {
      await supabase
        .from('api_key_usage')
        .insert({
          key_id: keyInfo.id,
          endpoint,
          method,
          status_code: statusCode,
          response_time: responseTime,
          ip_address: ip,
          user_agent: userAgent
        })

      // Log security event for failed requests
      if (statusCode >= 400) {
        await SecurityService.logSecurityEvent(
          'API_KEY_REQUEST_FAILED',
          ip,
          {
            keyId: keyInfo.id,
            userId: keyInfo.userId,
            endpoint,
            method,
            statusCode,
            userAgent
          },
          keyInfo.userId
        )
      }

    } catch (error) {
      logger.error('Failed to log API key usage', error as Error)
    }
  }

  // Get API keys for a user
  static async getUserApiKeys(userId: string): Promise<{
    success: boolean
    keys?: Omit<ApiKey, 'keyHash'>[]
    error?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, user_id, permissions, rate_limit, expires_at, last_used, is_active, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user API keys', error)
        return { success: false, error: 'Failed to get API keys' }
      }

      const keys = data?.map(key => ({
        id: key.id,
        name: key.name,
        keyHash: '', // Don't return hash
        userId: key.user_id,
        permissions: key.permissions,
        rateLimit: key.rate_limit,
        expiresAt: key.expires_at ? new Date(key.expires_at) : undefined,
        lastUsed: key.last_used ? new Date(key.last_used) : undefined,
        isActive: key.is_active,
        createdAt: new Date(key.created_at)
      })) || []

      return { success: true, keys }

    } catch (error) {
      logger.error('Failed to get user API keys', error as Error)
      return { success: false, error: 'Failed to get API keys' }
    }
  }

  // Revoke API key
  static async revokeApiKey(keyId: string, userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to revoke API key', error)
        return { success: false, error: 'Failed to revoke API key' }
      }

      // Log API key revocation
      await SecurityService.logAction(
        userId,
        'REVOKE_API_KEY',
        'api_key',
        keyId,
        { reason: 'User revoked' }
      )

      logger.info('API key revoked', { userId, keyId })

      return { success: true }

    } catch (error) {
      logger.error('API key revocation failed', error as Error)
      return { success: false, error: 'API key revocation failed' }
    }
  }

  // Get API key usage statistics
  static async getUsageStats(keyId: string, userId: string, days: number = 30): Promise<{
    success: boolean
    stats?: {
      totalRequests: number
      successfulRequests: number
      failedRequests: number
      averageResponseTime: number
      dailyUsage: { date: string; requests: number }[]
      topEndpoints: { endpoint: string; requests: number }[]
    }
    error?: string
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('api_key_usage')
        .select('*')
        .eq('key_id', keyId)
        .gte('created_at', startDate.toISOString())

      if (error) {
        logger.error('Failed to get API key usage stats', error)
        return { success: false, error: 'Failed to get usage statistics' }
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          stats: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            dailyUsage: [],
            topEndpoints: []
          }
        }
      }

      // Calculate statistics
      const totalRequests = data.length
      const successfulRequests = data.filter(r => r.status_code < 400).length
      const failedRequests = totalRequests - successfulRequests
      const averageResponseTime = data.reduce((sum, r) => sum + r.response_time, 0) / totalRequests

      // Daily usage
      const dailyUsageMap = new Map<string, number>()
      data.forEach(record => {
        const date = new Date(record.created_at).toISOString().split('T')[0]
        dailyUsageMap.set(date, (dailyUsageMap.get(date) || 0) + 1)
      })

      const dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, requests]) => ({ date, requests }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Top endpoints
      const endpointMap = new Map<string, number>()
      data.forEach(record => {
        endpointMap.set(record.endpoint, (endpointMap.get(record.endpoint) || 0) + 1)
      })

      const topEndpoints = Array.from(endpointMap.entries())
        .map(([endpoint, requests]) => ({ endpoint, requests }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10)

      return {
        success: true,
        stats: {
          totalRequests,
          successfulRequests,
          failedRequests,
          averageResponseTime,
          dailyUsage,
          topEndpoints
        }
      }

    } catch (error) {
      logger.error('Failed to get API key usage stats', error as Error)
      return { success: false, error: 'Failed to get usage statistics' }
    }
  }

  // Clean up expired API keys
  static async cleanupExpiredKeys(): Promise<void> {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true)

      if (error) {
        logger.error('Failed to cleanup expired API keys', error)
      } else {
        logger.info('Expired API keys cleaned up')
      }

    } catch (error) {
      logger.error('API key cleanup failed', error as Error)
    }
  }
}

// Run cleanup every hour
setInterval(() => {
  ApiKeyService.cleanupExpiredKeys()
}, 60 * 60 * 1000)