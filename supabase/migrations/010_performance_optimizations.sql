-- Performance Optimization Migration
-- This migration adds database optimizations for better query performance

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reports_user_status_created 
ON public.reports(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status_created 
ON public.reports(status, created_at DESC) 
WHERE status IN ('pending', 'reviewed');

CREATE INDEX IF NOT EXISTS idx_reports_ai_output_gin 
ON public.reports USING GIN(ai_output);

CREATE INDEX IF NOT EXISTS idx_doctor_notes_report_verified 
ON public.doctor_notes(report_id, verified, created_at DESC);

-- Add partial indexes for frequently filtered data
CREATE INDEX IF NOT EXISTS idx_reports_pending 
ON public.reports(created_at DESC) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reports_verified 
ON public.reports(created_at DESC) 
WHERE status = 'verified';

-- Add text search index for symptoms
CREATE INDEX IF NOT EXISTS idx_reports_symptoms_gin 
ON public.reports USING GIN(to_tsvector('english', symptoms));

-- Create materialized view for report statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS report_stats AS
SELECT 
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
  COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed_reports,
  COUNT(*) FILTER (WHERE status = 'verified') as verified_reports,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_reports,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as reports_this_week,
  COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as reports_this_month,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time_seconds
FROM public.reports;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS report_stats_unique ON report_stats ((1));

-- Function to refresh report stats
CREATE OR REPLACE FUNCTION refresh_report_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW report_stats;
END;
$$ LANGUAGE plpgsql;

-- Create user statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
  u.role,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE u.created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_this_month
FROM public.users u
GROUP BY u.role;

-- Create unique index on user stats
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_role_unique ON user_stats (role);

-- Function to refresh user stats
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW user_stats;
END;
$$ LANGUAGE plpgsql;

-- Optimize existing queries with better statistics
ANALYZE public.reports;
ANALYZE public.users;
ANALYZE public.doctor_notes;

-- Create function for efficient report search with full-text search
CREATE OR REPLACE FUNCTION search_reports_fts(
  search_query text,
  user_role text DEFAULT 'patient',
  requesting_user_id uuid DEFAULT NULL,
  limit_count int DEFAULT 20,
  offset_count int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  symptoms text,
  image_url text,
  ai_output jsonb,
  status report_status,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
) AS $$
BEGIN
  IF user_role = 'patient' THEN
    RETURN QUERY
    SELECT r.id, r.user_id, r.symptoms, r.image_url, r.ai_output, 
           r.status, r.created_at, r.updated_at,
           ts_rank(to_tsvector('english', r.symptoms), plainto_tsquery('english', search_query)) as rank
    FROM public.reports r
    WHERE r.user_id = requesting_user_id
      AND to_tsvector('english', r.symptoms) @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC, r.created_at DESC
    LIMIT limit_count OFFSET offset_count;
  ELSE
    RETURN QUERY
    SELECT r.id, r.user_id, r.symptoms, r.image_url, r.ai_output, 
           r.status, r.created_at, r.updated_at,
           ts_rank(to_tsvector('english', r.symptoms), plainto_tsquery('english', search_query)) as rank
    FROM public.reports r
    WHERE to_tsvector('english', r.symptoms) @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC, r.created_at DESC
    LIMIT limit_count OFFSET offset_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function for efficient pending reports queue
CREATE OR REPLACE FUNCTION get_pending_reports_queue(
  limit_count int DEFAULT 20,
  offset_count int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  symptoms text,
  image_url text,
  ai_output jsonb,
  status report_status,
  created_at timestamptz,
  updated_at timestamptz,
  patient_name text,
  patient_email text,
  wait_time_hours numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.symptoms, r.image_url, r.ai_output, 
         r.status, r.created_at, r.updated_at,
         u.name as patient_name, u.email as patient_email,
         EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 as wait_time_hours
  FROM public.reports r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.status = 'pending'
  ORDER BY r.created_at ASC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically refresh stats on report changes
CREATE OR REPLACE FUNCTION trigger_refresh_report_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_notify to trigger async refresh
  PERFORM pg_notify('refresh_stats', 'reports');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic stats refresh
DROP TRIGGER IF EXISTS reports_stats_refresh ON public.reports;
CREATE TRIGGER reports_stats_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.reports
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_report_stats();

-- Add database configuration optimizations
-- Note: These would typically be set at the database level, not in migrations
-- But we can create a function to suggest optimal settings

CREATE OR REPLACE FUNCTION get_performance_recommendations()
RETURNS TABLE (
  setting_name text,
  current_value text,
  recommended_value text,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'shared_buffers'::text,
    current_setting('shared_buffers'),
    '256MB'::text,
    'Amount of memory for shared buffer cache'::text
  UNION ALL
  SELECT 
    'effective_cache_size'::text,
    current_setting('effective_cache_size'),
    '1GB'::text,
    'Estimate of memory available for disk caching'::text
  UNION ALL
  SELECT 
    'work_mem'::text,
    current_setting('work_mem'),
    '4MB'::text,
    'Memory for internal sort operations and hash tables'::text
  UNION ALL
  SELECT 
    'maintenance_work_mem'::text,
    current_setting('maintenance_work_mem'),
    '64MB'::text,
    'Memory for maintenance operations like VACUUM and CREATE INDEX'::text;
END;
$$ LANGUAGE plpgsql;

-- Create function to monitor slow queries
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE (
  query text,
  calls bigint,
  total_time double precision,
  mean_time double precision,
  rows bigint
) AS $$
BEGIN
  -- This requires pg_stat_statements extension
  -- Return empty result if extension is not available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    pss.query,
    pss.calls,
    pss.total_exec_time as total_time,
    pss.mean_exec_time as mean_time,
    pss.rows
  FROM pg_stat_statements pss
  WHERE pss.mean_exec_time > 100 -- queries taking more than 100ms on average
  ORDER BY pss.mean_exec_time DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON INDEX idx_reports_user_status_created IS 'Composite index for user reports filtered by status and ordered by creation date';
COMMENT ON INDEX idx_reports_symptoms_gin IS 'GIN index for full-text search on symptoms';
COMMENT ON MATERIALIZED VIEW report_stats IS 'Cached statistics for reports dashboard';
COMMENT ON FUNCTION search_reports_fts IS 'Full-text search function for reports with role-based filtering';
COMMENT ON FUNCTION get_pending_reports_queue IS 'Optimized function for doctor verification queue';