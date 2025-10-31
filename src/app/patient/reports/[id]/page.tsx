'use client'

import { useRouter, useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ReportDetailView } from '@/components/patient/ReportDetailView'

export default function ReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = params?.id as string

  if (!reportId) {
    return (
      <ProtectedRoute requiredRole="patient">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-red-600">Invalid report ID</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="patient">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <ReportDetailView reportId={reportId} />
        </div>
      </div>
    </ProtectedRoute>
  )
}
