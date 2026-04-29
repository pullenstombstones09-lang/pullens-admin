import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function redirect303(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name: string | null = null;
    let newPin: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = formData.get('name') as string;
      newPin = formData.get('newPin') as string;
    } else {
      const body = await request.json().catch(() => ({}));
      name = body.name;
      newPin = body.newPin;
    }

    if (!name || !newPin) {
      return redirect303(new URL(`/login/change-pin?name=${name || ''}&error=PIN+required`, request.url));
    }

    if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
      return redirect303(new URL(`/login/change-pin?name=${name}&error=PIN+must+be+4+digits`, request.url));
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, role, perms')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (error || !user) {
      return redirect303(new URL('/login?error=User+not+found', request.url));
    }

    const pinHash = await bcrypt.hash(newPin, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        pin_hash: pinHash,
        force_pin_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      return redirect303(new URL(`/login/change-pin?name=${name}&error=Failed+to+save+PIN`, request.url));
    }

    const { getHomeRoute } = await import('@/lib/permissions');
    const landingPage = getHomeRoute(user.role as import('@/types/database').UserRole);

    const response = redirect303(new URL(landingPage, request.url));

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

    response.cookies.delete('pullens-pin-change');

    return response;
  } catch (err) {
    console.error('Change PIN error:', err);
    return redirect303(new URL('/login?error=Something+went+wrong', request.url));
  }
}
