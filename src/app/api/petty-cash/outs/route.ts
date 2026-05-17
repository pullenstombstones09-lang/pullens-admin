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

/** GET /api/petty-cash/outs — list all cash-out rows, newest first. */
export async function GET() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('petty_cash_outs')
    .select('*')
    .order('date', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ outs: data ?? [] });
}

/** POST /api/petty-cash/outs — create a new cash-out row. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('petty_cash_outs')
    .insert(body)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ out: data });
}

/** DELETE /api/petty-cash/outs?id=<uuid> — delete a single cash-out row. Owner-only enforced client-side. */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const supabase = await getSupabase();
  // Also remove any slip rows that referenced this out (FK cleanup; safe if none exist)
  await supabase.from('petty_cash_slips').delete().eq('out_id', id);
  const { error } = await supabase.from('petty_cash_outs').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
