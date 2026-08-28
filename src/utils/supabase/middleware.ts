import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login');
  const isDashboardPage = pathname.startsWith('/dashboard');
  const isMyAppointmentsPage = pathname.startsWith('/my-appointments');

  // If user is NOT logged in
  if (!user) {
    if (isDashboardPage || isMyAppointmentsPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // If user IS logged in
  if (user) {
    // Redirect from login or root page to their respective panels
    if (isAuthPage || pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = userRole === 'customer' ? '/my-appointments' : '/dashboard';
      return NextResponse.redirect(url);
    }

    // Prevent customers from accessing the business dashboard
    if (userRole === 'customer' && isDashboardPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/my-appointments';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse
}
