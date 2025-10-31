import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/admin-service'
import { validateAuth } from '@/lib/auth'
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

    // Get system health
    const result = await AdminService.getSystemHealth()

    if (!result.success) {
      throw new Error('Failed to fetch system health')
    }

    // Log the action
    await AdminService.logAction(
      user.id,
      'VIEW_SYSTEM_HEALTH',
      'system',
      undefined,
      { hasHealthData: !!result.health }
    )

    logger.info('System health retrieved by admin', {
      adminId: user.id,
      hasHealthData: !!result.health
    })

    return NextResponse.json({
      success: true,
      data: { health: result.health }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}