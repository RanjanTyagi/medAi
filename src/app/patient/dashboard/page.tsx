'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PatientDashboard } from '@/components/patient/PatientDashboard'
import { Navbar } from '@/components/Navbar'

export default function PatientDashboardPage() {
  return (
    <ProtectedRoute requiredRole="patient">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <PatientDashboard />
        </div>
      </div>
    </ProtectedRoute>
  )
}