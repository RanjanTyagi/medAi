import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

interface DiagnosisReport {
  id: string
  status: string
  verified_at: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    // Get user profile to verify doctor role
    const { data: profile } = await supabase
      .from('user_profiles' as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if ((profile as any)?.role !== 'doctor') {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden - Doctor access required' } },
        { status: 403 }
      )
    }

    // Get all reports reviewed by this doctor
    const { data: allReports, error: reportsError } = await supabase
      .from('diagnosis_reports' as any)
      .select('id, status, verified_at, created_at')
      .eq('verified_by', user.id)

    if (reportsError) {
      throw reportsError
    }

    // Get pending reports count
    const { count: pendingCount } = await supabase
      .from('diagnosis_reports' as any)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const reports = (allReports as any) || []
    const totalReviewed = reports.length || 0
    const verified = reports.filter((r: any) => r.status === 'verified').length || 0
    const rejected = reports.filter((r: any) => r.status === 'rejected').length || 0
    
    const thisWeek = reports.filter((r: any) => 
      r.verified_at && new Date(r.verified_at) >= weekAgo
    ).length || 0
    
    const thisMonth = reports.filter((r: any) => 
      r.verified_at && new Date(r.verified_at) >= monthAgo
    ).length || 0

    // Calculate average review time
    const reviewTimes = reports
      .filter((r: any) => r.verified_at && r.created_at)
      .map((r: any) => {
        const created = new Date(r.created_at).getTime()
        const verified = new Date(r.verified_at!).getTime()
        return (verified - created) / (1000 * 60 * 60) // hours
      }) || []

    const avgReviewTime = reviewTimes.length > 0
      ? Math.round(reviewTimes.reduce((a: number, b: number) => a + b, 0) / reviewTimes.length)
      : 0

    const verificationRate = totalReviewed > 0 
      ? (verified / totalReviewed) * 100 
      : 0

    const stats = {
      totalReportsReviewed: totalReviewed,
      reportsVerified: verified,
      reportsRejected: rejected,
      pendingReports: pendingCount || 0,
      thisWeekReviews: thisWeek,
      thisMonthReviews: thisMonth,
      verificationRate,
      averageReviewTime: avgReviewTime
    }

    logger.info('Doctor stats retrieved', { userId: user.id, stats })

    return NextResponse.json({
      success: true,
      data: { stats }
    })

  } catch (error) {
    logger.error('Failed to get doctor stats', error as Error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to get doctor stats',
          details: (error as Error).message
        } 
      },
      { status: 500 }
    )
  }
}
