# Storage Policies Setup Script (PowerShell)
# 
# This script automatically creates RLS policies for the medical-files storage bucket
# using the Supabase service role key.
# 
# Usage:
#   .\scripts\setup-storage-policies.ps1
# 
# Requirements:
#   - Node.js installed
#   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
#   - medical-files bucket must already exist

Write-Host "🚀 Setting up storage policies for medical-files bucket..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.local file not found. Please create it with your Supabase credentials." -ForegroundColor Red
    exit 1
}

# Check if required packages are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Run the Node.js script
Write-Host "🔧 Running storage policies setup..." -ForegroundColor Blue
node scripts/setup-storage-policies.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 Storage policies setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Storage policies setup failed. Check the output above for details." -ForegroundColor Red
    exit 1
}