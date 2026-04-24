import { createServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
