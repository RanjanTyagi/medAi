import { NextRequest, NextResponse } from 'next/server'
import { validateAuthToken } from '@/lib/auth'
import { DoctorService } from '@/lib/doctor-service'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Update doctor note
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

    // Check if user is doctor or admin
    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Only doctors can update notes' 
          } 
        },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Note ID is required' } },
        { status: 400 }
      )
    }

    try {
      const body = await request.json()
      const { note, verified } = body

      if (!note || note.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_NOTE', message: 'Note content is required' } },
          { status: 400 }
        )
      }

      // Update doctor note
      const updatedNote = await DoctorService.updateDoctorNote(user.id, id, {
        note: note.trim(),
        verified: verified || false
      })

      logger.info('Doctor note updated', {
        noteId: id,
        doctorId: user.id,
        verified: verified || false
      })

      return NextResponse.json({
        success: true,
        data: {
          note: updatedNote,
          message: 'Note updated successfully'
        }
      })

    } catch (error) {
      logger.error('Failed to update doctor note', error as Error, {
        noteId: id,
        doctorId: user.id
      })

      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update note' } },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Doctor note update error', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// Delete doctor note
async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check if user is doctor or admin
    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Only doctors can delete notes' 
          } 
        },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Note ID is required' } },
        { status: 400 }
      )
    }

    try {
      // Delete doctor note
      await DoctorService.deleteDoctorNote(user.id, id)

      logger.info('Doctor note deleted', {
        noteId: id,
        doctorId: user.id
      })

      return NextResponse.json({
        success: true,
        data: { message: 'Note deleted successfully' }
      })

    } catch (error) {
      logger.error('Failed to delete doctor note', error as Error, {
        noteId: id,
        doctorId: user.id
      })

      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete note' } },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Doctor note deletion error', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export { PATCH, DELETE }