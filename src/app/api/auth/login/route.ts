import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

function getLandingPage(role: string): string {
  if (role === 'admin') return '/register';
  if (role === 'petty_cash') return '/petty-cash';
  if (role === 'bookkeeper') return '/payroll';
  return '/dashboard';
}

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

// Helper: 303 redirect (POST → GET, browser follows correctly)
function redirect303(url: URL, request: NextRequest) {
  return NextResponse.redirect(url, { status: 303 });
}

// POST /api/auth/login — PIN-based login (form POST from PIN pad)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name: string | null = null;
    let pin: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = formData.get('name') as string;
      pin = formData.get('pin') as string;
    } else {
      const body = await request.json().catch(() => ({}));
      name = body.name;
      pin = body.pin;
    }

    if (!name || !pin) {
      return redirect303(new URL(`/login/pin?name=${name || ''}&error=PIN+required`, request.url), request);
    }

    const cookieStore = await cookies();
    const supabase = createSupabase(cookieStore);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, role, perms, pin_hash, force_pin_change')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (error || !user) {
      return redirect303(new URL(`/login/pin?name=${name}&error=User+not+found`, request.url), request);
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(pin, user.pin_hash);
    if (!pinValid) {
      return redirect303(new URL(`/login/pin?name=${name}&error=Incorrect+PIN`, request.url), request);
    }

    // Check force PIN change
    if (user.force_pin_change) {
      const response = redirect303(new URL('/login/change-pin?name=' + name, request.url), request);
      response.cookies.set('pullens-pin-change', name, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 10,
      });
      return response;
    }

    // Set session cookie
    const landingPage = getLandingPage(user.role);
    const response = redirect303(new URL(landingPage, request.url), request);

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
  } catch (err) {
    console.error('Login error:', err);
    return redirect303(new URL('/login?error=Login+failed', request.url), request);
  }
}

// Keep GET for backwards compat (redirects to PIN page)
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');

  if (!name) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.redirect(new URL(`/login/pin?name=${name}`, request.url));
}
