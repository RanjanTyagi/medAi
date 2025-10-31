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

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Days parameter must be between 1 and 365',
            code: 'INVALID_PARAMETER'
          } 
        },
        { status: 400 }
      )
    }

    // Get user activity stats
    const result = await AdminService.getUserActivityStats(days)

    if (!result.success) {
      throw new Error('Failed to fetch analytics data')
    }

    // Log the action
    await AdminService.logAction(
      user.id,
      'VIEW_ANALYTICS',
      'system',
      undefined,
      { period: `${days} days` }
    )

    logger.info('Analytics data retrieved by admin', {
      adminId: user.id,
      period: `${days} days`,
      hasStats: !!result.stats
    })

    return NextResponse.json({
      success: true,
      data: { analytics: result.stats }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}