-- Update system metrics view with full functionality after all tables exist
-- This should be run AFTER all other migrations

-- First, check if required tables exist and update the view accordingly
DO $$
BEGIN
  -- Check if reports table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reports' AND table_schema = 'public') THEN
    
    -- Update system metrics view with full functionality
    CREATE OR REPLACE VIEW system_metrics AS
    SELECT 
      -- User statistics
      (SELECT COUNT(*) FROM auth.users)::BIGINT as total_users,
      (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'patient')::BIGINT as total_patients,
      (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'doctor')::BIGINT as total_doctors,
      (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')::BIGINT as total_admins,
      
      -- Report statistics
      (SELECT COUNT(*) FROM reports)::BIGINT as total_reports,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending')::BIGINT as pending_reports,
      (SELECT COUNT(*) FROM reports WHERE status = 'verified')::BIGINT as verified_reports,
      (SELECT COUNT(*) FROM reports WHERE status = 'reviewed')::BIGINT as reports_needing_review,
      
      -- Activity statistics (last 30 days)
      (SELECT COUNT(*) FROM reports WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT as reports_last_30_days,
      
      -- Doctor notes statistics (if table exists)
      CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_notes' AND table_schema = 'public')
        THEN (SELECT COUNT(*) FROM doctor_notes WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT
        ELSE 0::BIGINT
      END as doctor_notes_last_30_days,
      
      -- Notifications statistics (if table exists)
      CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public')
        THEN (SELECT COUNT(*) FROM notifications WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT
        ELSE 0::BIGINT
      END as notifications_last_30_days,
      
      -- Storage statistics
      (SELECT COUNT(*) FROM reports WHERE image_url IS NOT NULL)::BIGINT as reports_with_images,
      
      -- System health
      NOW() as last_updated;
      
    RAISE NOTICE 'System metrics view updated with full functionality';
    
  ELSE
    RAISE NOTICE 'Reports table not found - keeping basic system metrics view';
  END IF;
END $$;

-- Create function to refresh system metrics (useful for admin dashboard)
CREATE OR REPLACE FUNCTION refresh_system_metrics()
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
  RETURN QUERY SELECT * FROM system_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_system_metrics() TO authenticated;