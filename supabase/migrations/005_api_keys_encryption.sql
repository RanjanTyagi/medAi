-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API key usage tracking table
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for API keys
-- Users can view their own API keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all API keys
CREATE POLICY "Admins can view all API keys" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for API key usage
-- Users can view usage of their own API keys
CREATE POLICY "Users can view own API key usage" ON api_key_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM api_keys 
      WHERE api_keys.id = api_key_usage.key_id 
      AND api_keys.user_id = auth.uid()
    )
  );

-- System can insert usage records
CREATE POLICY "System can insert usage records" ON api_key_usage
  FOR INSERT WITH CHECK (true);

-- Admins can view all usage records
CREATE POLICY "Admins can view all usage records" ON api_key_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Add encryption fields to existing tables
-- Add encryption fields to reports table for sensitive data
ALTER TABLE reports ADD COLUMN IF NOT EXISTS encrypted_data JSONB;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS encryption_tag TEXT;

-- Add encryption fields to files/images (if you have a separate files table)
-- This would be for storing encrypted medical images
CREATE TABLE IF NOT EXISTS encrypted_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  encrypted_data TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  encrypted_metadata TEXT,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for encrypted files
CREATE INDEX IF NOT EXISTS idx_encrypted_files_user_id ON encrypted_files(user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_files_report_id ON encrypted_files(report_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_files_created_at ON encrypted_files(created_at DESC);

-- Enable RLS for encrypted files
ALTER TABLE encrypted_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for encrypted files
-- Users can view their own files
CREATE POLICY "Users can view own encrypted files" ON encrypted_files
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own files
CREATE POLICY "Users can create own encrypted files" ON encrypted_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update own encrypted files" ON encrypted_files
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete own encrypted files" ON encrypted_files
  FOR DELETE USING (auth.uid() = user_id);

-- Doctors can view files for reports they have access to
CREATE POLICY "Doctors can view patient files" ON encrypted_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' IN ('doctor', 'admin')
    )
  );

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_encrypted_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

CREATE TRIGGER update_encrypted_files_updated_at
  BEFORE UPDATE ON encrypted_files
  FOR EACH ROW
  EXECUTE FUNCTION update_encrypted_files_updated_at();

-- Create function to clean up expired API keys
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE api_keys 
  SET is_active = FALSE 
  WHERE expires_at < NOW() 
  AND is_active = TRUE;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- Create function to get API key usage statistics
CREATE OR REPLACE FUNCTION get_api_key_stats(
  p_key_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  avg_response_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
    COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
    AVG(response_time) as avg_response_time
  FROM api_key_usage
  WHERE key_id = p_key_id
  AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;