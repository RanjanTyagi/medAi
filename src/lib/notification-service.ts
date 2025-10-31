import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  reportId?: string
  createdAt: string
}

export interface CreateNotificationData {
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  reportId?: string
}

export class NotificationService {
  // Create a new notification
  static async createNotification(data: CreateNotificationData): Promise<{ success: boolean; notification?: Notification; error?: any }> {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          report_id: data.reportId,
          read: false
        })
        .select()
        .single()

      if (error) throw error

      logger.info('Notification created', {
        notificationId: notification.id,
        userId: data.userId,
        type: data.type
      })

      return {
        success: true,
        notification: {
          id: notification.id,
          userId: notification.user_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          read: notification.read,
          reportId: notification.report_id,
          createdAt: notification.created_at
        }
      }
    } catch (error) {
      logger.error('Failed to create notification', error as Error)
      return { success: false, error }
    }
  }

  // Get notifications for a user
  static async getUserNotifications(
    userId: string, 
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<{ success: boolean; notifications?: Notification[]; total?: number; error?: any }> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (options.unreadOnly) {
        query = query.eq('read', false)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data: notifications, error, count } = await query

      if (error) throw error

      return {
        success: true,
        notifications: notifications?.map(n => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
          reportId: n.report_id,
          createdAt: n.created_at
        })) || [],
        total: count || 0
      }
    } catch (error) {
      logger.error('Failed to get user notifications', error as Error)
      return { success: false, error }
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) throw error

      logger.info('Notification marked as read', {
        notificationId,
        userId
      })

      return { success: true }
    } catch (error) {
      logger.error('Failed to mark notification as read', error as Error)
      return { success: false, error }
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error

      logger.info('All notifications marked as read', { userId })

      return { success: true }
    } catch (error) {
      logger.error('Failed to mark all notifications as read', error as Error)
      return { success: false, error }
    }
  }

  // Delete a notification
  static async deleteNotification(notificationId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) throw error

      logger.info('Notification deleted', {
        notificationId,
        userId
      })

      return { success: true }
    } catch (error) {
      logger.error('Failed to delete notification', error as Error)
      return { success: false, error }
    }
  }

  // Get unread notification count
  static async getUnreadCount(userId: string): Promise<{ success: boolean; count?: number; error?: any }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error

      return { success: true, count: count || 0 }
    } catch (error) {
      logger.error('Failed to get unread notification count', error as Error)
      return { success: false, error }
    }
  }

  // Helper methods for common notification types
  static async notifyReportAnalysisComplete(userId: string, reportId: string): Promise<{ success: boolean; error?: any }> {
    return this.createNotification({
      userId,
      title: 'AI Analysis Complete',
      message: 'Your medical report has been analyzed by our AI system. View the results now.',
      type: 'success',
      reportId
    })
  }

  static async notifyReportVerified(userId: string, reportId: string, doctorName: string): Promise<{ success: boolean; error?: any }> {
    return this.createNotification({
      userId,
      title: 'Report Verified by Doctor',
      message: `Dr. ${doctorName} has reviewed and verified your medical report.`,
      type: 'success',
      reportId
    })
  }

  static async notifyReportNeedsReview(userId: string, reportId: string, doctorName: string): Promise<{ success: boolean; error?: any }> {
    return this.createNotification({
      userId,
      title: 'Report Needs Additional Review',
      message: `Dr. ${doctorName} has requested additional information for your medical report.`,
      type: 'warning',
      reportId
    })
  }

  static async notifyReportDisputed(userId: string, reportId: string, doctorName: string): Promise<{ success: boolean; error?: any }> {
    return this.createNotification({
      userId,
      title: 'Report Analysis Disputed',
      message: `Dr. ${doctorName} has disputed the AI analysis. Please consult with a healthcare provider.`,
      type: 'error',
      reportId
    })
  }
}