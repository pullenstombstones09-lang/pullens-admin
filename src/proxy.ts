import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check cookie
  const userCookie = request.cookies.get('pullens-user');

  if (!userCookie?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Root → dashboard
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
