import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// NOTE: PIN auth bypassed temporarily — users log in by name only

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name) {
      return Response.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

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
        { error: 'User not found' },
        { status: 401 }
      );
    }

    return Response.json({
      user: { id: user.id, name: user.name, role: user.role, perms: user.perms },
    });
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
