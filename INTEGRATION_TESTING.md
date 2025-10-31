# Integration Testing Guide

This document provides comprehensive integration testing procedures for the AI Medical Diagnosis Assistant platform.

## Overview

Integration testing ensures that all components of the system work together correctly across different user roles and workflows.

## Prerequisites

Before running integration tests:

1. **Environment Setup**
   - Ensure `.env.local` is configured with valid credentials
   - Supabase project is running and accessible
   - All database migrations have been applied
   - Storage buckets are configured with proper policies

2. **Test Data**
   - Create test users for each role (patient, doctor, admin)
   - Prepare sample medical images for testing
   - Have test symptom descriptions ready

3. **Dependencies**
   - Run `npm install` to ensure all packages are installed
   - Verify Gemini API key is valid and has quota

## Test Scenarios

### 1. Patient Workflow Integration Test

#### 1.1 Patient Registration and Login
**Objective:** Verify patient can register, verify email, and login

**Steps:**
1. Navigate to `/auth/register`
2. Fill in registration form with patient role
3. Submit registration
4. Check email for verification link
5. Click verification link
6. Navigate to `/auth/login`
7. Login with credentials
8. Verify redirect to patient dashboard

**Expected Results:**
- User account created in database
- Email verification sent
- Successful login redirects to `/patient/dashboard`
- Patient dashboard displays correctly

#### 1.2 Symptom Submission and AI Diagnosis
**Objective:** Verify patient can submit symptoms and receive AI diagnosis

**Steps:**
1. Login as patient
2. Navigate to diagnosis submission form
3. Enter symptoms: "I have a persistent headache, fever of 101°F, and fatigue for 3 days"
4. Upload a medical image (optional)
5. Submit the form
6. Wait for AI processing
7. View the generated report

**Expected Results:**
- Form validation works correctly
- File upload succeeds (if image provided)
- AI analysis completes within 15 seconds
- Report is created with status "pending"
- AI diagnosis includes:
  - Multiple possible conditions
  - Confidence scores
  - Severity assessment
  - Recommendations
- Patient receives notification

#### 1.3 Report Viewing and History
**Objective:** Verify patient can view reports and history

**Steps:**
1. Login as patient
2. Navigate to patient dashboard
3. View list of all reports
4. Click on a specific report
5. View detailed report information
6. Check report status (pending/verified/rejected)

**Expected Results:**
- All patient reports are displayed
- Reports show correct status
- Detailed view shows AI analysis
- Doctor notes visible (if verified)
- No access to other patients' reports

### 2. Doctor Workflow Integration Test

#### 2.1 Doctor Registration and Access
**Objective:** Verify doctor can register and access verification queue

**Steps:**
1. Register as doctor (or have admin assign doctor role)
2. Login as doctor
3. Navigate to `/doctor/dashboard`
4. View verification queue

**Expected Results:**
- Doctor dashboard loads correctly
- Verification queue shows pending reports
- Reports are sorted by submission date
- Doctor can see patient symptoms and AI analysis

#### 2.2 Report Verification Workflow
**Objective:** Verify doctor can review and verify reports

**Steps:**
1. Login as doctor
2. Navigate to verification queue
3. Select a pending report
4. Review patient symptoms
5. Review AI analysis
6. View uploaded medical images
7. Add doctor notes
8. Verify or reject the report

**Expected Results:**
- Report details load correctly
- Medical images display properly
- Doctor can add comprehensive notes
- Report status updates to "verified" or "rejected"
- Patient receives notification
- Audit log entry created

#### 2.3 Doctor Notes Management
**Objective:** Verify doctor can manage notes on reports

**Steps:**
1. Login as doctor
2. Open a verified report
3. Edit existing doctor notes
4. Save changes
5. View updated notes

**Expected Results:**
- Notes are editable
- Changes save successfully
- Updated timestamp recorded
- Patient sees updated notes

### 3. Admin Workflow Integration Test

#### 3.1 Admin Access and Dashboard
**Objective:** Verify admin can access admin features

**Steps:**
1. Login as admin
2. Navigate to `/admin/dashboard`
3. View system metrics
4. Check system health status

**Expected Results:**
- Admin dashboard loads
- System metrics display correctly
- User statistics shown
- Report statistics shown
- System health indicator visible

#### 3.2 User Management
**Objective:** Verify admin can manage users

**Steps:**
1. Login as admin
2. Navigate to user management
3. View list of all users
4. Search for specific user
5. Edit user role
6. Deactivate a user
7. Reactivate a user

**Expected Results:**
- All users listed with roles
- Search functionality works
- Role changes save correctly
- User deactivation works
- Audit log entries created

#### 3.3 Analytics and Monitoring
**Objective:** Verify admin can view analytics and monitoring data

**Steps:**
1. Login as admin
2. Navigate to `/admin/analytics`
3. View usage analytics
4. Check active users metrics
5. Navigate to `/admin/monitoring`
6. View error logs
7. Check system alerts

**Expected Results:**
- Analytics dashboard displays metrics
- Real-time data updates
- Error monitoring shows recent errors
- System alerts visible
- Metrics are accurate

#### 3.4 Audit Logs
**Objective:** Verify admin can view audit logs

**Steps:**
1. Login as admin
2. Navigate to audit logs
3. Filter by action type
4. Filter by user
5. Filter by date range
6. Export audit logs

**Expected Results:**
- All sensitive operations logged
- Filters work correctly
- Logs show user, action, timestamp
- Export functionality works

### 4. End-to-End Workflow Test

#### 4.1 Complete Diagnosis Cycle
**Objective:** Verify complete workflow from patient submission to doctor verification

**Steps:**
1. **Patient Actions:**
   - Register and login as patient
   - Submit symptoms with medical image
   - Receive AI diagnosis
   - View pending report

2. **System Processing:**
   - AI analysis completes
   - Report created in database
   - Notification sent to patient
   - Report added to doctor queue

3. **Doctor Actions:**
   - Login as doctor
   - View report in queue
   - Review AI analysis
   - Add professional notes
   - Verify report

4. **Patient Follow-up:**
   - Receive verification notification
   - View verified report
   - See doctor notes

5. **Admin Oversight:**
   - Login as admin
   - View analytics showing the activity
   - Check audit logs for all actions
   - Verify system metrics updated

**Expected Results:**
- Complete workflow executes without errors
- All notifications sent correctly
- Data persists correctly across sessions
- Audit trail complete
- Analytics reflect the activity

### 5. Security Integration Tests

#### 5.1 Authentication and Authorization
**Objective:** Verify security controls work correctly

**Steps:**
1. Attempt to access protected routes without login
2. Attempt to access admin routes as patient
3. Attempt to access doctor routes as patient
4. Attempt to view another user's reports
5. Verify JWT token expiration
6. Test rate limiting on API endpoints

**Expected Results:**
- Unauthorized access blocked
- Proper redirects to login
- Role-based access enforced
- Data isolation maintained
- Rate limiting prevents abuse

#### 5.2 Data Privacy and Encryption
**Objective:** Verify data protection measures

**Steps:**
1. Upload medical image
2. Verify file encryption in storage
3. Check database for encrypted sensitive data
4. Verify HTTPS enforcement
5. Test RLS policies in database

**Expected Results:**
- Files encrypted at rest
- Sensitive data encrypted
- HTTPS enforced
- RLS prevents unauthorized access
- Audit logs capture access attempts

### 6. Performance Integration Tests

#### 6.1 Response Time Verification
**Objective:** Verify system meets performance requirements

**Steps:**
1. Submit text-only diagnosis request
2. Measure response time (should be < 5 seconds)
3. Submit diagnosis with image
4. Measure response time (should be < 15 seconds)
5. Load patient dashboard with multiple reports
6. Measure page load time

**Expected Results:**
- Text diagnosis completes in < 5 seconds
- Image diagnosis completes in < 15 seconds
- Dashboard loads in < 2 seconds
- API responses are fast
- No timeout errors

#### 6.2 Concurrent User Testing
**Objective:** Verify system handles multiple users

**Steps:**
1. Have 3 patients submit diagnoses simultaneously
2. Have 2 doctors verify reports simultaneously
3. Have admin view analytics during activity
4. Monitor system performance
5. Check for errors or slowdowns

**Expected Results:**
- All requests process successfully
- No race conditions
- Database handles concurrent writes
- System remains responsive
- No data corruption

### 7. Error Handling Integration Tests

#### 7.1 AI Service Failure
**Objective:** Verify graceful handling of AI service errors

**Steps:**
1. Submit diagnosis with invalid API key
2. Submit diagnosis when API quota exceeded
3. Submit diagnosis with network timeout
4. Verify error messages to user
5. Check error logging

**Expected Results:**
- User-friendly error messages
- No system crashes
- Errors logged properly
- User can retry
- Admin alerted to issues

#### 7.2 Database Connection Issues
**Objective:** Verify handling of database errors

**Steps:**
1. Simulate database connection loss
2. Attempt to submit diagnosis
3. Attempt to login
4. Verify error handling
5. Check recovery when connection restored

**Expected Results:**
- Graceful error messages
- No data loss
- System recovers automatically
- Users can retry operations

## Test Data

### Sample Symptoms for Testing

1. **Respiratory Issues:**
   - "Persistent cough for 2 weeks, shortness of breath, chest tightness, fever of 100.5°F"

2. **Digestive Issues:**
   - "Severe abdominal pain in lower right quadrant, nausea, vomiting, loss of appetite for 24 hours"

3. **Neurological Issues:**
   - "Severe headache with visual disturbances, sensitivity to light, nausea for 6 hours"

4. **Skin Conditions:**
   - "Red, itchy rash on arms and legs, appeared 3 days ago, spreading gradually"

5. **Cardiovascular:**
   - "Chest pain radiating to left arm, shortness of breath, sweating, started 30 minutes ago"

### Test User Accounts

Create these test accounts:

```
Patient 1:
- Email: patient1@test.com
- Password: TestPatient123!
- Role: patient

Patient 2:
- Email: patient2@test.com
- Password: TestPatient123!
- Role: patient

Doctor 1:
- Email: doctor1@test.com
- Password: TestDoctor123!
- Role: doctor

Doctor 2:
- Email: doctor2@test.com
- Password: TestDoctor123!
- Role: doctor

Admin:
- Email: admin@test.com
- Password: TestAdmin123!
- Role: admin
```

## Automated Testing Scripts

See the `/tests/integration` directory for automated test scripts that can be run with:

```bash
npm run test:integration
```

## Test Checklist

Use this checklist to track testing progress:

- [ ] Patient registration and login
- [ ] Patient symptom submission
- [ ] AI diagnosis generation
- [ ] Patient report viewing
- [ ] Doctor registration and login
- [ ] Doctor verification queue
- [ ] Doctor report verification
- [ ] Doctor notes management
- [ ] Admin dashboard access
- [ ] Admin user management
- [ ] Admin analytics viewing
- [ ] Admin monitoring dashboard
- [ ] Admin audit logs
- [ ] End-to-end workflow
- [ ] Authentication security
- [ ] Authorization controls
- [ ] Data privacy measures
- [ ] Performance requirements
- [ ] Concurrent user handling
- [ ] Error handling
- [ ] Notification system
- [ ] File upload and storage
- [ ] Database RLS policies

## Reporting Issues

When you find issues during testing:

1. Document the issue clearly
2. Include steps to reproduce
3. Note expected vs actual behavior
4. Capture screenshots if applicable
5. Check error logs and console
6. Report in issue tracker

## Success Criteria

Integration testing is complete when:

- All test scenarios pass
- No critical bugs found
- Performance requirements met
- Security controls verified
- All user workflows functional
- Error handling works correctly
- Documentation is accurate
