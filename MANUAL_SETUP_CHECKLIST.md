# ✅ Manual Setup Checklist

Before running the AI Medical Diagnosis System, complete these steps:

## 🗄️ Database Setup
- [ ] Create Supabase project
- [ ] Copy project URL and API keys
- [ ] Run migration: `001_initial_schema.sql`
- [ ] Run migration: `002_row_level_security.sql`
- [ ] Run migration: `003_notifications.sql`
- [ ] Run migration: `004_audit_logs.sql`
- [ ] Run migration: `005_api_keys_encryption.sql`
- [ ] Create `medical-files` storage bucket (private)

## 🤖 AI Setup
- [ ] Get Google AI Studio API key
- [ ] Enable Generative Language API
- [ ] Verify billing is enabled

## 🔐 Environment Variables
- [ ] Create `.env.local` file
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Add `GOOGLE_AI_API_KEY`
- [ ] Generate and add `ENCRYPTION_KEY` (32-byte base64)
- [ ] Add `NEXT_PUBLIC_APP_URL`

## 📦 Dependencies
- [ ] Run `npm install`
- [ ] Verify all packages installed correctly

## 🎨 Configuration
- [ ] Update Supabase domain in `next.config.js`
- [ ] Verify middleware configuration

## 👤 User Setup
- [ ] Start dev server: `npm run dev`
- [ ] Register first user
- [ ] Update user role to 'admin' in Supabase Auth
- [ ] Create test doctor user
- [ ] Create test patient user

## 🧪 Testing
- [ ] Test patient symptom submission
- [ ] Test AI diagnosis generation
- [ ] Test doctor verification flow
- [ ] Test admin dashboard access
- [ ] Test notification system

## 🔒 Security Verification
- [ ] Verify encryption is working
- [ ] Test rate limiting
- [ ] Check audit logging
- [ ] Verify RLS policies

---

**📖 For detailed instructions, see [SETUP.md](./SETUP.md)**

**⚠️ The system will NOT work without completing these steps!**