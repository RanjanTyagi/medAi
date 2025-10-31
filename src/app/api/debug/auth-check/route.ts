import { NextRequest, NextResponse } from 'next/server'
import { validateAuthToken } from '@/lib/auth'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    console.log('=== AUTH DEBUG ===')
    console.log('Has Authorization header:', !!token)
    console.log('Token length:', token?.length || 0)
    
    // Try to validate the token
    const { user, error } = await validateAuthToken(request)
    
    console.log('Validation result:', { 
      hasUser: !!user, 
      error,
      userId: user?.id 
    })
    
    // Check if user exists in database
    let dbUser = null
    if (user?.id) {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      dbUser = data
      console.log('DB User:', { exists: !!data, error: dbError })
    }
    
    // Check auth.users
    let authUser = null
    if (token) {
      const { data, error: authError } = await supabase.auth.getUser(token)
      authUser = data.user
      console.log('Auth User:', { exists: !!data.user, error: authError })
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        validationError: error,
        user: user ? {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        } : null,
        dbUser: dbUser ? {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role
        } : null,
        authUser: authUser ? {
          id: authUser.id,
          email: authUser.email
        } : null
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}
