import { NextRequest, NextResponse } from 'next/server'
import { DoctorService } from '@/lib/doctor-service'
import { NotificationService } from '@/lib/notification-service'
import { validateAuthToken } from '@/lib/auth'
import { updateReportStatusSchema } from '@/types/validation'
import { logger } from '@/lib/logger'

// Verify or reject a report
async function POST(request: NextRequest) {
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
            message: 'Only doctors and admins can verify reports' 
          } 
        },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = updateReportStatusSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid input data',
            details: validation.error.issues
          } 
        },
        { status: 400 }
      )
    }

    const { reportId, status, note } = body

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_REPORT_ID', message: 'Report ID is required' } },
        { status: 400 }
      )
    }

    // Verify report
    const result = await DoctorService.verifyReport(user.id, {
      reportId,
      status: validation.data.status,
      note,
      verified: status === 'verified'
    })

    // Create notification for the patient
    try {
      const doctorName = user.name || 'Doctor'
      
      if (status === 'verified') {
        await NotificationService.notifyReportVerified(reportId, reportId, doctorName)
      } else if (status === 'needs_review') {
        await NotificationService.notifyReportNeedsReview(reportId, reportId, doctorName)
      } else if (status === 'disputed') {
        await NotificationService.notifyReportDisputed(reportId, reportId, doctorName)
      }
      } catch (notificationError) {
        // Log but don't fail the request if notification fails
        logger.error('Failed to create verification notification', notificationError as Error, {
          doctorId: user.id,
          reportId,
          status
        })
      }
    }

    logger.info('Report verification completed via API', {
      doctorId: user.id,
      reportId,
      status: validation.data.status
    })

    return NextResponse.json({
      success: true,
      data: {
        reportId,
        status: validation.data.status,
        message: `Report ${validation.data.status} successfully`
      }
    })

  } catch (error) {
    logger.error('Verify report API error', error as Error)
    
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

    if ((error as Error).message.includes('not found') || (error as Error).message.includes('access denied')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Report not found or access denied' 
          } 
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to verify report' 
        } 
      },
      { status: 500 }
    )
  }
}

export { POST }