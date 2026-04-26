import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/seed'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for pullens-user cookie
  const userCookie = request.cookies.get('pullens-user');

  if (!userCookie?.value) {
    // No session — redirect to login
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Logged in — redirect root to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
