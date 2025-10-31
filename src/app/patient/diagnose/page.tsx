'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { api } from '@/lib/api-client'
import { logger } from '@/lib/logger'

export default function DiagnosePage() {
  const router = useRouter()
  const [symptoms, setSymptoms] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!symptoms.trim()) {
      setError('Please describe your symptoms')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let imageUrl = null

      // Upload image if provided
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)

        const uploadResponse = await api.post('/api/upload', formData, {
          headers: {
            // Don't set Content-Type, let browser set it with boundary
          } as any
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const uploadData = await uploadResponse.json()
        if (uploadData.success) {
          imageUrl = uploadData.data.url
        }
      }

      // Submit diagnosis request
      const response = await api.post('/api/diagnose', {
        symptoms,
        imageUrl
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to submit diagnosis request')
      }

      const data = await response.json()

      if (data.success) {
        logger.info('Diagnosis request submitted successfully', {
          reportId: data.data.report.id
        })
        
        // Redirect to patient dashboard
        router.push('/patient/dashboard')
      } else {
        throw new Error(data.error?.message || 'Failed to submit diagnosis request')
      }
    } catch (err) {
      logger.error('Failed to submit diagnosis request', err as Error)
      setError(err instanceof Error ? err.message : 'Failed to submit diagnosis request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute requiredRole="patient">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Submit Symptoms for Diagnosis</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Describe your symptoms and optionally upload medical images for AI analysis
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Symptoms Input */}
                <div>
                  <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700 mb-2">
                    Symptoms Description *
                  </label>
                  <textarea
                    id="symptoms"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe your symptoms in detail... (e.g., fever, headache, cough)"
                    className="w-full min-h-[150px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Be as specific as possible about your symptoms, duration, and severity
                  </p>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medical Images (Optional)
                  </label>
                  <FileUpload
                    onFileSelect={(files) => setImageFile(files[0] || null)}
                    accept="image/*,.pdf"
                    maxSize={10 * 1024 * 1024} // 10MB
                    maxFiles={1}
                    multiple={false}
                    disabled={loading}
                  />
                  {imageFile && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ File selected: {imageFile.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Upload X-rays, test results, or other relevant medical images (Max 10MB)
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Our AI will analyze your symptoms and images</li>
                    <li>You'll receive a preliminary diagnosis report</li>
                    <li>A licensed doctor will review and verify the analysis</li>
                    <li>You'll be notified when the final report is ready</li>
                  </ol>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={loading || !symptoms.trim()}
                    className="flex-1"
                  >
                    {loading ? 'Submitting...' : 'Submit for Diagnosis'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/patient/dashboard')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
