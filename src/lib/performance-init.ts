import PerformanceMonitor from './performance-monitor'
import { startCacheCleanup } from './cache-service'
import { logger } from './logger'

// Initialize performance monitoring and optimizations
export function initializePerformanceOptimizations(): void {
  try {
    // Start system performance monitoring
    PerformanceMonitor.startSystemMonitoring(30000) // Every 30 seconds
    
    // Start cache cleanup scheduler
    startCacheCleanup()
    
    // Set up process event handlers for graceful shutdown
    process.on('SIGTERM', handleGracefulShutdown)
    process.on('SIGINT', handleGracefulShutdown)
    
    // Monitor unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', new Error(String(reason)), {
        promise: promise.toString()
      })
      
      PerformanceMonitor.recordMetric(
        'system.unhandled_rejection',
        1,
        'count',
        { reason: String(reason) }
      )
    })
    
    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error)
      
      PerformanceMonitor.recordMetric(
        'system.uncaught_exception',
        1,
        'count',
        { message: error.message }
      )
      
      // Don't exit immediately, let the application handle it
    })
    
    // Log memory usage periodically
    setInterval(() => {
      const memUsage = process.memoryUsage()
      
      PerformanceMonitor.recordMetric('system.memory.heap_used', memUsage.heapUsed / 1024 / 1024, 'MB')
      PerformanceMonitor.recordMetric('system.memory.heap_total', memUsage.heapTotal / 1024 / 1024, 'MB')
      PerformanceMonitor.recordMetric('system.memory.external', memUsage.external / 1024 / 1024, 'MB')
      PerformanceMonitor.recordMetric('system.memory.rss', memUsage.rss / 1024 / 1024, 'MB')
      
      // Warn if memory usage is high
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024
      if (heapUsedMB > 512) { // 512MB threshold
        logger.warn('High memory usage detected', {
          heapUsed: heapUsedMB,
          heapTotal: memUsage.heapTotal / 1024 / 1024,
          rss: memUsage.rss / 1024 / 1024
        })
      }
    }, 60000) // Every minute
    
    logger.info('Performance optimizations initialized', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    })
    
  } catch (error) {
    logger.error('Failed to initialize performance optimizations', error as Error)
  }
}

// Graceful shutdown handler
function handleGracefulShutdown(signal: string): void {
  logger.info('Received shutdown signal, cleaning up...', { signal })
  
  try {
    // Export final metrics
    const finalMetrics = PerformanceMonitor.exportMetrics('json')
    logger.info('Final performance metrics', { metrics: finalMetrics })
    
    // Clean up resources
    PerformanceMonitor.clearOldMetrics(0) // Clear all metrics
    
    logger.info('Graceful shutdown completed')
    
    // Exit after cleanup
    setTimeout(() => {
      process.exit(0)
    }, 1000)
    
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error)
    process.exit(1)
  }
}

// Health check function for monitoring
export function getHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, boolean>
  metrics: any
} {
  try {
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()
    const stats = PerformanceMonitor.getStats()
    
    // Define health checks
    const checks = {
      memory: (memUsage.heapUsed / 1024 / 1024) < 512, // < 512MB
      uptime: uptime > 10, // > 10 seconds
      errors: !Object.values(stats).some(stat => stat.errorRate > 10) // < 10% error rate
    }
    
    // Determine overall status
    const healthyChecks = Object.values(checks).filter(Boolean).length
    const totalChecks = Object.values(checks).length
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyChecks === totalChecks) {
      status = 'healthy'
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }
    
    return {
      status,
      checks,
      metrics: {
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        },
        uptime: Math.round(uptime),
        performance: stats
      }
    }
    
  } catch (error) {
    logger.error('Health check failed', error as Error)
    return {
      status: 'unhealthy',
      checks: { healthCheck: false },
      metrics: { error: 'Health check failed' }
    }
  }
}

// Performance recommendations based on current metrics
export function getPerformanceRecommendations(): string[] {
  const recommendations: string[] = []
  
  try {
    const memUsage = process.memoryUsage()
    const stats = PerformanceMonitor.getStats()
    
    // Memory recommendations
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024
    if (heapUsedMB > 400) {
      recommendations.push('Consider increasing memory allocation or optimizing memory usage')
    }
    
    // Performance recommendations
    Object.entries(stats).forEach(([name, stat]) => {
      if (stat.avg > 5000) { // > 5 seconds average
        recommendations.push(`${name} is running slowly (avg: ${Math.round(stat.avg)}ms)`)
      }
      
      if (stat.errorRate > 5) { // > 5% error rate
        recommendations.push(`${name} has high error rate (${stat.errorRate.toFixed(1)}%)`)
      }
    })
    
    // Cache recommendations
    // This would require access to cache stats
    
    if (recommendations.length === 0) {
      recommendations.push('System performance is optimal')
    }
    
  } catch (error) {
    logger.error('Failed to generate performance recommendations', error as Error)
    recommendations.push('Unable to generate recommendations due to error')
  }
  
  return recommendations
}

// Export performance data for external monitoring
export function exportPerformanceData(format: 'json' | 'prometheus' = 'json'): string {
  try {
    return PerformanceMonitor.exportMetrics(format)
  } catch (error) {
    logger.error('Failed to export performance data', error as Error)
    return format === 'json' 
      ? JSON.stringify({ error: 'Export failed' })
      : '# Export failed\n'
  }
}

export default {
  initializePerformanceOptimizations,
  getHealthStatus,
  getPerformanceRecommendations,
  exportPerformanceData
}