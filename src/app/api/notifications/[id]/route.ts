import { NextRequest, NextResponse } from 'next/server'
import { validateAuth } from '@/lib/auth'
import { NotificationService } from '@/lib/notification-service'
import { handleApiError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate authentication
    const authResult = await validateAuth(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    const { user } = authResult

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Notification ID is required', code: 'MISSING_ID' } },
        { status: 400 }
      )
    }

    // Delete notification
    const result = await NotificationService.deleteNotification(id, user.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to delete notification', code: 'DELETE_FAILED' } },
        { status: 500 }
      )
    }

    logger.info('Notification deleted', {
      userId: user.id,
      notificationId: id
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Notification deleted successfully' }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate authentication
    const authResult = await validateAuth(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    const { user } = authResult

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Notification ID is required', code: 'MISSING_ID' } },
        { status: 400 }
      )
    }

    // Mark notification as read
    const result = await NotificationService.markAsRead(id, user.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to mark notification as read', code: 'UPDATE_FAILED' } },
        { status: 500 }
      )
    }

    logger.info('Notification marked as read', {
      userId: user.id,
      notificationId: id
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Notification marked as read' }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}