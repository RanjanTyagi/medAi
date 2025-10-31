'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard'
import { logger } from '@/lib/logger'

export default function AdminAnalyticsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user || !profile) {
        router.push('/auth/login')
        return
      }

      if (profile.role !== 'admin') {
        logger.warn('Unauthorized access attempt to admin analytics', { 
          userId: user.id, 
          role: profile.role 
        })
        router.push('/dashboard')
        return
      }

      setAuthorized(true)
    }
  }, [user, profile, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Checking authorization...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnalyticsDashboard />
        </div>
      </div>
    </ProtectedRoute>
  )
}