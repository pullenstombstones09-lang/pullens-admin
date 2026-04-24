import { createServiceRoleSupabase, createServerSupabase } from '@/lib/supabase/server';
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

    // Look up user by name using service role (bypasses RLS)
    const serviceSupabase = await createServiceRoleSupabase();
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

    // Sign in via Supabase Auth using synthetic email + PIN as password
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@pullens.local`;
    const supabase = await createServerSupabase();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

    if (authError) {
      return Response.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Check if forced PIN change is required
    if (user.force_pin_change) {
      return Response.json({
        forceChange: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        session: authData.session,
      });
    }

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        perms: user.perms,
      },
      session: authData.session,
    });
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
