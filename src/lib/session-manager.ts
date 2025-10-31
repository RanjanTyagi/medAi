import { User } from '@/types'
import { logger } from './logger'

// Session storage keys
const SESSION_KEYS = {
  USER: 'medical_app_user',
  PREFERENCES: 'medical_app_preferences',
  LAST_ACTIVITY: 'medical_app_last_activity',
  REMEMBER_ME: 'medical_app_remember_me',
} as const

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
  dashboard: {
    defaultView: 'grid' | 'list'
    itemsPerPage: number
  }
}

export class SessionManager {
  // Store user in session
  static setUser(user: User): void {
    try {
      if (typeof window === 'undefined') return

      localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user))
      this.updateLastActivity()
      
      logger.info('User session stored', { userId: user.id })
    } catch (error) {
      logger.error('Failed to store user session', error as Error)
    }
  }

  // Get user from session
  static getUser(): User | null {
    try {
      if (typeof window === 'undefined') return null

      const userStr = localStorage.getItem(SESSION_KEYS.USER)
      if (!userStr) return null

      const user = JSON.parse(userStr) as User
      
      // Check if session is expired
      if (this.isSessionExpired()) {
        this.clearSession()
        return null
      }

      this.updateLastActivity()
      return user
    } catch (error) {
      logger.error('Failed to get user session', error as Error)
      this.clearSession()
      return null
    }
  }

  // Clear user session
  static clearUser(): void {
    try {
      if (typeof window === 'undefined') return

      localStorage.removeItem(SESSION_KEYS.USER)
      localStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY)
      
      logger.info('User session cleared')
    } catch (error) {
      logger.error('Failed to clear user session', error as Error)
    }
  }

  // Store user preferences
  static setPreferences(preferences: Partial<UserPreferences>): void {
    try {
      if (typeof window === 'undefined') return

      const current = this.getPreferences()
      const updated = { ...current, ...preferences }
      
      localStorage.setItem(SESSION_KEYS.PREFERENCES, JSON.stringify(updated))
      
      logger.debug('User preferences updated', { preferences: Object.keys(preferences) })
    } catch (error) {
      logger.error('Failed to store user preferences', error as Error)
    }
  }

  // Get user preferences
  static getPreferences(): UserPreferences {
    try {
      if (typeof window === 'undefined') {
        return this.getDefaultPreferences()
      }

      const prefsStr = localStorage.getItem(SESSION_KEYS.PREFERENCES)
      if (!prefsStr) return this.getDefaultPreferences()

      return { ...this.getDefaultPreferences(), ...JSON.parse(prefsStr) }
    } catch (error) {
      logger.error('Failed to get user preferences', error as Error)
      return this.getDefaultPreferences()
    }
  }

  // Get default preferences
  static getDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      dashboard: {
        defaultView: 'grid',
        itemsPerPage: 20,
      },
    }
  }

  // Update last activity timestamp
  static updateLastActivity(): void {
    try {
      if (typeof window === 'undefined') return

      localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString())
    } catch (error) {
      logger.error('Failed to update last activity', error as Error)
    }
  }

  // Check if session is expired
  static isSessionExpired(): boolean {
    try {
      if (typeof window === 'undefined') return false

      const lastActivityStr = localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY)
      if (!lastActivityStr) return true

      const lastActivity = parseInt(lastActivityStr, 10)
      const now = Date.now()
      
      return (now - lastActivity) > SESSION_TIMEOUT
    } catch (error) {
      logger.error('Failed to check session expiry', error as Error)
      return true
    }
  }

  // Set remember me preference
  static setRememberMe(remember: boolean): void {
    try {
      if (typeof window === 'undefined') return

      if (remember) {
        localStorage.setItem(SESSION_KEYS.REMEMBER_ME, 'true')
      } else {
        localStorage.removeItem(SESSION_KEYS.REMEMBER_ME)
      }
    } catch (error) {
      logger.error('Failed to set remember me', error as Error)
    }
  }

  // Get remember me preference
  static getRememberMe(): boolean {
    try {
      if (typeof window === 'undefined') return false

      return localStorage.getItem(SESSION_KEYS.REMEMBER_ME) === 'true'
    } catch (error) {
      logger.error('Failed to get remember me', error as Error)
      return false
    }
  }

  // Clear all session data
  static clearSession(): void {
    try {
      if (typeof window === 'undefined') return

      Object.values(SESSION_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
      
      logger.info('All session data cleared')
    } catch (error) {
      logger.error('Failed to clear session', error as Error)
    }
  }

  // Get session info
  static getSessionInfo(): {
    isActive: boolean
    lastActivity: Date | null
    timeRemaining: number
    user: User | null
  } {
    const user = this.getUser()
    const lastActivityStr = typeof window !== 'undefined' 
      ? localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY) 
      : null
    
    const lastActivity = lastActivityStr 
      ? new Date(parseInt(lastActivityStr, 10)) 
      : null
    
    const timeRemaining = lastActivity 
      ? Math.max(0, SESSION_TIMEOUT - (Date.now() - lastActivity.getTime()))
      : 0

    return {
      isActive: !this.isSessionExpired() && !!user,
      lastActivity,
      timeRemaining,
      user,
    }
  }

  // Extend session
  static extendSession(): void {
    if (this.getUser()) {
      this.updateLastActivity()
      logger.debug('Session extended')
    }
  }

  // Session warning (5 minutes before expiry)
  static shouldShowSessionWarning(): boolean {
    const { timeRemaining } = this.getSessionInfo()
    return timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000 // 5 minutes
  }

  // Auto-logout timer
  static startAutoLogoutTimer(onLogout: () => void): () => void {
    if (typeof window === 'undefined') return () => {}

    const checkSession = () => {
      if (this.isSessionExpired()) {
        this.clearSession()
        onLogout()
        return
      }

      // Check again in 1 minute
      setTimeout(checkSession, 60 * 1000)
    }

    // Start checking
    setTimeout(checkSession, 60 * 1000)

    // Return cleanup function
    return () => {
      // Timer will naturally stop when component unmounts
    }
  }

  // Activity tracking
  static trackActivity(): (() => void) | void {
    if (typeof window === 'undefined') return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    const handleActivity = () => {
      this.updateLastActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Return cleanup function
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }
}

// Hook for session management in React components
export function useSessionManager() {
  if (typeof window === 'undefined') {
    return {
      user: null,
      preferences: SessionManager.getDefaultPreferences(),
      sessionInfo: {
        isActive: false,
        lastActivity: null,
        timeRemaining: 0,
        user: null,
      },
      setUser: () => {},
      clearUser: () => {},
      setPreferences: () => {},
      extendSession: () => {},
      clearSession: () => {},
    }
  }

  return {
    user: SessionManager.getUser(),
    preferences: SessionManager.getPreferences(),
    sessionInfo: SessionManager.getSessionInfo(),
    setUser: SessionManager.setUser,
    clearUser: SessionManager.clearUser,
    setPreferences: SessionManager.setPreferences,
    extendSession: SessionManager.extendSession,
    clearSession: SessionManager.clearSession,
  }
}