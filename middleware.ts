import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareSupabaseClient } from '@/lib/auth'
import { SecurityService } from '@/lib/security-service'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareSupabaseClient(request)
  
  // Get request info for security checks
  const path = request.nextUrl.pathname
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''
  
  // Apply security headers
  const securityHeaders = SecurityService.getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Rate limiting for API endpoints
  if (path.startsWith('/api/')) {
    const rateLimitResult = SecurityService.checkRateLimit(ip, path)
    
    if (!rateLimitResult.allowed) {
      // Log security event
      await SecurityService.logSecurityEvent('RATE_LIMIT_EXCEEDED', ip, {
        path,
        userAgent,
        resetTime: rateLimitResult.resetTime
      })
      
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          ...securityHeaders
        }
      })
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
  }

  // DDoS Protection
  if (SecurityService.detectDDoSPattern(ip, userAgent)) {
    await SecurityService.logSecurityEvent('DDOS_ATTACK_BLOCKED', ip, {
      path,
      userAgent
    })
    
    return new NextResponse('Access Denied', {
      status: 403,
      headers: securityHeaders
    })
  }

  // IP Risk Assessment for sensitive endpoints
  const ipRisk = SecurityService.assessIPRisk(ip, userAgent)
  if (ipRisk === 'high' && (path.startsWith('/api/admin') || path.startsWith('/api/diagnose'))) {
    await SecurityService.logSecurityEvent('HIGH_RISK_IP_BLOCKED', ip, {
      path,
      userAgent,
      riskLevel: ipRisk
    })
    
    return new NextResponse('Access Denied', {
      status: 403,
      headers: securityHeaders
    })
  }

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl



  // API routes that require authentication
  const protectedApiRoutes = ['/api/diagnose', '/api/reports', '/api/report']
  const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route))

  // Dashboard routes that require authentication
  const isDashboardRoute = pathname.startsWith('/dashboard')

  // If accessing protected routes without session, redirect to login
  if (!session && (isDashboardRoute || isProtectedApiRoute)) {
    // Log unauthorized access attempt
    await SecurityService.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', ip, {
      path,
      userAgent,
      reason: 'No session'
    })
    
    const redirectUrl = new URL('/auth/login', request.url)
    if (isDashboardRoute) {
      redirectUrl.searchParams.set('redirectTo', pathname)
    }
    return Response.redirect(redirectUrl)
  }

  // If logged in and accessing auth pages, redirect to dashboard
  if (session && pathname.startsWith('/auth/') && pathname !== '/auth/logout') {
    return Response.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control for dashboard routes
  if (session && isDashboardRoute) {
    // Get user profile to check role
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (user) {
      // Doctor-only routes
      if (pathname.startsWith('/dashboard/doctor') && user.role !== 'doctor' && user.role !== 'admin') {
        await SecurityService.logSecurityEvent('UNAUTHORIZED_DOCTOR_ACCESS', ip, {
          path,
          userAgent,
          userId: session.user.id,
          userRole: user.role
        })
        return Response.redirect(new URL('/dashboard', request.url))
      }

      // Admin-only routes
      if (pathname.startsWith('/dashboard/admin') && user.role !== 'admin') {
        await SecurityService.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', ip, {
          path,
          userAgent,
          userId: session.user.id,
          userRole: user.role
        })
        return Response.redirect(new URL('/dashboard', request.url))
      }

      // Patient-only routes
      if (pathname.startsWith('/dashboard/patient') && user.role !== 'patient' && user.role !== 'admin') {
        await SecurityService.logSecurityEvent('UNAUTHORIZED_PATIENT_ACCESS', ip, {
          path,
          userAgent,
          userId: session.user.id,
          userRole: user.role
        })
        return Response.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}