import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Get current date for monthly stats
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get report statistics
    const [totalResult, pendingResult, verifiedResult, monthlyResult] = await Promise.all([
      // Total reports
      supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id),
      
      // Pending reports
      supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'pending'),
      
      // Verified reports
      supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'verified'),
      
      // This month's reports
      supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
    ])

    // Check for errors
    if (totalResult.error) throw totalResult.error
    if (pendingResult.error) throw pendingResult.error
    if (verifiedResult.error) throw verifiedResult.error
    if (monthlyResult.error) throw monthlyResult.error

    const stats = {
      total: totalResult.count || 0,
      pending: pendingResult.count || 0,
      verified: verifiedResult.count || 0,
      thisMonth: monthlyResult.count || 0
    }

    logger.info('Patient stats retrieved', {
      userId: user.id,
      stats
    })

    return NextResponse.json({
      success: true,
      data: { stats }
    })

  } catch (error) {
    return handleApiError(error as Error, request)
  }
}