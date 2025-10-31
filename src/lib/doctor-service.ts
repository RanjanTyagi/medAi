import { supabase } from './supabaseClient'
import { logger } from './logger'
import { ReportService } from './report-service'
import { User, DoctorNote, ReportStatus } from '@/types'

export interface DoctorNoteData {
  reportId: string
  note: string
  verified?: boolean
}

export interface VerificationAction {
  reportId: string
  status: ReportStatus
  note?: string
  verified?: boolean
}

export interface DoctorStats {
  totalReportsReviewed: number
  reportsVerified: number
  reportsRejected: number
  averageReviewTime: number
  pendingReports: number
  thisWeekReviews: number
  thisMonthReviews: number
  verificationRate: number
}

export interface DoctorWorkload {
  doctorId: string
  doctorName: string
  pendingReports: number
  completedToday: number
  completedThisWeek: number
  averageReviewTime: number
  specialties?: string[]
}

export class DoctorService {
  // Add doctor note to a report
  static async addDoctorNote(
    doctorId: string,
    noteData: DoctorNoteData
  ): Promise<DoctorNote> {
    try {
      // Verify doctor permissions
      const { data: doctor } = await supabase
        .from('users')
        .select('role')
        .eq('id', doctorId)
        .single()

      if (!doctor || (doctor.role !== 'doctor' && doctor.role !== 'admin')) {
        throw new Error('Only doctors and admins can add notes')
      }

      // Verify report exists and doctor has access
      const report = await ReportService.getReportById(noteData.reportId, doctorId)
      if (!report) {
        throw new Error('Report not found or access denied')
      }

      logger.info('Adding doctor note', {
        doctorId,
        reportId: noteData.reportId,
        verified: noteData.verified
      })

      const { data: note, error } = await supabase
        .from('doctor_notes')
        .insert({
          report_id: noteData.reportId,
          doctor_id: doctorId,
          note: noteData.note,
          verified: noteData.verified || false
        })
        .select(`
          *,
          users!doctor_notes_doctor_id_fkey (
            id,
            name,
            email
          )
        `)
        .single()

      if (error) {
        logger.error('Failed to add doctor note', error, { doctorId, reportId: noteData.reportId })
        throw error
      }

      logger.info('Doctor note added successfully', {
        noteId: note.id,
        doctorId,
        reportId: noteData.reportId
      })

      return {
        id: note.id,
        report_id: note.report_id,
        doctor_id: note.doctor_id,
        note: note.note,
        verified: note.verified,
        created_at: note.created_at,
        doctor: note.users ? {
          id: note.users.id,
          name: note.users.name,
          email: note.users.email,
          role: 'doctor',
          created_at: '',
          updated_at: ''
        } : undefined
      }
    } catch (error) {
      logger.error('Add doctor note error', error as Error, { doctorId, reportId: noteData.reportId })
      throw error
    }
  }

  // Update existing doctor note
  static async updateDoctorNote(
    doctorId: string,
    noteId: string,
    updates: { note?: string; verified?: boolean }
  ): Promise<DoctorNote> {
    try {
      // Verify doctor owns the note
      const { data: existingNote } = await supabase
        .from('doctor_notes')
        .select('doctor_id')
        .eq('id', noteId)
        .single()

      if (!existingNote || existingNote.doctor_id !== doctorId) {
        throw new Error('Note not found or access denied')
      }

      const { data: note, error } = await supabase
        .from('doctor_notes')
        .update(updates)
        .eq('id', noteId)
        .select(`
          *,
          users!doctor_notes_doctor_id_fkey (
            id,
            name,
            email
          )
        `)
        .single()

      if (error) {
        logger.error('Failed to update doctor note', error, { doctorId, noteId })
        throw error
      }

      logger.info('Doctor note updated', { noteId, doctorId, updates })

      return {
        id: note.id,
        report_id: note.report_id,
        doctor_id: note.doctor_id,
        note: note.note,
        verified: note.verified,
        created_at: note.created_at,
        doctor: note.users ? {
          id: note.users.id,
          name: note.users.name,
          email: note.users.email,
          role: 'doctor',
          created_at: '',
          updated_at: ''
        } : undefined
      }
    } catch (error) {
      logger.error('Update doctor note error', error as Error, { doctorId, noteId })
      throw error
    }
  }

  // Verify or reject a report
  static async verifyReport(
    doctorId: string,
    action: VerificationAction
  ): Promise<void> {
    try {
      // Verify doctor permissions
      const { data: doctor } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', doctorId)
        .single()

      if (!doctor || (doctor.role !== 'doctor' && doctor.role !== 'admin')) {
        throw new Error('Only doctors and admins can verify reports')
      }

      logger.info('Doctor verification action', {
        doctorId,
        doctorName: doctor.name,
        reportId: action.reportId,
        status: action.status
      })

      // Start transaction
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: action.status })
        .eq('id', action.reportId)

      if (updateError) {
        logger.error('Failed to update report status', updateError, { 
          doctorId, 
          reportId: action.reportId 
        })
        throw updateError
      }

      // Add doctor note if provided
      if (action.note) {
        await this.addDoctorNote(doctorId, {
          reportId: action.reportId,
          note: action.note,
          verified: action.verified || action.status === 'verified'
        })
      }

      logger.info('Report verification completed', {
        doctorId,
        reportId: action.reportId,
        status: action.status,
        hasNote: !!action.note
      })

      // TODO: Send notification to patient about status change
      // This would integrate with a notification service
    } catch (error) {
      logger.error('Verify report error', error as Error, { 
        doctorId, 
        reportId: action.reportId 
      })
      throw error
    }
  }

  // Get doctor statistics
  static async getDoctorStats(doctorId: string): Promise<DoctorStats> {
    try {
      // Verify doctor permissions
      const { data: doctor } = await supabase
        .from('users')
        .select('role')
        .eq('id', doctorId)
        .single()

      if (!doctor || (doctor.role !== 'doctor' && doctor.role !== 'admin')) {
        throw new Error('Only doctors and admins can access statistics')
      }

      // Get all notes by this doctor
      const { data: notes, error: notesError } = await supabase
        .from('doctor_notes')
        .select(`
          id,
          verified,
          created_at,
          reports!doctor_notes_report_id_fkey (
            id,
            status,
            created_at,
            updated_at
          )
        `)
        .eq('doctor_id', doctorId)

      if (notesError) {
        logger.error('Failed to fetch doctor notes for stats', notesError, { doctorId })
        throw notesError
      }

      // Get pending reports count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (pendingError) {
        logger.error('Failed to fetch pending reports count', pendingError, { doctorId })
      }

      // Calculate statistics
      const now = new Date()
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const stats: DoctorStats = {
        totalReportsReviewed: notes?.length || 0,
        reportsVerified: notes?.filter(n => n.verified).length || 0,
        reportsRejected: notes?.filter(n => n.reports?.status === 'rejected').length || 0,
        averageReviewTime: 0, // Would need to calculate based on report creation vs note creation
        pendingReports: pendingCount || 0,
        thisWeekReviews: notes?.filter(n => new Date(n.created_at) >= weekStart).length || 0,
        thisMonthReviews: notes?.filter(n => new Date(n.created_at) >= monthStart).length || 0,
        verificationRate: 0
      }

      // Calculate verification rate
      if (stats.totalReportsReviewed > 0) {
        stats.verificationRate = (stats.reportsVerified / stats.totalReportsReviewed) * 100
      }

      // Calculate average review time (simplified)
      if (notes && notes.length > 0) {
        const reviewTimes = notes
          .filter(n => n.reports)
          .map(n => {
            const reportCreated = new Date(n.reports!.created_at)
            const noteCreated = new Date(n.created_at)
            return noteCreated.getTime() - reportCreated.getTime()
          })
          .filter(time => time > 0)

        if (reviewTimes.length > 0) {
          const avgMs = reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length
          stats.averageReviewTime = Math.round(avgMs / (1000 * 60 * 60)) // Convert to hours
        }
      }

      logger.info('Doctor stats calculated', { doctorId, stats })
      return stats
    } catch (error) {
      logger.error('Get doctor stats error', error as Error, { doctorId })
      throw error
    }
  }

  // Get all doctors with their workload
  static async getDoctorWorkloads(): Promise<DoctorWorkload[]> {
    try {
      // Get all doctors
      const { data: doctors, error: doctorsError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'doctor')

      if (doctorsError) {
        logger.error('Failed to fetch doctors', doctorsError)
        throw doctorsError
      }

      if (!doctors || doctors.length === 0) {
        return []
      }

      // Get pending reports count
      const { count: totalPending } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Get doctor notes for workload calculation
      const { data: allNotes, error: notesError } = await supabase
        .from('doctor_notes')
        .select(`
          doctor_id,
          created_at,
          reports!doctor_notes_report_id_fkey (
            created_at
          )
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

      if (notesError) {
        logger.error('Failed to fetch doctor notes for workload', notesError)
        throw notesError
      }

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const workloads: DoctorWorkload[] = doctors.map(doctor => {
        const doctorNotes = allNotes?.filter(n => n.doctor_id === doctor.id) || []
        
        const completedToday = doctorNotes.filter(n => 
          new Date(n.created_at) >= todayStart
        ).length

        const completedThisWeek = doctorNotes.filter(n => 
          new Date(n.created_at) >= weekStart
        ).length

        // Calculate average review time
        const reviewTimes = doctorNotes
          .filter(n => n.reports)
          .map(n => {
            const reportCreated = new Date(n.reports!.created_at)
            const noteCreated = new Date(n.created_at)
            return noteCreated.getTime() - reportCreated.getTime()
          })
          .filter(time => time > 0)

        const avgReviewTime = reviewTimes.length > 0
          ? Math.round(reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length / (1000 * 60 * 60))
          : 0

        return {
          doctorId: doctor.id,
          doctorName: doctor.name,
          pendingReports: Math.floor((totalPending || 0) / doctors.length), // Simplified distribution
          completedToday,
          completedThisWeek,
          averageReviewTime: avgReviewTime
        }
      })

      logger.info('Doctor workloads calculated', { doctorCount: workloads.length })
      return workloads
    } catch (error) {
      logger.error('Get doctor workloads error', error as Error)
      throw error
    }
  }

  // Get doctor notes for a specific report
  static async getReportNotes(reportId: string, requestingUserId: string): Promise<DoctorNote[]> {
    try {
      // Verify access to the report
      const report = await ReportService.getReportById(reportId, requestingUserId)
      if (!report) {
        throw new Error('Report not found or access denied')
      }

      const { data: notes, error } = await supabase
        .from('doctor_notes')
        .select(`
          *,
          users!doctor_notes_doctor_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to fetch report notes', error, { reportId, requestingUserId })
        throw error
      }

      return notes?.map(note => ({
        id: note.id,
        report_id: note.report_id,
        doctor_id: note.doctor_id,
        note: note.note,
        verified: note.verified,
        created_at: note.created_at,
        doctor: note.users ? {
          id: note.users.id,
          name: note.users.name,
          email: note.users.email,
          role: 'doctor',
          created_at: '',
          updated_at: ''
        } : undefined
      })) || []
    } catch (error) {
      logger.error('Get report notes error', error as Error, { reportId, requestingUserId })
      throw error
    }
  }

  // Delete doctor note (only by the doctor who created it)
  static async deleteDoctorNote(doctorId: string, noteId: string): Promise<void> {
    try {
      // Verify doctor owns the note
      const { data: note } = await supabase
        .from('doctor_notes')
        .select('doctor_id')
        .eq('id', noteId)
        .single()

      if (!note || note.doctor_id !== doctorId) {
        throw new Error('Note not found or access denied')
      }

      const { error } = await supabase
        .from('doctor_notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        logger.error('Failed to delete doctor note', error, { doctorId, noteId })
        throw error
      }

      logger.info('Doctor note deleted', { doctorId, noteId })
    } catch (error) {
      logger.error('Delete doctor note error', error as Error, { doctorId, noteId })
      throw error
    }
  }

  // Get verification queue with priority sorting
  static async getVerificationQueue(
    doctorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    try {
      // Verify doctor permissions
      const { data: doctor } = await supabase
        .from('users')
        .select('role')
        .eq('id', doctorId)
        .single()

      if (!doctor || (doctor.role !== 'doctor' && doctor.role !== 'admin')) {
        throw new Error('Only doctors and admins can access verification queue')
      }

      // Get pending reports with priority sorting
      // Priority: emergency > high risk > older reports
      const offset = (page - 1) * limit

      const { data: reports, error, count } = await supabase
        .from('reports')
        .select(`
          *,
          users!reports_user_id_fkey (
            id,
            name,
            email
          )
        `, { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: true }) // Older reports first
        .range(offset, offset + limit - 1)

      if (error) {
        logger.error('Failed to fetch verification queue', error, { doctorId })
        throw error
      }

      // Sort by priority (emergency/high risk first)
      const sortedReports = reports?.sort((a, b) => {
        const aAnalysis = a.ai_output as any
        const bAnalysis = b.ai_output as any
        
        // Emergency reports first
        if (aAnalysis?.urgencyLevel === 'emergency' && bAnalysis?.urgencyLevel !== 'emergency') return -1
        if (bAnalysis?.urgencyLevel === 'emergency' && aAnalysis?.urgencyLevel !== 'emergency') return 1
        
        // High risk reports next
        if (aAnalysis?.overallRisk === 'critical' && bAnalysis?.overallRisk !== 'critical') return -1
        if (bAnalysis?.overallRisk === 'critical' && aAnalysis?.overallRisk !== 'critical') return 1
        
        // Then by creation date (older first)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }) || []

      const totalPages = Math.ceil((count || 0) / limit)

      logger.info('Verification queue fetched', {
        doctorId,
        count: sortedReports.length,
        total: count,
        page
      })

      return {
        reports: sortedReports.map(report => ({
          id: report.id,
          user_id: report.user_id,
          symptoms: report.symptoms,
          image_url: report.image_url,
          ai_output: report.ai_output,
          status: report.status,
          created_at: report.created_at,
          updated_at: report.updated_at,
          patient: report.users ? {
            id: report.users.id,
            name: report.users.name,
            email: report.users.email
          } : undefined,
          doctorNotes: [] // Notes would be loaded separately if needed
        })),
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      logger.error('Get verification queue error', error as Error, { doctorId })
      throw error
    }
  }
}

// Export individual functions for convenience
export const {
  addDoctorNote,
  updateDoctorNote,
  verifyReport,
  getDoctorStats,
  getDoctorWorkloads,
  getReportNotes,
  deleteDoctorNote,
  getVerificationQueue
} = DoctorService