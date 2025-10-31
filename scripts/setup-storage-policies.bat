@echo off
REM Storage Policies Setup Script (Batch)
REM 
REM This script automatically creates RLS policies for the medical-files storage bucket
REM 
REM Usage: .\scripts\setup-storage-policies.bat
REM 
REM Requirements:
REM   - Node.js installed
REM   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
REM   - medical-files bucket must already exist

echo 🚀 Setting up storage policies for medical-files bucket...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Check if .env.local exists
if not exist ".env.local" (
    echo ❌ .env.local file not found. Please create it with your Supabase credentials.
    pause
    exit /b 1
)

echo ✅ Environment file found

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Run the Node.js script
echo 🔧 Running storage policies setup...
node scripts/setup-storage-policies.js

if %errorlevel% equ 0 (
    echo.
    echo 🎉 Storage policies setup completed successfully!
) else (
    echo.
    echo ❌ Storage policies setup failed. Check the output above for details.
    pause
    exit /b 1
)

echo.
echo Press any key to continue...
pause >nul