import { supabase } from './supabaseClient'
import { logger } from './logger'
import { Report, ReportStatus, User, DoctorNote, ReportFilters } from '@/types'
import CacheManager, { CacheKeys, CacheTTL } from './cache-service'
import { PerfUtils } from './performance-monitor'

export interface CreateReportData {
  userId: string
  symptoms: string
  imageUrl?: string
  aiOutput: any
}

export interface UpdateReportData {
  status?: ReportStatus
  doctorNote?: string
}

export interface ReportWithDetails extends Report {
  patient?: User
  doctorNotes: (DoctorNote & { doctor?: User })[]
}

export interface ReportListResponse {
  reports: ReportWithDetails[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export class ReportService {
  // Create a new medical report
  static async createReport(data: CreateReportData): Promise<Report> {
    try {
      logger.info('Creating new report', {
        userId: data.userId,
        hasImage: !!data.imageUrl,
        symptomsLength: data.symptoms.length
      })

      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          user_id: data.userId,
          symptoms: data.symptoms,
          image_url: data.imageUrl,
          ai_output: data.aiOutput,
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create report', error, { userId: data.userId })
        throw error
      }

      logger.info('Report created successfully', {
        reportId: report.id,
        userId: data.userId
      })

      return {
        id: report.id,
        user_id: report.user_id,
        symptoms: report.symptoms,
        image_url: report.image_url || undefined,
        ai_output: report.ai_output as any,
        status: report.status,
        created_at: report.created_at,
        updated_at: report.updated_at
      }
    } catch (error) {
      logger.error('Create report error', error as Error, { userId: data.userId })
      throw error
    }
  }

  // Get report by ID with full details
  static async getReportById(reportId: string, requestingUserId: string): Promise<ReportWithDetails | null> {
    const cacheKey = CacheKeys.reportDetails(reportId)
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorQuery('getReportById', async () => {
          const { data: report, error } = await supabase
            .from('reports')
            .select(`
              *,
              users!reports_user_id_fkey (
                id,
                name,
                email,
                role
              ),
              doctor_notes (
                id,
                note,
                verified,
                created_at,
                doctor_id,
                users!doctor_notes_doctor_id_fkey (
                  id,
                  name,
                  email
                )
              )
            `)
            .eq('id', reportId)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              return null
            }
            logger.error('Failed to fetch report', error, { reportId, requestingUserId })
            throw error
          }

          // Check access permissions
          const canAccess = await this.checkReportAccess(report, requestingUserId)
          if (!canAccess) {
            logger.warn('Unauthorized report access attempt', {
              reportId,
              requestingUserId,
              reportOwnerId: report.user_id
            })
            throw new Error('Access denied to this report')
          }

          return this.transformReportData(report)
        })
      },
      CacheTTL.MEDIUM
    )
  }

  // Get reports with filtering and pagination
  static async getReports(
    requestingUserId: string,
    filters: ReportFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<ReportListResponse> {
    const cacheKey = CacheKeys.userReports(requestingUserId, page, JSON.stringify(filters))
    
    return await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await PerfUtils.monitorQuery('getReports', async () => {
          const offset = (page - 1) * limit

          // Get requesting user's role
          const { data: requestingUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', requestingUserId)
            .single()

          // Build base query
          let query = supabase
            .from('reports')
            .select(`
              *,
              users!reports_user_id_fkey (
                id,
                name,
                email,
                role
              ),
              doctor_notes (
                id,
                note,
                verified,
                created_at,
                doctor_id,
                users!doctor_notes_doctor_id_fkey (
                  id,
                  name,
                  email
                )
              )
            `, { count: 'exact' })

          // Apply user-based filtering
          if (requestingUser?.role === 'patient') {
            // Patients can only see their own reports
            query = query.eq('user_id', requestingUserId)
          } else if (requestingUser?.role === 'doctor') {
            // Doctors can see all reports, but might want to filter by status
            // No additional user filtering needed
          } else if (requestingUser?.role === 'admin') {
            // Admins can see all reports
            // No additional user filtering needed
          } else {
            // Unknown role, restrict to own reports
            query = query.eq('user_id', requestingUserId)
          }

          // Apply filters
          if (filters.status) {
            query = query.eq('status', filters.status)
          }

          if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom)
          }

          if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo)
          }

          // Apply pagination and ordering
          query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

          const { data: reports, error, count } = await query

          if (error) {
            logger.error('Failed to fetch reports', error, { requestingUserId, filters })
            throw error
          }

          const transformedReports = reports?.map(report => this.transformReportData(report)) || []
          const totalPages = Math.ceil((count || 0) / limit)

          logger.info('Reports fetched successfully', {
            requestingUserId,
            count: transformedReports.length,
            total: count,
            page,
            filters
          })

          return {
            reports: transformedReports,
            pagination: {
              total: count || 0,
              page,
              limit,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          }
        })
      },
      CacheTTL.SHORT // Shorter cache for dynamic data
    )
  }

  // Update report status
  static async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    updatingUserId: string
  ): Promise<Report> {
    try {
      const result = await PerfUtils.monitorQuery('updateReportStatus', async () => {
        // Verify user has permission to update reports
        const { data: updatingUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', updatingUserId)
          .single()

        if (!updatingUser || (updatingUser.role !== 'doctor' && updatingUser.role !== 'admin')) {
          throw new Error('Only doctors and admins can update report status')
        }

        const { data: report, error } = await supabase
          .from('reports')
          .update({ status })
          .eq('id', reportId)
          .select()
          .single()

        if (error) {
          logger.error('Failed to update report status', error, { reportId, status, updatingUserId })
          throw error
        }

        return {
          id: report.id,
          user_id: report.user_id,
          symptoms: report.symptoms,
          image_url: report.image_url || undefined,
          ai_output: report.ai_output as any,
          status: report.status,
          created_at: report.created_at,
          updated_at: report.updated_at
        }
      })

      // Invalidate related caches
      CacheManager.invalidateReportCache(reportId)
      CacheManager.invalidateUserCache(result.user_id)
      CacheManager.invalidateSystemCache()

      logger.info('Report status updated', {
        reportId,
        newStatus: status,
        updatingUserId
      })

      return result
    } catch (error) {
      logger.error('Update report status error', error as Error, { reportId, status, updatingUserId })
      throw error
    }
  }

  // Get reports pending doctor review
  static async getPendingReports(
    doctorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ReportListResponse> {
    try {
      // Verify user is a doctor or admin
      const { data: doctor } = await supabase
        .from('users')
        .select('role')
        .eq('id', doctorId)
        .single()

      if (!doctor || (doctor.role !== 'doctor' && doctor.role !== 'admin')) {
        throw new Error('Only doctors and admins can access pending reports')
      }

      return await this.getReports(doctorId, { status: 'pending' }, page, limit)
    } catch (error) {
      logger.error('Get pending reports error', error as Error, { doctorId })
      throw error
    }
  }

  // Get report statistics
  static async getReportStats(userId?: string): Promise<any> {
    try {
      let query = supabase
        .from('reports')
        .select('status, created_at')

      if (userId) {
        // Get user role to determine if they can see all stats
        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (user?.role === 'patient') {
          // Patients can only see their own stats
          query = query.eq('user_id', userId)
        }
        // Doctors and admins can see all stats (no additional filtering)
      }

      const { data: reports, error } = await query

      if (error) {
        logger.error('Failed to fetch report stats', error, { userId })
        throw error
      }

      // Calculate statistics
      const stats = {
        total: reports?.length || 0,
        pending: reports?.filter(r => r.status === 'pending').length || 0,
        reviewed: reports?.filter(r => r.status === 'reviewed').length || 0,
        verified: reports?.filter(r => r.status === 'verified').length || 0,
        rejected: reports?.filter(r => r.status === 'rejected').length || 0,
        thisMonth: 0,
        thisWeek: 0
      }

      if (reports) {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        stats.thisMonth = reports.filter(r => new Date(r.created_at) >= monthStart).length
        stats.thisWeek = reports.filter(r => new Date(r.created_at) >= weekStart).length
      }

      logger.info('Report stats calculated', { userId, stats })
      return stats
    } catch (error) {
      logger.error('Get report stats error', error as Error, { userId })
      throw error
    }
  }

  // Delete report (admin only)
  static async deleteReport(reportId: string, deletingUserId: string): Promise<void> {
    try {
      // Verify user is admin
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', deletingUserId)
        .single()

      if (!user || user.role !== 'admin') {
        throw new Error('Only admins can delete reports')
      }

      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (error) {
        logger.error('Failed to delete report', error, { reportId, deletingUserId })
        throw error
      }

      logger.info('Report deleted', { reportId, deletingUserId })
    } catch (error) {
      logger.error('Delete report error', error as Error, { reportId, deletingUserId })
      throw error
    }
  }

  // Search reports
  static async searchReports(
    searchQuery: string,
    requestingUserId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ReportListResponse> {
    try {
      const offset = (page - 1) * limit

      // Get requesting user's role
      const { data: requestingUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', requestingUserId)
        .single()

      let query = supabase
        .from('reports')
        .select(`
          *,
          users!reports_user_id_fkey (
            id,
            name,
            email,
            role
          ),
          doctor_notes (
            id,
            note,
            verified,
            created_at,
            doctor_id,
            users!doctor_notes_doctor_id_fkey (
              id,
              name,
              email
            )
          )
        `, { count: 'exact' })

      // Apply user-based filtering
      if (requestingUser?.role === 'patient') {
        query = query.eq('user_id', requestingUserId)
      }

      // Apply search filter
      query = query.ilike('symptoms', `%${searchQuery}%`)

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data: reports, error, count } = await query

      if (error) {
        logger.error('Failed to search reports', error, { searchQuery, requestingUserId })
        throw error
      }

      const transformedReports = reports?.map(report => this.transformReportData(report)) || []
      const totalPages = Math.ceil((count || 0) / limit)

      logger.info('Reports search completed', {
        searchQuery,
        requestingUserId,
        resultsCount: transformedReports.length
      })

      return {
        reports: transformedReports,
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
      logger.error('Search reports error', error as Error, { searchQuery, requestingUserId })
      throw error
    }
  }

  // Helper method to check report access permissions
  private static async checkReportAccess(report: any, requestingUserId: string): Promise<boolean> {
    try {
      // User can access their own reports
      if (report.user_id === requestingUserId) {
        return true
      }

      // Get requesting user's role
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', requestingUserId)
        .single()

      // Doctors and admins can access all reports
      if (user && (user.role === 'doctor' || user.role === 'admin')) {
        return true
      }

      return false
    } catch (error) {
      logger.error('Error checking report access', error as Error)
      return false
    }
  }

  // Helper method to transform database report data
  private static transformReportData(report: any): ReportWithDetails {
    return {
      id: report.id,
      user_id: report.user_id,
      symptoms: report.symptoms,
      image_url: report.image_url || undefined,
      ai_output: report.ai_output as any,
      status: report.status,
      created_at: report.created_at,
      updated_at: report.updated_at,
      patient: report.users ? {
        id: report.users.id,
        name: report.users.name,
        email: report.users.email,
        role: report.users.role,
        created_at: report.users.created_at || '',
        updated_at: report.users.updated_at || ''
      } : undefined,
      doctorNotes: report.doctor_notes?.map((note: any) => ({
        id: note.id,
        report_id: report.id,
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
    }
  }
}

// Export individual functions for convenience
export const {
  createReport,
  getReportById,
  getReports,
  updateReportStatus,
  getPendingReports,
  getReportStats,
  deleteReport,
  searchReports
} = ReportService