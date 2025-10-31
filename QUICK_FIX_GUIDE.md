# Quick Fix Guide - Dashboard API Errors

## Problem
Dashboard shows "Failed to load dashboard data" with API errors.

## Solution Steps

### Step 1: Check Authentication Status
1. Open your browser to: **http://localhost:3000/debug/auth**
2. Look at the "Session Status" section
3. Look at the "User Status" section

### Step 2: Interpret Results

#### Scenario A: No Active Session ✗
**What you'll see:**
- "✗ No Active Session"
- "✗ No User Found"

**Fix:**
1. Click "Go to Login" button
2. Log in with your credentials
3. Return to dashboard
4. Dashboard should now work!

#### Scenario B: Session Active but API Fails ✓/✗
**What you'll see:**
- "✓ Session Active"
- "✓ User Authenticated"
- But "Test API Call" button shows error

**Fix:**
1. Check the HTTP status code:
   - **401 Unauthorized**: Token issue - try logging out and back in
   - **403 Forbidden**: Permission issue - check user role
   - **500 Server Error**: Database/server issue - check terminal logs
   - **404 Not Found**: API endpoint missing - check routes exist

2. Check your terminal where `npm run dev` is running:
   - Look for error messages
   - Look for database connection errors
   - Look for missing environment variables

3. Verify Supabase is accessible:
   - Go to https://supabase.com/dashboard
   - Check if your project is running
   - Check if database tables exist

#### Scenario C: Everything Works ✓
**What you'll see:**
- "✓ Session Active"
- "✓ User Authenticated"
- "✓ API Call Successful"

**If dashboard still fails:**
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for other errors

### Step 3: Common Fixes

#### Fix 1: Fresh Login
```
1. Go to http://localhost:3000
2. Click "Sign out" (if logged in)
3. Go to /auth/login
4. Enter credentials
5. Go to /dashboard
```

#### Fix 2: Check Environment Variables
```bash
# In terminal, verify these exist:
cat ai-med-diagnosis/.env.local | grep SUPABASE

# Should show:
# NEXT_PUBLIC_SUPABASE_URL=https://...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Fix 3: Restart Dev Server
```bash
# Stop the server (Ctrl+C)
# Start it again:
cd ai-med-diagnosis
npm run dev
```

#### Fix 4: Check Database Tables
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to "Table Editor"
4. Verify these tables exist:
   - users
   - reports
   - doctor_notes
   - notifications

### Step 4: Still Not Working?

Run the debug page and take note of:
1. Session status (active or not?)
2. User status (authenticated or not?)
3. API test result (status code?)
4. Any error messages

Then check:
- Browser console (F12 → Console tab)
- Network tab (F12 → Network tab)
- Server terminal (where npm run dev is running)

### Quick Reference

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| No session | Not logged in | Log in at /auth/login |
| 401 Unauthorized | Invalid/expired token | Log out and back in |
| 403 Forbidden | Wrong user role | Check user permissions |
| 500 Server Error | Database/server issue | Check terminal logs |
| 404 Not Found | Missing API route | Verify routes exist |

### Debug Page Features

The debug page at `/debug/auth` provides:
- ✓ Real-time session status
- ✓ User authentication status
- ✓ API call testing
- ✓ Detailed error messages
- ✓ Quick action buttons

Use it whenever you encounter authentication or API issues!

## Expected Behavior

### When Working:
- Dashboard loads without errors
- Shows user data (or "No reports yet")
- No console errors
- API calls succeed

### When Not Authenticated:
- Shows "Please log in" message
- Shows "Go to Login" button
- Console shows "No active session" warnings
- This is expected and correct!

## Need More Help?

1. Visit the debug page: http://localhost:3000/debug/auth
2. Click "Test API Call"
3. Take a screenshot of the results
4. Check the browser console (F12)
5. Check the server terminal
6. Share the error details for further assistance
