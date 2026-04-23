import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/app', '/onboarding']
const PUBLIC_AUTH_PATHS = ['/sign-up', '/log-in', '/forgot-password', '/reset-password']
const RECENT_COOKIE = 'recent_workspace_slug'

// Foundation paths that have moved into the workspace context — back-compat redirect target.
const MOVED_PATHS = new Set(['/dashboard', '/campaigns', '/connections', '/automation', '/reports'])

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
    // Get all workspaces this user belongs to.
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, workspaces!inner(slug)')
      .eq('user_id', user.id)
    const slugs: string[] = (memberships ?? [])
      .map((m) => {
        const w = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces
        return w?.slug ?? ''
      })
      .filter(Boolean)
    const hasWorkspace = slugs.length > 0

    // No-workspace handling: send to onboarding for /app/* or /onboarding
    if (pathname.startsWith('/app') && !hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return redirectWithCookies(url, response)
    }
    if (pathname === '/onboarding' && hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return redirectWithCookies(url, response)
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return redirectWithCookies(url, response)
    }

    // Back-compat: old Foundation paths → /app/w/<recent>/<sub>
    if (hasWorkspace) {
      for (const moved of MOVED_PATHS) {
        if (pathname === `/app${moved}` || pathname.startsWith(`/app${moved}/`)) {
          const cookieSlug = request.cookies.get(RECENT_COOKIE)?.value
          const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : (slugs[0] ?? '')
          if (target) {
            const url = request.nextUrl.clone()
            url.pathname = `/app/w/${target}${moved}${pathname.slice(`/app${moved}`.length)}`
            return redirectWithCookies(url, response)
          }
        }
      }
      // Old workspace-settings path
      if (pathname === '/app/settings/workspace') {
        const cookieSlug = request.cookies.get(RECENT_COOKIE)?.value
        const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : (slugs[0] ?? '')
        if (target) {
          const url = request.nextUrl.clone()
          url.pathname = `/app/w/${target}/settings/general`
          return redirectWithCookies(url, response)
        }
      }
    }

    // Membership check + cookie write for /app/w/[slug]/*
    const wMatch = pathname.match(/^\/app\/w\/([^/]+)(\/|$)/)
    if (wMatch) {
      const slug = wMatch[1]!
      if (!slugs.includes(slug)) {
        const url = request.nextUrl.clone()
        url.pathname = '/app'
        return redirectWithCookies(url, response)
      }
      response.cookies.set(RECENT_COOKIE, slug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
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
