import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import PerformanceMonitor from '@/lib/performance-monitor'
import CacheManager from '@/lib/cache-service'
import { logger } from '@/lib/logger'

// GET /api/performance/metrics - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const timeRange = parseInt(url.searchParams.get('timeRange') || '300000') // 5 minutes default

    // Get performance statistics
    const stats = PerformanceMonitor.getStats(timeRange)
    const systemMetrics = PerformanceMonitor.getSystemMetrics()
    const cacheStats = CacheManager.getStats()

    // Calculate additional metrics
    const performanceData = {
      timestamp: new Date().toISOString(),
      timeRangeMs: timeRange,
      performance: {
        stats,
        system: {
          memory: {
            used: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024),
            total: Math.round(systemMetrics.memory.heapTotal / 1024 / 1024),
            external: Math.round(systemMetrics.memory.external / 1024 / 1024),
            rss: Math.round(systemMetrics.memory.rss / 1024 / 1024)
          },
          uptime: Math.round(systemMetrics.uptime),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        cache: {
          ...cacheStats,
          efficiency: cacheStats.totalHits > 0 ? 
            Math.round((cacheStats.totalHits / (cacheStats.totalHits + cacheStats.size)) * 100) : 0
        }
      },
      health: {
        status: 'healthy',
        checks: {
          memory: systemMetrics.memory.heapUsed < 512 * 1024 * 1024, // < 512MB
          cache: cacheStats.hitRate > 0.5, // > 50% hit rate
          uptime: systemMetrics.uptime > 60 // > 1 minute
        }
      }
    }

    // Return in requested format
    if (format === 'prometheus') {
      const prometheusData = PerformanceMonitor.exportMetrics('prometheus')
      return new NextResponse(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      })
    }

    logger.info('Performance metrics retrieved', {
      userId: user.id,
      timeRange,
      format
    })

    return NextResponse.json({
      success: true,
      data: performanceData
    })

  } catch (error) {
    logger.error('Performance metrics error', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve performance metrics' },
      { status: 500 }
    )
  }
}

// POST /api/performance/metrics - Record custom metric
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, value, unit = 'ms', tags = {} } = body

    if (!name || typeof value !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Name and numeric value are required' },
        { status: 400 }
      )
    }

    // Add user context to tags
    const enrichedTags = {
      ...tags,
      userId: user.id,
      userRole: user.role,
      source: 'api'
    }

    // Record the metric
    PerformanceMonitor.recordMetric(name, value, unit, enrichedTags)

    logger.debug('Custom metric recorded', {
      name,
      value,
      unit,
      tags: enrichedTags,
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      message: 'Metric recorded successfully'
    })

  } catch (error) {
    logger.error('Record metric error', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to record metric' },
      { status: 500 }
    )
  }
}

// DELETE /api/performance/metrics - Clear performance data
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'clear_old'

    if (action === 'clear_all') {
      // Clear all performance data
      PerformanceMonitor['metrics'] = []
      CacheManager.clearAll()
      
      logger.warn('All performance data cleared', { userId: user.id })
      
      return NextResponse.json({
        success: true,
        message: 'All performance data cleared'
      })
    } else {
      // Clear old metrics (default: older than 1 hour)
      const olderThanMs = parseInt(url.searchParams.get('olderThan') || '3600000')
      const clearedMetrics = PerformanceMonitor.clearOldMetrics(olderThanMs)
      const clearedCache = CacheManager.cleanExpired()
      
      logger.info('Old performance data cleared', {
        userId: user.id,
        clearedMetrics,
        clearedCache,
        olderThanMs
      })
      
      return NextResponse.json({
        success: true,
        message: 'Old performance data cleared',
        data: {
          clearedMetrics,
          clearedCache
        }
      })
    }

  } catch (error) {
    logger.error('Clear performance data error', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear performance data' },
      { status: 500 }
    )
  }
}