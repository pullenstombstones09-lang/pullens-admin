import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { generateHearingNoticePdf, type HearingNoticePdfData } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hearing_id, employee_id, override } = body;

    const supabase = await createServiceRoleSupabase();

    let pdfData: HearingNoticePdfData;

    if (hearing_id) {
      // Generate from existing hearing record
      const { data: hearing, error } = await supabase
        .from('hearings')
        .select('*')
        .eq('id', hearing_id)
        .single();

      if (error || !hearing) {
        return NextResponse.json({ error: 'Hearing not found' }, { status: 404 });
      }

      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, pt_code, occupation')
        .eq('id', hearing.employee_id)
        .single();

      // Get prior active warnings
      const { data: priorWarnings } = await supabase
        .from('warnings')
        .select('level, category, offence, issued_date')
        .eq('employee_id', hearing.employee_id)
        .eq('status', 'active')
        .order('issued_date', { ascending: false });

      pdfData = {
        employee_name: emp?.full_name || 'Unknown',
        pt_code: emp?.pt_code || '—',
        occupation: emp?.occupation || 'General Worker',
        charges: [hearing.charge],
        hearing_date: hearing.hearing_date,
        hearing_time: '09:00',
        hearing_venue: 'Pullens Tombstones — Main Office, PMB',
        chairperson: hearing.chairperson || 'To be confirmed',
        notice_date: hearing.notice_date,
        issued_by: 'Management',
        prior_warnings: priorWarnings?.map(
          (w) => `${w.level} warning (Cat ${w.category}) — "${w.offence}" on ${w.issued_date}`
        ),
      };
    } else if (employee_id && override) {
      // Generate from override data (HR Advisor)
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, pt_code, occupation')
        .eq('id', employee_id)
        .single();

      pdfData = {
        employee_name: emp?.full_name || 'Unknown',
        pt_code: emp?.pt_code || '—',
        occupation: emp?.occupation || 'General Worker',
        charges: override.charges || ['Misconduct'],
        hearing_date: override.hearing_date || '—',
        hearing_time: override.hearing_time || '09:00',
        hearing_venue: override.venue || 'Pullens Tombstones — Main Office, PMB',
        chairperson: override.chairperson || 'To be confirmed',
        notice_date: override.notice_date || new Date().toISOString().slice(0, 10),
        issued_by: override.issued_by || 'Management',
        prior_warnings: override.prior_warnings,
      };
    } else {
      return NextResponse.json({ error: 'hearing_id or employee_id+override required' }, { status: 400 });
    }

    const pdfBuffer = generateHearingNoticePdf(pdfData);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hearing-notice-${pdfData.pt_code}-${pdfData.notice_date}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Hearing notice PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
