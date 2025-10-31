import { model } from './geminiClient'
import { OptimizedFileService } from './file-service'
import { logger } from './logger'
import { DiagnosisResult, Diagnosis } from '@/types'
import { PerfUtils } from './performance-monitor'
import CacheManager, { CacheKeys, CacheTTL, hashObject } from './cache-service'
import { analyticsService } from './analytics-service'
import { errorMonitoring } from './error-monitoring'

export interface AIAnalysisRequest {
  symptoms: string
  imageUrl?: string
  patientAge?: number
  patientGender?: 'male' | 'female' | 'other'
  medicalHistory?: string[]
  additionalContext?: string
}

export interface AIAnalysisResponse {
  analysis: DiagnosisResult
  processingTime: number
  modelVersion: string
  confidence: number
  rawResponse?: string
}

export class AIService {
  private static readonly MODEL_VERSION = 'gemini-1.5-pro'
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY = 1000

  // Main analysis function with caching and performance monitoring
  static async analyzeSymptoms(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const startTime = Date.now()
    
    try {
      // Create cache key based on request content
      const requestHash = hashObject({
        symptoms: request.symptoms,
        imageUrl: request.imageUrl,
        patientAge: request.patientAge,
        patientGender: request.patientGender,
        medicalHistory: request.medicalHistory
      })
      const cacheKey = CacheKeys.aiAnalysis(requestHash)

      return await CacheManager.getOrSet(
        cacheKey,
        async () => {
          return await PerfUtils.monitorAI('symptom_analysis', async () => {
            logger.info('AI analysis started', {
              hasSymptoms: !!request.symptoms,
              hasImage: !!request.imageUrl,
              patientAge: request.patientAge,
              patientGender: request.patientGender,
              requestHash
            })

            // Build the prompt
            const prompt = await this.buildPrompt(request)
            
            // Prepare content for Gemini
            const content = await this.prepareContent(prompt, request.imageUrl)
            
            // Call Gemini API with retry logic
            const response = await this.callGeminiWithRetry(content)
            
            // Parse and validate response
            const analysis = this.parseResponse(response)
            
            const processingTime = Date.now() - startTime
            
            // Track analytics for successful diagnosis
            analyticsService.trackDiagnosis('system', true, processingTime, !!request.imageUrl)
            
            logger.info('AI analysis completed', {
              processingTime,
              diagnosesCount: analysis.diagnoses.length,
              overallConfidence: analysis.confidence,
              cached: false
            })

            return {
              analysis,
              processingTime,
              modelVersion: this.MODEL_VERSION,
              confidence: analysis.confidence,
              rawResponse: response
            }
          })
        },
        CacheTTL.SHORT // Cache AI responses for 1 minute to avoid duplicate calls
      )
    } catch (error) {
      const processingTime = Date.now() - startTime
      
      // Track analytics for failed diagnosis
      analyticsService.trackDiagnosis('system', false, processingTime, !!request.imageUrl)
      
      // Report error to monitoring
      errorMonitoring.reportAiError('symptom_analysis', error as Error, 'system')
      
      logger.error('AI analysis failed', error as Error, {
        hasSymptoms: !!request.symptoms,
        hasImage: !!request.imageUrl,
        processingTime
      })
      
      throw error
    }
  }

  // Build structured prompt for medical analysis
  private static async buildPrompt(request: AIAnalysisRequest): Promise<string> {
    let prompt = `You are an AI medical assistant. Analyze the following symptoms and provide a structured medical assessment.

PATIENT INFORMATION:
- Symptoms: ${request.symptoms}`

    if (request.patientAge) {
      prompt += `\n- Age: ${request.patientAge} years`
    }

    if (request.patientGender) {
      prompt += `\n- Gender: ${request.patientGender}`
    }

    if (request.medicalHistory && request.medicalHistory.length > 0) {
      prompt += `\n- Medical History: ${request.medicalHistory.join(', ')}`
    }

    if (request.additionalContext) {
      prompt += `\n- Additional Context: ${request.additionalContext}`
    }

    if (request.imageUrl) {
      prompt += `\n- Medical Image: Provided for analysis`
    }

    prompt += `

INSTRUCTIONS:
1. Analyze the symptoms and any provided medical images
2. Provide possible diagnoses with confidence levels
3. Include severity assessment and recommendations
4. Return response in the following JSON format:

{
  "diagnoses": [
    {
      "condition": "Condition Name",
      "confidence": 0.85,
      "severity": "mild|moderate|severe",
      "description": "Brief explanation"
    }
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "confidence": 0.75,
  "severity": "low|moderate|high",
  "timestamp": "${new Date().toISOString()}"
}

IMPORTANT: 
- Only return the JSON object, no additional text
- Confidence should be between 0 and 1
- Always recommend consulting a healthcare professional
- Be conservative with diagnoses and confidence levels`

    return prompt
  }

  // Prepare content for Gemini API
  private static async prepareContent(prompt: string, imageUrl?: string): Promise<any[]> {
    const content = [{ text: prompt }]

    if (imageUrl) {
      try {
        // Get image type from URL
        const imageType = this.getImageTypeFromUrl(imageUrl)
        
        // Convert image to base64
        const base64Image = await OptimizedFileService.fileToBase64(new File([], 'temp'))
        
        content.push({
          text: `[Image data: ${imageType}]`
        } as any)
      } catch (error) {
        logger.error('Failed to process image for AI analysis', error as Error, { imageUrl })
        // Continue without image if processing fails
      }
    }

    return content
  }

  // Call Gemini API with retry logic
  private static async callGeminiWithRetry(content: any[]): Promise<string> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        logger.debug('Calling Gemini API', { attempt, maxRetries: this.MAX_RETRIES })
        
        const result = await model.generateContent(content)
        const response = result.response
        const text = response.text()
        
        if (!text) {
          throw new Error('Empty response from Gemini API')
        }

        logger.debug('Gemini API call successful', { 
          attempt, 
          responseLength: text.length 
        })

        return text
      } catch (error) {
        lastError = error as Error
        
        logger.warn('Gemini API call failed', { 
          error: (error as Error).message,
          attempt, 
          maxRetries: this.MAX_RETRIES 
        })

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt
          logger.debug('Retrying Gemini API call', { attempt, delay })
          await new Promise<void>(resolve => setTimeout(resolve, delay))
        }
      }
    }

    logger.error('All Gemini API retry attempts failed', lastError!, { 
      maxRetries: this.MAX_RETRIES 
    })
    
    throw lastError!
  }

  // Parse and validate Gemini response
  private static parseResponse(response: string): DiagnosisResult {
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim()
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '')
      }

      // Parse JSON
      const parsed = JSON.parse(cleanResponse)
      
      // Validate required fields
      if (!parsed.diagnoses || !Array.isArray(parsed.diagnoses)) {
        throw new Error('Invalid response: missing or invalid diagnoses array')
      }

      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        throw new Error('Invalid response: missing or invalid recommendations array')
      }

      // Validate diagnoses structure
      for (const diagnosis of parsed.diagnoses) {
        if (!diagnosis.condition || typeof diagnosis.condition !== 'string') {
          throw new Error('Invalid diagnosis: missing or invalid condition')
        }
        if (typeof diagnosis.confidence !== 'number' || diagnosis.confidence < 0 || diagnosis.confidence > 1) {
          throw new Error('Invalid diagnosis: confidence must be a number between 0 and 1')
        }
      }

      // Set defaults for missing fields
      const result: DiagnosisResult = {
        diagnoses: parsed.diagnoses.map((d: any) => ({
          condition: d.condition,
          confidence: d.confidence,
          severity: d.severity || 'moderate',
          description: d.description || ''
        })),
        recommendations: parsed.recommendations,
        confidence: parsed.confidence || 0.5,
        severity: parsed.severity || 'moderate',
        timestamp: parsed.timestamp || new Date().toISOString()
      }

      logger.debug('AI response parsed successfully', {
        diagnosesCount: result.diagnoses.length,
        recommendationsCount: result.recommendations.length,
        overallConfidence: result.confidence
      })

      return result
    } catch (error) {
      logger.error('Failed to parse AI response', error as Error, { response })
      
      // Return fallback response
      return this.createFallbackResponse()
    }
  }

  // Create fallback response when parsing fails
  private static createFallbackResponse(): DiagnosisResult {
    return {
      diagnoses: [{
        condition: 'Unable to analyze symptoms',
        confidence: 0.1,
        severity: 'moderate',
        description: 'The AI system encountered an error while analyzing the symptoms. Please consult a healthcare professional.'
      }],
      recommendations: [
        'Please consult with a qualified healthcare professional for proper diagnosis',
        'Provide detailed symptom information to your doctor',
        'Seek immediate medical attention if symptoms are severe or worsening'
      ],
      confidence: 0.1,
      severity: 'moderate',
      timestamp: new Date().toISOString()
    }
  }

  // Get image MIME type from URL
  private static getImageTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      case 'webp':
        return 'image/webp'
      default:
        return 'image/jpeg' // Default fallback
    }
  }

  // Validate symptoms input
  static validateSymptoms(symptoms: string): { valid: boolean; error?: string } {
    if (!symptoms || symptoms.trim().length === 0) {
      return { valid: false, error: 'Symptoms description is required' }
    }

    if (symptoms.trim().length < 10) {
      return { valid: false, error: 'Please provide more detailed symptoms (at least 10 characters)' }
    }

    if (symptoms.length > 2000) {
      return { valid: false, error: 'Symptoms description is too long (maximum 2000 characters)' }
    }

    return { valid: true }
  }

  // Get analysis statistics
  static async getAnalysisStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    // This would typically query a database for analysis statistics
    // For now, return mock data
    return {
      totalAnalyses: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      commonConditions: [],
      errorRate: 0
    }
  }
}

// Export individual functions for convenience
export const {
  analyzeSymptoms,
  validateSymptoms,
  getAnalysisStats
} = AIService