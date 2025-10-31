'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function VerifyEmailPage() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const type = searchParams.get('type')

    if (token && type === 'signup') {
      // Handle email verification
      handleEmailVerification(token)
    }
  }, [searchParams])

  const handleEmailVerification = async (token: string) => {
    setVerificationStatus('loading')
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup'
      })

      if (error) {
        throw error
      }

      setVerificationStatus('success')
      setMessage('Your email has been verified successfully!')
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      setVerificationStatus('error')
      setMessage('Failed to verify email. The link may be expired or invalid.')
      console.error('Email verification error:', error)
    }
  }

  const resendVerification = async () => {
    // This would need the user's email - for now, redirect to login
    router.push('/auth/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Email Verification
          </h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {verificationStatus === 'pending' && 'Check Your Email'}
              {verificationStatus === 'loading' && 'Verifying...'}
              {verificationStatus === 'success' && 'Verification Successful!'}
              {verificationStatus === 'error' && 'Verification Failed'}
            </CardTitle>
            <CardDescription>
              {verificationStatus === 'pending' && 'We sent you a verification link'}
              {verificationStatus === 'loading' && 'Please wait while we verify your email'}
              {verificationStatus === 'success' && 'Your account is now active'}
              {verificationStatus === 'error' && 'There was a problem verifying your email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {verificationStatus === 'pending' && (
              <div className="text-center space-y-4">
                <div className="rounded-md bg-blue-50 p-4">
                  <div className="text-sm text-blue-700">
                    We've sent a verification link to your email address. 
                    Please check your inbox and click the link to activate your account.
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  <p>Didn't receive the email? Check your spam folder or</p>
                  <button
                    onClick={resendVerification}
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    try signing in again
                  </button>
                </div>
              </div>
            )}

            {verificationStatus === 'loading' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Verifying your email...</p>
              </div>
            )}

            {verificationStatus === 'success' && (
              <div className="text-center space-y-4">
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">
                    {message}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Redirecting you to the dashboard...
                </p>
              </div>
            )}

            {verificationStatus === 'error' && (
              <div className="space-y-4">
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">
                    {message}
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Button
                    onClick={resendVerification}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            )}

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}