'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { VerificationQueue } from '@/components/doctor/VerificationQueue'
import { DoctorStats } from '@/components/doctor/DoctorStats'
import { Navbar } from '@/components/Navbar'

export default function DoctorDashboardPage() {
  return (
    <ProtectedRoute requiredRole="doctor">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Review and verify patient diagnoses
            </p>
          </div>

          <div className="space-y-8">
            <DoctorStats />
            <VerificationQueue />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}