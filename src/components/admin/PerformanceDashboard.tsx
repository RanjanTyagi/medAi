'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { logger } from '@/lib/logger'

interface PerformanceStats {
  [metricName: string]: {
    count: number
    avg: number
    min: number
    max: number
    p95: number
    p99: number
    errorRate: number
  }
}

interface SystemMetrics {
  memory: {
    used: number
    total: number
    external: number
    rss: number
  }
  uptime: number
  nodeVersion: string
  platform: string
  arch: string
}

interface CacheStats {
  size: number
  maxSize: number
  totalHits: number
  expiredItems: number
  hitRate: number
  efficiency: number
}

interface PerformanceData {
  timestamp: string
  timeRangeMs: number
  performance: {
    stats: PerformanceStats
    system: SystemMetrics
    cache: CacheStats
  }
  health: {
    status: string
    checks: {
      memory: boolean
      cache: boolean
      uptime: boolean
    }
  }
}

export default function PerformanceDashboard() {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [timeRange, setTimeRange] = useState(300000) // 5 minutes

  // Fetch performance data
  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(`/api/performance/metrics?timeRange=${timeRange}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch performance data')
      }

      setPerformanceData(result.data)
      setError(null)
    } catch (err) {
      logger.error('Failed to fetch performance data', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Clear old performance data
  const clearOldData = async () => {
    try {
      const response = await fetch('/api/performance/metrics?action=clear_old', {
        method: 'DELETE'
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clear old data')
      }

      // Refresh data after clearing
      await fetchPerformanceData()
    } catch (err) {
      logger.error('Failed to clear old data', err as Error)
      setError((err as Error).message)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchPerformanceData()

    if (autoRefresh) {
      const interval = setInterval(fetchPerformanceData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, timeRange])

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format duration to human readable
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
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
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <Button onClick={fetchPerformanceData}>Retry</Button>
        </div>
        <Card className="p-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Error Loading Performance Data</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!performanceData) {
    return null
  }

  const { performance, health } = performanceData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={60000}>Last 1 minute</option>
            <option value={300000}>Last 5 minutes</option>
            <option value={900000}>Last 15 minutes</option>
            <option value={3600000}>Last 1 hour</option>
          </select>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'primary' : 'secondary'}
            size="sm"
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={fetchPerformanceData} size="sm">
            Refresh
          </Button>
          <Button onClick={clearOldData} variant="secondary" size="sm">
            Clear Old Data
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
              {health.status.toUpperCase()}
            </div>
            <div className="text-sm text-gray-600">Overall Status</div>
          </div>
          <div className="text-center">
            <div className={`text-lg ${health.checks.memory ? 'text-green-600' : 'text-red-600'}`}>
              {health.checks.memory ? '✓' : '✗'} Memory
            </div>
            <div className="text-sm text-gray-600">
              {formatBytes(performance.system.memory.used * 1024 * 1024)} / 
              {formatBytes(performance.system.memory.total * 1024 * 1024)}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-lg ${health.checks.cache ? 'text-green-600' : 'text-red-600'}`}>
              {health.checks.cache ? '✓' : '✗'} Cache
            </div>
            <div className="text-sm text-gray-600">
              {Math.round(performance.cache.hitRate * 100)}% hit rate
            </div>
          </div>
          <div className="text-center">
            <div className={`text-lg ${health.checks.uptime ? 'text-green-600' : 'text-red-600'}`}>
              {health.checks.uptime ? '✓' : '✗'} Uptime
            </div>
            <div className="text-sm text-gray-600">
              {formatDuration(performance.system.uptime)}
            </div>
          </div>
        </div>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <h4 className="font-semibold text-gray-700 mb-2">Memory Usage</h4>
          <div className="text-2xl font-bold text-blue-600">
            {performance.system.memory.used} MB
          </div>
          <div className="text-sm text-gray-600">
            of {performance.system.memory.total} MB total
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{
                width: `${(performance.system.memory.used / performance.system.memory.total) * 100}%`
              }}
            ></div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold text-gray-700 mb-2">Cache Performance</h4>
          <div className="text-2xl font-bold text-green-600">
            {Math.round(performance.cache.hitRate * 100)}%
          </div>
          <div className="text-sm text-gray-600">
            {performance.cache.size} / {performance.cache.maxSize} items
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {performance.cache.totalHits} total hits
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold text-gray-700 mb-2">System Info</h4>
          <div className="text-sm space-y-1">
            <div><span className="font-medium">Node:</span> {performance.system.nodeVersion}</div>
            <div><span className="font-medium">Platform:</span> {performance.system.platform}</div>
            <div><span className="font-medium">Arch:</span> {performance.system.arch}</div>
            <div><span className="font-medium">Uptime:</span> {formatDuration(performance.system.uptime)}</div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold text-gray-700 mb-2">Last Updated</h4>
          <div className="text-sm text-gray-600">
            {new Date(performanceData.timestamp).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Time range: {timeRange / 1000}s
          </div>
        </Card>
      </div>

      {/* Performance Statistics */}
      {Object.keys(performance.stats).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Statistics</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg (ms)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P95 (ms)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P99 (ms)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(performance.stats).map(([name, stats]) => (
                  <tr key={name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stats.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(stats.avg)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(stats.p95)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(stats.p99)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`${stats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.round(stats.errorRate * 100) / 100}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}