# Debugging Guide - Dashboard Authentication Issues

## Current Situation

The dashboards are showing errors when trying to load data. This is **expected behavior** when:
1. User is not logged in
2. User session has expired
3. User doesn't have the required role permissions

## What We Fixed

✅ Created authenticated API client (`src/lib/api-client.ts`)
✅ Updated all dashboards to use authenticated API calls
✅ Added proper error logging and debugging

## How to Debug

### Step 1: Check Authentication Status

Visit the debug page: `http://localhost:3000/debug/auth`

This page shows:
- Current user information
- Session status and token
- Direct Supabase session data
- Ability to test API calls

### Step 2: Verify User is Logged In

1. Go to `/auth/login` or `/auth/register`
2. Create an account or log in
3. Check the debug page again to see if session exists

### Step 3: Test API Calls

On the debug page:
1. Click "Test API Call to /api/admin/health"
2. Check the response:
   - **401 Unauthorized**: No valid session or token
   - **403 Forbidden**: User doesn't have admin role
   - **200 OK**: Authentication working correctly

## Common Issues and Solutions

### Issue 1: "No active session found"
**Cause**: User is not logged in
**Solution**: 
- Go to `/auth/login` and log in
- Or register a new account at `/auth/register`

### Issue 2: "401 Unauthorized"
**Cause**: Session expired or invalid token
**Solution**:
- Log out and log back in
- Clear browser cookies and try again
- Check if Supabase environment variables are correct

### Issue 3: "403 Forbidden"
**Cause**: User doesn't have required role (e.g., trying to access admin dashboard as patient)
**Solution**:
- Log in with an account that has the correct role
- For admin access, you need a user with `role = 'admin'`
- For doctor access, you need `role = 'doctor'`

### Issue 4: API calls fail with network error
**Cause**: API endpoints not running or CORS issues
**Solution**:
- Ensure dev server is running: `npm run dev`
- Check browser console for detailed error messages
- Verify Supabase URL and keys in `.env.local`

## Testing the Full Flow

### As a Patient:
1. Register at `/auth/register` with role "patient"
2. Go to `/dashboard` - should redirect to patient dashboard
3. Patient dashboard should load (may be empty if no reports)

### As a Doctor:
1. Register with role "doctor" (or update existing user in database)
2. Go to `/dashboard` - should redirect to doctor dashboard
3. Doctor dashboard should show verification queue

### As an Admin:
1. Register with role "admin" (or update existing user in database)
2. Go to `/dashboard` - should redirect to admin dashboard
3. Admin dashboard should show system metrics

## Manual Database Setup for Testing

If you need to create test users with specific roles:

```sql
-- Update existing user to admin
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"')
WHERE email = 'your-email@example.com';

-- Update users table
UPDATE public.users 
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Environment Variables Checklist

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GOOGLE_GEMINI_API_KEY=your-gemini-key
```

## API Client Debug Logs

The API client now logs:
- When no session is found
- When API requests fail (status, URL, auth status)
- Session retrieval errors

Check browser console for these logs.

## Next Steps

1. **Visit debug page**: `/debug/auth`
2. **Check session status**: Verify user is logged in
3. **Test API call**: Use the test button to verify authentication
4. **Review logs**: Check browser console for detailed error messages
5. **Fix issues**: Follow solutions above based on error type

## Expected Behavior

### When Not Logged In:
- Dashboards show loading state briefly
- Then show "no user" or redirect to login
- No API calls should be made

### When Logged In:
- Dashboards make authenticated API calls
- If role matches, data loads successfully
- If role doesn't match, shows 403 error
- If no data exists, shows empty state

### When Session Expires:
- API calls return 401
- User should be redirected to login
- Session should refresh automatically (Supabase handles this)

## Troubleshooting Commands

```bash
# Check if dev server is running
npm run dev

# Check Supabase connection
# Visit: https://app.supabase.com/project/YOUR_PROJECT/settings/api

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Check for TypeScript errors
npm run type-check
```

## Support

If issues persist:
1. Check browser console for errors
2. Check terminal for server errors
3. Verify Supabase dashboard shows your user
4. Test authentication with debug page
5. Review API endpoint logs in terminal

## Status

✅ Authentication system implemented
✅ API client with auto-authentication created
✅ All dashboards updated
✅ Debug page created
⏳ Waiting for user testing
⏳ Need to verify with real login flow
