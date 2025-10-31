import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
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

    const activeAlerts = errorMonitoring.getActiveAlerts()
    const systemHealth = errorMonitoring.getSystemHealth()

    logger.info('System alerts retrieved', {
      userId: user.id,
      alertCount: activeAlerts.length
    })

    return NextResponse.json({
      success: true,
      data: {
        alerts: activeAlerts,
        health: systemHealth,
        summary: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          warning: activeAlerts.filter(a => a.severity === 'warning').length
        }
      }
    })

  } catch (error) {
    logger.error('Failed to get system alerts', error as Error)
    errorMonitoring.reportApiError('/api/monitoring/alerts', 'GET', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to retrieve alerts' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { type, message, severity = 'warning', details } = body

    if (!type || !message) {
      return NextResponse.json(
        { error: { message: 'Alert type and message are required' } },
        { status: 400 }
      )
    }

    const alertId = errorMonitoring.createAlert(type, message, severity, details)

    logger.info('Manual alert created', {
      alertId,
      type,
      severity,
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      data: { alertId }
    })

  } catch (error) {
    logger.error('Failed to create alert', error as Error)
    errorMonitoring.reportApiError('/api/monitoring/alerts', 'POST', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to create alert' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { alertId, action } = body

    if (!alertId || !action) {
      return NextResponse.json(
        { error: { message: 'Alert ID and action are required' } },
        { status: 400 }
      )
    }

    let success = false
    if (action === 'acknowledge') {
      success = errorMonitoring.acknowledgeAlert(alertId)
    }

    if (!success) {
      return NextResponse.json(
        { error: { message: 'Alert not found or action failed' } },
        { status: 404 }
      )
    }

    logger.info('Alert action performed', {
      alertId,
      action,
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`
    })

  } catch (error) {
    logger.error('Failed to perform alert action', error as Error)
    errorMonitoring.reportApiError('/api/monitoring/alerts', 'PATCH', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to perform action' } },
      { status: 500 }
    )
  }
}