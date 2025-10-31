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

    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50')

    let errors
    if (severity) {
      errors = errorMonitoring.getErrorsBySeverity(severity as any, limit)
    } else {
      errors = errorMonitoring.getRecentErrors(limit)
    }

    const errorStats = errorMonitoring.getErrorStats()
    const systemHealth = errorMonitoring.getSystemHealth()
    const activeAlerts = errorMonitoring.getActiveAlerts()

    logger.info('Error monitoring data retrieved', {
      userId: user.id,
      errorCount: errors.length,
      severity
    })

    return NextResponse.json({
      success: true,
      data: {
        errors,
        stats: errorStats,
        health: systemHealth,
        alerts: activeAlerts
      }
    })

  } catch (error) {
    logger.error('Failed to get error monitoring data', error as Error)
    errorMonitoring.reportApiError('/api/monitoring/errors', 'GET', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to retrieve error data' } },
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
    const { message, stack, context, severity = 'medium' } = body

    if (!message) {
      return NextResponse.json(
        { error: { message: 'Error message is required' } },
        { status: 400 }
      )
    }

    // Create error object
    const error = new Error(message)
    if (stack) {
      error.stack = stack
    }

    // Report the error
    const errorId = errorMonitoring.reportError(error, context, user.id)

    logger.info('Error reported via API', {
      errorId,
      userId: user.id,
      severity
    })

    return NextResponse.json({
      success: true,
      data: { errorId }
    })

  } catch (error) {
    logger.error('Failed to report error', error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to report error' } },
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
    const { errorId, action } = body

    if (!errorId || !action) {
      return NextResponse.json(
        { error: { message: 'Error ID and action are required' } },
        { status: 400 }
      )
    }

    let success = false
    if (action === 'resolve') {
      success = errorMonitoring.resolveError(errorId)
    }

    if (!success) {
      return NextResponse.json(
        { error: { message: 'Error not found or action failed' } },
        { status: 404 }
      )
    }

    logger.info('Error action performed', {
      errorId,
      action,
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      message: `Error ${action}d successfully`
    })

  } catch (error) {
    logger.error('Failed to perform error action', error as Error)
    errorMonitoring.reportApiError('/api/monitoring/errors', 'PATCH', 500, error as Error)
    
    return NextResponse.json(
      { error: { message: 'Failed to perform action' } },
      { status: 500 }
    )
  }
}