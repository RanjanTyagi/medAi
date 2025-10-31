'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuditLogsViewer } from '@/components/admin/AuditLogsViewer'
import { Navbar } from '@/components/Navbar'

export default function AdminAuditLogsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <AuditLogsViewer />
        </div>
      </div>
    </ProtectedRoute>
  )
}
