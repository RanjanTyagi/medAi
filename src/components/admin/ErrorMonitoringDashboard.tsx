'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { logger } from '@/lib/logger'

interface ErrorReport {
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

interface SystemAlert {
  id: string
  type: 'error_rate' | 'response_time' | 'api_failure' | 'security' | 'performance'
  message: string
  severity: 'warning' | 'critical'
  timestamp: Date
  acknowledged: boolean
  details?: Record<string, any>
}

interface ErrorStats {
  total: number
  byDay: number
  byHour: number
  bySeverity: Record<string, number>
  topErrors: Array<{ message: string; count: number }>
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  errorRate: number
  activeAlerts: number
  criticalErrors: number
}

interface MonitoringData {
  errors: ErrorReport[]
  stats: ErrorStats
  health: SystemHealth
  alerts: SystemAlert[]
}

export default function ErrorMonitoringDashboard() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchMonitoringData = async () => {
    try {
      setRefreshing(true)
      
      const params = new URLSearchParams()
      if (selectedSeverity !== 'all') {
        params.append('severity', selectedSeverity)
      }
      
      const response = await fetch(`/api/monitoring/errors?${params}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch monitoring data')
      }

      setMonitoringData(result.data)
      setError(null)
    } catch (err) {
      logger.error('Failed to fetch monitoring data', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'acknowledge' })
      })

      if (response.ok) {
        fetchMonitoringData() // Refresh data
      }
    } catch (err) {
      logger.error('Failed to acknowledge alert', err as Error)
    }
  }

  const resolveError = async (errorId: string) => {
    try {
      const response = await fetch('/api/monitoring/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId, action: 'resolve' })
      })

      if (response.ok) {
        fetchMonitoringData() // Refresh data
      }
    } catch (err) {
      logger.error('Failed to resolve error', err as Error)
    }
  }

  useEffect(() => {
    fetchMonitoringData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000)
    return () => clearInterval(interval)
  }, [selectedSeverity])

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Error Monitoring</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Error Monitoring</h1>
          <Button onClick={fetchMonitoringData}>Retry</Button>
        </div>
        
        <Card className="p-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Error Loading Monitoring Data</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!monitoringData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Error Monitoring</h1>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(monitoringData.health.status)}`}>
            System: {monitoringData.health.status.toUpperCase()}
          </div>
          <Button 
            onClick={fetchMonitoringData} 
            disabled={refreshing}
            size="sm"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-red-600">{(monitoringData.health.errorRate * 100).toFixed(2)}%</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className={`text-2xl font-bold ${monitoringData.health.activeAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {monitoringData.health.activeAlerts}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${monitoringData.health.activeAlerts > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <svg className={`w-4 h-4 ${monitoringData.health.activeAlerts > 0 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 01-7.5-7.5H0l5-5 5 5H5a2.5 2.5 0 002.5 2.5V17z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Critical Errors</p>
              <p className={`text-2xl font-bold ${monitoringData.health.criticalErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {monitoringData.health.criticalErrors}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${monitoringData.health.criticalErrors > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <svg className={`w-4 h-4 ${monitoringData.health.criticalErrors > 0 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold text-gray-900">{monitoringData.stats.total}</p>
            </div>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      {monitoringData.alerts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h3>
          <div className="space-y-4">
            {monitoringData.alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{alert.type.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatTimestamp(alert.timestamp)}</p>
                </div>
                <Button
                  onClick={() => acknowledgeAlert(alert.id)}
                  size="sm"
                  variant="secondary"
                >
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last 24 Hours</span>
              <span className="text-sm font-medium">{monitoringData.stats.byDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last Hour</span>
              <span className="text-sm font-medium">{monitoringData.stats.byHour}</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">By Severity:</p>
              {Object.entries(monitoringData.stats.bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex justify-between items-center pl-4">
                  <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(severity)}`}>
                    {severity.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Error Messages</h3>
          <div className="space-y-3">
            {monitoringData.stats.topErrors.slice(0, 5).map((error, index) => (
              <div key={index} className="flex justify-between items-start">
                <p className="text-sm text-gray-900 flex-1 mr-4 truncate">{error.message}</p>
                <span className="text-sm font-medium text-gray-600">{error.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Errors */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <div className="space-y-4">
          {monitoringData.errors.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No errors found</p>
          ) : (
            monitoringData.errors.map((error) => (
              <div key={error.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(error.severity)}`}>
                      {error.severity.toUpperCase()}
                    </span>
                    {error.resolved && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-600">
                        RESOLVED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{formatTimestamp(error.timestamp)}</span>
                    {!error.resolved && (
                      <Button
                        onClick={() => resolveError(error.id)}
                        size="sm"
                        variant="secondary"
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
                
                <p className="text-sm font-medium text-gray-900 mb-2">{error.message}</p>
                
                {error.context && (
                  <div className="text-xs text-gray-600 mb-2">
                    <strong>Context:</strong> {JSON.stringify(error.context, null, 2)}
                  </div>
                )}
                
                {error.userId && (
                  <p className="text-xs text-gray-500">User ID: {error.userId}</p>
                )}
                
                {error.url && (
                  <p className="text-xs text-gray-500">URL: {error.url}</p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}