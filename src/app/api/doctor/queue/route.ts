import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Get verification queue
async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Get user profile to verify doctor role
    const { data: profile } = await supabase
      .from('user_profiles' as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if ((profile as any)?.role !== 'doctor' && (profile as any)?.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Only doctors and admins can access verification queue' 
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

    // Get pending reports with patient details
    const offset = (page - 1) * limit
    
    const { data: reports, error: reportsError, count } = await supabase
      .from('diagnosis_reports' as any)
      .select(`
        *,
        patient:user_profiles!diagnosis_reports_user_id_fkey(id, name, email)
      `, { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (reportsError) {
      throw reportsError
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    logger.info('Verification queue fetched via API', {
      doctorId: user.id,
      page,
      limit,
      resultCount: reports?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: {
        reports: reports || [],
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    })

  } catch (error) {
    logger.error('Get verification queue API error', error as Error)

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch verification queue',
          details: (error as Error).message
        } 
      },
      { status: 500 }
    )
  }
}

export { GET }