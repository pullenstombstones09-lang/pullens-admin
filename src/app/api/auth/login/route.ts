import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');

  if (!name) {
    return NextResponse.redirect(new URL('/login?error=No+name', request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, role, perms')
    .eq('name', name)
    .eq('active', true)
    .single();

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?error=User+not+found', request.url));
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));

  response.cookies.set('pullens-user', JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role,
    perms: user.perms,
  }), {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
