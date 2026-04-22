import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/app', '/onboarding']
const PUBLIC_AUTH_PATHS = ['/sign-up', '/log-in', '/forgot-password', '/reset-password']

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAuthPage = PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/log-in'
    url.searchParams.set('redirect', pathname)
    return redirectWithCookies(url, response)
  }

  if (user) {
    // Has any workspace?
    const { count } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
    const hasWorkspace = (count ?? 0) > 0

    if (pathname.startsWith('/app') && !hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return redirectWithCookies(url, response)
    }
    if (pathname === '/onboarding' && hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/dashboard'
      return redirectWithCookies(url, response)
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/dashboard'
      return redirectWithCookies(url, response)
    }
  }

  return response
}

function redirectWithCookies(url: URL, sourceResponse: NextResponse) {
  const redirect = NextResponse.redirect(url)
  for (const cookie of sourceResponse.cookies.getAll()) {
    redirect.cookies.set(cookie.name, cookie.value, cookie)
  }
  return redirect
}

export const config = {
  matcher: [
    '/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)',
  ],
}
