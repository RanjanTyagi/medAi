-- Fix RLS policies to allow user creation
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Doctors can view users" ON public.users;

-- Allow users to be inserted (for the trigger function)
CREATE POLICY "Allow user creation" ON public.users
  FOR INSERT WITH CHECK (true);

-- Recreate admin policies using auth.jwt() instead of public.users lookup
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') = 'admin'
  );

-- Doctors can view other users (for patient information)
CREATE POLICY "Doctors can view users" ON public.users
  FOR SELECT USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

-- Update reports policies to use auth.jwt() for role checking
DROP POLICY IF EXISTS "Doctors can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Doctors can update report status" ON public.reports;
DROP POLICY IF EXISTS "Admins have full access to reports" ON public.reports;

CREATE POLICY "Doctors can view all reports" ON public.reports
  FOR SELECT USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

CREATE POLICY "Doctors can update report status" ON public.reports
  FOR UPDATE USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

CREATE POLICY "Admins have full access to reports" ON public.reports
  FOR ALL USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') = 'admin'
  );

-- Update doctor notes policies
DROP POLICY IF EXISTS "Doctors can view all notes" ON public.doctor_notes;
DROP POLICY IF EXISTS "Doctors can create notes" ON public.doctor_notes;
DROP POLICY IF EXISTS "Doctors can update own notes" ON public.doctor_notes;
DROP POLICY IF EXISTS "Admins have full access to notes" ON public.doctor_notes;

CREATE POLICY "Doctors can view all notes" ON public.doctor_notes
  FOR SELECT USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

CREATE POLICY "Doctors can create notes" ON public.doctor_notes
  FOR INSERT WITH CHECK (
    auth.uid() = doctor_id AND
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

CREATE POLICY "Doctors can update own notes" ON public.doctor_notes
  FOR UPDATE USING (
    auth.uid() = doctor_id AND
    (auth.jwt() ->> 'user_metadata' ->> 'role') IN ('doctor', 'admin')
  );

CREATE POLICY "Admins have full access to notes" ON public.doctor_notes
  FOR ALL USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role') = 'admin'
  );