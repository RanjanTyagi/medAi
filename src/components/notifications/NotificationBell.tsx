'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Notification } from '@/lib/notification-service'
import { useAuth } from '@/lib/auth-context'
import { formatRelativeTime } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  // Load recent notifications and unread count
  const loadNotifications = async () => {
    if (!user) return

    setLoading(true)

    try {
      const [notificationsResponse, countResponse] = await Promise.all([
        fetch('/api/notifications?limit=5', {
          headers: {
            'Authorization': `Bearer ${user.id}` // This would need proper token handling
          }
        }),
        fetch('/api/notifications?limit=1&unreadOnly=true', {
          headers: {
            'Authorization': `Bearer ${user.id}` // This would need proper token handling
          }
        })
      ])

      if (notificationsResponse.ok && countResponse.ok) {
        const [notificationsData, countData] = await Promise.all([
          notificationsResponse.json(),
          countResponse.json()
        ])

        if (notificationsData.success) {
          setNotifications(notificationsData.data.notifications)
        }

        if (countData.success) {
          setUnreadCount(countData.data.total)
        }
      }
    } catch (err) {
      logger.error('Failed to load notifications', err as Error)
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      logger.error('Failed to mark notification as read', err as Error)
    }
  }

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load notifications on mount and when user changes
  useEffect(() => {
    loadNotifications()
  }, [user])

  // Refresh notifications periodically
  useEffect(() => {
    if (!user) return

    const interval = setInterval(loadNotifications, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [user])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      default:
        return 'ℹ️'
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2z" />
        </svg>
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <Link href="/dashboard/notifications">
                <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                  View All
                </Button>
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification.id)
                      }
                      if (notification.reportId) {
                        setIsOpen(false)
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className={`mt-1 text-xs ${
                          !notification.read ? 'text-blue-700' : 'text-gray-600'
                        }`}>
                          {notification.message.length > 80 
                            ? `${notification.message.substring(0, 80)}...` 
                            : notification.message
                          }
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                        {notification.reportId && (
                          <Link 
                            href={`/dashboard/patient/reports/${notification.reportId}`}
                            className="inline-block mt-2"
                            onClick={() => setIsOpen(false)}
                          >
                            <span className="text-xs text-blue-600 hover:text-blue-800">
                              View Report →
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No notifications</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200">
              <Link href="/dashboard/notifications">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setIsOpen(false)}
                >
                  View All Notifications
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}