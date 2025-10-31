import { createClient } from '@supabase/supabase-js'
import { SecurityService } from './security-service'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AccessControlContext {
  userId: string
  userRole: 'patient' | 'doctor' | 'admin'
  ip?: string
  userAgent?: string
  sessionId?: string
}

export interface ResourcePermissions {
  read: boolean
  write: boolean
  delete: boolean
  admin: boolean
}

export interface AccessLog {
  userId: string
  resourceType: string
  resourceId: string
  action: string
  granted: boolean
  reason?: string
  timestamp: Date
  ip?: string
  userAgent?: string
}

export class AccessControlService {
  // Define role-based permissions
  private static readonly ROLE_PERMISSIONS = {
    patient: {
      reports: { read: true, write: true, delete: false, admin: false },
      own_reports: { read: true, write: true, delete: true, admin: false },
      notifications: { read: true, write: false, delete: true, admin: false },
      profile: { read: true, write: true, delete: false, admin: false }
    },
    doctor: {
      reports: { read: true, write: true, delete: false, admin: false },
      all_reports: { read: true, write: true, delete: false, admin: false },
      doctor_notes: { read: true, write: true, delete: true, admin: false },
      notifications: { read: true, write: false, delete: true, admin: false },
      profile: { read: true, write: true, delete: false, admin: false },
      verification: { read: true, write: true, delete: false, admin: false }
    },
    admin: {
      users: { read: true, write: true, delete: true, admin: true },
      reports: { read: true, write: true, delete: true, admin: true },
      notifications: { read: true, write: true, delete: true, admin: true },
      audit_logs: { read: true, write: false, delete: false, admin: true },
      system: { read: true, write: true, delete: false, admin: true },
      profile: { read: true, write: true, delete: false, admin: false }
    }
  }

  // Check if user has permission for a resource
  static async checkPermission(
    context: AccessControlContext,
    resourceType: string,
    resourceId: string,
    action: 'read' | 'write' | 'delete' | 'admin'
  ): Promise<{ granted: boolean; reason?: string }> {
    try {
      // Get base permissions for user role
      const rolePermissions = this.ROLE_PERMISSIONS[context.userRole]
      if (!rolePermissions) {
        await this.logAccess({
          userId: context.userId,
          resourceType,
          resourceId,
          action,
          granted: false,
          reason: 'Invalid user role',
          timestamp: new Date(),
          ip: context.ip,
          userAgent: context.userAgent
        })
        return { granted: false, reason: 'Invalid user role' }
      }

      // Check resource-specific permissions
      let permissions: ResourcePermissions | undefined

      // Handle ownership-based permissions
      if (resourceType === 'report' && context.userRole === 'patient') {
        const isOwner = await this.checkReportOwnership(context.userId, resourceId)
        permissions = isOwner ? rolePermissions.own_reports : rolePermissions.reports
      } else if (resourceType === 'user' && context.userId === resourceId) {
        // Users can always access their own profile
        permissions = rolePermissions.profile
      } else {
        // Use general resource permissions
        permissions = rolePermissions[resourceType as keyof typeof rolePermissions] as ResourcePermissions
      }

      if (!permissions) {
        await this.logAccess({
          userId: context.userId,
          resourceType,
          resourceId,
          action,
          granted: false,
          reason: 'No permissions defined for resource type',
          timestamp: new Date(),
          ip: context.ip,
          userAgent: context.userAgent
        })
        return { granted: false, reason: 'No permissions defined for resource type' }
      }

      // Check specific action permission
      const granted = permissions[action]

      // Additional security checks
      if (granted) {
        // Check for suspicious access patterns
        const riskAssessment = await this.assessAccessRisk(context, resourceType, resourceId, action)
        if (riskAssessment.risk === 'high') {
          await this.logAccess({
            userId: context.userId,
            resourceType,
            resourceId,
            action,
            granted: false,
            reason: `High risk access blocked: ${riskAssessment.reason}`,
            timestamp: new Date(),
            ip: context.ip,
            userAgent: context.userAgent
          })
          return { granted: false, reason: 'Access blocked due to security concerns' }
        }
      }

      // Log access attempt
      await this.logAccess({
        userId: context.userId,
        resourceType,
        resourceId,
        action,
        granted,
        reason: granted ? 'Permission granted' : 'Insufficient permissions',
        timestamp: new Date(),
        ip: context.ip,
        userAgent: context.userAgent
      })

      return { granted, reason: granted ? undefined : 'Insufficient permissions' }

    } catch (error) {
      logger.error('Access control check failed', error as Error)
      
      await this.logAccess({
        userId: context.userId,
        resourceType,
        resourceId,
        action,
        granted: false,
        reason: 'Access control system error',
        timestamp: new Date(),
        ip: context.ip,
        userAgent: context.userAgent
      })

      return { granted: false, reason: 'Access control system error' }
    }
  }

  // Check if user owns a specific report
  private static async checkReportOwnership(userId: string, reportId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single()

      if (error || !data) {
        return false
      }

      return data.user_id === userId
    } catch (error) {
      logger.error('Failed to check report ownership', error as Error)
      return false
    }
  }

  // Assess risk of access attempt
  private static async assessAccessRisk(
    context: AccessControlContext,
    resourceType: string,
    resourceId: string,
    action: string
  ): Promise<{ risk: 'low' | 'medium' | 'high'; reason?: string }> {
    try {
      // Check for rapid successive access attempts
      const recentAccesses = await this.getRecentAccesses(context.userId, 5 * 60 * 1000) // 5 minutes
      if (recentAccesses.length > 50) {
        return { risk: 'high', reason: 'Too many recent access attempts' }
      }

      // Check for access to sensitive resources
      const sensitiveResources = ['admin', 'audit_logs', 'system']
      if (sensitiveResources.includes(resourceType) && context.userRole !== 'admin') {
        return { risk: 'high', reason: 'Non-admin accessing sensitive resource' }
      }

      // Check for unusual access patterns
      if (action === 'delete' && resourceType === 'report') {
        const reportAge = await this.getResourceAge('reports', resourceId)
        if (reportAge && reportAge < 24 * 60 * 60 * 1000) { // Less than 24 hours old
          return { risk: 'medium', reason: 'Attempting to delete recent report' }
        }
      }

      // Check IP reputation if available
      if (context.ip) {
        const ipRisk = SecurityService.assessIPRisk(context.ip, context.userAgent)
        if (ipRisk === 'high') {
          return { risk: 'high', reason: 'High-risk IP address' }
        }
      }

      return { risk: 'low' }

    } catch (error) {
      logger.error('Risk assessment failed', error as Error)
      return { risk: 'medium', reason: 'Risk assessment system error' }
    }
  }

  // Get recent access attempts for a user
  private static async getRecentAccesses(userId: string, timeWindowMs: number): Promise<AccessLog[]> {
    try {
      const since = new Date(Date.now() - timeWindowMs)
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get recent accesses', error)
        return []
      }

      return data?.map(log => ({
        userId: log.user_id,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        action: log.action,
        granted: !log.action.includes('DENIED'),
        timestamp: new Date(log.created_at),
        ip: log.ip_address,
        userAgent: log.user_agent
      })) || []

    } catch (error) {
      logger.error('Failed to get recent accesses', error as Error)
      return []
    }
  }

  // Get age of a resource
  private static async getResourceAge(table: string, resourceId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('created_at')
        .eq('id', resourceId)
        .single()

      if (error || !data) {
        return null
      }

      return Date.now() - new Date(data.created_at).getTime()
    } catch (error) {
      logger.error('Failed to get resource age', error as Error)
      return null
    }
  }

  // Log access attempt
  private static async logAccess(accessLog: AccessLog): Promise<void> {
    try {
      // Log to audit system
      await SecurityService.logAction(
        accessLog.userId,
        `ACCESS_${accessLog.granted ? 'GRANTED' : 'DENIED'}_${accessLog.action.toUpperCase()}`,
        accessLog.resourceType,
        accessLog.resourceId,
        {
          action: accessLog.action,
          granted: accessLog.granted,
          reason: accessLog.reason,
          ip: accessLog.ip,
          userAgent: accessLog.userAgent
        },
        accessLog.ip,
        accessLog.userAgent
      )

      // Log security event for denied access
      if (!accessLog.granted) {
        await SecurityService.logSecurityEvent(
          'ACCESS_DENIED',
          accessLog.ip || 'unknown',
          {
            userId: accessLog.userId,
            resourceType: accessLog.resourceType,
            resourceId: accessLog.resourceId,
            action: accessLog.action,
            reason: accessLog.reason,
            userAgent: accessLog.userAgent
          },
          accessLog.userId
        )
      }

    } catch (error) {
      logger.error('Failed to log access attempt', error as Error)
    }
  }

  // Validate data access based on context
  static async validateDataAccess(
    context: AccessControlContext,
    dataType: 'medical_image' | 'report_data' | 'personal_info' | 'system_data',
    ownerId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check basic permissions
      if (dataType === 'system_data' && context.userRole !== 'admin') {
        return { allowed: false, reason: 'Admin access required for system data' }
      }

      // Check ownership for personal data
      if ((dataType === 'medical_image' || dataType === 'personal_info') && ownerId) {
        if (context.userRole === 'patient' && context.userId !== ownerId) {
          return { allowed: false, reason: 'Can only access own personal data' }
        }
        
        if (context.userRole === 'doctor') {
          // Doctors can access patient data they are treating
          const hasAccess = await this.checkDoctorPatientRelationship(context.userId, ownerId)
          if (!hasAccess) {
            return { allowed: false, reason: 'No doctor-patient relationship' }
          }
        }
      }

      // Additional security checks
      const riskAssessment = await this.assessAccessRisk(context, dataType, ownerId || 'unknown', 'read')
      if (riskAssessment.risk === 'high') {
        return { allowed: false, reason: `Access blocked: ${riskAssessment.reason}` }
      }

      return { allowed: true }

    } catch (error) {
      logger.error('Data access validation failed', error as Error)
      return { allowed: false, reason: 'Access validation system error' }
    }
  }

  // Check doctor-patient relationship
  private static async checkDoctorPatientRelationship(doctorId: string, patientId: string): Promise<boolean> {
    try {
      // Check if doctor has reviewed any reports from this patient
      const { data, error } = await supabase
        .from('doctor_notes')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('report_id', supabase
          .from('reports')
          .select('id')
          .eq('user_id', patientId)
        )
        .limit(1)

      return !error && data && data.length > 0
    } catch (error) {
      logger.error('Failed to check doctor-patient relationship', error as Error)
      return false
    }
  }

  // Create access control middleware
  static createAccessMiddleware(
    resourceType: string,
    action: 'read' | 'write' | 'delete' | 'admin',
    getResourceId?: (request: any) => string
  ) {
    return async (request: any, context: AccessControlContext) => {
      const resourceId = getResourceId ? getResourceId(request) : 'unknown'
      
      const permission = await this.checkPermission(context, resourceType, resourceId, action)
      
      if (!permission.granted) {
        throw new Error(`Access denied: ${permission.reason}`)
      }
      
      return true
    }
  }

  // Bulk permission check for multiple resources
  static async checkBulkPermissions(
    context: AccessControlContext,
    resources: Array<{ type: string; id: string; action: 'read' | 'write' | 'delete' | 'admin' }>
  ): Promise<Array<{ resourceId: string; granted: boolean; reason?: string }>> {
    const results = await Promise.all(
      resources.map(async (resource) => {
        const permission = await this.checkPermission(context, resource.type, resource.id, resource.action)
        return {
          resourceId: resource.id,
          granted: permission.granted,
          reason: permission.reason
        }
      })
    )

    return results
  }
}