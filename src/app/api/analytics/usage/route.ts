import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { analyticsService } from '@/lib/analytics-service'
import { errorMonitoring } from '@/lib/error-monitoring'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Use the supabase client
    
    // Check authentication and admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: { message: 'Admin access required' } },
        { status: 403 }
      )
    }

    // Get usage analytics from the analytics service
    const usageAnalytics = await analyticsService.calculateUsageAnalytics()
    
    // Get additional metrics from database
    const { data: userStats } = await supabase
      .from('users')
      .select('role, created_at')
    
    const { data: reportStats } = await supabase
      .from('reports')
      .select('status, created_at')

    const { data: verificationStats } = await supabase
      .from('doctor_notes')
      .select('created_at')

    // Calculate additional metrics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const newUsersThisMonth = userStats?.filter(user => 
      new Date(user.created_at) > thirtyDaysAgo
    ).length || 0

    const reportsThisMonth = reportStats?.filter(report => 
      new Date(report.created_at) > thirtyDaysAgo
    ).length || 0

    const verificationsThisMonth = verificationStats?.filter(note => 
      new Date(note.created_at) > thirtyDaysAgo
    ).length || 0

    const usersByRole = userStats?.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const reportsByStatus = reportStats?.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Get system health
    const systemHealth = errorMonitoring.getSystemHealth()
    const errorStats = errorMonitoring.getErrorStats()

    const analytics = {
      usage: {
        ...usageAnalytics,
        newUsersThisMonth,
        reportsThisMonth,
        verificationsThisMonth
      },
      users: {
        total: userStats?.length || 0,
        byRole: usersByRole,
        newThisMonth: newUsersThisMonth
      },
      reports: {
        total: reportStats?.length || 0,
        byStatus: reportsByStatus,
        thisMonth: reportsThisMonth
      },
      verifications: {
        total: verificationStats?.length || 0,
        thisMonth: verificationsThisMonth,
        rate: reportStats?.length ? (verificationStats?.length || 0) / reportStats.length : 0
      },
      system: {
        health: systemHealth,
        errors: errorStats
      },
      metrics: analyticsService.getMetrics()
    }

    logger.info('Usage analytics retrieved', {
      userId: user.id,
      metricsCount: Object.keys(analytics.metrics).length
    })

    return NextResponse.json({
      success: true,
      data: analytics
    })

  } catch (error) {
    logger.error('Failed to get usage analytics', error as Error)
    errorMonitoring.reportApiError('/api/analytics/usage', 'GET', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to retrieve analytics data' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use the supabase client
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { event, properties } = body

    if (!event) {
      return NextResponse.json(
        { error: { message: 'Event name is required' } },
        { status: 400 }
      )
    }

    // Track the event
    analyticsService.trackEvent({
      name: event,
      properties,
      userId: user.id
    })

    logger.info('Analytics event tracked via API', {
      event,
      userId: user.id,
      properties
    })

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully'
    })

  } catch (error) {
    logger.error('Failed to track analytics event', error as Error)
    errorMonitoring.reportApiError('/api/analytics/usage', 'POST', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to track event' } },
      { status: 500 }
    )
  }
}