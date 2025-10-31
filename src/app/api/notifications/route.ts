import { NextRequest, NextResponse } from 'next/server'
import { validateAuth } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'
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
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Get user notifications
    const result = await NotificationService.getUserNotifications(user.id, {
      limit,
      offset,
      unreadOnly
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch notifications', code: 'FETCH_FAILED' } },
        { status: 500 }
      )
    }

    logger.info('Notifications retrieved', {
      userId: user.id,
      count: result.notifications?.length || 0,
      unreadOnly
    })

    return NextResponse.json({
      success: true,
      data: {
        notifications: result.notifications || [],
        pagination: {
          limit,
          offset,
          total: result.total || 0
        }
      }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json()

    const { title, message, type, targetUserId } = body

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: { message: 'Title and message are required', code: 'MISSING_FIELDS' } },
        { status: 400 }
      )
    }

    // Only admins can send notifications to other users
    if (targetUserId && targetUserId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Only admins can send notifications to other users', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    // Create notification
    const result = await NotificationService.createNotification({
      userId: targetUserId || user.id,
      title,
      message,
      type: type || 'info'
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to create notification', code: 'CREATE_FAILED' } },
        { status: 500 }
      )
    }

    logger.info('Notification created', {
      createdBy: user.id,
      targetUserId: targetUserId || user.id,
      type: type || 'info'
    })

    return NextResponse.json({
      success: true,
      data: {
        notification: result.notification,
        message: 'Notification created successfully'
      }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}