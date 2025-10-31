-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update user roles
CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Doctors can view other users (for patient information)
CREATE POLICY "Doctors can view users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Reports table policies
-- Patients can view their own reports
CREATE POLICY "Patients can view own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);

-- Patients can create their own reports
CREATE POLICY "Patients can create own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Patients can update their own pending reports
CREATE POLICY "Patients can update own pending reports" ON public.reports
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  );

-- Doctors can view all reports for verification
CREATE POLICY "Doctors can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Doctors can update report status
CREATE POLICY "Doctors can update report status" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Admins have full access to reports
CREATE POLICY "Admins have full access to reports" ON public.reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Doctor notes table policies
-- Patients can view notes on their reports
CREATE POLICY "Patients can view notes on own reports" ON public.doctor_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports 
      WHERE id = report_id AND user_id = auth.uid()
    )
  );

-- Doctors can view all notes
CREATE POLICY "Doctors can view all notes" ON public.doctor_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Doctors can create notes
CREATE POLICY "Doctors can create notes" ON public.doctor_notes
  FOR INSERT WITH CHECK (
    auth.uid() = doctor_id AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Doctors can update their own notes
CREATE POLICY "Doctors can update own notes" ON public.doctor_notes
  FOR UPDATE USING (
    auth.uid() = doctor_id AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Admins have full access to notes
CREATE POLICY "Admins have full access to notes" ON public.doctor_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );