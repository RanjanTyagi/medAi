import { track } from '@vercel/analytics'
import { logger } from './logger'

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  userId?: string
  timestamp?: Date
}

export interface SystemMetrics {
  apiCalls: number
  responseTime: number
  errorRate: number
  activeUsers: number
  reportCount: number
  verificationRate: number
}

export interface UsageAnalytics {
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  totalReports: number
  verifiedReports: number
  pendingReports: number
  averageResponseTime: number
  errorCount: number
}

class AnalyticsService {
  private events: AnalyticsEvent[] = []
  private metrics: Map<string, number> = new Map()

  // Track user events
  trackEvent(event: AnalyticsEvent): void {
    try {
      // Store event locally for analytics dashboard
      this.events.push({
        ...event,
        timestamp: event.timestamp || new Date()
      })

      // Send to Vercel Analytics
      track(event.name, event.properties)

      // Log for debugging
      logger.info('Analytics event tracked', {
        event: event.name,
        properties: event.properties,
        userId: event.userId
      })
    } catch (error) {
      logger.error('Failed to track analytics event', error as Error)
    }
  }

  // Track user actions
  trackUserAction(action: string, userId: string, properties?: Record<string, any>): void {
    this.trackEvent({
      name: `user_${action}`,
      properties: {
        ...properties,
        action
      },
      userId
    })
  }

  // Track API performance
  trackApiCall(endpoint: string, method: string, responseTime: number, status: number): void {
    const isError = status >= 400
    
    this.trackEvent({
      name: 'api_call',
      properties: {
        endpoint,
        method,
        responseTime,
        status,
        isError
      }
    })

    // Update metrics
    this.incrementMetric('api_calls_total')
    this.updateMetric('response_time_avg', responseTime)
    
    if (isError) {
      this.incrementMetric('api_errors_total')
    }
  }

  // Track AI diagnosis events
  trackDiagnosis(userId: string, success: boolean, processingTime: number, hasImages: boolean): void {
    this.trackEvent({
      name: 'ai_diagnosis',
      properties: {
        success,
        processingTime,
        hasImages,
        timestamp: new Date().toISOString()
      },
      userId
    })

    this.incrementMetric('diagnoses_total')
    if (success) {
      this.incrementMetric('diagnoses_successful')
    } else {
      this.incrementMetric('diagnoses_failed')
    }
  }

  // Track doctor verification events
  trackVerification(doctorId: string, reportId: string, action: 'verified' | 'rejected'): void {
    this.trackEvent({
      name: 'doctor_verification',
      properties: {
        action,
        reportId,
        timestamp: new Date().toISOString()
      },
      userId: doctorId
    })

    this.incrementMetric('verifications_total')
    this.incrementMetric(`verifications_${action}`)
  }

  // Track system errors
  trackError(error: Error, context?: Record<string, any>): void {
    this.trackEvent({
      name: 'system_error',
      properties: {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    })

    this.incrementMetric('errors_total')
  }

  // Track user authentication events
  trackAuth(action: 'login' | 'logout' | 'register', userId?: string, role?: string): void {
    this.trackEvent({
      name: `auth_${action}`,
      properties: {
        action,
        role,
        timestamp: new Date().toISOString()
      },
      userId
    })

    if (action === 'login') {
      this.incrementMetric('logins_total')
    } else if (action === 'register') {
      this.incrementMetric('registrations_total')
    }
  }

  // Get current metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics)
  }

  // Get recent events
  getRecentEvents(limit: number = 100): AnalyticsEvent[] {
    return this.events
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit)
  }

  // Get events by type
  getEventsByType(eventName: string, limit: number = 50): AnalyticsEvent[] {
    return this.events
      .filter(event => event.name === eventName)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit)
  }

  // Calculate usage analytics
  async calculateUsageAnalytics(): Promise<UsageAnalytics> {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const loginEvents = this.getEventsByType('auth_login')
    
    const dailyActiveUsers = new Set(
      loginEvents
        .filter(event => event.timestamp && event.timestamp > oneDayAgo)
        .map(event => event.userId)
        .filter(Boolean)
    ).size

    const weeklyActiveUsers = new Set(
      loginEvents
        .filter(event => event.timestamp && event.timestamp > oneWeekAgo)
        .map(event => event.userId)
        .filter(Boolean)
    ).size

    const monthlyActiveUsers = new Set(
      loginEvents
        .filter(event => event.timestamp && event.timestamp > oneMonthAgo)
        .map(event => event.userId)
        .filter(Boolean)
    ).size

    const diagnosisEvents = this.getEventsByType('ai_diagnosis')
    const verificationEvents = this.getEventsByType('doctor_verification')
    const errorEvents = this.getEventsByType('system_error')
    const apiEvents = this.getEventsByType('api_call')

    const totalReports = diagnosisEvents.length
    const verifiedReports = verificationEvents.filter(e => e.properties?.action === 'verified').length
    const pendingReports = totalReports - verifiedReports

    const responseTimes = apiEvents
      .map(e => e.properties?.responseTime)
      .filter(time => typeof time === 'number') as number[]
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      totalReports,
      verifiedReports,
      pendingReports,
      averageResponseTime,
      errorCount: errorEvents.length
    }
  }

  // Helper methods
  private incrementMetric(key: string): void {
    const current = this.metrics.get(key) || 0
    this.metrics.set(key, current + 1)
  }

  private updateMetric(key: string, value: number): void {
    const current = this.metrics.get(key) || 0
    const count = this.metrics.get(`${key}_count`) || 0
    
    // Calculate running average
    const newAverage = (current * count + value) / (count + 1)
    this.metrics.set(key, newAverage)
    this.metrics.set(`${key}_count`, count + 1)
  }

  // Clear old events (keep only last 1000 events)
  cleanupEvents(): void {
    if (this.events.length > 1000) {
      this.events = this.events
        .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
        .slice(0, 1000)
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService()

// Cleanup events every hour
if (typeof window !== 'undefined') {
  setInterval(() => {
    analyticsService.cleanupEvents()
  }, 60 * 60 * 1000)
}