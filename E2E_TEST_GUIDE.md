# End-to-End Testing Guide

## Goal
Verify the complete application works from registration to diagnosis to verification.

## Prerequisites
- Dev server running: `npm run dev`
- Supabase configured
- Database migrations applied

## Test Workflow 1: Patient Journey (5 minutes)

### Step 1: Register as Patient
1. Go to `http://localhost:3000/auth/register`
2. Fill in:
   - Email: `patient@test.com`
   - Password: `Test123!`
   - Name: `Test Patient`
   - Role: `Patient`
3. Click Register
4. **Expected**: Redirected to patient dashboard

### Step 2: Submit Symptoms
1. Click "New Report" button
2. Enter symptoms: "Headache and fever for 3 days"
3. (Optional) Upload a medical image
4. Click "Submit for Analysis"
5. **Expected**: AI analysis appears, report created

### Step 3: View Report
1. Go to dashboard
2. **Expected**: See your report with AI diagnosis
3. **Expected**: Status shows "Pending" (awaiting doctor verification)

## Test Workflow 2: Doctor Journey (5 minutes)

### Step 1: Register as Doctor
1. Go to `http://localhost:3000/auth/register`
2. Fill in:
   - Email: `doctor@test.com`
   - Password: `Test123!`
   - Name: `Dr. Test`
   - Role: `Doctor`
3. Click Register
4. **Expected**: Redirected to doctor dashboard

### Step 2: Review Verification Queue
1. Check dashboard
2. **Expected**: See patient's report in queue
3. Click on report to review

### Step 3: Verify Report
1. Review AI diagnosis
2. Add doctor note: "Diagnosis confirmed. Recommend rest and hydration."
3. Click "Verify" or "Reject"
4. **Expected**: Report status updated

## Test Workflow 3: Admin Journey (3 minutes)

### Step 1: Register as Admin
1. Go to `http://localhost:3000/auth/register`
2. Fill in:
   - Email: `admin@test.com`
   - Password: `Test123!`
   - Name: `Admin User`
   - Role: `Admin`
3. Click Register
4. **Expected**: Redirected to admin dashboard

### Step 2: View System Metrics
1. Check dashboard
2. **Expected**: See user counts, report statistics
3. **Expected**: System health indicators

### Step 3: Manage Users
1. Go to Users section
2. **Expected**: See list of all users
3. **Expected**: Can view user details

## Quick Smoke Test (2 minutes)

If you just want to verify basics work:

1. **Register**: Create one account
2. **Login**: Sign out and sign back in
3. **Dashboard**: Check dashboard loads
4. **Navigation**: Click through main pages

## Common Issues & Fixes

### Issue: "Failed to load dashboard data"
**Cause**: No data in database yet
**Fix**: This is normal for empty database. Create a report first.

### Issue: Can't register
**Cause**: Supabase not configured or email already exists
**Fix**: 
- Check `.env.local` has Supabase keys
- Use different email
- Check Supabase dashboard for errors

### Issue: AI diagnosis fails
**Cause**: No Gemini API key
**Fix**: Add `GOOGLE_GEMINI_API_KEY` to `.env.local`

### Issue: Can't upload images
**Cause**: Storage policies not set
**Fix**: Run storage setup script

## Success Criteria

✅ **Authentication Works**
- Can register new users
- Can log in
- Can log out
- Redirects to correct dashboard by role

✅ **Patient Flow Works**
- Can submit symptoms
- AI generates diagnosis
- Can view reports
- Can see verification status

✅ **Doctor Flow Works**
- Can see pending reports
- Can add notes
- Can verify/reject reports
- Patient sees updated status

✅ **Admin Flow Works**
- Can view all users
- Can see system metrics
- Can access all features

## What to Test Next

Once basic flows work:

1. **Error Handling**: Try invalid inputs
2. **Permissions**: Try accessing wrong role pages
3. **Edge Cases**: Empty states, long text, large images
4. **Performance**: Multiple reports, many users

## Automated Testing

For automated tests, run:
```bash
npm run test:integration
```

This runs the integration test suite that covers:
- Patient workflow
- Doctor workflow
- API endpoints
- Database operations

## Manual Testing Checklist

- [ ] Patient can register
- [ ] Patient can submit symptoms
- [ ] AI diagnosis generates
- [ ] Doctor can see pending reports
- [ ] Doctor can verify reports
- [ ] Admin can view metrics
- [ ] Sign out works
- [ ] Sign in works
- [ ] Navigation works
- [ ] Error messages are helpful

## Time Estimate

- **Quick smoke test**: 2 minutes
- **Full patient flow**: 5 minutes
- **Full doctor flow**: 5 minutes
- **Full admin flow**: 3 minutes
- **Total comprehensive test**: 15 minutes

## Next Steps After Testing

1. **If everything works**: Move to production deployment
2. **If issues found**: Document them and fix one by one
3. **If partially works**: Focus on core patient→doctor flow first

## Support

If you encounter issues:
1. Check browser console for errors
2. Check terminal for server errors
3. Check Supabase dashboard for database issues
4. Review the error message carefully
5. Try the suggested fixes above
