import { logger } from './logger'

// Performance metrics interface
interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 5000, // 5 seconds
  DATABASE_QUERY_TIME: 1000, // 1 second
  AI_PROCESSING_TIME: 15000, // 15 seconds
  IMAGE_UPLOAD_TIME: 10000, // 10 seconds
  MEMORY_USAGE_MB: 512, // 512 MB
  CPU_USAGE_PERCENT: 80, // 80%
}

// Performance monitoring class
export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = []
  private static maxMetrics = 1000 // Keep last 1000 metrics

  // Record a performance metric
  static recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Check thresholds and log warnings
    this.checkThresholds(metric)

    logger.debug('Performance metric recorded', metric)
  }

  // Time a function execution
  static async timeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      
      this.recordMetric(name, duration, 'ms', tags)
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.recordMetric(name, duration, 'ms', {
        ...tags,
        error: 'true',
        errorMessage: (error as Error).message
      })
      
      throw error
    }
  }

  // Time a synchronous function
  static timeSync<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const startTime = Date.now()
    
    try {
      const result = fn()
      const duration = Date.now() - startTime
      
      this.recordMetric(name, duration, 'ms', tags)
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.recordMetric(name, duration, 'ms', {
        ...tags,
        error: 'true',
        errorMessage: (error as Error).message
      })
      
      throw error
    }
  }

  // Get performance statistics
  static getStats(timeRangeMs: number = 5 * 60 * 1000): {
    [metricName: string]: {
      count: number
      avg: number
      min: number
      max: number
      p95: number
      p99: number
      errorRate: number
    }
  } {
    const cutoff = Date.now() - timeRangeMs
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    const statsByName: { [key: string]: number[] } = {}
    const errorsByName: { [key: string]: number } = {}
    const totalsByName: { [key: string]: number } = {}

    // Group metrics by name
    for (const metric of recentMetrics) {
      if (!statsByName[metric.name]) {
        statsByName[metric.name] = []
        errorsByName[metric.name] = 0
        totalsByName[metric.name] = 0
      }
      
      statsByName[metric.name].push(metric.value)
      totalsByName[metric.name]++
      
      if (metric.tags?.error === 'true') {
        errorsByName[metric.name]++
      }
    }

    // Calculate statistics
    const stats: any = {}
    
    for (const [name, values] of Object.entries(statsByName)) {
      if (values.length === 0) continue
      
      const sorted = values.sort((a, b) => a - b)
      const sum = values.reduce((a, b) => a + b, 0)
      
      stats[name] = {
        count: values.length,
        avg: sum / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
        p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
        errorRate: (errorsByName[name] / totalsByName[name]) * 100
      }
    }

    return stats
  }

  // Get system performance metrics
  static getSystemMetrics(): {
    memory: NodeJS.MemoryUsage
    uptime: number
    cpuUsage?: NodeJS.CpuUsage
  } {
    const metrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }

    // Record memory usage
    this.recordMetric('system.memory.used', metrics.memory.heapUsed / 1024 / 1024, 'MB')
    this.recordMetric('system.memory.total', metrics.memory.heapTotal / 1024 / 1024, 'MB')
    this.recordMetric('system.uptime', metrics.uptime, 'seconds')

    return metrics
  }

  // Check performance thresholds
  private static checkThresholds(metric: PerformanceMetric): void {
    const thresholdMap: { [key: string]: number } = {
      'api.response_time': PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
      'database.query_time': PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME,
      'ai.processing_time': PERFORMANCE_THRESHOLDS.AI_PROCESSING_TIME,
      'file.upload_time': PERFORMANCE_THRESHOLDS.IMAGE_UPLOAD_TIME,
    }

    const threshold = thresholdMap[metric.name]
    
    if (threshold && metric.value > threshold) {
      logger.warn('Performance threshold exceeded', {
        metric: metric.name,
        value: metric.value,
        threshold,
        unit: metric.unit,
        tags: metric.tags
      })
    }

    // Check system metrics
    if (metric.name === 'system.memory.used' && metric.value > PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB) {
      logger.warn('High memory usage detected', {
        usage: metric.value,
        threshold: PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB,
        unit: 'MB'
      })
    }
  }

  // Clear old metrics
  static clearOldMetrics(olderThanMs: number = 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs
    const initialLength = this.metrics.length
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    const cleared = initialLength - this.metrics.length
    
    if (cleared > 0) {
      logger.debug('Cleared old performance metrics', { count: cleared })
    }
    
    return cleared
  }

  // Export metrics for external monitoring
  static exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.toPrometheusFormat()
    }
    
    return JSON.stringify({
      timestamp: Date.now(),
      metrics: this.metrics.slice(-100), // Last 100 metrics
      stats: this.getStats(),
      system: this.getSystemMetrics()
    }, null, 2)
  }

  // Convert metrics to Prometheus format
  private static toPrometheusFormat(): string {
    const stats = this.getStats()
    let output = ''
    
    for (const [name, stat] of Object.entries(stats)) {
      const metricName = name.replace(/\./g, '_')
      
      output += `# HELP ${metricName}_duration_ms Duration in milliseconds\n`
      output += `# TYPE ${metricName}_duration_ms histogram\n`
      output += `${metricName}_duration_ms_count ${stat.count}\n`
      output += `${metricName}_duration_ms_sum ${stat.avg * stat.count}\n`
      output += `${metricName}_duration_ms{quantile="0.95"} ${stat.p95}\n`
      output += `${metricName}_duration_ms{quantile="0.99"} ${stat.p99}\n`
      
      output += `# HELP ${metricName}_error_rate Error rate percentage\n`
      output += `# TYPE ${metricName}_error_rate gauge\n`
      output += `${metricName}_error_rate ${stat.errorRate}\n\n`
    }
    
    return output
  }

  // Start automatic system monitoring
  static startSystemMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.getSystemMetrics()
      this.clearOldMetrics()
    }, intervalMs)
    
    logger.info('System performance monitoring started', { intervalMs })
  }
}

// Middleware for automatic API performance monitoring
export function performanceMiddleware(metricName?: string) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()
    const name = metricName || `api.${req.method.toLowerCase()}.${req.route?.path || 'unknown'}`
    
    // Override res.end to capture response time
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime
      
      PerformanceMonitor.recordMetric(name, duration, 'ms', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode.toString(),
        userAgent: req.get('User-Agent') || 'unknown'
      })
      
      originalEnd.apply(res, args)
    }
    
    next()
  }
}

// Decorator for automatic function performance monitoring
export function monitor(metricName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const name = metricName || `function.${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function(...args: any[]) {
      return await PerformanceMonitor.timeFunction(
        name,
        () => originalMethod.apply(this, args),
        { class: target.constructor.name, method: propertyKey }
      )
    }
    
    return descriptor
  }
}

// Utility functions for common performance patterns
export const PerfUtils = {
  // Monitor database queries
  async monitorQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    return await PerformanceMonitor.timeFunction(
      `database.${queryName}`,
      queryFn,
      { type: 'database' }
    )
  },

  // Monitor AI processing
  async monitorAI<T>(
    operation: string,
    aiFn: () => Promise<T>
  ): Promise<T> {
    return await PerformanceMonitor.timeFunction(
      `ai.${operation}`,
      aiFn,
      { type: 'ai' }
    )
  },

  // Monitor file operations
  async monitorFile<T>(
    operation: string,
    fileFn: () => Promise<T>
  ): Promise<T> {
    return await PerformanceMonitor.timeFunction(
      `file.${operation}`,
      fileFn,
      { type: 'file' }
    )
  }
}

export default PerformanceMonitor