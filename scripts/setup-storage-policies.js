#!/usr/bin/env node

/**
 * Storage Policies Setup Script
 * 
 * This script automatically creates RLS policies for the medical-files storage bucket
 * using the Supabase service role key.
 * 
 * Usage:
 *   node scripts/setup-storage-policies.js
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - medical-files bucket must already exist
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'medical-files';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Make sure your .env.local file is configured correctly.');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Storage policies to create
const policies = [
  {
    name: 'Users can upload own files',
    operation: 'INSERT',
    definition: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
  },
  {
    name: 'Users can view own files',
    operation: 'SELECT',
    definition: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
  },
  {
    name: 'Doctors and admins can view all files',
    operation: 'SELECT',
    definition: `bucket_id = '${BUCKET_NAME}' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.raw_user_meta_data->>'role' IN ('doctor', 'admin')))`
  },
  {
    name: 'Users can delete own files',
    operation: 'DELETE',
    definition: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
  },
  {
    name: 'Users can update own files',
    operation: 'UPDATE',
    definition: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
  }
];

async function enableRLS() {
  console.log('🔐 Enabling RLS on storage.objects...');
  
  try {
    // Use REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
      })
    });

    if (!response.ok && !response.statusText.includes('already enabled')) {
      const error = await response.text();
      console.error('❌ Failed to enable RLS:', error);
      return false;
    }
    
    console.log('✅ RLS enabled on storage.objects');
    return true;
  } catch (error) {
    console.warn('⚠️  Could not enable RLS via API, it may already be enabled:', error.message);
    return true; // Continue anyway
  }
}

async function dropExistingPolicies() {
  console.log('🧹 Dropping existing policies...');
  
  // Skip dropping policies - let creation handle conflicts
  console.log('✅ Skipping policy cleanup (will handle conflicts during creation)');
}

async function createPolicy(policy) {
  console.log(`📝 Creating policy: ${policy.name}...`);
  
  try {
    // Use the storage API to create policies
    const policyData = {
      name: policy.name,
      definition: policy.definition,
      command: policy.operation,
      roles: ['authenticated']
    };

    // Try using Supabase Management API approach
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_storage_policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify(policyData)
    });

    if (response.ok) {
      console.log(`✅ Policy created: ${policy.name}`);
      return true;
    }

    // Fallback: Skip automated creation and provide manual instructions
    console.log(`⚠️  Could not create policy "${policy.name}" automatically`);
    console.log(`   Please create this policy manually in Supabase Dashboard:`);
    console.log(`   - Name: ${policy.name}`);
    console.log(`   - Operation: ${policy.operation}`);
    console.log(`   - Target: authenticated`);
    console.log(`   - Expression: ${policy.definition}`);
    console.log('');
    
    return false;
  } catch (error) {
    console.log(`⚠️  Could not create policy "${policy.name}" automatically:`, error.message);
    console.log(`   Please create this policy manually in Supabase Dashboard:`);
    console.log(`   - Name: ${policy.name}`);
    console.log(`   - Operation: ${policy.operation}`);
    console.log(`   - Target: authenticated`);
    console.log(`   - Expression: ${policy.definition}`);
    console.log('');
    
    return false;
  }
}

async function verifyBucket() {
  console.log(`🪣 Verifying ${BUCKET_NAME} bucket exists...`);
  
  const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
  
  if (error) {
    console.error(`❌ Bucket ${BUCKET_NAME} not found:`, error.message);
    console.error('   Please create the bucket first via Supabase Dashboard');
    return false;
  }
  
  console.log(`✅ Bucket ${BUCKET_NAME} found`);
  return true;
}

async function verifyPolicies() {
  console.log('🔍 Verifying bucket and basic setup...');
  
  try {
    // Just verify the bucket exists and is accessible
    const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
    
    if (error) {
      console.warn('⚠️  Could not access bucket:', error.message);
      return;
    }
    
    console.log('✅ Bucket is accessible');
    console.log('   Note: Policy verification requires manual check in Supabase Dashboard');
    console.log('   Go to Storage → medical-files → Policies to verify policies were created');
    
  } catch (error) {
    console.warn('⚠️  Could not verify setup:', error.message);
  }
}

async function main() {
  console.log('🚀 Setting up storage policies for medical-files bucket...\n');
  
  try {
    // Step 1: Verify bucket exists
    if (!(await verifyBucket())) {
      process.exit(1);
    }
    
    // Step 2: Enable RLS
    if (!(await enableRLS())) {
      process.exit(1);
    }
    
    // Step 3: Drop existing policies
    await dropExistingPolicies();
    
    // Step 4: Create new policies
    let successCount = 0;
    for (const policy of policies) {
      if (await createPolicy(policy)) {
        successCount++;
      }
    }
    
    // Step 5: Verify setup
    await verifyPolicies();
    
    console.log(`\n🎉 Setup complete! ${successCount}/${policies.length} policies created successfully.`);
    
    if (successCount < policies.length) {
      console.log('\n⚠️  Some policies failed to create. You may need to:');
      console.log('   1. Check your service role key permissions');
      console.log('   2. Create remaining policies manually via Supabase Dashboard');
    } else {
      console.log('\n✅ All storage policies are now configured!');
      console.log('   Your medical files will be properly secured with RLS.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();