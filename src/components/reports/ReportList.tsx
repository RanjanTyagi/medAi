'use client'

import { useState, useEffect } from 'react'
import { ReportCard } from './ReportCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ReportWithDetails } from '@/lib/report-service'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'

export interface ReportListProps {
  initialReports?: ReportWithDetails[]
  showPatientInfo?: boolean
  showFilters?: boolean
  onStatusUpdate?: (reportId: string, status: string) => void
  apiEndpoint?: string
  className?: string
}

export function ReportList({
  initialReports = [],
  showPatientInfo = false,
  showFilters = true,
  onStatusUpdate,
  apiEndpoint = '/api/reports',
  className = ''
}: ReportListProps) {
  const [reports, setReports] = useState<ReportWithDetails[]>(initialReports)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  })
  const { user } = useAuth()

  // Load reports
  const loadReports = async (resetPage = false) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const currentPage = resetPage ? 1 : page
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      const response = await fetch(`${apiEndpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load reports')
      }

      const data = await response.json()
      
      if (data.success) {
        if (resetPage) {
          setReports(data.data.reports)
          setPage(1)
        } else {
          setReports(prev => [...prev, ...data.data.reports])
        }
        
        setHasMore(data.data.pagination.hasNext)
        
        if (!resetPage) {
          setPage(prev => prev + 1)
        }
      } else {
        throw new Error(data.error?.message || 'Failed to load reports')
      }
    } catch (err) {
      logger.error('Failed to load reports', err as Error)
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
    setReports([])
    setPage(1)
    setHasMore(true)
    loadReports(true)
  }

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      search: '',
      dateFrom: '',
      dateTo: ''
    })
    setReports([])
    setPage(1)
    setHasMore(true)
    loadReports(true)
  }

  // Handle status update
  const handleStatusUpdate = async (reportId: string, status: string) => {
    if (onStatusUpdate) {
      onStatusUpdate(reportId, status)
    }
    
    // Update local state
    setReports(prev => 
      prev.map(report => 
        report.id === reportId 
          ? { ...report, status: status as any }
          : report
      )
    )
  }

  // Load initial reports
  useEffect(() => {
    if (initialReports.length === 0) {
      loadReports(true)
    }
  }, [user])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <Input
                type="text"
                placeholder="Search symptoms..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={applyFilters} disabled={loading}>
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters} disabled={loading}>
              Clear
            </Button>
          </div>
        </div>
      )}

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
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 && !loading ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.search || filters.status || filters.dateFrom || filters.dateTo
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by creating your first medical report.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              showPatientInfo={showPatientInfo}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && reports.length > 0 && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => loadReports()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More Reports'}
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && reports.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
              <div className="mt-4 h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}