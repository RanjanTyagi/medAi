'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ApiTestPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    const testResults: any = {}

    try {
      // Test 1: Auth check
      console.log('Testing auth check...')
      const authResponse = await apiClient('/api/debug/auth-check')
      testResults.authCheck = await authResponse.json()

      // Test 2: Reports API
      console.log('Testing reports API...')
      const reportsResponse = await apiClient('/api/reports?limit=5')
      if (reportsResponse.ok) {
        testResults.reports = await reportsResponse.json()
      } else {
        testResults.reports = {
          error: true,
          status: reportsResponse.status,
          statusText: reportsResponse.statusText,
          body: await reportsResponse.text()
        }
      }

      // Test 3: Stats API
      console.log('Testing stats API...')
      const statsResponse = await apiClient('/api/reports/stats')
      if (statsResponse.ok) {
        testResults.stats = await statsResponse.json()
      } else {
        testResults.stats = {
          error: true,
          status: statsResponse.status,
          statusText: statsResponse.statusText,
          body: await statsResponse.text()
        }
      }

      setResults(testResults)
    } catch (error) {
      console.error('Test error:', error)
      testResults.error = String(error)
      setResults(testResults)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">API Debug Test</h1>
      
      <Card className="p-6 mb-6">
        <Button onClick={runTests} loading={loading} disabled={loading}>
          Run API Tests
        </Button>
      </Card>

      {results && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
            {JSON.stringify(results, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
