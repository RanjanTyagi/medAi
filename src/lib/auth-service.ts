import { supabase } from './supabaseClient'
import { 
  UserRegistrationInput, 
  UserLoginInput, 
  PasswordResetInput, 
  PasswordUpdateInput,
  UserRole,
  User 
} from '@/types'
import { logger } from './logger'
import { analyticsService } from './analytics-service'
import { errorMonitoring } from './error-monitoring'

export class AuthService {
  // User registration
  static async register(input: UserRegistrationInput) {
    try {
      logger.info('User registration attempt', { email: input.email, role: input.role })

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            role: input.role || 'patient',
          },
        },
      })

      if (error) {
        logger.error('Registration failed', error, { email: input.email })
        throw error
      }

      logger.info('User registered successfully', { 
        userId: data.user?.id, 
        email: input.email 
      })

      // Track registration analytics
      analyticsService.trackAuth('register', data.user?.id, input.role)

      return { data, error: null }
    } catch (error) {
      logger.error('Registration error', error as Error, { email: input.email })
      errorMonitoring.reportAuthError('register', error as Error)
      return { data: null, error }
    }
  }

  // User login
  static async login(input: UserLoginInput) {
    try {
      logger.info('User login attempt', { email: input.email })

      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })

      if (error) {
        logger.error('Login failed', error, { email: input.email })
        throw error
      }

      // Get user profile
      const profile = await this.getUserProfile(data.user.id)

      logger.info('User logged in successfully', { 
        userId: data.user.id, 
        email: input.email,
        role: profile?.role 
      })

      // Track login analytics
      analyticsService.trackAuth('login', data.user.id, profile?.role)

      return { data: { ...data, profile }, error: null }
    } catch (error) {
      logger.error('Login error', error as Error, { email: input.email })
      return { data: null, error }
    }
  }

  // User logout
  static async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        logger.error('Logout failed', error)
        throw error
      }

      logger.info('User logged out successfully')
      
      // Track logout analytics
      analyticsService.trackAuth('logout')
      
      return { error: null }
    } catch (error) {
      logger.error('Logout error', error as Error)
      return { error }
    }
  }

  // Password reset request
  static async requestPasswordReset(input: PasswordResetInput) {
    try {
      logger.info('Password reset requested', { email: input.email })

      const { data, error } = await supabase.auth.resetPasswordForEmail(
        input.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
        }
      )

      if (error) {
        logger.error('Password reset request failed', error, { email: input.email })
        throw error
      }

      logger.info('Password reset email sent', { email: input.email })
      return { data, error: null }
    } catch (error) {
      logger.error('Password reset request error', error as Error, { email: input.email })
      return { data: null, error }
    }
  }

  // Update password
  static async updatePassword(input: PasswordUpdateInput) {
    try {
      logger.info('Password update attempt')

      const { data, error } = await supabase.auth.updateUser({
        password: input.password,
      })

      if (error) {
        logger.error('Password update failed', error)
        throw error
      }

      logger.info('Password updated successfully', { userId: data.user?.id })
      return { data, error: null }
    } catch (error) {
      logger.error('Password update error', error as Error)
      return { data: null, error }
    }
  }

  // Get current user session
  static async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        logger.error('Get session failed', error)
        return { session: null, error }
      }

      return { session, error: null }
    } catch (error) {
      logger.error('Get session error', error as Error)
      return { session: null, error }
    }
  }

  // Get current user
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return { user: null, error }
      }

      // Get user profile from our users table
      const profile = await this.getUserProfile(user.id)
      return { user: profile, error: null }
    } catch (error) {
      logger.error('Get current user error', error as Error)
      return { user: null, error }
    }
  }

  // Get user profile by ID
  static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        logger.error('Get user profile failed', error, { userId })
        return null
      }

      return data
    } catch (error) {
      logger.error('Get user profile error', error as Error, { userId })
      return null
    }
  }

  // Update user profile
  static async updateProfile(userId: string, updates: Partial<User>) {
    try {
      logger.info('Profile update attempt', { userId, updates: Object.keys(updates) })

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Profile update failed', error, { userId })
        throw error
      }

      logger.info('Profile updated successfully', { userId })
      return { data, error: null }
    } catch (error) {
      logger.error('Profile update error', error as Error, { userId })
      return { data: null, error }
    }
  }

  // Update user role (admin only)
  static async updateUserRole(userId: string, role: UserRole, adminUserId: string) {
    try {
      logger.info('User role update attempt', { userId, role, adminUserId })

      // Verify admin permissions
      const admin = await this.getUserProfile(adminUserId)
      if (!admin || admin.role !== 'admin') {
        throw new Error('Insufficient permissions')
      }

      const { data, error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Role update failed', error, { userId, role })
        throw error
      }

      logger.info('User role updated successfully', { userId, role, adminUserId })
      return { data, error: null }
    } catch (error) {
      logger.error('Role update error', error as Error, { userId, role })
      return { data: null, error }
    }
  }

  // Verify email
  static async verifyEmail(token: string) {
    try {
      logger.info('Email verification attempt')

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })

      if (error) {
        logger.error('Email verification failed', error)
        throw error
      }

      logger.info('Email verified successfully', { userId: data.user?.id })
      return { data, error: null }
    } catch (error) {
      logger.error('Email verification error', error as Error)
      return { data: null, error }
    }
  }

  // Refresh session
  static async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        logger.error('Session refresh failed', error)
        throw error
      }

      return { data, error: null }
    } catch (error) {
      logger.error('Session refresh error', error as Error)
      return { data: null, error }
    }
  }

  // Check if user has required role
  static hasRole(user: User | null, requiredRoles: UserRole[]): boolean {
    if (!user) return false
    return requiredRoles.includes(user.role) || user.role === 'admin'
  }

  // Check if user is admin
  static isAdmin(user: User | null): boolean {
    return user?.role === 'admin'
  }

  // Check if user is doctor
  static isDoctor(user: User | null): boolean {
    return user?.role === 'doctor' || user?.role === 'admin'
  }

  // Check if user is patient
  static isPatient(user: User | null): boolean {
    return user?.role === 'patient'
  }

  // Get users list (admin only)
  static async getUsers(adminUserId: string, filters?: {
    role?: UserRole
    search?: string
    limit?: number
    offset?: number
  }) {
    try {
      // Verify admin permissions
      const admin = await this.getUserProfile(adminUserId)
      if (!admin || admin.role !== 'admin') {
        throw new Error('Insufficient permissions')
      }

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })

      // Apply filters
      if (filters?.role) {
        query = query.eq('role', filters.role)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 20)) - 1)
      }

      const { data, error, count } = await query.order('created_at', { ascending: false })

      if (error) {
        logger.error('Get users failed', error)
        throw error
      }

      return { data, count, error: null }
    } catch (error) {
      logger.error('Get users error', error as Error)
      return { data: null, count: 0, error }
    }
  }

  // Delete user account (admin only)
  static async deleteUser(userId: string, adminUserId: string) {
    try {
      logger.info('User deletion attempt', { userId, adminUserId })

      // Verify admin permissions
      const admin = await this.getUserProfile(adminUserId)
      if (!admin || admin.role !== 'admin') {
        throw new Error('Insufficient permissions')
      }

      // Don't allow admin to delete themselves
      if (userId === adminUserId) {
        throw new Error('Cannot delete your own account')
      }

      // Delete user from auth (this will cascade to our users table)
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) {
        logger.error('User deletion failed', error, { userId })
        throw error
      }

      logger.info('User deleted successfully', { userId, adminUserId })
      return { error: null }
    } catch (error) {
      logger.error('User deletion error', error as Error, { userId })
      return { error }
    }
  }
}

// Export individual functions for convenience
export const {
  register,
  login,
  logout,
  requestPasswordReset,
  updatePassword,
  getCurrentSession,
  getCurrentUser,
  getUserProfile,
  updateProfile,
  updateUserRole,
  verifyEmail,
  refreshSession,
  hasRole,
  isAdmin,
  isDoctor,
  isPatient,
  getUsers,
  deleteUser,
} = AuthService