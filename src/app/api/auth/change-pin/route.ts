import { createServiceRoleSupabase, createServerSupabase } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();

    // Verify authenticated session
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return Response.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { newPin } = await request.json();

    if (!newPin || newPin.length < 4) {
      return Response.json(
        { error: 'PIN must be at least 4 digits' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(newPin)) {
      return Response.json(
        { error: 'PIN must contain only digits' },
        { status: 400 }
      );
    }

    // Hash the new PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(newPin, salt);

    // Update pin_hash and clear force_pin_change in users table
    const serviceSupabase = await createServiceRoleSupabase();
    const { error: updateError } = await serviceSupabase
      .from('users')
      .update({
        pin_hash: pinHash,
        force_pin_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id);

    if (updateError) {
      return Response.json(
        { error: 'Failed to update PIN' },
        { status: 500 }
      );
    }

    // Update Supabase Auth password to match
    const { error: authUpdateError } =
      await serviceSupabase.auth.admin.updateUserById(authUser.id, {
        password: newPin,
      });

    if (authUpdateError) {
      return Response.json(
        { error: 'Failed to update authentication password' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
