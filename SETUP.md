# 🏥 AI Medical Diagnosis System - Setup Guide

## 📋 Manual Setup Requirements

Before running the application, you need to complete these manual setup steps:

## 1. 🗄️ Database Setup (Supabase)

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key
3. Go to Project Settings → API to find your service role key

### Run Database Migrations
```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project reference)
supabase link --project-ref YOUR_PROJECT_REF

# Run all migrations in order
supabase db push
```

**Or manually run each migration in Supabase SQL Editor (IN THIS ORDER):**
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_row_level_security.sql`
3. `supabase/migrations/003_notifications.sql`
4. `supabase/migrations/004_audit_logs_safe.sql` ⚠️ **Use the _safe version**
5. `supabase/migrations/005_api_keys_encryption.sql`
6. `supabase/migrations/006_update_system_metrics.sql`

**⚠️ IMPORTANT**: If you get errors with `004_audit_logs.sql`, use `004_audit_logs_safe.sql` instead!

### Configure Storage Bucket
1. Go to Storage in Supabase dashboard
2. Create a new bucket named `medical-files`
3. Set bucket to **private** (not public)
4. Configure RLS policies for the bucket

## 2. 🤖 Google Gemini AI Setup

### Get API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Save the API key securely

### Enable Required APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Generative Language API
3. Ensure your project has billing enabled

## 3. 🔐 Environment Variables Setup

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini AI
GOOGLE_AI_API_KEY=your-gemini-api-key

# Encryption (Generate a 32-byte base64 key)
ENCRYPTION_KEY=your-base64-encryption-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Optional: For production
# VERCEL_URL=your-production-url
```

### Generate Encryption Key
Run this command to generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4. 📦 Install Dependencies

```bash
# Install all dependencies
npm install

# Or if you prefer yarn
yarn install
```

## 5. 🎨 UI Components Setup

The project uses custom UI components. Ensure all component files are in place:
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Input.tsx`
- All other UI components

## 6. 🔧 Configuration Files

### Update next.config.js
Update the domain in `next.config.js` for your Supabase project:

```javascript
// In next.config.js, update the images domains
images: {
  domains: ['your-project.supabase.co'], // Replace with your Supabase URL
  // ... rest of config
}
```

### Middleware Configuration
The middleware is already configured but ensure your routes match your needs.

## 7. 🚀 First Run Setup

### Start the Development Server
```bash
npm run dev
# or
yarn dev
```

### Create Admin User
1. Register a new user through the UI
2. Go to Supabase Auth dashboard
3. Find the user and update their `raw_user_meta_data` to include:
   ```json
   {
     "name": "Admin User",
     "role": "admin"
   }
   ```

### Create Test Doctor
1. Register another user
2. Update their role to `doctor` in the same way

## 8. 🧪 Test the System

### Test Patient Flow
1. Register as a patient
2. Submit symptoms with an image
3. Check if AI analysis works

### Test Doctor Flow
1. Login as doctor
2. Check verification queue
3. Verify a report

### Test Admin Flow
1. Login as admin
2. Check user management
3. View audit logs and analytics

## 9. 🔒 Security Checklist

### Production Security
- [ ] Change all default passwords
- [ ] Use strong encryption keys
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Configure backup strategies

### Environment Security
- [ ] Never commit `.env.local` to git
- [ ] Use different keys for development/production
- [ ] Rotate API keys regularly
- [ ] Monitor for security alerts

## 10. 📊 Optional: Monitoring Setup

### Vercel Analytics (if deploying to Vercel)
1. Enable Vercel Analytics in your project
2. Add analytics tracking code

### Error Monitoring
Consider setting up:
- Sentry for error tracking
- LogRocket for session replay
- Custom monitoring dashboards

## 🚨 Common Issues & Solutions

### Database Migration Issues
**Error: "invalid input value for enum report_status"**
- Use `004_audit_logs_safe.sql` instead of `004_audit_logs.sql`
- Run migrations in the exact order specified
- Make sure `001_initial_schema.sql` runs successfully first

**Error: "relation does not exist"**
- Run migrations in order: 001 → 002 → 003 → 004_safe → 005 → 006
- Check if previous migrations completed successfully
- Verify you're running in the correct database

### Database Connection Issues
- Verify Supabase URL and keys in `.env.local`
- Check if RLS policies are correctly set
- Ensure all 6 migrations ran successfully
- Check Supabase dashboard for any error messages

### AI API Issues
- Verify Google AI API key is correct
- Check API quotas and billing in Google Cloud Console
- Ensure Generative Language API is enabled
- Test API key with a simple curl request first

### File Upload Issues
- Create `medical-files` bucket in Supabase Storage
- Set bucket to **private** (not public)
- Verify bucket permissions and RLS policies
- Check file size limits (default 10MB)

### Authentication Issues
- Check JWT configuration in Supabase
- Verify middleware setup and routes
- Ensure user roles are set correctly in `raw_user_meta_data`
- Check if email confirmation is required

### Environment Variable Issues
- Ensure all required variables are in `.env.local`
- Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Don't commit `.env.local` to git
- Restart dev server after changing environment variables

## 📞 Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs
3. Verify all environment variables are set
4. Ensure all migrations have run
5. Check Supabase dashboard for any issues

## 🎯 Next Steps

Once setup is complete:
1. Test all user flows
2. Customize the UI/UX as needed
3. Add any additional features
4. Prepare for production deployment
5. Set up monitoring and backups

---

**⚠️ Important**: This is a medical application. Ensure you comply with all relevant healthcare regulations (HIPAA, GDPR, etc.) in your jurisdiction before deploying to production.