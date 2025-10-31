-- Fix User Profiles Script
-- Run this in your Supabase SQL Editor to sync existing auth users

-- First, sync any existing auth users that don't have profiles
SELECT public.sync_auth_users();

-- Verify the sync worked
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  u.id as profile_id,
  u.name,
  u.role,
  u.created_at as profile_created
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC;

-- Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
