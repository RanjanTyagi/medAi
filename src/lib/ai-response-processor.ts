import { DiagnosisResult, Diagnosis } from '@/types'
import { logger } from './logger'

export interface ProcessedDiagnosis extends Diagnosis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'routine' | 'urgent' | 'emergency'
  category: string
  icd10Code?: string
  commonality: 'common' | 'uncommon' | 'rare'
}

export interface ProcessedDiagnosisResult extends Omit<DiagnosisResult, 'diagnoses'> {
  diagnoses: ProcessedDiagnosis[]
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  urgencyLevel: 'routine' | 'urgent' | 'emergency'
  requiresImmediateAttention: boolean
  processedRecommendations: ProcessedRecommendation[]
  confidenceLevel: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
  qualityScore: number
}

export interface ProcessedRecommendation {
  text: string
  type: 'immediate' | 'short-term' | 'long-term' | 'lifestyle' | 'diagnostic'
  priority: 'high' | 'medium' | 'low'
  category: string
}

export class AIResponseProcessor {
  // Medical condition categories and their risk levels
  private static readonly CONDITION_CATEGORIES = {
    'cardiovascular': {
      keywords: ['heart', 'cardiac', 'chest pain', 'palpitation', 'hypertension', 'arrhythmia'],
      baseRisk: 'medium' as const
    },
    'respiratory': {
      keywords: ['lung', 'breathing', 'cough', 'pneumonia', 'asthma', 'bronchitis'],
      baseRisk: 'medium' as const
    },
    'neurological': {
      keywords: ['headache', 'migraine', 'seizure', 'stroke', 'brain', 'neurological'],
      baseRisk: 'high' as const
    },
    'gastrointestinal': {
      keywords: ['stomach', 'abdominal', 'nausea', 'vomiting', 'diarrhea', 'gastritis'],
      baseRisk: 'low' as const
    },
    'musculoskeletal': {
      keywords: ['muscle', 'joint', 'bone', 'arthritis', 'fracture', 'sprain'],
      baseRisk: 'low' as const
    },
    'infectious': {
      keywords: ['infection', 'fever', 'bacterial', 'viral', 'sepsis', 'pneumonia'],
      baseRisk: 'medium' as const
    },
    'dermatological': {
      keywords: ['skin', 'rash', 'dermatitis', 'eczema', 'psoriasis'],
      baseRisk: 'low' as const
    },
    'endocrine': {
      keywords: ['diabetes', 'thyroid', 'hormone', 'metabolic', 'insulin'],
      baseRisk: 'medium' as const
    }
  }

  // Emergency/critical conditions that require immediate attention
  private static readonly EMERGENCY_CONDITIONS = [
    'heart attack', 'myocardial infarction', 'stroke', 'sepsis', 'anaphylaxis',
    'pulmonary embolism', 'aortic dissection', 'meningitis', 'appendicitis',
    'ectopic pregnancy', 'diabetic ketoacidosis', 'severe asthma attack'
  ]

  // High-risk conditions
  private static readonly HIGH_RISK_CONDITIONS = [
    'pneumonia', 'deep vein thrombosis', 'kidney stones', 'gallstones',
    'severe dehydration', 'severe infection', 'chest pain', 'severe headache'
  ]

  // Common conditions (higher commonality score)
  private static readonly COMMON_CONDITIONS = [
    'common cold', 'flu', 'headache', 'back pain', 'muscle strain',
    'minor cuts', 'bruises', 'mild fever', 'upset stomach', 'allergies'
  ]

  // Process raw AI diagnosis result
  static processDiagnosisResult(result: DiagnosisResult): ProcessedDiagnosisResult {
    try {
      logger.info('Processing AI diagnosis result', {
        diagnosesCount: result.diagnoses.length,
        originalConfidence: result.confidence
      })

      // Process individual diagnoses
      const processedDiagnoses = result.diagnoses.map(diagnosis => 
        this.processDiagnosis(diagnosis)
      )

      // Calculate overall metrics
      const overallRisk = this.calculateOverallRisk(processedDiagnoses)
      const urgencyLevel = this.calculateUrgencyLevel(processedDiagnoses)
      const requiresImmediateAttention = this.checkImmediateAttention(processedDiagnoses)
      
      // Process recommendations
      const processedRecommendations = this.processRecommendations(
        result.recommendations, 
        overallRisk, 
        urgencyLevel
      )

      // Calculate confidence level and quality score
      const confidenceLevel = this.calculateConfidenceLevel(result.confidence)
      const qualityScore = this.calculateQualityScore(result, processedDiagnoses)

      const processed: ProcessedDiagnosisResult = {
        ...result,
        diagnoses: processedDiagnoses,
        overallRisk,
        urgencyLevel,
        requiresImmediateAttention,
        processedRecommendations,
        confidenceLevel,
        qualityScore
      }

      logger.info('AI diagnosis result processed', {
        overallRisk,
        urgencyLevel,
        requiresImmediateAttention,
        confidenceLevel,
        qualityScore
      })

      return processed
    } catch (error) {
      logger.error('Failed to process AI diagnosis result', error as Error)
      throw error
    }
  }

  // Process individual diagnosis
  private static processDiagnosis(diagnosis: Diagnosis): ProcessedDiagnosis {
    const category = this.categorizeCondition(diagnosis.condition)
    const riskLevel = this.calculateRiskLevel(diagnosis)
    const urgency = this.calculateUrgency(diagnosis)
    const commonality = this.assessCommonality(diagnosis.condition)
    const icd10Code = this.getICD10Code(diagnosis.condition) // Placeholder

    return {
      ...diagnosis,
      riskLevel,
      urgency,
      category,
      icd10Code,
      commonality
    }
  }

  // Categorize medical condition
  private static categorizeCondition(condition: string): string {
    const lowerCondition = condition.toLowerCase()
    
    for (const [category, data] of Object.entries(this.CONDITION_CATEGORIES)) {
      if (data.keywords.some(keyword => lowerCondition.includes(keyword))) {
        return category
      }
    }
    
    return 'general'
  }

  // Calculate risk level for a diagnosis
  private static calculateRiskLevel(diagnosis: Diagnosis): 'low' | 'medium' | 'high' | 'critical' {
    const condition = diagnosis.condition.toLowerCase()
    
    // Check for emergency conditions
    if (this.EMERGENCY_CONDITIONS.some(emergency => condition.includes(emergency))) {
      return 'critical'
    }
    
    // Check for high-risk conditions
    if (this.HIGH_RISK_CONDITIONS.some(highRisk => condition.includes(highRisk))) {
      return 'high'
    }
    
    // Base risk on confidence and severity
    if (diagnosis.confidence > 0.8 && diagnosis.severity === 'severe') {
      return 'high'
    }
    
    if (diagnosis.confidence > 0.6 && diagnosis.severity === 'moderate') {
      return 'medium'
    }
    
    return 'low'
  }

  // Calculate urgency level
  private static calculateUrgency(diagnosis: Diagnosis): 'routine' | 'urgent' | 'emergency' {
    const condition = diagnosis.condition.toLowerCase()
    
    // Emergency conditions
    if (this.EMERGENCY_CONDITIONS.some(emergency => condition.includes(emergency))) {
      return 'emergency'
    }
    
    // Urgent conditions based on severity and confidence
    if (diagnosis.severity === 'severe' && diagnosis.confidence > 0.7) {
      return 'urgent'
    }
    
    if (this.HIGH_RISK_CONDITIONS.some(highRisk => condition.includes(highRisk))) {
      return 'urgent'
    }
    
    return 'routine'
  }

  // Assess condition commonality
  private static assessCommonality(condition: string): 'common' | 'uncommon' | 'rare' {
    const lowerCondition = condition.toLowerCase()
    
    if (this.COMMON_CONDITIONS.some(common => lowerCondition.includes(common))) {
      return 'common'
    }
    
    // Simple heuristic: conditions with common words are more common
    const commonWords = ['pain', 'ache', 'cold', 'flu', 'fever', 'headache']
    if (commonWords.some(word => lowerCondition.includes(word))) {
      return 'common'
    }
    
    // Conditions with medical terminology are often less common
    const medicalTerms = ['syndrome', 'disease', 'disorder', 'carcinoma', 'sarcoma']
    if (medicalTerms.some(term => lowerCondition.includes(term))) {
      return 'rare'
    }
    
    return 'uncommon'
  }

  // Calculate overall risk from all diagnoses
  private static calculateOverallRisk(diagnoses: ProcessedDiagnosis[]): 'low' | 'medium' | 'high' | 'critical' {
    if (diagnoses.some(d => d.riskLevel === 'critical')) return 'critical'
    if (diagnoses.some(d => d.riskLevel === 'high')) return 'high'
    if (diagnoses.some(d => d.riskLevel === 'medium')) return 'medium'
    return 'low'
  }

  // Calculate overall urgency level
  private static calculateUrgencyLevel(diagnoses: ProcessedDiagnosis[]): 'routine' | 'urgent' | 'emergency' {
    if (diagnoses.some(d => d.urgency === 'emergency')) return 'emergency'
    if (diagnoses.some(d => d.urgency === 'urgent')) return 'urgent'
    return 'routine'
  }

  // Check if immediate attention is required
  private static checkImmediateAttention(diagnoses: ProcessedDiagnosis[]): boolean {
    return diagnoses.some(d => 
      d.riskLevel === 'critical' || 
      d.urgency === 'emergency' ||
      (d.riskLevel === 'high' && d.confidence > 0.7)
    )
  }

  // Process recommendations
  private static processRecommendations(
    recommendations: string[], 
    overallRisk: string, 
    urgencyLevel: string
  ): ProcessedRecommendation[] {
    return recommendations.map(rec => {
      const type = this.categorizeRecommendation(rec)
      const priority = this.calculateRecommendationPriority(rec, overallRisk, urgencyLevel)
      const category = this.categorizeRecommendationContent(rec)
      
      return {
        text: rec,
        type,
        priority,
        category
      }
    })
  }

  // Categorize recommendation type
  private static categorizeRecommendation(recommendation: string): ProcessedRecommendation['type'] {
    const lower = recommendation.toLowerCase()
    
    if (lower.includes('immediately') || lower.includes('emergency') || lower.includes('urgent')) {
      return 'immediate'
    }
    
    if (lower.includes('test') || lower.includes('scan') || lower.includes('x-ray') || lower.includes('blood work')) {
      return 'diagnostic'
    }
    
    if (lower.includes('lifestyle') || lower.includes('diet') || lower.includes('exercise')) {
      return 'lifestyle'
    }
    
    if (lower.includes('follow up') || lower.includes('monitor') || lower.includes('track')) {
      return 'long-term'
    }
    
    return 'short-term'
  }

  // Calculate recommendation priority
  private static calculateRecommendationPriority(
    recommendation: string, 
    overallRisk: string, 
    urgencyLevel: string
  ): 'high' | 'medium' | 'low' {
    const lower = recommendation.toLowerCase()
    
    if (urgencyLevel === 'emergency' || lower.includes('immediately')) {
      return 'high'
    }
    
    if (overallRisk === 'high' || urgencyLevel === 'urgent') {
      return 'high'
    }
    
    if (lower.includes('important') || lower.includes('should')) {
      return 'medium'
    }
    
    return 'low'
  }

  // Categorize recommendation content
  private static categorizeRecommendationContent(recommendation: string): string {
    const lower = recommendation.toLowerCase()
    
    if (lower.includes('doctor') || lower.includes('physician') || lower.includes('medical')) {
      return 'medical-consultation'
    }
    
    if (lower.includes('test') || lower.includes('scan') || lower.includes('lab')) {
      return 'diagnostic'
    }
    
    if (lower.includes('medication') || lower.includes('treatment')) {
      return 'treatment'
    }
    
    if (lower.includes('lifestyle') || lower.includes('diet') || lower.includes('exercise')) {
      return 'lifestyle'
    }
    
    return 'general'
  }

  // Calculate confidence level category
  private static calculateConfidenceLevel(confidence: number): 'very-low' | 'low' | 'medium' | 'high' | 'very-high' {
    if (confidence >= 0.9) return 'very-high'
    if (confidence >= 0.7) return 'high'
    if (confidence >= 0.5) return 'medium'
    if (confidence >= 0.3) return 'low'
    return 'very-low'
  }

  // Calculate overall quality score
  private static calculateQualityScore(
    result: DiagnosisResult, 
    processedDiagnoses: ProcessedDiagnosis[]
  ): number {
    let score = 0
    
    // Base score from confidence
    score += result.confidence * 40
    
    // Bonus for multiple diagnoses (differential diagnosis)
    if (result.diagnoses.length > 1) {
      score += Math.min(result.diagnoses.length * 5, 20)
    }
    
    // Bonus for detailed recommendations
    if (result.recommendations.length >= 3) {
      score += 15
    }
    
    // Bonus for consistent severity assessment
    const severityConsistency = this.assessSeverityConsistency(processedDiagnoses)
    score += severityConsistency * 10
    
    // Penalty for very low confidence
    if (result.confidence < 0.3) {
      score -= 20
    }
    
    return Math.max(0, Math.min(100, score))
  }

  // Assess consistency of severity across diagnoses
  private static assessSeverityConsistency(diagnoses: ProcessedDiagnosis[]): number {
    if (diagnoses.length <= 1) return 1
    
    const severityLevels = diagnoses.map(d => d.severity)
    const uniqueSeverities = new Set(severityLevels)
    
    // More consistent if fewer different severity levels
    return Math.max(0, 1 - (uniqueSeverities.size - 1) * 0.3)
  }

  // Get ICD-10 code (placeholder - would need proper medical coding database)
  private static getICD10Code(condition: string): string | undefined {
    // This is a simplified placeholder
    // In a real system, you'd have a comprehensive ICD-10 mapping
    const commonCodes: Record<string, string> = {
      'headache': 'R51',
      'fever': 'R50.9',
      'cough': 'R05',
      'chest pain': 'R07.9',
      'abdominal pain': 'R10.9',
      'back pain': 'M54.9',
      'nausea': 'R11',
      'fatigue': 'R53'
    }
    
    const lowerCondition = condition.toLowerCase()
    for (const [key, code] of Object.entries(commonCodes)) {
      if (lowerCondition.includes(key)) {
        return code
      }
    }
    
    return undefined
  }
}

// Export individual functions for convenience
export const {
  processDiagnosisResult
} = AIResponseProcessor