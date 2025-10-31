# 🔐 Storage Policies Setup Scripts

This directory contains scripts to automatically set up Row Level Security (RLS) policies for the `medical-files` storage bucket in Supabase.

## 📋 Prerequisites

Before running these scripts, ensure you have:

1. **Created the `medical-files` bucket** in your Supabase project (must be private)
2. **Environment variables** configured in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
3. **Node.js** installed on your system
4. **Dependencies** installed: `npm install`

## 🚀 Usage

### Method 1: NPM Script (Recommended)
```bash
npm run setup:storage
```

### Method 2: Direct Node.js
```bash
node scripts/setup-storage-policies.js
```

### Method 3: PowerShell (Windows)
```powershell
.\scripts\setup-storage-policies.ps1
```

## 🔍 What the Script Does

The script automatically:

1. **Verifies** the `medical-files` bucket exists
2. **Enables RLS** on the `storage.objects` table
3. **Drops existing policies** (if any) to avoid conflicts
4. **Creates 5 new policies**:
   - Users can upload their own files
   - Users can view their own files
   - Doctors/admins can view all files
   - Users can delete their own files
   - Users can update their own files
5. **Verifies** the policies were created successfully

## 📁 File Structure

The policies organize files by user ID:
```
medical-files/
├── {user-id-1}/
│   ├── medical-image-1.jpg
│   └── report-1.pdf
├── {user-id-2}/
│   ├── medical-image-2.jpg
│   └── report-2.pdf
└── ...
```

## 🔒 Security Rules

- **Patients** can only access files in their own folder (`{user-id}/`)
- **Doctors** can access all patient files (based on `role` in user metadata)
- **Admins** can access all files (based on `role` in user metadata)
- **Anonymous users** have no access

## 🛠️ Troubleshooting

### Error: "Bucket not found"
- Create the `medical-files` bucket in Supabase Dashboard
- Ensure it's set to **Private** (not Public)

### Error: "Missing environment variables"
- Check your `.env.local` file exists
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Make sure there are no extra spaces or quotes

### Error: "Permission denied"
- Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct
- Ensure you're using the **service role key**, not the anon key

### Error: "Policy already exists"
- The script handles this automatically by dropping existing policies first
- If issues persist, manually delete policies in Supabase Dashboard first

### Policies not working in app
- Check that user roles are properly set in `auth.users.raw_user_meta_data`
- Verify file paths follow the `{user-id}/filename` structure
- Test with different user roles (patient, doctor, admin)

## 🔄 Manual Fallback

If the script fails, you can create policies manually via Supabase Dashboard:

1. Go to **Storage** → **medical-files** → **Policies**
2. Click **"New Policy"** for each policy
3. Use the policy expressions from the script comments

## 📝 Policy Details

### Policy 1: Upload Own Files
- **Operation**: INSERT
- **Target**: authenticated users
- **Rule**: `bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text`

### Policy 2: View Own Files
- **Operation**: SELECT
- **Target**: authenticated users  
- **Rule**: `bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text`

### Policy 3: Doctors/Admins View All
- **Operation**: SELECT
- **Target**: authenticated users
- **Rule**: `bucket_id = 'medical-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.raw_user_meta_data->>'role' IN ('doctor', 'admin')))`

### Policy 4: Delete Own Files
- **Operation**: DELETE
- **Target**: authenticated users
- **Rule**: `bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text`

### Policy 5: Update Own Files
- **Operation**: UPDATE
- **Target**: authenticated users
- **Rule**: `bucket_id = 'medical-files' AND (storage.foldername(name))[1] = auth.uid()::text`

## ✅ Verification

After running the script, verify it worked by:

1. **Check Supabase Dashboard**: Storage → medical-files → Policies
2. **Test file upload** through your application
3. **Test access control** with different user roles
4. **Check file organization** follows the user-id folder structure

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Try the manual fallback method
4. Check Supabase logs for detailed error messages