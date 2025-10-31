-- Note: Storage policies cannot be created via SQL migrations due to permission restrictions
-- This file documents the required policies that must be created manually via the Supabase Dashboard

-- MANUAL SETUP REQUIRED:
-- Go to Storage > medical-files > Policies in your Supabase Dashboard
-- Create the following policies using the Policy Builder UI:

/*
Policy 1: Users can upload own files
- Operation: INSERT
- Target roles: authenticated
- Policy expression: bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 2: Users can view own files  
- Operation: SELECT
- Target roles: authenticated
- Policy expression: bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 3: Doctors and admins can view all files
- Operation: SELECT
- Target roles: authenticated
- Policy expression: bucket_id = 'medical-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.raw_user_meta_data->>'role' IN ('doctor', 'admin')))

Policy 4: Users can delete own files
- Operation: DELETE
- Target roles: authenticated
- Policy expression: bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 5: Users can update own files
- Operation: UPDATE
- Target roles: authenticated
- Policy expression: bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text
*/

-- Create a helper function to check if storage policies exist
CREATE OR REPLACE FUNCTION check_storage_policies_setup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'Storage policies must be configured manually via Supabase Dashboard. See migration file comments for details.';
END;
$$;

-- Call the function to indicate this migration requires manual setup
SELECT check_storage_policies_setup();