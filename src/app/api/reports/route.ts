import { NextRequest, NextResponse } from 'next/server'
import { ReportService } from '@/lib/report-service'
import { validateAuthToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Get reports with filtering and pagination
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

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const status = searchParams.get('status') as any
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')

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

    // Validate status if provided
    if (status && !['pending', 'reviewed', 'verified', 'rejected'].includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_STATUS', 
            message: 'Status must be one of: pending, reviewed, verified, rejected' 
          } 
        },
        { status: 400 }
      )
    }

    let result

    if (search) {
      // Search reports
      result = await ReportService.searchReports(search, user.id, page, limit)
    } else {
      // Get reports with filters
      const filters = {
        status,
        dateFrom,
        dateTo
      }

      result = await ReportService.getReports(user.id, filters, page, limit)
    }

    logger.info('Reports fetched successfully', {
      userId: user.id,
      page,
      limit,
      status,
      search,
      resultCount: result.reports.length
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Get reports API error', error as Error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch reports' 
        } 
      },
      { status: 500 }
    )
  }
}

export { GET }