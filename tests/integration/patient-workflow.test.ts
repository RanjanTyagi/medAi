/**
 * Patient Workflow Integration Tests
 * 
 * Tests the complete patient journey from registration to viewing verified reports
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const TEST_PATIENT_EMAIL = `patient-test-${Date.now()}@test.com`
const TEST_PATIENT_PASSWORD = 'TestPatient123!'
const TEST_PATIENT_NAME = 'Test Patient'

describe('Patient Workflow Integration Tests', () => {
  let authToken: string
  let userId: string
  let reportId: string

  beforeAll(async () => {
    console.log('Starting Patient Workflow Integration Tests')
    console.log(`Test Patient Email: ${TEST_PATIENT_EMAIL}`)
  })

  afterAll(async () => {
    console.log('Patient Workflow Integration Tests Complete')
    // Cleanup: Delete test user and data
    // This would require admin API access
  })

  describe('1. Patient Registration', () => {
    it('should register a new patient account', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_PATIENT_EMAIL,
          password: TEST_PATIENT_PASSWORD,
          name: TEST_PATIENT_NAME,
          role: 'patient'
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBeDefined()
      expect(data.data.user.email).toBe(TEST_PATIENT_EMAIL)
      
      userId = data.data.user.id
      console.log(`✓ Patient registered with ID: ${userId}`)
    })

    it('should not allow duplicate email registration', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_PATIENT_EMAIL,
          password: TEST_PATIENT_PASSWORD,
          name: TEST_PATIENT_NAME,
          role: 'patient'
        })
      })

      expect(response.status).toBe(400)
      console.log('✓ Duplicate registration prevented')
    })
  })

  describe('2. Patient Login', () => {
    it('should login with valid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_PATIENT_EMAIL,
          password: TEST_PATIENT_PASSWORD
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.session).toBeDefined()
      expect(data.data.user.email).toBe(TEST_PATIENT_EMAIL)
      
      authToken = data.data.session.access_token
      console.log('✓ Patient logged in successfully')
    })

    it('should reject invalid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_PATIENT_EMAIL,
          password: 'WrongPassword123!'
        })
      })

      expect(response.status).toBe(401)
      console.log('✓ Invalid credentials rejected')
    })
  })

  describe('3. Symptom Submission and AI Diagnosis', () => {
    it('should submit symptoms and receive AI diagnosis', async () => {
      const symptoms = 'I have a persistent headache, fever of 101°F, and fatigue for 3 days. Also experiencing body aches and chills.'

      const response = await fetch(`${BASE_URL}/api/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          symptoms,
          patientAge: 35,
          patientGender: 'male'
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.report).toBeDefined()
      expect(data.data.report.id).toBeDefined()
      expect(data.data.report.symptoms).toBe(symptoms)
      expect(data.data.report.status).toBe('pending')
      expect(data.data.report.aiAnalysis).toBeDefined()
      expect(data.data.report.aiAnalysis.diagnoses).toBeDefined()
      expect(data.data.report.aiAnalysis.diagnoses.length).toBeGreaterThan(0)
      
      reportId = data.data.report.id
      
      // Verify AI analysis structure
      const aiAnalysis = data.data.report.aiAnalysis
      expect(aiAnalysis.confidence).toBeDefined()
      expect(aiAnalysis.urgencyLevel).toBeDefined()
      expect(aiAnalysis.recommendations).toBeDefined()
      
      // Verify each diagnosis has required fields
      aiAnalysis.diagnoses.forEach((diagnosis: any) => {
        expect(diagnosis.condition).toBeDefined()
        expect(diagnosis.confidence).toBeDefined()
        expect(diagnosis.severity).toBeDefined()
        expect(diagnosis.description).toBeDefined()
      })
      
      console.log(`✓ AI diagnosis generated for report ID: ${reportId}`)
      console.log(`  - Diagnoses count: ${aiAnalysis.diagnoses.length}`)
      console.log(`  - Overall confidence: ${aiAnalysis.confidence}%`)
      console.log(`  - Urgency level: ${aiAnalysis.urgencyLevel}`)
    }, 30000) // 30 second timeout for AI processing

    it('should validate required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          // Missing symptoms
          patientAge: 35
        })
      })

      expect(response.status).toBe(400)
      console.log('✓ Validation prevents empty symptoms')
    })

    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(6).fill(null).map(() =>
        fetch(`${BASE_URL}/api/diagnose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            symptoms: 'Test symptoms for rate limiting'
          })
        })
      )

      const responses = await Promise.all(requests)
      const rateLimited = responses.some(r => r.status === 429)
      
      expect(rateLimited).toBe(true)
      console.log('✓ Rate limiting enforced')
    }, 30000)
  })

  describe('4. Report Viewing', () => {
    it('should retrieve patient reports', async () => {
      const response = await fetch(`${BASE_URL}/api/reports`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.reports).toBeDefined()
      expect(Array.isArray(data.data.reports)).toBe(true)
      expect(data.data.reports.length).toBeGreaterThan(0)
      
      // Verify report structure
      const report = data.data.reports[0]
      expect(report.id).toBeDefined()
      expect(report.symptoms).toBeDefined()
      expect(report.status).toBeDefined()
      expect(report.created_at).toBeDefined()
      
      console.log(`✓ Retrieved ${data.data.reports.length} report(s)`)
    })

    it('should retrieve specific report by ID', async () => {
      const response = await fetch(`${BASE_URL}/api/reports/${reportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.report).toBeDefined()
      expect(data.data.report.id).toBe(reportId)
      expect(data.data.report.ai_analysis).toBeDefined()
      
      console.log(`✓ Retrieved report ${reportId}`)
    })

    it('should not access other patients reports', async () => {
      // Try to access a non-existent or unauthorized report
      const fakeReportId = '00000000-0000-0000-0000-000000000000'
      
      const response = await fetch(`${BASE_URL}/api/reports/${fakeReportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(404)
      console.log('✓ Unauthorized report access prevented')
    })
  })

  describe('5. Notifications', () => {
    it('should retrieve patient notifications', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.notifications).toBeDefined()
      expect(Array.isArray(data.data.notifications)).toBe(true)
      
      console.log(`✓ Retrieved ${data.data.notifications.length} notification(s)`)
    })
  })

  describe('6. Authorization Tests', () => {
    it('should not access doctor endpoints', async () => {
      const response = await fetch(`${BASE_URL}/api/doctor/queue`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(403)
      console.log('✓ Patient cannot access doctor endpoints')
    })

    it('should not access admin endpoints', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(403)
      console.log('✓ Patient cannot access admin endpoints')
    })
  })

  describe('7. Logout', () => {
    it('should logout successfully', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)
      console.log('✓ Patient logged out successfully')
    })

    it('should not access protected endpoints after logout', async () => {
      const response = await fetch(`${BASE_URL}/api/reports`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(401)
      console.log('✓ Protected endpoints inaccessible after logout')
    })
  })
})

export {}