#!/usr/bin/env node

/**
 * Simple Storage Policies Setup Script
 * 
 * This script provides clear instructions for setting up storage policies
 * and verifies your Supabase connection works.
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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('🚀 Storage Policies Setup Helper\n');
  
  try {
    // Test connection
    console.log('🔗 Testing Supabase connection...');
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('   Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully');
    
    // Check if bucket exists
    console.log(`\n🪣 Checking for ${BUCKET_NAME} bucket...`);
    const bucket = data.find(b => b.name === BUCKET_NAME);
    
    if (!bucket) {
      console.error(`❌ Bucket "${BUCKET_NAME}" not found!`);
      console.error('\n📋 Please create the bucket first:');
      console.error('   1. Go to your Supabase Dashboard');
      console.error('   2. Navigate to Storage');
      console.error('   3. Click "New bucket"');
      console.error(`   4. Name it "${BUCKET_NAME}"`);
      console.error('   5. Make sure it\'s set to PRIVATE (not public)');
      console.error('   6. Click "Create bucket"');
      process.exit(1);
    }
    
    console.log(`✅ Bucket "${BUCKET_NAME}" found`);
    console.log(`   - Public: ${bucket.public ? 'Yes ⚠️' : 'No ✅'}`);
    
    if (bucket.public) {
      console.warn('\n⚠️  WARNING: Your bucket is set to PUBLIC!');
      console.warn('   For security, it should be PRIVATE. Please:');
      console.warn('   1. Go to Storage → medical-files → Settings');
      console.warn('   2. Uncheck "Public bucket"');
      console.warn('   3. Save changes');
    }
    
    // Provide manual setup instructions
    console.log('\n📋 MANUAL SETUP REQUIRED:');
    console.log('Since automated policy creation has limitations, please create these policies manually:\n');
    
    console.log('🔗 Go to: Storage → medical-files → Policies in your Supabase Dashboard\n');
    
    const policies = [
      {
        name: 'Users can upload own files',
        operation: 'INSERT',
        expression: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
      },
      {
        name: 'Users can view own files',
        operation: 'SELECT',
        expression: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
      },
      {
        name: 'Doctors and admins can view all files',
        operation: 'SELECT',
        expression: `bucket_id = '${BUCKET_NAME}' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.raw_user_meta_data->>'role' IN ('doctor', 'admin')))`
      },
      {
        name: 'Users can delete own files',
        operation: 'DELETE',
        expression: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
      },
      {
        name: 'Users can update own files',
        operation: 'UPDATE',
        expression: `bucket_id = '${BUCKET_NAME}' AND (storage.foldername(name))[1] = auth.uid()::text`
      }
    ];
    
    policies.forEach((policy, index) => {
      console.log(`📝 Policy ${index + 1}: ${policy.name}`);
      console.log(`   - Click "New Policy"`);
      console.log(`   - Policy Name: ${policy.name}`);
      console.log(`   - Allowed Operation: ${policy.operation}`);
      console.log(`   - Target Roles: authenticated`);
      console.log(`   - Policy Expression:`);
      console.log(`     ${policy.expression}`);
      console.log(`   - Click "Save Policy"`);
      console.log('');
    });
    
    console.log('🎯 Quick Copy-Paste Values:');
    console.log('   You can copy these expressions directly into the Policy Builder:\n');
    
    policies.forEach((policy, index) => {
      console.log(`${index + 1}. ${policy.operation} Policy:`);
      console.log(`   ${policy.expression}\n`);
    });
    
    console.log('✅ After creating all 5 policies, your storage will be secure!');
    console.log('\n🔍 To verify: Go to Storage → medical-files → Policies');
    console.log('   You should see all 5 policies listed');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Create the policies above');
    console.log('   2. Run: npm run dev');
    console.log('   3. Test file upload in your application');
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

main();