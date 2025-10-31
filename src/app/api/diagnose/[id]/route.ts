import { NextRequest, NextResponse } from 'next/server'
import { validateAuthToken } from '@/lib/auth'
import { ReportService } from '@/lib/report-service'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Get specific diagnosis report
async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Report ID is required' } },
        { status: 400 }
      )
    }

    try {
      // Get report by ID
      const report = await ReportService.getReportById(id, user.id)
      
      if (!report) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } },
          { status: 404 }
        )
      }

      logger.info('Diagnosis report retrieved', {
        reportId: id,
        userId: user.id,
        userRole: user.role
      })

      return NextResponse.json({
        success: true,
        data: {
          report: {
            id: report.id,
            symptoms: report.symptoms,
            imageUrl: report.image_url,
            aiOutput: report.ai_output,
            status: report.status,
            createdAt: report.created_at,
            updatedAt: report.updated_at,
            doctorNotes: report.doctorNotes || []
          }
        }
      })

    } catch (error) {
      logger.error('Failed to retrieve diagnosis report', error as Error, {
        reportId: id,
        userId: user.id
      })

      if ((error as Error).message.includes('Access denied')) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this report' } },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve report' } },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Diagnosis report retrieval error', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// Update diagnosis report (for status changes)
async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Only doctors and admins can update report status
    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only doctors can update report status' } },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Report ID is required' } },
        { status: 400 }
      )
    }

    try {
      const body = await request.json()
      const { status, doctorNote } = body

      if (!status) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_STATUS', message: 'Status is required' } },
          { status: 400 }
        )
      }

      // Validate status
      const validStatuses = ['pending', 'reviewed', 'verified', 'rejected']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status value' } },
          { status: 400 }
        )
      }

      // Update report status
      const updatedReport = await ReportService.updateReportStatus(id, status, user.id)

      // Add doctor note if provided
      if (doctorNote && doctorNote.trim()) {
        // This would require a DoctorService.addNote method
        logger.info('Doctor note would be added', {
          reportId: id,
          doctorId: user.id,
          noteLength: doctorNote.length
        })
      }

      logger.info('Diagnosis report status updated', {
        reportId: id,
        newStatus: status,
        doctorId: user.id,
        hasDoctorNote: !!doctorNote
      })

      return NextResponse.json({
        success: true,
        data: {
          report: {
            id: updatedReport.id,
            status: updatedReport.status,
            updatedAt: updatedReport.updated_at
          },
          message: 'Report status updated successfully'
        }
      })

    } catch (error) {
      logger.error('Failed to update diagnosis report', error as Error, {
        reportId: id,
        userId: user.id
      })

      if ((error as Error).message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update report' } },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Diagnosis report update error', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export { GET, PATCH }