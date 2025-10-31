import { supabase } from './supabaseClient'
import { logger } from './logger'

export interface User {
  id: string
  email: string
  role: string
  name: string
  created_at: string
  updated_at: string
}

export interface CreateUserData {
  email: string
  password: string
  role: string
  full_name?: string
}

export interface UpdateUserData {
  role?: string
  name?: string
  email?: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  details?: any
  ip_address?: string
  user_agent?: string
  created_at: string
  users?: {
    raw_user_meta_data: any
  }[]
}

export interface SystemHealth {
  database: boolean
  storage: boolean
  auth: boolean
  overall: boolean
  timestamp: string
}

export interface UserActivityStats {
  totalUsers: number
  activeUsers: number
  newUsers: number
  dailyActivity: Record<string, number>
}

export class AdminService {
  // User Management
  static async getAllUsers(limit = 50, offset = 0): Promise<{ success: boolean; users?: User[]; total?: number; error?: any }> {
    try {
      const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return {
        success: true,
        users: data || [],
        total: count || 0
      }
    } catch (error) {
      logger.error('Failed to get all users', error as Error)
      return { success: false, error }
    }
  }

  static async getUserById(userId: string): Promise<{ success: boolean; user?: User; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      return { success: true, user: data }
    } catch (error) {
      logger.error('Failed to get user by ID', error as Error)
      return { success: false, error }
    }
  }

  static async createUser(data: CreateUserData, adminId: string): Promise<{ success: boolean; user?: User; error?: any }> {
    try {
      // Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        user_metadata: {
          role: data.role,
          full_name: data.full_name
        },
        email_confirm: true
      })

      if (authError) {
        throw authError
      }

      // Insert user data into our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: data.email,
          role: data.role,
          name: data.full_name || data.email
        })
        .select()
        .single()

      if (userError) {
        // Cleanup: delete the auth user if database insert fails
        await supabase.auth.admin.deleteUser(authUser.user.id)
        throw userError
      }

      // Log the action
      await this.logAction(
        adminId,
        'CREATE_USER',
        'user',
        authUser.user.id,
        { email: data.email, role: data.role }
      )

      return { success: true, user: userData }
    } catch (error) {
      logger.error('Failed to create user', error as Error)
      return { success: false, error }
    }
  }

  static async updateUser(userId: string, data: UpdateUserData, adminId: string): Promise<{ success: boolean; user?: User; error?: any }> {
    try {
      // Update user metadata in Supabase Auth if needed
      if (data.role || data.name) {
        const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            role: data.role,
            name: data.name
          }
        })

        if (authError) {
          throw authError
        }
      }

      // Update user in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update({
          role: data.role,
          name: data.name,
          email: data.email
        })
        .eq('id', userId)
        .select()
        .single()

      if (userError) {
        throw userError
      }

      // Log the action
      await this.logAction(
        adminId,
        'UPDATE_USER',
        'user',
        userId,
        data
      )

      return { success: true, user: userData }
    } catch (error) {
      logger.error('Failed to update user', error as Error)
      return { success: false, error }
    }
  }

  static async deleteUser(userId: string, adminId: string): Promise<{ success: boolean; error?: any }> {
    try {
      // Delete user from Supabase Auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)

      if (authError) {
        throw authError
      }

      // Delete user from our users table (should cascade)
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (userError) {
        throw userError
      }

      // Log the action
      await this.logAction(
        adminId,
        'DELETE_USER',
        'user',
        userId,
        {}
      )

      return { success: true }
    } catch (error) {
      logger.error('Failed to delete user', error as Error)
      return { success: false, error }
    }
  }

  // Audit Logging
  static async logAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; logId?: string; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: userId,
          action: action,
          resource_type: resourceType,
          resource_id: resourceId,
          details: details,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return { success: true, logId: data.id }
    } catch (error) {
      logger.error('Failed to log action', error as Error)
      return { success: false, error }
    }
  }

  static async getAuditLogs(options: {
    limit?: number
    offset?: number
    userId?: string
    action?: string
    resourceType?: string
    startDate?: string
    endDate?: string
  } = {}): Promise<{ success: boolean; logs?: AuditLog[]; total?: number; error?: any }> {
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          users!inner(raw_user_meta_data)
        `, { count: 'exact' })

      // Apply filters
      if (options.userId) {
        query = query.eq('user_id', options.userId)
      }

      if (options.action) {
        query = query.eq('action', options.action)
      }

      if (options.resourceType) {
        query = query.eq('resource_type', options.resourceType)
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate)
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate)
      }

      // Apply pagination and ordering
      const { data, error, count } = await query
        .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return {
        success: true,
        logs: data || [],
        total: count || 0
      }
    } catch (error) {
      logger.error('Failed to get audit logs', error as Error)
      return { success: false, error }
    }
  }

  // System Health
  static async getSystemHealth(): Promise<{ success: boolean; health?: SystemHealth; error?: any }> {
    try {
      const [metricsResult, recentErrorsResult] = await Promise.allSettled([
        supabase.from('system_metrics').select('*').limit(1),
        supabase.from('audit_logs').select('*').eq('action', 'ERROR').limit(1)
      ])

      const health: SystemHealth = {
        database: metricsResult.status === 'fulfilled' && !metricsResult.value.error,
        storage: true, // Assume storage is healthy if we can connect
        auth: true, // Assume auth is healthy if we can connect
        overall: false,
        timestamp: new Date().toISOString()
      }

      health.overall = health.database && health.storage && health.auth

      return { success: true, health }
    } catch (error) {
      logger.error('Failed to get system health', error as Error)
      return { success: false, error }
    }
  }

  // Analytics
  static async getUserActivityStats(days = 30): Promise<{ success: boolean; stats?: UserActivityStats; error?: any }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data: activityStats, error } = await supabase
        .from('audit_logs')
        .select('user_id, created_at')
        .gte('created_at', startDate)

      if (error) {
        throw error
      }

      // Process daily activity
      const dailyActivity: Record<string, number> = {}
      
      activityStats?.forEach((log: any) => {
        const date = new Date(log.created_at).toISOString().split('T')[0]
        dailyActivity[date] = (dailyActivity[date] || 0) + 1
      })

      const stats: UserActivityStats = {
        totalUsers: 0,
        activeUsers: new Set(activityStats?.map((log: any) => log.user_id)).size,
        newUsers: 0,
        dailyActivity
      }

      return { success: true, stats }
    } catch (error) {
      logger.error('Failed to get user activity stats', error as Error)
      return { success: false, error }
    }
  }
}