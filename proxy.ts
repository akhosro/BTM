import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Protected routes that require active trial or subscription
const PROTECTED_ROUTES = [
  '/dashboard',
  '/control-room',
  '/data-connections',
  '/settings',
]

// Routes that should always be accessible
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/about',
  '/contact',
  '/blog',
  '/privacy',
  '/security',
  '/terms',
  '/contracts',
  '/landing',
  '/demo',
  '/trial-expired',
]

// API routes that should be accessible
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
]

function getSessionSecret(): Uint8Array {
  const secretKey = process.env.SESSION_SECRET
  if (!secretKey) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secretKey)
}

async function verifySession(token: string) {
  try {
    const secret = getSessionSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as { userId: string; email: string }
  } catch (error) {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/_') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Get session token
  const sessionToken = request.cookies.get('enalysis_session')?.value

  if (!sessionToken) {
    // Not logged in - redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify session
  const session = await verifySession(sessionToken)
  if (!session) {
    // Invalid session - redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check trial status by making an internal API call
  // We'll add the trial check via response headers to avoid database calls in middleware
  const response = NextResponse.next()

  // Add user ID to request headers so API routes can access it
  response.headers.set('x-user-id', session.userId)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}
