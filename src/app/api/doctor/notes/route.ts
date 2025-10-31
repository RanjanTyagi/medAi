import { NextRequest, NextResponse } from 'next/server'
import { DoctorService } from '@/lib/doctor-service'
import { validateAuthToken } from '@/lib/auth'
import { createDoctorNoteSchema } from '@/types/validation'
import { logger } from '@/lib/logger'

// Add doctor note to a report
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
            message: 'Only doctors and admins can add notes' 
          } 
        },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = createDoctorNoteSchema.safeParse(body)
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

    const { reportId, note, verified } = validation.data

    // Add doctor note
    const doctorNote = await DoctorService.addDoctorNote(user.id, {
      reportId,
      note,
      verified
    })

    logger.info('Doctor note added via API', {
      doctorId: user.id,
      reportId,
      noteId: doctorNote.id
    })

    return NextResponse.json({
      success: true,
      data: {
        note: doctorNote
      }
    })

  } catch (error) {
    logger.error('Add doctor note API error', error as Error)
    
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
          message: 'Failed to add doctor note' 
        } 
      },
      { status: 500 }
    )
  }
}

export { POST }