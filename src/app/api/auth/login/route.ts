import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, pin } = await request.json();

    if (!name || !pin) {
      return Response.json(
        { error: 'Name and PIN are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    // Service role client to look up user (bypasses RLS)
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* service role — no cookies needed */ },
        },
      }
    );

    const { data: user, error: lookupError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (lookupError || !user) {
      return Response.json(
        { error: 'Invalid name or PIN' },
        { status: 401 }
      );
    }

    // Compare PIN against stored hash
    const pinMatch = await bcrypt.compare(pin, user.pin_hash);
    if (!pinMatch) {
      return Response.json(
        { error: 'Invalid name or PIN' },
        { status: 401 }
      );
    }

    // Sign in via Supabase Auth — collect cookies to set on response
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@pullens.local`;
    // Supabase Auth requires min 6 char password — pad PIN
    const authPassword = pin.padEnd(6, '_');
    const responseCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            responseCookies.push(...cookiesToSet);
          },
        },
      }
    );

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      });

    if (authError) {
      return Response.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Build response with auth cookies baked in
    const body = user.force_pin_change
      ? {
          forceChange: true,
          user: { id: user.id, name: user.name, role: user.role },
        }
      : {
          user: { id: user.id, name: user.name, role: user.role, perms: user.perms },
        };

    const response = Response.json(body);

    // Set each Supabase auth cookie on the response
    for (const { name: cName, value, options } of responseCookies) {
      const parts = [`${cName}=${value}`];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
      if (options.httpOnly) parts.push('HttpOnly');
      if (options.secure) parts.push('Secure');
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      response.headers.append('Set-Cookie', parts.join('; '));
    }

    return response;
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
