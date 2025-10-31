'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<{ data: unknown; error: unknown }>
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ data: User | null; error: unknown }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn('⚠️ Auth initialization timeout (3s) - setting loading to false')
      console.warn('This usually means Supabase is not responding or environment variables are incorrect')
      console.warn('Check: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
      setLoading(false)
    }, 3000) // 3 second timeout (reduced from 5)

    // Get initial session
    console.log('🔐 Initializing auth...')
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout)
        
        if (error) {
          console.error('❌ Failed to get session:', error)
          setLoading(false)
          return
        }
        
        console.log('✅ Session check complete:', session ? 'User logged in' : 'No active session')
        setSession(session)
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error) => {
        clearTimeout(timeout)
        console.error('❌ Session fetch error:', error)
        setLoading(false)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      
      if (session?.user) {
        await fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If user profile doesn't exist, try to create it from auth user
        if (error.code === 'PGRST116') {
          console.log('User profile not found, attempting to create...')
          await createUserProfile(userId)
          return
        }
        console.warn('Profile fetch error, continuing with basic user data:', error)
        // Continue with basic user data from auth
        const { data: authUser } = await supabase.auth.getUser()
        if (authUser.user) {
          setUser({
            id: authUser.user.id,
            name: authUser.user.user_metadata?.name || authUser.user.email || 'User',
            email: authUser.user.email || '',
            role: (authUser.user.user_metadata?.role as any) || 'patient',
            created_at: authUser.user.created_at,
            updated_at: new Date().toISOString()
          })
        }
        return
      }
      setUser(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const createUserProfile = async (userId: string) => {
    try {
      // Get auth user data
      const { data: authUser } = await supabase.auth.getUser()
      if (!authUser.user) return

      // Create user profile
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: authUser.user.user_metadata?.name || authUser.user.email || 'User',
          email: authUser.user.email || '',
          role: (authUser.user.user_metadata?.role as any) || 'patient'
        })
        .select()
        .single()

      if (error) throw error
      setUser(data)
    } catch (error) {
      console.error('Error creating user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, name: string, role: UserRole = 'patient') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
        },
      },
    })

    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return { data, error }
  }

  const signOut = async () => {
    try {
      console.log('🔐 Calling Supabase signOut...')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Supabase signOut error:', error)
        // Don't throw - still clear local state
      } else {
        console.log('✅ Supabase signOut successful')
      }
      
      // Clear local state immediately
      console.log('🧹 Clearing local auth state...')
      setUser(null)
      setSession(null)
      
      console.log('✅ Sign out complete')
    } catch (error) {
      console.error('❌ Sign out failed:', error)
      // Clear local state even if API call fails
      setUser(null)
      setSession(null)
      // Don't throw - we still want to redirect
    }
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return { data: null, error: 'No user logged in' }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data) {
      setUser(data)
    }

    return { data, error }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Custom hooks for role-based access
export function useRequireAuth(requiredRole?: UserRole) {
  const { user, loading } = useAuth()

  if (loading) return { user: null, loading: true, hasAccess: false }

  const hasAccess = !requiredRole || (user && hasRole(user.role, [requiredRole]))

  return { user, loading: false, hasAccess }
}

function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole) || userRole === 'admin'
}