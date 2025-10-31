'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DoctorNoteForm } from '@/components/doctor/DoctorNoteForm'
import { api } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { formatDate, getStatusColor, getStatusDisplayName } from '@/lib/utils'

export default function DoctorReportReviewPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = params?.id as string
  
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (reportId) {
      loadReport()
    }
  }, [reportId])

  const loadReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/api/diagnose/${reportId}`)

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
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (status: 'verified' | 'rejected') => {
    setVerifying(true)
    setError(null)

    try {
      const response = await api.post('/api/doctor/verify', {
        reportId,
        status
      })

      if (!response.ok) {
        throw new Error('Failed to verify report')
      }

      const data = await response.json()

      if (data.success) {
        logger.info('Report verified successfully', { reportId, status })
        router.push('/doctor/dashboard')
      } else {
        throw new Error(data.error?.message || 'Failed to verify report')
      }
    } catch (err) {
      logger.error('Failed to verify report', err as Error)
      setError(err instanceof Error ? err.message : 'Failed to verify report')
    } finally {
      setVerifying(false)
    }
  }

  const handleNoteAdded = () => {
    // Reload report to show new note
    loadReport()
  }

  return (
    <ProtectedRoute requiredRole="doctor">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                <p className="text-sm text-gray-600">Loading report...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {!loading && report && (
            <div className="space-y-6">
              {/* Report Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Report Review</CardTitle>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
                      {getStatusDisplayName(report.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Submitted: {formatDate(report.created_at)}
                  </p>
                </CardHeader>
              </Card>

              {/* Patient Symptoms */}
              <Card>
                <CardHeader>
                  <CardTitle>Patient Symptoms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{report.symptoms}</p>
                </CardContent>
              </Card>

              {/* Medical Image */}
              {report.image_url && (
                <Card>
                  <CardHeader>
                    <CardTitle>Medical Image</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={report.image_url}
                      alt="Medical image"
                      className="max-w-full h-auto rounded-lg border border-gray-200"
                    />
                  </CardContent>
                </Card>
              )}

              {/* AI Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {report.ai_output?.diagnosis && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Diagnosis:</h4>
                        <p className="text-gray-700">{report.ai_output.diagnosis}</p>
                      </div>
                    )}
                    {report.ai_output?.recommendations && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Recommendations:</h4>
                        <p className="text-gray-700">{report.ai_output.recommendations}</p>
                      </div>
                    )}
                    {report.ai_output?.confidence && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Confidence:</h4>
                        <p className="text-gray-700">{report.ai_output.confidence}%</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Doctor Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Doctor Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.doctor_notes && report.doctor_notes.length > 0 ? (
                    <div className="space-y-4 mb-6">
                      {report.doctor_notes.map((note: any) => (
                        <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {formatDate(note.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mb-6">No notes yet</p>
                  )}

                  <DoctorNoteForm reportId={reportId} onNoteAdded={handleNoteAdded} />
                </CardContent>
              </Card>

              {/* Verification Actions */}
              {report.status === 'pending' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Verification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleVerify('verified')}
                        disabled={verifying}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {verifying ? 'Verifying...' : 'Verify Report'}
                      </Button>
                      <Button
                        onClick={() => handleVerify('rejected')}
                        disabled={verifying}
                        variant="outline"
                        className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                      >
                        {verifying ? 'Rejecting...' : 'Reject Report'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Back Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push('/doctor/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
