'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ReportWithDetails } from '@/lib/report-service'
import { useAuth } from '@/lib/auth-context'
import { formatRelativeTime, getStatusColor, getStatusDisplayName } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface ReportDetailViewProps {
  reportId: string
  className?: string
}

export function ReportDetailView({ reportId, className = '' }: ReportDetailViewProps) {
  const [report, setReport] = useState<ReportWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  // Load report details
  const loadReport = async () => {
    if (!user || !reportId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found')
        }
        throw new Error('Failed to load report')
      }

      const data = await response.json()
      
      if (data.success) {
        setReport(data.data.report)
      } else {
        throw new Error(data.error?.message || 'Failed to load report')
      }
    } catch (err) {
      logger.error('Failed to load report', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [user, reportId]) 
 if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-red-800">Error Loading Report</h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <div className="mt-6 space-x-3">
            <Button onClick={loadReport} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => router.back()} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Report not found</h3>
          <p className="mt-1 text-sm text-gray-500">The requested report could not be found.</p>
          <div className="mt-6">
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }  return
 (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Report #{report.id.slice(-8)}
            </h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
              {getStatusDisplayName(report.status)}
            </span>
          </div>
          <p className="text-gray-600">
            Created {formatRelativeTime(report.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          {report.status === 'pending' && (
            <Button variant="outline" disabled>
              Analysis in Progress
            </Button>
          )}
        </div>
      </div>

      {/* Patient Information */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <p className="mt-1 text-sm text-gray-900">{report.patientAge} years</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <p className="mt-1 text-sm text-gray-900 capitalize">{report.patientGender}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Report Date</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(report.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Symptoms */}
      <Card>
        <CardHeader>
          <CardTitle>Symptoms Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{report.symptoms}</p>
          </div>
        </CardContent>
      </Card>

      {/* Medical Image */}
      {report.imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Medical Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <img 
                src={report.imageUrl} 
                alt="Medical image" 
                className="w-full h-auto rounded-lg border border-gray-200"
              />
            </div>
          </CardContent>
        </Card>
      )}    
  {/* AI Analysis */}
      {report.aiDiagnosis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Possible Conditions */}
              {report.aiDiagnosis.possibleConditions && report.aiDiagnosis.possibleConditions.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Possible Conditions</h4>
                  <div className="space-y-2">
                    {report.aiDiagnosis.possibleConditions.map((condition, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-medium text-blue-900">{condition.condition}</p>
                          <p className="text-sm text-blue-700">{condition.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-blue-900">
                            {Math.round(condition.confidence * 100)}%
                          </span>
                          <p className="text-xs text-blue-600">confidence</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.aiDiagnosis.recommendations && report.aiDiagnosis.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {report.aiDiagnosis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-700">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Urgency Level */}
              {report.aiDiagnosis.urgencyLevel && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Urgency Level</h4>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    report.aiDiagnosis.urgencyLevel === 'high' 
                      ? 'bg-red-100 text-red-800'
                      : report.aiDiagnosis.urgencyLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {report.aiDiagnosis.urgencyLevel.charAt(0).toUpperCase() + report.aiDiagnosis.urgencyLevel.slice(1)}
                  </div>
                </div>
              )}
            </div>

            {/* AI Disclaimer */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Important Disclaimer</h4>
                  <div className="mt-1 text-sm text-yellow-700">
                    <p>
                      This AI analysis is for informational purposes only and should not replace professional medical advice. 
                      Always consult with a qualified healthcare provider for proper diagnosis and treatment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}   
   {/* Doctor Notes */}
      {report.doctorNotes && report.doctorNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Doctor Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.doctorNotes.map((note, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">Dr. {note.doctorName}</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        note.status === 'verified' 
                          ? 'bg-green-100 text-green-800'
                          : note.status === 'needs_review'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {note.status === 'verified' ? 'Verified' : 
                         note.status === 'needs_review' ? 'Needs Review' : 'Disputed'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(note.createdAt)}
                    </span>
                  </div>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{note.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Report Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-medium text-gray-900">Report Created</p>
                <p className="text-sm text-gray-500">{formatRelativeTime(report.createdAt)}</p>
              </div>
            </div>
            
            {report.aiDiagnosis && (
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-3 h-3 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900">AI Analysis Completed</p>
                  <p className="text-sm text-gray-500">AI provided initial diagnosis</p>
                </div>
              </div>
            )}
            
            {report.doctorNotes && report.doctorNotes.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900">Doctor Review</p>
                  <p className="text-sm text-gray-500">
                    Reviewed by {report.doctorNotes.length} doctor(s)
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}