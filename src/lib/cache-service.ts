import { logger } from './logger'

// In-memory cache implementation for API responses
// In production, consider using Redis or similar external cache
class CacheService {
  private cache = new Map<string, { data: any; expiry: number; hits: number }>()
  private maxSize = 1000 // Maximum number of cached items
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default TTL

  // Get item from cache
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      logger.debug('Cache item expired', { key })
      return null
    }

    // Increment hit counter
    item.hits++
    logger.debug('Cache hit', { key, hits: item.hits })
    return item.data as T
  }

  // Set item in cache
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL
    const expiry = Date.now() + ttl

    // If cache is full, remove oldest items
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, { data, expiry, hits: 0 })
    logger.debug('Cache set', { key, ttl, expiry })
  }

  // Delete item from cache
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      logger.debug('Cache item deleted', { key })
    }
    return deleted
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    logger.info('Cache cleared', { previousSize: size })
  }

  // Get cache statistics
  getStats() {
    const items = Array.from(this.cache.values())
    const totalHits = items.reduce((sum, item) => sum + item.hits, 0)
    const expiredItems = items.filter(item => Date.now() > item.expiry).length

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      expiredItems,
      hitRate: totalHits > 0 ? totalHits / (totalHits + expiredItems) : 0
    }
  }

  // Evict oldest items when cache is full
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries())
    
    // Sort by expiry time (oldest first)
    entries.sort((a, b) => a[1].expiry - b[1].expiry)
    
    // Remove oldest 10% of items
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }

    logger.debug('Cache eviction completed', { removedItems: toRemove })
  }

  // Clean expired items
  cleanExpired(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Expired cache items cleaned', { count: cleaned })
    }

    return cleaned
  }
}

// Create singleton instance
const cacheService = new CacheService()

// Cache key generators for different data types
export const CacheKeys = {
  // User-specific caches
  userReports: (userId: string, page: number, filters?: string) => 
    `user:${userId}:reports:${page}:${filters || 'all'}`,
  
  userStats: (userId: string) => 
    `user:${userId}:stats`,
  
  // Report-specific caches
  reportDetails: (reportId: string) => 
    `report:${reportId}:details`,
  
  // System-wide caches
  pendingReports: (page: number) => 
    `reports:pending:${page}`,
  
  systemStats: () => 
    'system:stats',
  
  systemMetrics: () => 
    'system:metrics',
  
  // Search caches
  reportSearch: (query: string, userId: string, page: number) => 
    `search:${userId}:${query}:${page}`,
  
  // AI-related caches (shorter TTL)
  aiAnalysis: (symptomsHash: string) => 
    `ai:analysis:${symptomsHash}`,
}

// Cache TTL constants (in milliseconds)
export const CacheTTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
}

// Wrapper functions for common caching patterns
export class CacheManager {
  // Cache with automatic key generation and error handling
  static async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = cacheService.get<T>(key)
      if (cached !== null) {
        return cached
      }

      // Fetch fresh data
      logger.debug('Cache miss, fetching fresh data', { key })
      const data = await fetchFunction()
      
      // Store in cache
      cacheService.set(key, data, ttl)
      
      return data
    } catch (error) {
      logger.error('Cache getOrSet error', error as Error, { key })
      // If caching fails, still return the fresh data
      return await fetchFunction()
    }
  }

  // Invalidate related caches
  static invalidatePattern(pattern: string): number {
    let invalidated = 0
    
    for (const key of cacheService['cache'].keys()) {
      if (key.includes(pattern)) {
        cacheService.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      logger.debug('Cache pattern invalidated', { pattern, count: invalidated })
    }

    return invalidated
  }

  // Invalidate user-specific caches
  static invalidateUserCache(userId: string): number {
    return this.invalidatePattern(`user:${userId}`)
  }

  // Invalidate report-specific caches
  static invalidateReportCache(reportId: string): number {
    return this.invalidatePattern(`report:${reportId}`)
  }

  // Invalidate system caches
  static invalidateSystemCache(): number {
    let invalidated = 0
    invalidated += this.invalidatePattern('system:')
    invalidated += this.invalidatePattern('reports:pending')
    return invalidated
  }

  // Get cache statistics
  static getStats() {
    return cacheService.getStats()
  }

  // Clean expired items
  static cleanExpired(): number {
    return cacheService.cleanExpired()
  }

  // Clear all cache
  static clearAll(): void {
    cacheService.clear()
  }
}

// Middleware for automatic cache cleanup
export function startCacheCleanup(): void {
  // Clean expired items every 5 minutes
  setInterval(() => {
    CacheManager.cleanExpired()
  }, 5 * 60 * 1000)

  logger.info('Cache cleanup scheduler started')
}

// Hash function for creating cache keys from objects
export function hashObject(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort())
  let hash = 0
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36)
}

// Export the cache service for direct access if needed
export { cacheService }
export default CacheManager