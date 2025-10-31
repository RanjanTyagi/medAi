'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  formatDate, 
  formatRelativeTime, 
  getConfidenceColor,
  truncateText 
} from '@/lib/utils'
import { ReportWithDetails } from '@/lib/report-service'
import { ProcessedDiagnosisResult } from '@/lib/ai-response-processor'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'
import { api } from '@/lib/api-client'

export interface VerificationQueueProps {
  onVerifyReport?: (reportId: string, status: string, note?: string) => void
  className?: string
}

export function VerificationQueue({ onVerifyReport, className = '' }: VerificationQueueProps) {
  const [reports, setReports] = useState<ReportWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [verifyingReports, setVerifyingReports] = useState<Set<string>>(new Set())
  const { user, loading: authLoading } = useAuth()

  // Load verification queue
  const loadQueue = async (resetPage = false) => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const currentPage = resetPage ? 1 : page
      const response = await api.get(`/api/doctor/queue?page=${currentPage}&limit=10`)

      if (!response.ok) {
        throw new Error('Failed to load verification queue')
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
        throw new Error(data.error?.message || 'Failed to load verification queue')
      }

      logger.info('Verification queue loaded successfully', {
        userId: user.id,
        reportsCount: data.data.reports.length
      })
    } catch (err) {
      logger.error('Failed to load verification queue', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Handle report verification
  const handleVerification = async (reportId: string, status: 'verified' | 'rejected', note?: string) => {
    setVerifyingReports(prev => new Set(prev).add(reportId))

    try {
      const response = await api.post('/api/doctor/verify', {
        reportId,
        status,
        note
      })

      if (!response.ok) {
        throw new Error('Failed to verify report')
      }

      const data = await response.json()
      
      if (data.success) {
        // Remove report from queue
        setReports(prev => prev.filter(report => report.id !== reportId))
        
        if (onVerifyReport) {
          onVerifyReport(reportId, status, note)
        }

        logger.info('Report verified successfully', { reportId, status })
      } else {
        throw new Error(data.error?.message || 'Failed to verify report')
      }
    } catch (err) {
      logger.error('Failed to verify report', err as Error)
      setError((err as Error).message)
    } finally {
      setVerifyingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(reportId)
        return newSet
      })
    }
  }

  // Load initial queue
  useEffect(() => {
    if (user) {
      loadQueue(true)
    }
  }, [user])

  const getPriorityBadge = (report: ReportWithDetails) => {
    const aiAnalysis = report.ai_output as ProcessedDiagnosisResult
    
    if (aiAnalysis?.urgencyLevel === 'emergency') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          🚨 Emergency
        </span>
      )
    }
    
    if (aiAnalysis?.overallRisk === 'critical') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ⚠️ Critical
        </span>
      )
    }
    
    if (aiAnalysis?.overallRisk === 'high') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          High Risk
        </span>
      )
    }
    
    return null
  }

  const getWaitingTime = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Less than 1 hour'
    if (diffHours < 24) return `${diffHours} hours`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Verification Queue</h2>
          <p className="text-gray-600">
            {reports.length} report{reports.length !== 1 ? 's' : ''} pending verification
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadQueue(true)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Queue'}
        </Button>
      </div>

      {/* Error Display - Suppressed, just log it */}

      {/* Queue List */}
      {reports.length === 0 && !loading ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports pending</h3>
            <p className="mt-1 text-sm text-gray-500">
              All reports have been reviewed. Great work!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const aiAnalysis = report.ai_output as ProcessedDiagnosisResult
            const primaryDiagnosis = aiAnalysis?.diagnoses?.[0]
            const isVerifying = verifyingReports.has(report.id)

            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg font-medium text-gray-900">
                          Patient: {report.patient?.name || 'Unknown'}
                        </CardTitle>
                        {getPriorityBadge(report)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Submitted: {formatRelativeTime(report.created_at)}</span>
                        <span>Waiting: {getWaitingTime(report.created_at)}</span>
                        {report.image_url && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                            Has Image
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Symptoms */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Symptoms</h4>
                    <p className="text-sm text-gray-700">
                      {truncateText(report.symptoms, 200)}
                    </p>
                  </div>

                  {/* AI Analysis Summary */}
                  {primaryDiagnosis && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">AI Analysis</h4>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-blue-900">{primaryDiagnosis.condition}</span>
                          <span className={`text-sm font-medium ${getConfidenceColor(primaryDiagnosis.confidence)}`}>
                            {Math.round(primaryDiagnosis.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-blue-700">
                          <span>Severity: {primaryDiagnosis.severity}</span>
                          <span>Risk: {aiAnalysis.overallRisk}</span>
                          {aiAnalysis.diagnoses.length > 1 && (
                            <span>+{aiAnalysis.diagnoses.length - 1} more diagnoses</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Report ID: {report.id.slice(0, 8)}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/doctor/reports/${report.id}`}>
                        <Button variant="outline" size="sm">
                          Review Details
                        </Button>
                      </Link>
                      
                      <Button
                        size="sm"
                        onClick={() => handleVerification(report.id, 'verified')}
                        disabled={isVerifying}
                        loading={isVerifying}
                      >
                        {isVerifying ? 'Verifying...' : 'Verify'}
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleVerification(report.id, 'rejected', 'Requires further evaluation')}
                        disabled={isVerifying}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && reports.length > 0 && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => loadQueue()}
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
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="mt-4 h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}