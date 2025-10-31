'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  formatDate, 
  getStatusColor, 
  getStatusDisplayName,
  getConfidenceColor 
} from '@/lib/utils'
import { ReportWithDetails } from '@/lib/report-service'
import { ProcessedDiagnosisResult } from '@/lib/ai-response-processor'

export interface ReportDetailsProps {
  report: ReportWithDetails
  showPatientInfo?: boolean
  onStatusUpdate?: (status: string) => void
  onAddNote?: (note: string) => void
  className?: string
}

export function ReportDetails({
  report,
  showPatientInfo = false,
  onStatusUpdate,
  onAddNote,
  className = ''
}: ReportDetailsProps) {
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const aiAnalysis = report.ai_output as ProcessedDiagnosisResult

  const handleAddNote = async () => {
    if (!noteText.trim() || !onAddNote) return

    setIsSubmitting(true)
    try {
      await onAddNote(noteText.trim())
      setNoteText('')
      setShowAddNote(false)
    } catch (error) {
      console.error('Failed to add note:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Medical Report Details
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span>Report ID: {report.id}</span>
                <span>Created: {formatDate(report.created_at)}</span>
                {report.updated_at !== report.created_at && (
                  <span>Updated: {formatDate(report.updated_at)}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
                {getStatusDisplayName(report.status)}
              </span>
              
              {aiAnalysis?.overallRisk && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRiskBadgeColor(aiAnalysis.overallRisk)}`}>
                  {aiAnalysis.overallRisk.charAt(0).toUpperCase() + aiAnalysis.overallRisk.slice(1)} Risk
                </span>
              )}

              {aiAnalysis?.requiresImmediateAttention && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  Immediate Attention Required
                </span>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Patient Information */}
      {showPatientInfo && report.patient && (
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{report.patient.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{report.patient.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Symptoms */}
      <Card>
        <CardHeader>
          <CardTitle>Reported Symptoms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-900 whitespace-pre-wrap">{report.symptoms}</p>
        </CardContent>
      </Card>

      {/* Medical Image */}
      {report.image_url && (
        <Card>
          <CardHeader>
            <CardTitle>Medical Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl">
              <img
                src={report.image_url}
                alt="Medical scan"
                className="w-full h-auto rounded-lg border border-gray-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-medical-image.png'
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Assessment */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Overall Assessment</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Confidence Level:</span>
                  <span className={`ml-2 font-medium ${getConfidenceColor(aiAnalysis.confidence)}`}>
                    {aiAnalysis.confidenceLevel} ({Math.round(aiAnalysis.confidence * 100)}%)
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Urgency:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {aiAnalysis.urgencyLevel.charAt(0).toUpperCase() + aiAnalysis.urgencyLevel.slice(1)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Quality Score:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {Math.round(aiAnalysis.qualityScore)}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnoses */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Possible Diagnoses</h4>
              <div className="space-y-3">
                {aiAnalysis.diagnoses.map((diagnosis, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h5 className={`font-medium ${index === 0 ? 'text-blue-900' : 'text-gray-900'}`}>
                        {index === 0 ? 'Primary: ' : `${index + 1}. `}{diagnosis.condition}
                      </h5>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`font-medium ${getConfidenceColor(diagnosis.confidence)}`}>
                          {Math.round(diagnosis.confidence * 100)}%
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          diagnosis.severity === 'severe' ? 'bg-red-100 text-red-800' :
                          diagnosis.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {diagnosis.severity}
                        </span>
                      </div>
                    </div>
                    
                    {diagnosis.description && (
                      <p className={`text-sm mb-2 ${index === 0 ? 'text-blue-800' : 'text-gray-700'}`}>
                        {diagnosis.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs">
                      <span className={index === 0 ? 'text-blue-700' : 'text-gray-600'}>
                        Category: {diagnosis.category}
                      </span>
                      <span className={index === 0 ? 'text-blue-700' : 'text-gray-600'}>
                        Risk: {diagnosis.riskLevel}
                      </span>
                      <span className={index === 0 ? 'text-blue-700' : 'text-gray-600'}>
                        Commonality: {diagnosis.commonality}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
              <div className="space-y-2">
                {aiAnalysis.processedRecommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      rec.priority === 'high' ? 'bg-red-500' :
                      rec.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-green-800">{rec.text}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-green-700">
                        <span>Type: {rec.type}</span>
                        <span>Priority: {rec.priority}</span>
                        <span>Category: {rec.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Flags */}
            {(aiAnalysis as any).redFlags && (aiAnalysis as any).redFlags.length > 0 && (
              <div>
                <h4 className="font-medium text-red-900 mb-3">⚠️ Important Warnings</h4>
                <div className="space-y-2">
                  {(aiAnalysis as any).redFlags.map((flag: string, index: number) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{flag}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Doctor Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Doctor Notes ({report.doctorNotes.length})</CardTitle>
            {onAddNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddNote(!showAddNote)}
              >
                Add Note
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Add Note Form */}
          {showAddNote && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add your professional note..."
                className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || isSubmitting}
                  loading={isSubmitting}
                >
                  Add Note
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddNote(false)
                    setNoteText('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Existing Notes */}
          {report.doctorNotes.length > 0 ? (
            <div className="space-y-4">
              {report.doctorNotes.map((note) => (
                <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {note.doctor?.name || 'Doctor'}
                      </h5>
                      <p className="text-sm text-gray-600">{note.doctor?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.verified && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-900 whitespace-pre-wrap">{note.note}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No doctor notes yet. {onAddNote && 'Add the first note above.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {onStatusUpdate && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {report.status === 'pending' && (
                <>
                  <Button
                    onClick={() => onStatusUpdate('reviewed')}
                    variant="outline"
                  >
                    Mark as Reviewed
                  </Button>
                  <Button
                    onClick={() => onStatusUpdate('verified')}
                  >
                    Verify Report
                  </Button>
                  <Button
                    onClick={() => onStatusUpdate('rejected')}
                    variant="destructive"
                  >
                    Reject Report
                  </Button>
                </>
              )}
              
              {report.status === 'reviewed' && (
                <>
                  <Button
                    onClick={() => onStatusUpdate('verified')}
                  >
                    Verify Report
                  </Button>
                  <Button
                    onClick={() => onStatusUpdate('rejected')}
                    variant="destructive"
                  >
                    Reject Report
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}