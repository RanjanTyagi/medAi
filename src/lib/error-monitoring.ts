import { logger } from './logger'
import { analyticsService } from './analytics-service'

export interface ErrorReport {
  id: string
  message: string
  stack?: string
  timestamp: Date
  userId?: string
  url?: string
  userAgent?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
  resolved: boolean
}

export interface SystemAlert {
  id: string
  type: 'error_rate' | 'response_time' | 'api_failure' | 'security' | 'performance'
  message: string
  severity: 'warning' | 'critical'
  timestamp: Date
  acknowledged: boolean
  details?: Record<string, any>
}

class ErrorMonitoringService {
  private errors: ErrorReport[] = []
  private alerts: SystemAlert[] = []
  private errorThresholds = {
    errorRate: 0.05, // 5% error rate threshold
    responseTime: 5000, // 5 second response time threshold
    consecutiveErrors: 5 // 5 consecutive errors trigger alert
  }

  // Report an error
  reportError(error: Error, context?: Record<string, any>, userId?: string): string {
    const errorId = this.generateId()
    const severity = this.calculateSeverity(error, context)

    const errorReport: ErrorReport = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      userId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      severity,
      context,
      resolved: false
    }

    this.errors.push(errorReport)
    
    // Track in analytics
    analyticsService.trackError(error, context)
    
    // Log the error
    logger.error('Error reported to monitoring', error, {
      errorId,
      severity,
      context,
      userId
    })

    // Check if we need to create alerts
    this.checkForAlerts()

    // Cleanup old errors
    this.cleanupErrors()

    return errorId
  }

  // Report API errors
  reportApiError(endpoint: string, method: string, status: number, error: Error, userId?: string): string {
    return this.reportError(error, {
      type: 'api_error',
      endpoint,
      method,
      status,
      timestamp: new Date().toISOString()
    }, userId)
  }

  // Report authentication errors
  reportAuthError(action: string, error: Error, userId?: string): string {
    return this.reportError(error, {
      type: 'auth_error',
      action,
      timestamp: new Date().toISOString()
    }, userId)
  }

  // Report AI service errors
  reportAiError(operation: string, error: Error, userId?: string): string {
    return this.reportError(error, {
      type: 'ai_error',
      operation,
      timestamp: new Date().toISOString()
    }, userId)
  }

  // Get error statistics
  getErrorStats(): {
    total: number
    byDay: number
    byHour: number
    bySeverity: Record<string, number>
    topErrors: Array<{ message: string; count: number }>
  } {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const byDay = this.errors.filter(error => error.timestamp > oneDayAgo).length
    const byHour = this.errors.filter(error => error.timestamp > oneHourAgo).length

    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Count error messages
    const errorCounts = this.errors.reduce((acc, error) => {
      acc[error.message] = (acc[error.message] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }))

    return {
      total: this.errors.length,
      byDay,
      byHour,
      bySeverity,
      topErrors
    }
  }

  // Get recent errors
  getRecentErrors(limit: number = 50): ErrorReport[] {
    return this.errors
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  // Get errors by severity
  getErrorsBySeverity(severity: ErrorReport['severity'], limit: number = 50): ErrorReport[] {
    return this.errors
      .filter(error => error.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  // Mark error as resolved
  resolveError(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      logger.info('Error marked as resolved', { errorId })
      return true
    }
    return false
  }

  // Create system alert
  createAlert(type: SystemAlert['type'], message: string, severity: SystemAlert['severity'], details?: Record<string, any>): string {
    const alertId = this.generateId()
    
    const alert: SystemAlert = {
      id: alertId,
      type,
      message,
      severity,
      timestamp: new Date(),
      acknowledged: false,
      details
    }

    this.alerts.push(alert)
    
    logger.warn('System alert created', {
      alertId,
      type,
      message,
      severity,
      details
    })

    return alertId
  }

  // Get active alerts
  getActiveAlerts(): SystemAlert[] {
    return this.alerts
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      logger.info('Alert acknowledged', { alertId })
      return true
    }
    return false
  }

  // Check for system alerts based on error patterns
  private checkForAlerts(): void {
    const recentErrors = this.getRecentErrors(100)
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const recentHourErrors = recentErrors.filter(error => error.timestamp > oneHourAgo)

    // Check error rate
    if (recentHourErrors.length > 50) { // More than 50 errors in an hour
      this.createAlert(
        'error_rate',
        `High error rate detected: ${recentHourErrors.length} errors in the last hour`,
        'critical',
        { errorCount: recentHourErrors.length, timeWindow: '1 hour' }
      )
    }

    // Check for consecutive API failures
    const apiErrors = recentErrors
      .filter(error => error.context?.type === 'api_error')
      .slice(0, 10)

    if (apiErrors.length >= 5) {
      this.createAlert(
        'api_failure',
        'Multiple consecutive API failures detected',
        'critical',
        { consecutiveFailures: apiErrors.length }
      )
    }

    // Check for critical errors
    const criticalErrors = recentHourErrors.filter(error => error.severity === 'critical')
    if (criticalErrors.length > 0) {
      this.createAlert(
        'error_rate',
        `Critical errors detected: ${criticalErrors.length} in the last hour`,
        'critical',
        { criticalErrorCount: criticalErrors.length }
      )
    }
  }

  // Calculate error severity based on error type and context
  private calculateSeverity(error: Error, context?: Record<string, any>): ErrorReport['severity'] {
    // Critical errors
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'critical'
    }
    
    if (context?.type === 'auth_error' || context?.type === 'security_error') {
      return 'high'
    }

    if (context?.type === 'api_error' && context?.status >= 500) {
      return 'high'
    }

    if (context?.type === 'ai_error') {
      return 'medium'
    }

    // Default to medium for unclassified errors
    return 'medium'
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup old errors (keep only last 1000 errors)
  private cleanupErrors(): void {
    if (this.errors.length > 1000) {
      this.errors = this.errors
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 1000)
    }

    // Cleanup old alerts (keep only last 100 alerts)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 100)
    }
  }

  // Get system health status
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    errorRate: number
    activeAlerts: number
    criticalErrors: number
  } {
    const recentErrors = this.getRecentErrors(100)
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const recentHourErrors = recentErrors.filter(error => error.timestamp > oneHourAgo)
    
    const errorRate = recentHourErrors.length / 100 // Assuming 100 requests per hour baseline
    const activeAlerts = this.getActiveAlerts().length
    const criticalErrors = recentHourErrors.filter(error => error.severity === 'critical').length

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (criticalErrors > 0 || activeAlerts > 5) {
      status = 'critical'
    } else if (errorRate > this.errorThresholds.errorRate || activeAlerts > 0) {
      status = 'warning'
    }

    return {
      status,
      errorRate,
      activeAlerts,
      criticalErrors
    }
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoringService()

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorMonitoring.reportError(new Error(event.message), {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    errorMonitoring.reportError(new Error(event.reason), {
      type: 'unhandled_promise_rejection'
    })
  })
}