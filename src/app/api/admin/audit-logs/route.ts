import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/admin-service'
import { validateAuth } from '@/lib/auth'
import { auditLogFilterSchema } from '@/types/validation'
import { handleApiError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateAuth(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    const { user } = authResult

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const filterData = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      resourceType: searchParams.get('resourceType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined
    }

    const validation = auditLogFilterSchema.safeParse(filterData)
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Invalid filter parameters',
            code: 'VALIDATION_ERROR',
            details: validation.error.issues
          } 
        },
        { status: 400 }
      )
    }

    // Get audit logs
    const result = await AdminService.getAuditLogs(validation.data)

    if (!result.success) {
      throw new Error('Failed to fetch audit logs')
    }

    // Log the action (but don't create infinite loop)
    if (validation.data.action !== 'VIEW_AUDIT_LOGS') {
      await AdminService.logAction(
        user.id,
        'VIEW_AUDIT_LOGS',
        'audit_log',
        undefined,
        { filters: validation.data }
      )
    }

    logger.info('Audit logs retrieved by admin', {
      adminId: user.id,
      count: result.logs?.length,
      total: result.total,
      filters: validation.data
    })

    return NextResponse.json({
      success: true,
      data: {
        logs: result.logs,
        total: result.total,
        hasMore: (result.total || 0) > (validation.data.offset || 0) + (validation.data.limit || 20)
      }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}