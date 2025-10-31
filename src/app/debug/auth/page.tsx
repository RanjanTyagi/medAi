'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { apiClient } from '@/lib/api-client'

export default function AuthDebugPage() {
  const [authState, setAuthState] = useState<any>(null)
  const [apiTest, setApiTest] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    setLoading(true)
    
    // Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Check user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    setAuthState({
      session: session ? {
        access_token: session.access_token ? '✓ Present' : '✗ Missing',
        refresh_token: session.refresh_token ? '✓ Present' : '✗ Missing',
        expires_at: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A',
        user_id: session.user?.id || 'N/A'
      } : null,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'N/A'
      } : null,
      errors: {
        sessionError: sessionError?.message || null,
        userError: userError?.message || null
      }
    })
    
    setLoading(false)
  }

  async function testApiCall() {
    setApiTest({ loading: true })
    
    try {
      const response = await apiClient('/api/reports/stats')
      const data = await response.json()
      
      setApiTest({
        loading: false,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data
      })
    } catch (error: any) {
      setApiTest({
        loading: false,
        success: false,
        error: error.message
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Authentication Debug</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Authentication Debug</h1>
        
        {/* Session Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Session Status</h2>
          {authState?.session ? (
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✓ Session Active</p>
              <div className="bg-gray-50 p-4 rounded">
                <p><strong>Access Token:</strong> {authState.session.access_token}</p>
                <p><strong>Refresh Token:</strong> {authState.session.refresh_token}</p>
                <p><strong>Expires At:</strong> {authState.session.expires_at}</p>
                <p><strong>User ID:</strong> {authState.session.user_id}</p>
              </div>
            </div>
          ) : (
            <p className="text-red-600 font-semibold">✗ No Active Session</p>
          )}
          
          {authState?.errors?.sessionError && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
              <strong>Session Error:</strong> {authState.errors.sessionError}
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Status</h2>
          {authState?.user ? (
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✓ User Authenticated</p>
              <div className="bg-gray-50 p-4 rounded">
                <p><strong>ID:</strong> {authState.user.id}</p>
                <p><strong>Email:</strong> {authState.user.email}</p>
                <p><strong>Role:</strong> {authState.user.role}</p>
              </div>
            </div>
          ) : (
            <p className="text-red-600 font-semibold">✗ No User Found</p>
          )}
          
          {authState?.errors?.userError && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
              <strong>User Error:</strong> {authState.errors.userError}
            </div>
          )}
        </div>

        {/* API Test */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API Test</h2>
          <button
            onClick={testApiCall}
            disabled={apiTest?.loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {apiTest?.loading ? 'Testing...' : 'Test API Call'}
          </button>
          
          {apiTest && !apiTest.loading && (
            <div className="mt-4">
              {apiTest.success ? (
                <div className="p-4 bg-green-50 text-green-700 rounded">
                  <p className="font-semibold">✓ API Call Successful</p>
                  <p className="text-sm mt-2">Status: {apiTest.status} {apiTest.statusText}</p>
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(apiTest.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-4 bg-red-50 text-red-700 rounded">
                  <p className="font-semibold">✗ API Call Failed</p>
                  {apiTest.status && (
                    <p className="text-sm mt-2">Status: {apiTest.status} {apiTest.statusText}</p>
                  )}
                  {apiTest.error && (
                    <p className="text-sm mt-2">Error: {apiTest.error}</p>
                  )}
                  {apiTest.data && (
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(apiTest.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={checkAuth}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Refresh Status
            </button>
            <a
              href="/auth/login"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Go to Login
            </a>
            <a
              href="/dashboard"
              className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Go to Dashboard
            </a>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Troubleshooting Tips:</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
            <li>If no session: Log in at /auth/login</li>
            <li>If session expired: Log out and log back in</li>
            <li>If API test fails with 401: Authentication issue</li>
            <li>If API test fails with 500: Server/database issue</li>
            <li>Check browser console for detailed logs</li>
            <li>Check server terminal for API errors</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
