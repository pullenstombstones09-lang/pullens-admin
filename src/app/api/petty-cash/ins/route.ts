import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

async function getSupabase() {
  const cookieStore = await cookies();
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

/** GET /api/petty-cash/ins — list all cash-in rows, newest first. */
export async function GET() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('petty_cash_ins')
    .select('*')
    .order('date', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ins: data ?? [] });
}

/** POST /api/petty-cash/ins — create a new cash-in row. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('petty_cash_ins')
    .insert(body)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ in: data });
}

/** DELETE /api/petty-cash/ins?id=<uuid> — delete a single cash-in row. Owner-only enforced client-side. */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const supabase = await getSupabase();
  const { error } = await supabase.from('petty_cash_ins').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
