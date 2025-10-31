import { NextRequest, NextResponse } from 'next/server'
import { OptimizedFileService } from '@/lib/file-service'
import { validateAuthToken } from '@/lib/auth'
import { withErrorHandler } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'medical-images'

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FILE', message: 'No file provided' } },
        { status: 400 }
      )
    }

    logger.info('File upload request', {
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folder
    })

    // Upload file
    const result = await OptimizedFileService.uploadMedicalFile(file, user.id, {
      folder,
      generateUniqueName: true
    })

    logger.info('File upload successful', {
      userId: user.id,
      filePath: result.path,
      fileUrl: result.url
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('File upload API error', error as Error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'UPLOAD_FAILED', 
          message: (error as Error).message || 'File upload failed' 
        } 
      },
      { status: 500 }
    )
  }
}

async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'medical-images'

    // List user files
    const files = await OptimizedFileService.listUserFiles(user.id, folder)

    return NextResponse.json({
      success: true,
      data: files
    })

  } catch (error) {
    logger.error('List files API error', error as Error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'LIST_FAILED', 
          message: 'Failed to list files' 
        } 
      },
      { status: 500 }
    )
  }
}

async function DELETE(request: NextRequest) {
  try {
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PATH', message: 'File path is required' } },
        { status: 400 }
      )
    }

    // Delete file
    await OptimizedFileService.deleteFile(filePath, user.id)

    logger.info('File deleted successfully', {
      userId: user.id,
      filePath
    })

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    logger.error('Delete file API error', error as Error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DELETE_FAILED', 
          message: (error as Error).message || 'File deletion failed' 
        } 
      },
      { status: 500 }
    )
  }
}

export { POST, GET, DELETE }