import { NextRequest, NextResponse } from 'next/server'
import { ReportService } from '@/lib/report-service'
import { validateAuthToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Get pending reports for doctor review
async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Check if user is doctor or admin
    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Only doctors and admins can access pending reports' 
          } 
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page

    // Validate page and limit
    if (page < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' } },
        { status: 400 }
      )
    }

    if (limit < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_LIMIT', message: 'Limit must be >= 1' } },
        { status: 400 }
      )
    }

    // Get pending reports
    const result = await ReportService.getPendingReports(user.id, page, limit)

    logger.info('Pending reports fetched', {
      doctorId: user.id,
      page,
      limit,
      resultCount: result.reports.length
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Get pending reports API error', error as Error)
    
    if ((error as Error).message.includes('Only doctors and admins')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: (error as Error).message 
          } 
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch pending reports' 
        } 
      },
      { status: 500 }
    )
  }
}

export { GET }