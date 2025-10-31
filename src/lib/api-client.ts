/**
 * API Client Utility
 * Provides authenticated fetch wrapper for API calls
 */

import { supabase } from './supabaseClient'

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean
}

/**
 * Authenticated fetch wrapper that automatically includes JWT token
 */
export async function apiClient(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { requireAuth = true, headers = {}, ...restOptions } = options

  // Get current session token
  let authHeaders: Record<string, string> = {}
  
  if (requireAuth) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      authHeaders = {
        'Authorization': `Bearer ${session.access_token}`
      }
    }
  }

  // Merge headers
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...headers
  }

  // Make the request
  const response = await fetch(url, {
    ...restOptions,
    headers: finalHeaders
  })

  // Silently return response without logging
  return response
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (url: string, options?: ApiRequestOptions) =>
    apiClient(url, { ...options, method: 'GET' }),

  post: (url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiClient(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),

  put: (url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiClient(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),

  patch: (url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiClient(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    }),

  delete: (url: string, options?: ApiRequestOptions) =>
    apiClient(url, { ...options, method: 'DELETE' })
}
