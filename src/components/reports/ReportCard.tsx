'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  formatDate, 
  formatRelativeTime, 
  getStatusColor, 
  getStatusDisplayName,
  getConfidenceColor,
  truncateText 
} from '@/lib/utils'
import { ReportWithDetails } from '@/lib/report-service'
import { ProcessedDiagnosisResult } from '@/lib/ai-response-processor'

export interface ReportCardProps {
  report: ReportWithDetails
  showPatientInfo?: boolean
  onStatusUpdate?: (reportId: string, status: string) => void
  className?: string
}

export function ReportCard({ 
  report, 
  showPatientInfo = false, 
  onStatusUpdate,
  className = '' 
}: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const aiAnalysis = report.ai_output as ProcessedDiagnosisResult
  const primaryDiagnosis = aiAnalysis?.diagnoses?.[0]
  const hasImage = !!report.image_url
  const hasNotes = report.doctorNotes && report.doctorNotes.length > 0

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return (
          <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'urgent':
        return (
          <svg className="h-4 w-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <span>Medical Report</span>
              {aiAnalysis?.urgencyLevel && getUrgencyIcon(aiAnalysis.urgencyLevel)}
              {aiAnalysis?.requiresImmediateAttention && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Immediate Attention
                </span>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>{formatRelativeTime(report.created_at)}</span>
              {showPatientInfo && report.patient && (
                <span>Patient: {report.patient.name}</span>
              )}
              {hasImage && (
                <span className="inline-flex items-center gap-1">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  Image
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
              {getStatusDisplayName(report.status)}
            </span>
            
            {aiAnalysis?.overallRisk && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskBadgeColor(aiAnalysis.overallRisk)}`}>
                {aiAnalysis.overallRisk.charAt(0).toUpperCase() + aiAnalysis.overallRisk.slice(1)} Risk
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Symptoms */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Symptoms</h4>
          <p className="text-sm text-gray-700">
            {isExpanded ? report.symptoms : truncateText(report.symptoms, 150)}
            {report.symptoms.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        </div>

        {/* Primary Diagnosis */}
        {primaryDiagnosis && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Primary Diagnosis</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-900">{primaryDiagnosis.condition}</span>
                <span className={`text-sm font-medium ${getConfidenceColor(primaryDiagnosis.confidence)}`}>
                  {Math.round(primaryDiagnosis.confidence * 100)}% confidence
                </span>
              </div>
              {primaryDiagnosis.description && (
                <p className="text-sm text-blue-800">{primaryDiagnosis.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-blue-700">
                <span>Severity: {primaryDiagnosis.severity}</span>
                {primaryDiagnosis.category && (
                  <span>Category: {primaryDiagnosis.category}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additional Diagnoses */}
        {aiAnalysis?.diagnoses && aiAnalysis.diagnoses.length > 1 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Additional Considerations ({aiAnalysis.diagnoses.length - 1})
            </h4>
            <div className="space-y-2">
              {aiAnalysis.diagnoses.slice(1, 3).map((diagnosis, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{diagnosis.condition}</span>
                    <span className="text-xs text-gray-600">
                      {Math.round(diagnosis.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              {aiAnalysis.diagnoses.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{aiAnalysis.diagnoses.length - 3} more diagnoses
                </p>
              )}
            </div>
          </div>
        )}

        {/* Doctor Notes */}
        {hasNotes && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Doctor Notes</h4>
            <div className="space-y-2">
              {report.doctorNotes.slice(0, 2).map((note, index) => (
                <div key={note.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-green-900">
                      {note.doctor?.name || 'Doctor'}
                    </span>
                    <div className="flex items-center gap-2">
                      {note.verified && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                      <span className="text-xs text-green-700">
                        {formatRelativeTime(note.created_at)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-green-800">{note.note}</p>
                </div>
              ))}
              {report.doctorNotes.length > 2 && (
                <p className="text-xs text-gray-500">
                  +{report.doctorNotes.length - 2} more notes
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>ID: {report.id.slice(0, 8)}</span>
            <span>Created: {formatDate(report.created_at)}</span>
            {aiAnalysis?.qualityScore && (
              <span>Quality: {Math.round(aiAnalysis.qualityScore)}/100</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/dashboard/reports/${report.id}`}>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </Link>
            
            {onStatusUpdate && report.status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusUpdate(report.id, 'reviewed')}
              >
                Mark Reviewed
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}