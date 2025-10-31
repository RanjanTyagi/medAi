// Logger utility for structured logging
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  userId?: string
  requestId?: string
  error?: Error
}

class Logger {
  private logLevel: LogLevel

  constructor() {
    // Set log level based on environment
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  private formatLogEntry(entry: LogEntry): string {
    const { level, message, timestamp, context, userId, requestId, error } = entry
    
    const logData = {
      level: LogLevel[level],
      message,
      timestamp,
      ...(userId && { userId }),
      ...(requestId && { requestId }),
      ...(context && { context }),
      ...(error && { 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }),
    }

    return JSON.stringify(logData)
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    }

    const formattedLog = this.formatLogEntry(entry)

    // In development, use console methods for better formatting
    if (process.env.NODE_ENV === 'development') {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedLog)
          break
        case LogLevel.INFO:
          console.info(formattedLog)
          break
        case LogLevel.WARN:
          console.warn(formattedLog)
          break
        case LogLevel.ERROR:
          // Silently skip error logging
          break
      }
    } else {
      // In production, skip ERROR level logging
      if (this.level !== LogLevel.ERROR) {
        console.log(formattedLog)
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  // Specialized logging methods
  apiRequest(method: string, url: string, userId?: string, duration?: number): void {
    this.info('API Request', {
      method,
      url,
      userId,
      duration,
      type: 'api_request',
    })
  }

  apiResponse(method: string, url: string, statusCode: number, duration: number, userId?: string): void {
    this.info('API Response', {
      method,
      url,
      statusCode,
      duration,
      userId,
      type: 'api_response',
    })
  }

  userAction(action: string, userId: string, resource?: string, resourceId?: string): void {
    this.info('User Action', {
      action,
      userId,
      resource,
      resourceId,
      type: 'user_action',
    })
  }

  securityEvent(event: string, userId?: string, ipAddress?: string, details?: Record<string, unknown>): void {
    this.warn('Security Event', {
      event,
      userId,
      ipAddress,
      ...details,
      type: 'security_event',
    })
  }

  aiRequest(operation: string, duration: number, success: boolean, details?: Record<string, unknown>): void {
    this.info('AI Request', {
      operation,
      duration,
      success,
      ...details,
      type: 'ai_request',
    })
  }

  databaseQuery(query: string, duration: number, success: boolean, error?: Error): void {
    this.debug('Database Query', {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      success,
      type: 'database_query',
    })

    if (error) {
      this.error('Database Query Failed', error, { query })
    }
  }

  performanceMetric(metric: string, value: number, unit: string, context?: Record<string, unknown>): void {
    this.info('Performance Metric', {
      metric,
      value,
      unit,
      ...context,
      type: 'performance_metric',
    })
  }
}

// Create singleton logger instance
export const logger = new Logger()

// Performance monitoring utilities
export class PerformanceMonitor {
  private startTime: number
  private operation: string

  constructor(operation: string) {
    this.operation = operation
    this.startTime = performance.now()
  }

  end(success: boolean = true, context?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime
    
    logger.performanceMetric(this.operation, duration, 'ms', {
      success,
      ...context,
    })

    return duration
  }
}

// Request logging middleware helper
export function createRequestLogger(operation: string) {
  return {
    start: () => new PerformanceMonitor(operation),
    logRequest: (method: string, url: string, userId?: string) => {
      logger.apiRequest(method, url, userId)
    },
    logResponse: (method: string, url: string, statusCode: number, duration: number, userId?: string) => {
      logger.apiResponse(method, url, statusCode, duration, userId)
    },
    logError: (error: Error, context?: Record<string, unknown>) => {
      logger.error(`${operation} failed`, error, context)
    },
  }
}

// Audit logging utilities
export interface AuditLogEntry {
  userId: string
  action: string
  resource: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const auditEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  logger.info('Audit Event', {
    ...auditEntry,
    type: 'audit_event',
  })
}

// Error tracking utilities
export function trackError(error: Error, context?: Record<string, unknown>): void {
  logger.error('Tracked Error', error, {
    ...context,
    type: 'tracked_error',
  })
}

export function trackUserError(userId: string, error: Error, action: string): void {
  logger.error('User Error', error, {
    userId,
    action,
    type: 'user_error',
  })
}