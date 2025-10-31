'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'

export interface DoctorNoteFormProps {
  reportId: string
  onNoteAdded?: (note: any) => void
  onVerificationComplete?: (status: 'verified' | 'rejected') => void
  className?: string
}

export function DoctorNoteForm({
  reportId,
  onNoteAdded,
  onVerificationComplete,
  className = ''
}: DoctorNoteFormProps) {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // Add doctor note
  const handleAddNote = async (verified = false) => {
    if (!noteText.trim() || !user) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/doctor/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        },
        body: JSON.stringify({
          reportId,
          note: noteText.trim(),
          verified
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add note')
      }

      const data = await response.json()
      
      if (data.success) {
        setNoteText('')
        
        if (onNoteAdded) {
          onNoteAdded(data.data.note)
        }

        logger.info('Doctor note added successfully', { reportId, verified })
      } else {
        throw new Error(data.error?.message || 'Failed to add note')
      }
    } catch (err) {
      logger.error('Failed to add doctor note', err as Error)
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verify or reject report
  const handleVerification = async (status: 'verified' | 'rejected') => {
    if (!user) return

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/doctor/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        },
        body: JSON.stringify({
          reportId,
          status,
          note: noteText.trim() || undefined
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${status} report`)
      }

      const data = await response.json()
      
      if (data.success) {
        if (noteText.trim()) {
          setNoteText('')
        }
        
        if (onVerificationComplete) {
          onVerificationComplete(status)
        }

        logger.info('Report verification completed', { reportId, status })
      } else {
        throw new Error(data.error?.message || `Failed to ${status} report`)
      }
    } catch (err) {
      logger.error('Failed to verify report', err as Error)
      setError((err as Error).message)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Doctor Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
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

        {/* Note Input */}
        <div>
          <label htmlFor="doctor-note" className="block text-sm font-medium text-gray-700 mb-2">
            Professional Notes
          </label>
          <textarea
            id="doctor-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your professional assessment, recommendations, or additional observations..."
            className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting || isVerifying}
          />
          <p className="mt-1 text-xs text-gray-500">
            {noteText.length}/2000 characters
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Add Note Only */}
          <Button
            variant="outline"
            onClick={() => handleAddNote(false)}
            disabled={!noteText.trim() || isSubmitting || isVerifying}
            loading={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Adding Note...' : 'Add Note Only'}
          </Button>

          {/* Verify with Note */}
          <Button
            onClick={() => handleVerification('verified')}
            disabled={isSubmitting || isVerifying}
            loading={isVerifying}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isVerifying ? 'Verifying...' : 'Verify Report'}
          </Button>

          {/* Reject with Note */}
          <Button
            variant="destructive"
            onClick={() => handleVerification('rejected')}
            disabled={isSubmitting || isVerifying}
            className="flex-1"
          >
            Reject Report
          </Button>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">Review Guidelines</h4>
              <div className="mt-1 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Review AI analysis for accuracy and completeness</li>
                  <li>Add professional insights and recommendations</li>
                  <li>Verify if diagnosis aligns with clinical judgment</li>
                  <li>Reject if additional tests or consultation needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setNoteText(prev => prev + 'Recommend follow-up with specialist. ')}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              disabled={isSubmitting || isVerifying}
            >
              + Specialist referral
            </button>
            <button
              onClick={() => setNoteText(prev => prev + 'Additional tests recommended. ')}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              disabled={isSubmitting || isVerifying}
            >
              + Additional tests
            </button>
            <button
              onClick={() => setNoteText(prev => prev + 'Monitor symptoms and return if worsening. ')}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              disabled={isSubmitting || isVerifying}
            >
              + Monitor symptoms
            </button>
            <button
              onClick={() => setNoteText(prev => prev + 'Diagnosis confirmed based on clinical presentation. ')}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              disabled={isSubmitting || isVerifying}
            >
              + Confirm diagnosis
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}