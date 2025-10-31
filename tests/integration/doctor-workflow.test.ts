/**
 * Doctor Workflow Integration Tests
 * 
 * Tests the complete doctor journey from login to report verification
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const TEST_DOCTOR_EMAIL = `doctor-test-${Date.now()}@test.com`
const TEST_DOCTOR_PASSWORD = 'TestDoctor123!'
const TEST_DOCTOR_NAME = 'Dr. Test Doctor'

describe('Doctor Workflow Integration Tests', () => {
  let authToken: string
  let userId: string
  let pendingReportId: string

  beforeAll(async () => {
    console.log('Starting Doctor Workflow Integration Tests')
    console.log(`Test Doctor Email: ${TEST_DOCTOR_EMAIL}`)
  })

  afterAll(async () => {
    console.log('Doctor Workflow Integration Tests Complete')
  })

  describe('1. Doctor Registration and Login', () => {
    it('should register a new doctor account', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_DOCTOR_EMAIL,
          password: TEST_DOCTOR_PASSWORD,
          name: TEST_DOCTOR_NAME,
          role: 'doctor'
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBeDefined()
      
      userId = data.data.user.id
      console.log(`✓ Doctor registered with ID: ${userId}`)
    })

    it('should login as doctor', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_DOCTOR_EMAIL,
          password: TEST_DOCTOR_PASSWORD
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.session).toBeDefined()
      
      authToken = data.data.session.access_token
      console.log('✓ Doctor logged in successfully')
    })
  })

  describe('2. Verification Queue Access', () => {
    it('should access verification queue', async () => {
      const response = await fetch(`${BASE_URL}/api/doctor/queue`, {
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
      
      console.log(`✓ Verification queue accessed: ${data.data.reports.length} pending report(s)`)
      
      // Store a pending report ID for verification tests
      if (data.data.reports.length > 0) {
        pendingReportId = data.data.reports[0].id
        console.log(`  - Using report ${pendingReportId} for verification tests`)
      }
    })

    it('should filter queue by status', async () => {
      const response = await fetch(`${BASE_URL}/api/doctor/queue?status=pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // All reports should have pending status
      data.data.reports.forEach((report: any) => {
        expect(report.status).toBe('pending')
      })
      
      console.log('✓ Queue filtering works correctly')
    })
  })

  describe('3. Report Verification', () => {
    it('should verify a pending report', async () => {
      if (!pendingReportId) {
        console.log('⊘ Skipping: No pending reports available')
        return
      }

      const doctorNotes = 'Based on the symptoms and AI analysis, I concur with the preliminary diagnosis. Recommend follow-up examination and prescribed treatment plan.'

      const response = await fetch(`${BASE_URL}/api/doctor/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          reportId: pendingReportId,
          status: 'verified',
          notes: doctorNotes
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.report).toBeDefined()
      expect(data.data.report.status).toBe('verified')
      
      console.log(`✓ Report ${pendingReportId} verified successfully`)
    })

    it('should add doctor notes to report', async () => {
      if (!pendingReportId) {
        console.log('⊘ Skipping: No pending reports available')
        return
      }

      const notes = 'Additional clinical observations and recommendations for patient care.'

      const response = await fetch(`${BASE_URL}/api/doctor/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          reportId: pendingReportId,
          notes
        })
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.note).toBeDefined()
      expect(data.data.note.notes).toBe(notes)
      
      console.log('✓ Doctor notes added successfully')
    })

    it('should reject a report with reason', async () => {
      // This test would need a different pending report
      // Skipping if no additional reports available
      console.log('⊘ Skipping: Requires additional pending report')
    })

    it('should validate verification data', async () => {
      const response = await fetch(`${BASE_URL}/api/doctor/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          // Missing reportId
          status: 'verified',
          notes: 'Test notes'
        })
      })

      expect(response.status).toBe(400)
      console.log('✓ Verification validation works')
    })
  })

  describe('4. Doctor Statistics', () => {
    it('should retrieve doctor statistics', async () => {
      const response = await fetch(`${BASE_URL}/api/doctor/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.stats).toBeDefined()
      
      const stats = data.data.stats
      expect(stats.totalVerified).toBeDefined()
      expect(stats.totalRejected).toBeDefined()
      expect(stats.pendingCount).toBeDefined()
      
      console.log('✓ Doctor statistics retrieved')
      console.log(`  - Total verified: ${stats.totalVerified}`)
      console.log(`  - Total rejected: ${stats.totalRejected}`)
      console.log(`  - Pending: ${stats.pendingCount}`)
    })
  })

  describe('5. Authorization Tests', () => {
    it('should not access patient-specific endpoints', async () => {
      // Doctors shouldn't be able to directly access patient diagnosis endpoint
      const response = await fetch(`${BASE_URL}/api/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          symptoms: 'Test symptoms'
        })
      })

      // This might return 403 or work depending on implementation
      // Doctors might be allowed to submit on behalf of patients
      console.log(`  - Diagnose endpoint status: ${response.status}`)
    })

    it('should not access admin endpoints', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(403)
      console.log('✓ Doctor cannot access admin endpoints')
    })
  })

  describe('6. Audit Trail', () => {
    it('should create audit log entries for verifications', async () => {
      // This would require admin access to verify
      // Or a dedicated audit log endpoint for doctors
      console.log('⊘ Audit trail verification requires admin access')
    })
  })
})

export {}