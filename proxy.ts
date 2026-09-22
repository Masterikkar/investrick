import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

const handleI18nRouting = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request)

  // next-intl sta reindirizzando per aggiungere il prefisso di lingua mancante:
  // il refresh sessione e il guard di auth avverranno sulla richiesta successiva,
  // già con il locale nel path.
  if (response.headers.get('location')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const locale =
    routing.locales.find(
      (l) => request.nextUrl.pathname === `/${l}` || request.nextUrl.pathname.startsWith(`/${l}/`)
    ) ?? routing.defaultLocale

  const pathnameWithoutLocale = request.nextUrl.pathname.slice(`/${locale}`.length) || '/'
  const isLoginPage = pathnameWithoutLocale.startsWith('/login')

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}`
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
