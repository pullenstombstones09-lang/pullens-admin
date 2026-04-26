import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  const showInactive = request.nextUrl.searchParams.get('showInactive') === 'true';

  if (!date) {
    return Response.json({ error: 'date required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const empQuery = supabase
    .from('employees')
    .select('id, pt_code, full_name, photo_url, weekly_wage, status')
    .order('pt_code');

  if (!showInactive) {
    empQuery.eq('status', 'active');
  }

  const [empResult, attResult] = await Promise.all([
    empQuery,
    supabase.from('attendance').select('*').eq('date', date),
  ]);

  return Response.json({
    employees: empResult.data ?? [],
    attendance: attResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const { records, date } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'employee_id,date' });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { employeeId, status } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { error } = await supabase
    .from('employees')
    .update({ status })
    .eq('id', employeeId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { attendanceId } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
