import { NextRequest, NextResponse } from 'next/server'
import { AIService } from '@/lib/ai-service'
import { AIResponseProcessor } from '@/lib/ai-response-processor'
import { NotificationService } from '@/lib/notification-service'
import { validateAuthToken } from '@/lib/auth'
import { supabase } from '@/lib/supabaseClient'
import { createReportSchema } from '@/types/validation'
import { logger } from '@/lib/logger'
import { RateLimiter } from '@/lib/error-handler'
import { analyticsService } from '@/lib/analytics-service'

// Rate limiter: 5 requests per minute per user
const rateLimiter = new RateLimiter(5, 60000)

async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Validate authentication
    const { user, error: authError } = await validateAuthToken(request)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Check rate limiting
    if (!rateLimiter.isAllowed(user.id)) {
      logger.warn('Rate limit exceeded for diagnosis request', { userId: user.id })
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RATE_LIMIT_EXCEEDED', 
            message: 'Too many diagnosis requests. Please wait before trying again.' 
          } 
        },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    
    logger.info('Diagnosis request received', {
      userId: user.id,
      hasSymptoms: !!body.symptoms,
      hasImageUrl: !!body.imageUrl,
      patientAge: body.patientAge,
      patientGender: body.patientGender
    })

    // Validate input
    const validation = createReportSchema.safeParse({
      symptoms: body.symptoms,
      imageFile: undefined // We're using imageUrl instead
    })

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

    // Additional validation for symptoms
    const symptomsValidation = AIService.validateSymptoms(body.symptoms)
    if (!symptomsValidation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_SYMPTOMS', 
            message: symptomsValidation.error 
          } 
        },
        { status: 400 }
      )
    }

    // Prepare AI analysis request
    const aiRequest = {
      symptoms: body.symptoms,
      imageUrl: body.imageUrl,
      patientAge: body.patientAge,
      patientGender: body.patientGender,
      medicalHistory: body.medicalHistory,
      additionalContext: body.additionalContext
    }

    // Call AI service
    const aiResponse = await AIService.analyzeSymptoms(aiRequest)
    
    // Process AI response
    const processedResult = AIResponseProcessor.processDiagnosisResult(aiResponse.analysis)

    // Create report in database
    const { data: report, error: dbError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        symptoms: body.symptoms,
        image_url: body.imageUrl,
        ai_output: processedResult as any,
        status: 'pending'
      })
      .select()
      .single()

    if (dbError) {
      logger.error('Failed to create report in database', dbError, { userId: user.id })
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to save diagnosis report' 
          } 
        },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    // Create notification for completed analysis
    try {
      await NotificationService.notifyReportAnalysisComplete(user.id, report.id)
    } catch (notificationError) {
      // Log but don't fail the request if notification fails
      logger.error('Failed to create analysis completion notification', notificationError as Error, {
        userId: user.id,
        reportId: report.id
      })
    }

    logger.info('Diagnosis completed successfully', {
      userId: user.id,
      reportId: report.id,
      processingTime,
      overallRisk: processedResult.overallRisk,
      urgencyLevel: processedResult.urgencyLevel,
      diagnosesCount: processedResult.diagnoses.length
    })

    // Track API call analytics
    analyticsService.trackApiCall('/api/diagnose', 'POST', Date.now() - startTime, 200)
    
    // Return response
    return NextResponse.json({
      success: true,
      data: {
        report: {
          id: report.id,
          symptoms: report.symptoms,
          imageUrl: report.image_url,
          status: report.status,
          createdAt: report.created_at,
          aiAnalysis: processedResult
        },
        processingTime,
        modelVersion: aiResponse.modelVersion
      }
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    logger.error('Diagnosis API error', error as Error, { processingTime })
    
    // Track API error analytics
    analyticsService.trackApiCall('/api/diagnose', 'POST', processingTime, 500)
    
    // Handle specific error types
    if ((error as Error).message.includes('timeout')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TIMEOUT_ERROR', 
            message: 'Analysis took too long. Please try again.' 
          } 
        },
        { status: 408 }
      )
    }

    if ((error as Error).message.includes('Gemini API')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'AI_SERVICE_ERROR', 
            message: 'AI analysis service is temporarily unavailable. Please try again later.' 
          } 
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'An unexpected error occurred during diagnosis' 
        } 
      },
      { status: 500 }
    )
  }
}

// Get diagnosis history for a user
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('reports')
      .select(`
        id,
        symptoms,
        image_url,
        ai_output,
        status,
        created_at,
        updated_at,
        doctor_notes (
          id,
          note,
          verified,
          created_at,
          doctor_id,
          users!doctor_notes_doctor_id_fkey (
            name,
            email
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status as any)
    }

    const { data: reports, error: dbError } = await query

    if (dbError) {
      logger.error('Failed to fetch diagnosis history', dbError, { userId: user.id })
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to fetch diagnosis history' 
          } 
        },
        { status: 500 }
      )
    }

    // Transform data for response
    const transformedReports = reports?.map(report => ({
      id: report.id,
      symptoms: report.symptoms,
      imageUrl: report.image_url,
      aiAnalysis: report.ai_output,
      status: report.status,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
      doctorNotes: report.doctor_notes?.map((note: any) => ({
        id: note.id,
        note: note.note,
        verified: note.verified,
        createdAt: note.created_at,
        doctor: {
          name: note.users?.name,
          email: note.users?.email
        }
      }))
    }))

    logger.info('Diagnosis history fetched', {
      userId: user.id,
      count: transformedReports?.length || 0,
      status
    })

    return NextResponse.json({
      success: true,
      data: {
        reports: transformedReports || [],
        pagination: {
          limit,
          offset,
          hasMore: (transformedReports?.length || 0) === limit
        }
      }
    })

  } catch (error) {
    logger.error('Get diagnosis history API error', error as Error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch diagnosis history' 
        } 
      },
      { status: 500 }
    )
  }
}

export { POST, GET }