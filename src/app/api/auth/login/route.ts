import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// NOTE: Supabase Auth sign-in removed temporarily — login uses bcrypt PIN only

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

    // Build response — PIN verified via bcrypt, skip Supabase Auth for now
    const body = user.force_pin_change
      ? {
          forceChange: true,
          user: { id: user.id, name: user.name, role: user.role },
        }
      : {
          user: { id: user.id, name: user.name, role: user.role, perms: user.perms },
        };

    return Response.json(body);
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
