# Authentication Fix for Dashboard API Calls

## Problem
The dashboards were making unauthenticated API calls, causing errors when trying to fetch real data from the backend. The previous implementation used mock data, but after removing it, the API calls failed because they weren't including JWT authentication tokens.

## Solution
Created an authenticated API client utility that automatically includes JWT tokens from Supabase auth in all API requests.

## Changes Made

### 1. Created API Client Utility (`src/lib/api-client.ts`)
- **Purpose**: Centralized authenticated fetch wrapper
- **Features**:
  - Automatically retrieves and includes JWT token from Supabase session
  - Provides convenience methods for GET, POST, PUT, PATCH, DELETE
  - Handles authentication headers automatically
  - Supports optional authentication bypass for public endpoints

### 2. Updated AdminDashboard (`src/components/admin/AdminDashboard.tsx`)
- **Before**: Used mock data with hardcoded values
- **After**: Makes authenticated API calls to:
  - `/api/admin/health` - System health status
  - `/api/admin/analytics` - User and report analytics
- **Benefits**: Shows real-time system metrics and user statistics

### 3. Updated PatientDashboard (`src/components/patient/PatientDashboard.tsx`)
- **Before**: Used mock data with empty reports
- **After**: Makes authenticated API calls to:
  - `/api/reports/stats` - Patient's report statistics
  - `/api/reports?limit=5` - Recent reports
- **Benefits**: Displays actual patient reports and statistics
- **Bug Fix**: Changed `report.createdAt` to `report.created_at` to match database schema

### 4. Updated DoctorStats (`src/components/doctor/DoctorStats.tsx`)
- **Before**: Used mock data with zero values
- **After**: Makes authenticated API call to:
  - `/api/doctor/stats` - Doctor verification statistics
- **Benefits**: Shows real doctor performance metrics

### 5. Updated VerificationQueue (`src/components/doctor/VerificationQueue.tsx`)
- **Before**: Used mock data with empty queue
- **After**: Makes authenticated API calls to:
  - `/api/doctor/queue?page={page}&limit=10` - Pending reports for verification
  - `/api/doctor/verify` - Submit verification decisions
- **Benefits**: Displays actual pending reports and enables real verification workflow
- **Features**: Supports pagination for large queues

## API Client Usage

### Basic Usage
```typescript
import { api } from '@/lib/api-client'

// GET request
const response = await api.get('/api/endpoint')

// POST request
const response = await api.post('/api/endpoint', { data: 'value' })

// PUT request
const response = await api.put('/api/endpoint', { data: 'value' })

// DELETE request
const response = await api.delete('/api/endpoint')
```

### Advanced Usage
```typescript
// Disable authentication for public endpoints
const response = await api.get('/api/public', { requireAuth: false })

// Custom headers
const response = await api.post('/api/endpoint', body, {
  headers: { 'Custom-Header': 'value' }
})
```

## Authentication Flow

1. **User logs in** → Supabase creates session with JWT token
2. **Component makes API call** → Uses `api.get()` or `api.post()`
3. **API client retrieves token** → Gets current session from Supabase
4. **Token added to headers** → `Authorization: Bearer {token}`
5. **API endpoint validates** → Middleware checks JWT and user permissions
6. **Response returned** → Component receives authenticated data

## Testing

### Expected Behavior
- **With valid session**: API calls succeed and return real data
- **Without session**: API calls fail with 401 Unauthorized
- **Expired token**: Supabase automatically refreshes token

### Manual Testing Steps
1. **Register/Login** as a user
2. **Navigate to dashboard** for your role
3. **Verify data loads** without errors
4. **Check browser console** for successful API calls
5. **Logout and try again** - should see authentication errors

## Benefits

1. **Security**: All API calls now properly authenticated
2. **Real Data**: Dashboards show actual database content
3. **Centralized**: Single place to manage API authentication
4. **Maintainable**: Easy to update authentication logic
5. **Type-Safe**: Full TypeScript support
6. **Error Handling**: Consistent error handling across all API calls

## Next Steps

1. **Test with real users**: Create test accounts and verify workflows
2. **Monitor errors**: Check for authentication failures in production
3. **Add retry logic**: Handle token refresh failures gracefully
4. **Rate limiting**: Ensure API client respects rate limits
5. **Caching**: Consider adding response caching for frequently accessed data

## Related Files

- `src/lib/api-client.ts` - API client utility
- `src/lib/auth-context.tsx` - Authentication context provider
- `src/lib/supabaseClient.ts` - Supabase client configuration
- `middleware.ts` - API route authentication middleware
- All dashboard components in `src/components/`

## Status

✅ **Complete** - All dashboards now use authenticated API calls
✅ **Tested** - No TypeScript errors
⏳ **Pending** - Manual testing with real user accounts
