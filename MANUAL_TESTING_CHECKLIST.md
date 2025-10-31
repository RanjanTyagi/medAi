# Manual Testing Checklist

Use this checklist to manually verify all system functionality before deployment.

## Pre-Testing Setup

- [ ] Development server is running (`npm run dev`)
- [ ] Supabase project is configured and accessible
- [ ] All environment variables are set in `.env.local`
- [ ] Database migrations have been applied
- [ ] Storage buckets are configured
- [ ] Test user accounts created for each role

## 1. Patient Workflow Tests

### Registration and Authentication
- [ ] Navigate to `/auth/register`
- [ ] Register new patient account
- [ ] Verify email validation works
- [ ] Check email for verification link
- [ ] Click verification link
- [ ] Verify account is activated
- [ ] Login with patient credentials
- [ ] Verify redirect to patient dashboard
- [ ] Test "Remember Me" functionality
- [ ] Test logout functionality

### Symptom Submission
- [ ] Navigate to diagnosis submission form
- [ ] Test form validation (empty fields)
- [ ] Enter valid symptoms
- [ ] Test character limit (if any)
- [ ] Upload medical image (JPEG)
- [ ] Upload medical image (PNG)
- [ ] Test file size limit
- [ ] Test invalid file format rejection
- [ ] Submit form
- [ ] Verify loading indicator appears
- [ ] Wait for AI processing
- [ ] Verify success message

### AI Diagnosis Review
- [ ] View generated diagnosis report
- [ ] Verify multiple conditions listed
- [ ] Check confidence scores display
- [ ] Verify severity levels shown
- [ ] Check recommendations are clear
- [ ] Verify disclaimer is visible
- [ ] Test report status shows "pending"

### Report Management
- [ ] Navigate to patient dashboard
- [ ] Verify all reports are listed
- [ ] Check reports are sorted by date
- [ ] Click on a specific report
- [ ] Verify detailed view loads
- [ ] Check AI analysis is displayed
- [ ] Verify images are viewable
- [ ] Test back navigation
- [ ] Filter reports by status
- [ ] Search reports (if implemented)

### Notifications
- [ ] Check notification bell icon
- [ ] Verify unread count displays
- [ ] Click notification bell
- [ ] View notification list
- [ ] Click on a notification
- [ ] Verify navigation to related report
- [ ] Mark notification as read
- [ ] Verify count updates

## 2. Doctor Workflow Tests

### Doctor Authentication
- [ ] Login as doctor
- [ ] Verify redirect to doctor dashboard
- [ ] Check dashboard displays correctly
- [ ] Verify doctor-specific navigation

### Verification Queue
- [ ] View verification queue
- [ ] Verify pending reports listed
- [ ] Check reports show patient symptoms
- [ ] Verify AI analysis is visible
- [ ] Test queue sorting options
- [ ] Filter by urgency level
- [ ] Search queue (if implemented)

### Report Verification
- [ ] Select a pending report
- [ ] Review patient information
- [ ] Review symptoms
- [ ] View AI analysis
- [ ] View uploaded images
- [ ] Zoom/pan images (if implemented)
- [ ] Add doctor notes
- [ ] Test rich text formatting (if implemented)
- [ ] Verify report
- [ ] Check success confirmation
- [ ] Verify report removed from queue
- [ ] Check notification sent to patient

### Report Rejection
- [ ] Select another pending report
- [ ] Choose to reject report
- [ ] Add rejection reason
- [ ] Verify reason is required
- [ ] Submit rejection
- [ ] Check confirmation message
- [ ] Verify patient notified

### Doctor Notes Management
- [ ] Open a verified report
- [ ] Edit existing notes
- [ ] Save changes
- [ ] Verify changes persist
- [ ] Check timestamp updated

### Doctor Statistics
- [ ] View doctor statistics
- [ ] Verify total verifications count
- [ ] Check rejection count
- [ ] View pending count
- [ ] Check statistics accuracy

## 3. Admin Workflow Tests

### Admin Authentication
- [ ] Login as admin
- [ ] Verify redirect to admin dashboard
- [ ] Check all admin features visible

### User Management
- [ ] Navigate to user management
- [ ] View list of all users
- [ ] Verify user details displayed
- [ ] Search for specific user
- [ ] Filter by role
- [ ] Click on a user
- [ ] View user details
- [ ] Edit user role
- [ ] Save changes
- [ ] Verify role updated
- [ ] Deactivate a user
- [ ] Verify user cannot login
- [ ] Reactivate user
- [ ] Verify user can login again

### System Analytics
- [ ] Navigate to analytics dashboard
- [ ] Verify metrics display
- [ ] Check active users count
- [ ] View report statistics
- [ ] Check verification rates
- [ ] View charts/graphs
- [ ] Test date range filters
- [ ] Export analytics data (if implemented)
- [ ] Verify data accuracy

### Error Monitoring
- [ ] Navigate to monitoring dashboard
- [ ] View error logs
- [ ] Check error severity levels
- [ ] Filter by severity
- [ ] Filter by date
- [ ] View error details
- [ ] Mark error as resolved
- [ ] View system alerts
- [ ] Acknowledge alerts
- [ ] Check system health status

### Audit Logs
- [ ] Navigate to audit logs
- [ ] View all logged actions
- [ ] Filter by action type
- [ ] Filter by user
- [ ] Filter by date range
- [ ] Search logs
- [ ] View log details
- [ ] Export logs (if implemented)
- [ ] Verify sensitive actions logged

### System Configuration
- [ ] Access system settings (if implemented)
- [ ] Update configuration
- [ ] Save changes
- [ ] Verify changes applied
- [ ] Test configuration validation

## 4. Security Tests

### Authentication Security
- [ ] Test login with wrong password
- [ ] Verify account lockout after multiple failures
- [ ] Test password reset flow
- [ ] Verify password complexity requirements
- [ ] Test session timeout
- [ ] Verify logout clears session
- [ ] Test concurrent sessions (if allowed)

### Authorization Tests
- [ ] As patient, try to access `/doctor/dashboard`
- [ ] As patient, try to access `/admin/dashboard`
- [ ] As doctor, try to access `/admin/dashboard`
- [ ] As doctor, try to access another doctor's data
- [ ] Verify all unauthorized access blocked
- [ ] Check proper error messages

### Data Privacy
- [ ] As patient, try to view another patient's report
- [ ] Verify reports are isolated by user
- [ ] Check medical images are protected
- [ ] Verify direct URL access blocked
- [ ] Test RLS policies in database

### API Security
- [ ] Test API without authentication token
- [ ] Test API with invalid token
- [ ] Test API with expired token
- [ ] Verify rate limiting works
- [ ] Test CORS policies
- [ ] Check security headers

## 5. Performance Tests

### Page Load Times
- [ ] Measure home page load time
- [ ] Measure dashboard load time
- [ ] Measure report list load time
- [ ] Verify all pages load < 2 seconds

### AI Processing
- [ ] Submit text-only diagnosis
- [ ] Measure processing time (should be < 5s)
- [ ] Submit diagnosis with image
- [ ] Measure processing time (should be < 15s)
- [ ] Test with multiple images
- [ ] Verify timeout handling

### Concurrent Users
- [ ] Have 3 users submit diagnoses simultaneously
- [ ] Verify all process successfully
- [ ] Check for race conditions
- [ ] Monitor system performance
- [ ] Verify no data corruption

## 6. UI/UX Tests

### Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on laptop (1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] Verify all features accessible
- [ ] Check navigation works on mobile
- [ ] Test touch interactions

### Accessibility
- [ ] Test keyboard navigation
- [ ] Verify tab order is logical
- [ ] Test with screen reader
- [ ] Check color contrast
- [ ] Verify alt text on images
- [ ] Test form labels
- [ ] Check ARIA attributes

### Browser Compatibility
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on Edge
- [ ] Verify consistent behavior
- [ ] Check for console errors

### User Experience
- [ ] Verify loading indicators
- [ ] Check error messages are clear
- [ ] Test success confirmations
- [ ] Verify tooltips/help text
- [ ] Check form validation messages
- [ ] Test empty states
- [ ] Verify 404 page
- [ ] Test error page

## 7. Integration Tests

### Email Integration
- [ ] Verify registration email sent
- [ ] Check email verification link works
- [ ] Test password reset email
- [ ] Verify notification emails
- [ ] Check email formatting
- [ ] Test email delivery

### File Storage
- [ ] Upload medical image
- [ ] Verify file stored in Supabase
- [ ] Check file encryption
- [ ] Test file retrieval
- [ ] Verify file access control
- [ ] Test file deletion

### Database Operations
- [ ] Create new record
- [ ] Update existing record
- [ ] Delete record
- [ ] Test transactions
- [ ] Verify data integrity
- [ ] Check RLS policies

### External APIs
- [ ] Test Gemini AI API
- [ ] Verify API key validation
- [ ] Test API error handling
- [ ] Check API rate limits
- [ ] Verify fallback behavior

## 8. Error Handling Tests

### Network Errors
- [ ] Disconnect network during operation
- [ ] Verify error message displayed
- [ ] Check retry functionality
- [ ] Test offline behavior
- [ ] Verify data not lost

### API Errors
- [ ] Test with invalid API key
- [ ] Test with API quota exceeded
- [ ] Verify error messages
- [ ] Check logging
- [ ] Test recovery

### Database Errors
- [ ] Simulate database connection loss
- [ ] Verify error handling
- [ ] Check user notification
- [ ] Test automatic retry
- [ ] Verify data consistency

### Validation Errors
- [ ] Submit invalid form data
- [ ] Verify validation messages
- [ ] Check field highlighting
- [ ] Test error recovery
- [ ] Verify form state preserved

## 9. Data Integrity Tests

### Report Lifecycle
- [ ] Create report
- [ ] Verify in database
- [ ] Update report status
- [ ] Add doctor notes
- [ ] Verify all changes saved
- [ ] Check audit trail

### User Data
- [ ] Create user
- [ ] Update profile
- [ ] Change password
- [ ] Verify changes persist
- [ ] Check data consistency

### Concurrent Updates
- [ ] Two doctors verify same report
- [ ] Verify conflict handling
- [ ] Check data consistency
- [ ] Test optimistic locking

## 10. Deployment Readiness

### Configuration
- [ ] Verify all environment variables set
- [ ] Check production API keys
- [ ] Verify database connection
- [ ] Test storage configuration
- [ ] Check domain configuration

### Build Process
- [ ] Run `npm run build`
- [ ] Verify build succeeds
- [ ] Check for warnings
- [ ] Test production build locally
- [ ] Verify all features work

### Documentation
- [ ] README is up to date
- [ ] API documentation complete
- [ ] User guides available
- [ ] Deployment guide ready
- [ ] Troubleshooting guide available

## Test Sign-Off

**Tester Name:** ___________________________

**Date:** ___________________________

**Overall Status:** [ ] Pass [ ] Fail

**Critical Issues Found:** ___________________________

**Notes:** ___________________________

___________________________

___________________________

**Approved for Deployment:** [ ] Yes [ ] No

**Approver:** ___________________________

**Date:** ___________________________
