import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // Fetch employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Fetch all warnings
    const { data: warnings } = await supabase
      .from('warnings')
      .select('*')
      .eq('employee_id', employee_id)
      .order('issued_date', { ascending: true });

    // Fetch all hearings
    const { data: hearings } = await supabase
      .from('hearings')
      .select('*')
      .eq('employee_id', employee_id)
      .order('hearing_date', { ascending: true });

    // Fetch all incidents
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*')
      .eq('employee_id', employee_id)
      .order('incident_date', { ascending: true });

    // Fetch all documents
    const { data: documents } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employee_id)
      .order('uploaded_at', { ascending: true });

    // Fetch contract info (EIF)
    const { data: leave } = await supabase
      .from('leave')
      .select('*')
      .eq('employee_id', employee_id)
      .order('from_date', { ascending: true });

    // Fetch attendance summary (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const { data: attendance } = await supabase
      .from('attendance')
      .select('date, status, late_minutes, reason')
      .eq('employee_id', employee_id)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const caseFile = {
      generated_at: new Date().toISOString(),
      employee: {
        id: employee.id,
        pt_code: employee.pt_code,
        full_name: employee.full_name,
        id_number: employee.id_number,
        occupation: employee.occupation,
        start_date: employee.start_date,
        status: employee.status,
      },
      warnings: warnings || [],
      hearings: hearings || [],
      incidents: incidents || [],
      documents: (documents || []).map((d) => ({
        id: d.id,
        doc_type: d.doc_type,
        file_url: d.file_url,
        uploaded_at: d.uploaded_at,
        expiry_date: d.expiry_date,
        notes: d.notes,
      })),
      leave_history: leave || [],
      recent_attendance: {
        period: `${ninetyDaysAgo.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
        records: attendance || [],
        summary: {
          total_days: (attendance || []).length,
          present: (attendance || []).filter((a) => a.status === 'present').length,
          late: (attendance || []).filter((a) => a.status === 'late').length,
          absent: (attendance || []).filter((a) => a.status === 'absent').length,
          sick: (attendance || []).filter((a) => a.status === 'sick').length,
          leave: (attendance || []).filter((a) => a.status === 'leave').length,
        },
      },
      _note: 'PDF/ZIP generation is Phase 2. This JSON contains all data that will be included in the CCMA case file.',
    };

    return NextResponse.json(caseFile);
  } catch (error) {
    console.error('CCMA case file error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CCMA case file' },
      { status: 500 }
    );
  }
}
