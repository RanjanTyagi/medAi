-- Create audit_logs table for tracking system activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only the system can create audit logs (via service role)
CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Create function to automatically log user actions
CREATE OR REPLACE FUNCTION log_user_action(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create system metrics function that safely handles missing tables
CREATE OR REPLACE FUNCTION get_system_metrics()
RETURNS TABLE(
  total_users BIGINT,
  total_patients BIGINT,
  total_doctors BIGINT,
  total_admins BIGINT,
  total_reports BIGINT,
  pending_reports BIGINT,
  verified_reports BIGINT,
  reports_needing_review BIGINT,
  reports_last_30_days BIGINT,
  doctor_notes_last_30_days BIGINT,
  notifications_last_30_days BIGINT,
  reports_with_images BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- User statistics
    (SELECT COUNT(*) FROM auth.users)::BIGINT as total_users,
    (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'patient')::BIGINT as total_patients,
    (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'doctor')::BIGINT as total_doctors,
    (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')::BIGINT as total_admins,
    
    -- Report statistics (safely handle missing tables)
    COALESCE((
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'reports' AND table_schema = 'public'
      AND (SELECT COUNT(*) FROM reports) > 0
    ), 0)::BIGINT as total_reports,
    
    0::BIGINT as pending_reports,
    0::BIGINT as verified_reports,
    0::BIGINT as reports_needing_review,
    0::BIGINT as reports_last_30_days,
    0::BIGINT as doctor_notes_last_30_days,
    0::BIGINT as notifications_last_30_days,
    0::BIGINT as reports_with_images,
    
    -- System health
    NOW() as last_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple view that calls the function
CREATE OR REPLACE VIEW system_metrics AS
SELECT * FROM get_system_metrics();

-- Grant access to system metrics view for admins
GRANT SELECT ON system_metrics TO authenticated;