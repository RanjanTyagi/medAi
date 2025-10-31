import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/admin-service'
import { validateAuth } from '@/lib/auth'
import { updateUserSchema } from '@/types/validation'
import { handleApiError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export async function GET(
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

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'User ID is required', code: 'MISSING_ID' } },
        { status: 400 }
      )
    }

    // Get user by ID
    const result = await AdminService.getUserById(id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found', code: 'NOT_FOUND' } },
        { status: 404 }
      )
    }

    // Log the action
    await AdminService.logAction(
      user.id,
      'VIEW_USER',
      'user',
      id
    )

    logger.info('User retrieved by admin', {
      adminId: user.id,
      userId: id,
      userEmail: result.user?.email
    })

    return NextResponse.json({
      success: true,
      data: { user: result.user }
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

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'User ID is required', code: 'MISSING_ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = updateUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Invalid input data',
            code: 'VALIDATION_ERROR',
            details: validation.error.issues
          } 
        },
        { status: 400 }
      )
    }

    // Update user
    const result = await AdminService.updateUser(id, validation.data, user.id)

    if (!result.success) {
      if ((result.error as Error).message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { message: 'User not found', code: 'NOT_FOUND' } },
          { status: 404 }
        )
      }
      throw result.error
    }

    logger.info('User updated by admin', {
      adminId: user.id,
      userId: id,
      changes: validation.data
    })

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        message: 'User updated successfully'
      }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}

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

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'User ID is required', code: 'MISSING_ID' } },
        { status: 400 }
      )
    }

    // Prevent admin from deleting themselves
    if (id === user.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete your own account', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    // Delete user
    const result = await AdminService.deleteUser(id, user.id)

    if (!result.success) {
      if ((result.error as Error).message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { message: 'User not found', code: 'NOT_FOUND' } },
          { status: 404 }
        )
      }
      throw result.error
    }

    logger.info('User deleted by admin', {
      adminId: user.id,
      deletedUserId: id
    })

    return NextResponse.json({
      success: true,
      data: { message: 'User deleted successfully' }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}