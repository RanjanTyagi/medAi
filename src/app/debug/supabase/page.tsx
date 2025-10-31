'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SupabaseDebugPage() {
  const [status, setStatus] = useState<any>({
    loading: true,
    envVars: {
      url: null,
      anonKey: null
    },
    connection: null,
    session: null,
    error: null
  })

  useEffect(() => {
    checkSupabase()
  }, [])

  async function checkSupabase() {
    const result: any = {
      loading: false,
      envVars: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (hidden)' : 'MISSING'
      },
      connection: 'Testing...',
      session: null,
      error: null
    }

    try {
      // Test 1: Check environment variables
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        result.error = 'Environment variables are missing!'
        result.connection = 'FAILED - Missing env vars'
        setStatus(result)
        return
      }

      // Test 2: Try to get session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        result.error = sessionError.message
        result.connection = 'FAILED - ' + sessionError.message
      } else {
        result.connection = 'SUCCESS'
        result.session = sessionData.session ? {
          user_id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          expires_at: new Date(sessionData.session.expires_at! * 1000).toLocaleString()
        } : 'No active session'
      }

      // Test 3: Try a simple query
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (testError) {
        result.dbTest = 'FAILED - ' + testError.message
      } else {
        result.dbTest = 'SUCCESS - Database accessible'
      }

    } catch (error: any) {
      result.error = error.message
      result.connection = 'FAILED - ' + error.message
    }

    setStatus(result)
  }

  if (status.loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>
          <p>Testing...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>

        {/* Environment Variables */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</span>
              <span className={status.envVars.url === 'MISSING' ? 'text-red-600' : 'text-green-600'}>
                {status.envVars.url}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
              <span className={status.envVars.anonKey === 'MISSING' ? 'text-red-600' : 'text-green-600'}>
                {status.envVars.anonKey}
              </span>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className={`p-4 rounded ${status.connection.includes('SUCCESS') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-semibold">{status.connection}</p>
          </div>
        </div>

        {/* Database Test */}
        {status.dbTest && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Database Test</h2>
            <div className={`p-4 rounded ${status.dbTest.includes('SUCCESS') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="font-semibold">{status.dbTest}</p>
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Session Info</h2>
          {status.session && typeof status.session === 'object' ? (
            <div className="bg-green-50 p-4 rounded">
              <p className="text-green-800 font-semibold mb-2">✓ User Logged In</p>
              <div className="text-sm space-y-1">
                <p><strong>User ID:</strong> {status.session.user_id}</p>
                <p><strong>Email:</strong> {status.session.email}</p>
                <p><strong>Expires:</strong> {status.session.expires_at}</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-600">No active session - User not logged in</p>
            </div>
          )}
        </div>

        {/* Error Details */}
        {status.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Error Details</h2>
            <pre className="text-sm text-red-800 whitespace-pre-wrap">{status.error}</pre>
          </div>
        )}

        {/* Troubleshooting */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Troubleshooting</h2>
          <ul className="list-disc list-inside text-blue-800 space-y-2 text-sm">
            <li>If env vars are missing: Check .env.local file exists in ai-med-diagnosis folder</li>
            <li>If connection fails: Verify Supabase project is running at supabase.com</li>
            <li>If database test fails: Run migrations in Supabase SQL Editor</li>
            <li>If no session: This is normal if you're not logged in</li>
            <li>Restart dev server after changing .env.local: npm run dev</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={checkSupabase}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retest Connection
          </button>
          <a
            href="/auth/login"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Go to Login
          </a>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}
