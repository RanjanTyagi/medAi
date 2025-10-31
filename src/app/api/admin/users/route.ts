import { NextRequest, NextResponse } from 'next/server'
import { AdminService } from '@/lib/admin-service'
import { validateAuth } from '@/lib/auth'
import { createUserSchema } from '@/types/validation'
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
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const role = searchParams.get('role')
    const search = searchParams.get('search')

    // Get users with pagination
    const offset = (page - 1) * limit
    const result = await AdminService.getAllUsers(limit, offset)

    if (!result.success) {
      throw result.error
    }

    // Log the action
    await AdminService.logAction(
      user.id,
      'LIST_USERS',
      'user',
      undefined,
      { filters: { page, limit, role, search } }
    )

    logger.info('Users list retrieved by admin', {
      adminId: user.id,
      page,
      limit,
      role,
      search,
      resultCount: result.users?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: {
        users: result.users || [],
        pagination: {
          page,
          limit,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / limit)
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

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = createUserSchema.safeParse(body)
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

    // Create user
    const result = await AdminService.createUser(validation.data, user.id)

    if (!result.success) {
      if ((result.error as Error).message.includes('already exists')) {
        return NextResponse.json(
          { success: false, error: { message: 'User already exists', code: 'USER_EXISTS' } },
          { status: 409 }
        )
      }
      throw result.error
    }

    logger.info('User created by admin', {
      adminId: user.id,
      newUserId: result.user?.id,
      newUserEmail: result.user?.email,
      newUserRole: result.user?.role
    })

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        message: 'User created successfully'
      }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}