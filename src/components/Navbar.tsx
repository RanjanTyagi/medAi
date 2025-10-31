'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { getRoleDisplayName, getRoleColor } from '@/lib/utils'
import { logger } from '@/lib/logger'

export function Navbar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      console.log('🚪 Sign out button clicked')
      logger.info('Sign out initiated', { userId: user?.id })
      
      // Call sign out
      await signOut()
      
      console.log('✅ Sign out successful, redirecting...')
      logger.info('User signed out successfully', { userId: user?.id })
      
      // Clear any local storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Force a hard redirect to clear all state
      window.location.href = '/'
    } catch (error) {
      console.error('❌ Sign out failed:', error)
      logger.error('Sign out error', error as Error)
      
      // Even if sign out fails, clear local state and redirect
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
      }
    }
  }

  const navigation = getNavigationItems(user?.role)

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Logo and main navigation */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                MedAssist AI
              </Link>
            </div>
            
            {user && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Role badge */}
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColor(user.role)}`}>
                  {getRoleDisplayName(user.role)}
                </span>

                {/* User info */}
                <div className="hidden sm:flex sm:items-center sm:space-x-4">
                  <span className="text-sm text-gray-700">
                    Welcome, {user.name}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </Button>
                </div>

                {/* Mobile menu button */}
                <button
                  type="button"
                  className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <span className="sr-only">Open main menu</span>
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Sign in
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && user && (
        <div className="sm:hidden">
          <div className="space-y-1 pb-3 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColor(user.role)}`}>
                    {getRoleDisplayName(user.role)}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{user.name}</div>
                  <div className="text-sm font-medium text-gray-500">{user.email}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <button
                  onClick={handleSignOut}
                  className="block w-full px-4 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// Helper function to get navigation items based on user role
function getNavigationItems(role?: string) {
  const items: { name: string; href: string }[] = []

  if (role === 'patient') {
    items.push(
      { name: 'Dashboard', href: '/patient/dashboard' },
      { name: 'New Report', href: '/patient/new-report' },
      { name: 'My Reports', href: '/patient/reports' }
    )
  }

  if (role === 'doctor') {
    items.push(
      { name: 'Dashboard', href: '/doctor/dashboard' },
      { name: 'Verification Queue', href: '/doctor/queue' },
      { name: 'Patients', href: '/doctor/patients' }
    )
  }

  if (role === 'admin') {
    items.push(
      { name: 'Dashboard', href: '/admin/dashboard' },
      { name: 'Users', href: '/admin/users' },
      { name: 'Analytics', href: '/admin/analytics' },
      { name: 'System Health', href: '/admin/health' }
    )
  }

  return items
}