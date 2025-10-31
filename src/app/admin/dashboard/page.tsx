'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { Navbar } from '@/components/Navbar'

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <AdminDashboard />
        </div>
      </div>
    </ProtectedRoute>
  )
}