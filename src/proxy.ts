import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without auth check
  if (
    pathname === '/login' ||
    pathname === '/test' ||
    pathname === '/test2' ||
    pathname === '/test3' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/seed'
  ) {
    return NextResponse.next();
  }

  // Create a Supabase client using the request cookies
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session — redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch user role from the users table to pass in headers
  // We use the user's email to derive the name, then look up the role
  const { data: dbUser } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (dbUser) {
    response.headers.set('x-user-role', dbUser.role);
    response.headers.set('x-user-name', dbUser.name);
    response.headers.set('x-user-id', user.id);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
