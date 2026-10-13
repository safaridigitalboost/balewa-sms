import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session on every request and sends signed-out users to /login.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Clear message instead of a crash when the hosting environment is not configured
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(Boolean).join(', ');
    console.error(`[balewa] Missing environment variables: ${missing}`);
    return new NextResponse(
      `Mfumo haujawekwa kikamilifu: environment variables hazipo (${missing}).\n` +
      `Vercel > Project > Settings > Environment Variables: ziongeze, kisha Deployments > Redeploy.`,
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const isLogin = request.nextUrl.pathname.startsWith('/login');

    if (!user && !isLogin) {
      const to = request.nextUrl.clone();
      to.pathname = '/login';
      to.search = '';
      return NextResponse.redirect(to);
    }
    // Signed in but sent back with an error (no profile / disabled): stay on /login to show it
    if (user && isLogin && !request.nextUrl.searchParams.has('error')) {
      const to = request.nextUrl.clone();
      to.pathname = '/dashboard';
      to.search = '';
      return NextResponse.redirect(to);
    }
    return response;
  } catch (e) {
    // Supabase unreachable or misconfigured: let the page load so the login screen can show an error
    console.error('[balewa] middleware auth check failed:', e);
    return response;
  }
}

export const config = {
  // Node.js runtime (stable in Next 15.5): avoids Edge-runtime incompatibilities with the Supabase client
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
