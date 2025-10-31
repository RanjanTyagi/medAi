# Fix User Profile Issues

## The Problem
You're authenticated but your user profile doesn't exist in the `public.users` table, causing API calls to fail.

## Quick Fix (2 minutes)

### Option 1: Run SQL Script (Recommended)
1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste this command:
   ```sql
   SELECT public.sync_auth_users();
   ```
5. Click **Run**
6. Refresh your app - dashboard should work now!

### Option 2: Manual User Creation
1. Go to Supabase Dashboard → **Table Editor** → **users** table
2. Click **Insert** → **Insert row**
3. Fill in:
   - **id**: Get from Authentication → Users (copy your user ID)
   - **email**: Your email
   - **name**: Your name
   - **role**: `patient` (or `doctor`/`admin`)
4. Click **Save**
5. Refresh your app

### Option 3: Register a New Account
1. Sign out of the app
2. Go to `/auth/register`
3. Register with a NEW email
4. The trigger should create your profile automatically

## Verify It's Fixed

After running the fix, check:
1. Dashboard loads without errors
2. You can see your reports (even if empty)
3. No console errors about failed API calls

## Why This Happened

The database trigger that creates user profiles might not have been active when you registered, or there was an RLS policy blocking it. The `sync_auth_users()` function will sync all existing auth users to the users table.

## Prevent Future Issues

The trigger is now properly set up in migration `009_fix_user_trigger.sql`. All new registrations should automatically create user profiles.

If you still have issues, check:
- Supabase logs for trigger errors
- RLS policies on the users table
- That the trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
