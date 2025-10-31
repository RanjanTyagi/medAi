'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { UserRole } from '@/types'
import { logger } from '@/lib/logger'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  redirectTo?: string
  fallback?: React.ReactNode
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = '/auth/login',
  fallback 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // If no user is logged in, redirect to login
    if (!user) {
      logger.info('Unauthorized access attempt', { redirectTo })
      router.push(redirectTo)
      return
    }

    // If a specific role is required, check if user has it
    if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
      logger.warn('Insufficient permissions', { 
        userRole: user.role, 
        requiredRole,
        userId: user.id 
      })
      router.push('/dashboard') // Redirect to default dashboard
      return
    }
  }, [user, loading, requiredRole, redirectTo, router])

  // Show loading state
  if (loading) {
    return fallback || <LoadingSpinner />
  }

  // Show nothing while redirecting
  if (!user) {
    return null
  }

  // Check role permissions
  if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
    return null
  }

  return <>{children}</>
}

// Helper function to check role permissions
function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  // Admin has access to everything
  if (userRole === 'admin') return true
  
  // Exact role match
  if (userRole === requiredRole) return true
  
  // Doctor can access patient routes (for viewing patient data)
  if (userRole === 'doctor' && requiredRole === 'patient') return true
  
  return false
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

// Role-based wrapper component
interface RoleGateProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export function RoleGate({ children, allowedRoles, fallback }: RoleGateProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return fallback || <LoadingSpinner />
  }

  if (!user || !allowedRoles.some(role => hasRequiredRole(user.role, role))) {
    return fallback || (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-600">
            You don&apos;t have permission to view this content.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Hook for checking permissions in components
export function usePermissions() {
  const { user } = useAuth()

  return {
    isAdmin: user?.role === 'admin',
    isDoctor: user?.role === 'doctor' || user?.role === 'admin',
    isPatient: user?.role === 'patient',
    hasRole: (role: UserRole) => user ? hasRequiredRole(user.role, role) : false,
    canAccess: (allowedRoles: UserRole[]) => 
      user ? allowedRoles.some(role => hasRequiredRole(user.role, role)) : false,
  }
}