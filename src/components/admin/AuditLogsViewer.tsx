'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuditLog } from '@/lib/admin-service'
import { useAuth } from '@/lib/auth-context'
import { formatRelativeTime } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface AuditLogsViewerProps {
  className?: string
}

export function AuditLogsViewer({ className = '' }: AuditLogsViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    userId: '',
    startDate: '',
    endDate: ''
  })
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const { user } = useAuth()

  const limit = 50

  // Load audit logs
  const loadLogs = async (reset = false) => {
    if (!user || user.role !== 'admin') return

    setLoading(true)
    setError(null)

    try {
      const currentOffset = reset ? 0 : offset
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString()
      })

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load audit logs')
      }

      const data = await response.json()
      
      if (data.success) {
        if (reset) {
          setLogs(data.data.logs)
          setOffset(limit)
        } else {
          setLogs(prev => [...prev, ...data.data.logs])
          setOffset(prev => prev + limit)
        }
        setHasMore(data.data.hasMore)
      } else {
        throw new Error(data.error?.message || 'Failed to load audit logs')
      }
    } catch (err) {
      logger.error('Failed to load audit logs', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Apply filters
  const applyFilters = () => {
    setOffset(0)
    loadLogs(true)
  }

  // Clear filters
  const clearFilters = () => {
    setFilters({
      action: '',
      resourceType: '',
      userId: '',
      startDate: '',
      endDate: ''
    })
    setOffset(0)
    loadLogs(true)
  }

  useEffect(() => {
    loadLogs(true)
  }, [user])

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800'
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800'
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800'
    if (action.includes('VIEW')) return 'bg-gray-100 text-gray-800'
    if (action.includes('ERROR')) return 'bg-red-100 text-red-800'
    return 'bg-purple-100 text-purple-800'
  }

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'user':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'report':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'system':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-600 mt-1">System activity and security monitoring</p>
        </div>
        <Button onClick={() => loadLogs(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <Input
                placeholder="e.g., CREATE_USER, VIEW_REPORT"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
              <select
                value={filters.resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="user">User</option>
                <option value="report">Report</option>
                <option value="system">System</option>
                <option value="audit_log">Audit Log</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <Input
                placeholder="Filter by user ID"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={applyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
          </div>
        </CardContent>
      </Card>     
 {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadLogs(true)}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {getResourceIcon(log.resourceType)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm text-gray-500">
                        {log.resourceType}
                      </span>
                      {log.resourceId && (
                        <span className="text-xs text-gray-400 font-mono">
                          {log.resourceId.slice(-8)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-900">
                          {log.user ? (
                            <span>
                              <strong>{log.user.name}</strong> ({log.user.email})
                            </span>
                          ) : (
                            <span className="text-gray-500">System</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(log.createdAt)}
                          {log.ipAddress && ` • ${log.ipAddress}`}
                        </p>
                      </div>
                      
                      {log.details && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Show details in a modal or expand inline
                            alert(JSON.stringify(log.details, null, 2))
                          }}
                        >
                          Details
                        </Button>
                      )}
                    </div>
                    
                    {log.userAgent && (
                      <p className="text-xs text-gray-400 mt-2 truncate">
                        {log.userAgent}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.values(filters).some(f => f) ? 'Try adjusting your filters.' : 'System activity will appear here.'}
              </p>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={() => loadLogs(false)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}