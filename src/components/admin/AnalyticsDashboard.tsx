'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { logger } from '@/lib/logger'

interface UsageAnalytics {
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  totalReports: number
  verifiedReports: number
  pendingReports: number
  averageResponseTime: number
  errorCount: number
}

interface UserStats {
  total: number
  byRole: Record<string, number>
  newThisMonth: number
}

interface ReportStats {
  total: number
  byStatus: Record<string, number>
  thisMonth: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  errorRate: number
  activeAlerts: number
  criticalErrors: number
}

interface AnalyticsData {
  usage: UsageAnalytics
  users: UserStats
  reports: ReportStats
  system: { health: SystemHealth }
  metrics: Record<string, number>
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/analytics/usage')
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch analytics')
      }

      setAnalytics(result.data)
      setError(null)
    } catch (err) {
      logger.error('Failed to fetch analytics', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatTime = (ms: number): string => {
    if (ms >= 1000) {
      return (ms / 1000).toFixed(2) + 's'
    }
    return ms.toFixed(0) + 'ms'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
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
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </div>
        
        <Card className="p-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Error Loading Analytics</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(analytics.system.health.status)}`}>
            System: {analytics.system.health.status.toUpperCase()}
          </div>
          <Button 
            onClick={fetchAnalytics} 
            disabled={refreshing}
            size="sm"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Daily Active Users</p>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(analytics.usage.dailyActiveUsers)}</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-green-600">{formatNumber(analytics.usage.totalReports)}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-purple-600">{formatTime(analytics.usage.averageResponseTime)}</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Error Count</p>
              <p className={`text-2xl font-bold ${analytics.usage.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatNumber(analytics.usage.errorCount)}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${analytics.usage.errorCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <svg className={`w-4 h-4 ${analytics.usage.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* User Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Users</span>
              <span className="text-lg font-semibold">{formatNumber(analytics.users.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New This Month</span>
              <span className="text-lg font-semibold text-blue-600">{formatNumber(analytics.users.newThisMonth)}</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">By Role:</p>
              {Object.entries(analytics.users.byRole).map(([role, count]) => (
                <div key={role} className="flex justify-between items-center pl-4">
                  <span className="text-sm text-gray-600 capitalize">{role}s</span>
                  <span className="text-sm font-medium">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Analytics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Reports</span>
              <span className="text-lg font-semibold">{formatNumber(analytics.reports.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-lg font-semibold text-green-600">{formatNumber(analytics.reports.thisMonth)}</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">By Status:</p>
              {Object.entries(analytics.reports.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center pl-4">
                  <span className="text-sm text-gray-600 capitalize">{status}</span>
                  <span className="text-sm font-medium">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Daily Active</span>
              <span className="text-sm font-medium">{formatNumber(analytics.usage.dailyActiveUsers)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Weekly Active</span>
              <span className="text-sm font-medium">{formatNumber(analytics.usage.weeklyActiveUsers)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Monthly Active</span>
              <span className="text-sm font-medium">{formatNumber(analytics.usage.monthlyActiveUsers)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Verified</span>
              <span className="text-sm font-medium text-green-600">{formatNumber(analytics.usage.verifiedReports)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pending</span>
              <span className="text-sm font-medium text-yellow-600">{formatNumber(analytics.usage.pendingReports)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Verification Rate</span>
              <span className="text-sm font-medium">
                {analytics.usage.totalReports > 0 
                  ? ((analytics.usage.verifiedReports / analytics.usage.totalReports) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`text-sm font-medium ${getHealthColor(analytics.system.health.status).split(' ')[0]}`}>
                {analytics.system.health.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="text-sm font-medium">{(analytics.system.health.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Alerts</span>
              <span className={`text-sm font-medium ${analytics.system.health.activeAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {analytics.system.health.activeAlerts}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* System Metrics */}
      {Object.keys(analytics.metrics).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(analytics.metrics).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-xs text-gray-500 mb-1">{key.replace(/_/g, ' ').toUpperCase()}</p>
                <p className="text-lg font-semibold">{formatNumber(value)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}