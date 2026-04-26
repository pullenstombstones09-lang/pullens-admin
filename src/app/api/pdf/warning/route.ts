import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { generateWarningPdf, type WarningPdfData } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { warning_id, employee_id, override } = body;

    const supabase = await createServiceRoleSupabase();

    let pdfData: WarningPdfData;

    if (warning_id) {
      // Generate from existing warning record
      const { data: warning, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('id', warning_id)
        .single();

      if (error || !warning) {
        return NextResponse.json({ error: 'Warning not found' }, { status: 404 });
      }

      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, pt_code, occupation, start_date')
        .eq('id', warning.employee_id)
        .single();

      const { data: issuer } = warning.issued_by
        ? await supabase.from('users').select('name').eq('id', warning.issued_by).single()
        : { data: null };

      // Get prior active warnings
      const { data: priorWarnings } = await supabase
        .from('warnings')
        .select('level, category, offence, issued_date')
        .eq('employee_id', warning.employee_id)
        .eq('status', 'active')
        .neq('id', warning_id)
        .order('issued_date', { ascending: false });

      pdfData = {
        employee_name: emp?.full_name || 'Unknown',
        pt_code: emp?.pt_code || '—',
        occupation: emp?.occupation || 'General Worker',
        start_date: emp?.start_date || '—',
        warning_level: warning.level,
        category: warning.category,
        offence: warning.offence,
        description: warning.description || warning.offence,
        date_of_offence: warning.issued_date,
        issued_date: warning.issued_date,
        expiry_date: warning.expiry_date || '—',
        issued_by: issuer?.name || 'Management',
        prior_warnings: priorWarnings?.map(
          (w) => `${w.level} warning (Cat ${w.category}) — "${w.offence}" on ${w.issued_date}`
        ),
      };
    } else if (employee_id && override) {
      // Generate from HR Advisor output (override data)
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, pt_code, occupation, start_date')
        .eq('id', employee_id)
        .single();

      pdfData = {
        employee_name: emp?.full_name || 'Unknown',
        pt_code: emp?.pt_code || '—',
        occupation: emp?.occupation || 'General Worker',
        start_date: emp?.start_date || '—',
        warning_level: override.level || 'verbal',
        category: override.category || 'A',
        offence: override.offence || 'Misconduct',
        description: override.description || '',
        date_of_offence: override.date || new Date().toISOString().slice(0, 10),
        issued_date: new Date().toISOString().slice(0, 10),
        expiry_date: override.expiry_date || '—',
        issued_by: override.issued_by || 'Management',
        prior_warnings: override.prior_warnings,
      };
    } else {
      return NextResponse.json({ error: 'warning_id or employee_id+override required' }, { status: 400 });
    }

    const pdfBuffer = generateWarningPdf(pdfData);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="warning-${pdfData.pt_code}-${pdfData.issued_date}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Warning PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
