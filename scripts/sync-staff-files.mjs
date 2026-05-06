#!/usr/bin/env node
/**
 * Staff Files Sync — Pullens Tombstones
 *
 * Downloads all employee data from Supabase into C:\Staff Files\
 * Creates one folder per employee with profile summary, payslips, ID copy, and documents.
 *
 * Run: node scripts/sync-staff-files.mjs
 * Or double-click: sync-staff-files.bat
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { jsPDF } from 'jspdf';

// ─── Config ───
const SUPABASE_URL = 'https://eznppvewksorfoedgzpa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bnBwdmV3a3NvcmZvZWRnenBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyMzc4NiwiZXhwIjoyMDkyNTk5Nzg2fQ.Ux9dFHOQ8WlXDEa4HJ9TV8JdjnqdDCwsLrOQ55H9H2Q';
const OUTPUT_DIR = 'C:\\Staff Files';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, '-').trim();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(n) {
  return `R${(n || 0).toFixed(2)}`;
}

// ─── Profile Summary PDF ───
function generateProfilePdf(emp, attendance, loans, warnings, leaveBalance) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Pullens Tombstones — Employee Profile', margin, y);
  y += 4;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Name block
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(emp.full_name, margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${emp.pt_code}  |  ${emp.status === 'active' ? 'Active' : 'Terminated'}`, margin, y);
  y += 10;

  // Personal details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('PERSONAL DETAILS', margin, y);
  y += 7;

  const personalFields = [
    ['ID Number', emp.id_number || '—'],
    ['Date of Birth', formatDate(emp.dob)],
    ['Gender', emp.gender || '—'],
    ['Race', emp.race || '—'],
    ['Cell', emp.cell || '—'],
    ['Address', emp.address || '—'],
    ['Next of Kin', `${emp.nok_name || '—'} (${emp.nok_relationship || '—'}) ${emp.nok_phone || ''}`],
    ['Tax Number', emp.tax_number || '—'],
    ['UIF Ref', emp.uif_ref || '—'],
  ];

  doc.setFontSize(9.5);
  for (const [label, value] of personalFields) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, margin + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(String(value), 110);
    doc.text(lines, margin + 45, y);
    y += lines.length * 4.5 + 1;
  }

  y += 6;

  // Employment details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('EMPLOYMENT', margin, y);
  y += 7;

  const empFields = [
    ['Position', emp.occupation || emp.job_title || 'General Worker'],
    ['Department', emp.department || 'Production'],
    ['Start Date', formatDate(emp.start_date)],
    ['Employment Type', emp.employment_type === 'part_time' ? 'Part-time' : 'Full-time'],
    ['Weekly Wage', formatCurrency(emp.weekly_wage)],
    ['Weekly Hours', `${emp.weekly_hours || 40}h`],
    ['Payment Method', emp.payment_method || '—'],
    ['Bank', emp.bank_name ? `${emp.bank_name} — ${emp.bank_account || ''}` : '—'],
    ['Garnishee', emp.garnishee > 0 ? formatCurrency(emp.garnishee) : 'None'],
  ];

  doc.setFontSize(9.5);
  for (const [label, value] of empFields) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, margin + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(String(value), margin + 45, y);
    y += 5.5;
  }

  y += 6;

  // Attendance summary (last 30 days)
  if (attendance.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('ATTENDANCE (Last 30 Days)', margin, y);
    y += 7;

    const counts = { present: 0, late: 0, absent: 0, leave: 0, sick: 0, ph: 0 };
    for (const a of attendance) {
      if (counts[a.status] !== undefined) counts[a.status]++;
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(`Present: ${counts.present}  |  Late: ${counts.late}  |  Absent: ${counts.absent}  |  Leave: ${counts.leave}  |  Sick: ${counts.sick}  |  PH: ${counts.ph}`, margin + 2, y);
    y += 8;
  }

  // Loans
  if (loans.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('ACTIVE LOANS', margin, y);
    y += 7;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    for (const loan of loans) {
      doc.text(`${formatDate(loan.created_at)} — ${formatCurrency(loan.amount)} (outstanding: ${formatCurrency(loan.outstanding)}) — ${loan.reason || 'No reason'}`, margin + 2, y);
      y += 5;
    }
    y += 4;
  }

  // Warnings
  if (warnings.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('ACTIVE WARNINGS', margin, y);
    y += 7;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    for (const w of warnings) {
      doc.text(`${formatDate(w.issued_date)} — ${w.warning_type || 'Warning'}: ${w.reason || '—'}`, margin + 2, y);
      y += 5;
    }
    y += 4;
  }

  // Leave balance
  if (leaveBalance) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('LEAVE BALANCE', margin, y);
    y += 7;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(`Annual: ${leaveBalance.annual_remaining || 0}/21  |  Sick: ${leaveBalance.sick_remaining || 0}/30  |  Family: ${leaveBalance.family_remaining || 0}/3`, margin + 2, y);
    y += 8;
  }

  // Footer
  const footerY = 282;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Synced ${new Date().toISOString().slice(0, 10)} — Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones`, margin, footerY + 4);
  doc.text('CONFIDENTIAL', pageW - margin, footerY + 4, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Payslip PDF ───
function generatePayslipPdf(emp, payslip, run) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Pullens Tombstones — Payslip', margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Week: ${formatDate(run.week_start)} — ${formatDate(run.week_end)}`, pageW - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Employee info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(emp.full_name, margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(emp.pt_code, margin + doc.getTextWidth(emp.full_name) + 4, y);
  y += 10;

  // Payslip table
  const rows = [
    ['Ordinary Hours', `${payslip.ordinary_hours || 0}`, '', ''],
    ['OT Hours', `${payslip.ot_hours || 0}`, 'OT Amount', formatCurrency(payslip.ot_amount)],
    ['', '', '', ''],
    ['Gross Pay', '', '', formatCurrency(payslip.gross)],
    ['', '', '', ''],
    ['PAYE', '', '', `- ${formatCurrency(payslip.paye)}`],
    ['UIF (Employee)', '', '', `- ${formatCurrency(payslip.uif_employee)}`],
    ['Loan Deduction', '', '', `- ${formatCurrency(payslip.loan_deduction)}`],
    ['Garnishee', '', '', `- ${formatCurrency(payslip.garnishee)}`],
    ['Petty Shortfall', '', '', `- ${formatCurrency(payslip.petty_shortfall)}`],
    ['', '', '', ''],
  ];

  doc.setFontSize(9.5);
  for (const [label1, val1, label2, val2] of rows) {
    if (!label1 && !label2 && !val1 && !val2) {
      y += 2;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
      continue;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    if (label1) doc.text(label1, margin + 2, y);
    if (val1) doc.text(val1, margin + 60, y);
    if (label2) doc.text(label2, margin + 90, y);
    if (val2) {
      const isDeduction = val2.startsWith('-');
      doc.setTextColor(isDeduction ? 200 : 30, isDeduction ? 50 : 30, isDeduction ? 50 : 30);
      doc.setFont('helvetica', isDeduction ? 'normal' : 'bold');
      doc.text(val2, pageW - margin, y, { align: 'right' });
    }
    y += 6;
  }

  // Net pay
  y += 2;
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(margin, y - 1, pageW - margin * 2, 12, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAY', margin + 4, y + 7);
  doc.text(formatCurrency(payslip.net), pageW - margin - 4, y + 7, { align: 'right' });

  // Footer
  const footerY = 282;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones | Reg: 2011/105461/23', margin, footerY + 4);
  doc.text('CONFIDENTIAL', pageW - margin, footerY + 4, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Main sync ───
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Pullens Staff Files Sync               ║');
  console.log('║   Downloading to C:\\Staff Files\\          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Create root dir
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Fetch all employees
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .order('pt_code');

  if (empErr || !employees) {
    console.error('Failed to fetch employees:', empErr);
    process.exit(1);
  }

  console.log(`Found ${employees.length} employees\n`);

  let totalPayslips = 0;
  let totalDocs = 0;
  let totalIdCopies = 0;

  for (const emp of employees) {
    const folderName = sanitize(`${emp.pt_code} - ${emp.full_name}`);
    const empDir = join(OUTPUT_DIR, folderName);
    const payslipDir = join(empDir, 'Payslips');
    const docDir = join(empDir, 'Documents');

    mkdirSync(empDir, { recursive: true });
    mkdirSync(payslipDir, { recursive: true });
    mkdirSync(docDir, { recursive: true });

    process.stdout.write(`  ${emp.pt_code} ${emp.full_name.padEnd(25)} `);

    // ── 1. Profile Summary PDF ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [attRes, loanRes, warnRes, leaveRes] = await Promise.all([
      supabase.from('attendance').select('status').eq('employee_id', emp.id).gte('date', thirtyDaysAgo.toISOString().slice(0, 10)),
      supabase.from('loans').select('*').eq('employee_id', emp.id).eq('status', 'active'),
      supabase.from('warnings').select('*').eq('employee_id', emp.id).eq('status', 'active'),
      supabase.from('leave_balances').select('*').eq('employee_id', emp.id).maybeSingle(),
    ]);

    const profilePdf = generateProfilePdf(
      emp,
      attRes.data || [],
      loanRes.data || [],
      warnRes.data || [],
      leaveRes.data
    );
    writeFileSync(join(empDir, 'Profile Summary.pdf'), profilePdf);

    // ── 2. ID Copy ──
    if (emp.id_document_url) {
      try {
        const filePath = emp.id_document_url.replace('id-documents/', '');
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('id-documents')
          .download(filePath);

        if (fileData && !dlErr) {
          const ext = filePath.split('.').pop() || 'pdf';
          const buffer = Buffer.from(await fileData.arrayBuffer());
          writeFileSync(join(empDir, `ID Copy.${ext}`), buffer);
          totalIdCopies++;
        }
      } catch (e) {
        // ID copy download failed — skip silently
      }
    }

    // ── 3. Payslips ──
    const { data: payslips } = await supabase
      .from('payslips')
      .select('*, payroll_run:payroll_runs(week_start, week_end)')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false });

    let payslipCount = 0;
    for (const slip of payslips || []) {
      const run = slip.payroll_run;
      if (!run) continue;

      const filename = `${run.week_start} to ${run.week_end}.pdf`;
      const filepath = join(payslipDir, sanitize(filename));

      // Skip if already exists (don't re-download old payslips)
      if (existsSync(filepath)) {
        payslipCount++;
        continue;
      }

      try {
        const pdfBuf = generatePayslipPdf(emp, slip, run);
        writeFileSync(filepath, pdfBuf);
        payslipCount++;
      } catch (e) {
        // Payslip generation failed — skip
      }
    }
    totalPayslips += payslipCount;

    // ── 4. Documents ──
    const { data: docs } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', emp.id);

    let docCount = 0;
    for (const doc of docs || []) {
      if (!doc.file_url) continue;
      try {
        // Try to download from storage
        const url = doc.file_url;
        const ext = url.split('.').pop()?.split('?')[0] || 'pdf';
        const docName = sanitize(`${doc.doc_type}_${doc.id.slice(0, 8)}.${ext}`);
        const docPath = join(docDir, docName);

        if (existsSync(docPath)) {
          docCount++;
          continue;
        }

        // If it's a Supabase storage URL, download via storage API
        if (url.includes('supabase')) {
          const storagePath = url.split('/object/public/')[1] || url.split('/object/sign/')[1]?.split('?')[0];
          if (storagePath) {
            const [bucket, ...rest] = storagePath.split('/');
            const { data: fileData } = await supabase.storage.from(bucket).download(rest.join('/'));
            if (fileData) {
              writeFileSync(docPath, Buffer.from(await fileData.arrayBuffer()));
              docCount++;
            }
          }
        }
      } catch (e) {
        // Document download failed — skip
      }
    }
    totalDocs += docCount;

    console.log(`profile ✓  payslips: ${payslipCount}  docs: ${docCount}${emp.id_document_url ? '  ID ✓' : ''}`);
  }

  // Write sync timestamp
  const timestamp = new Date().toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' });
  writeFileSync(
    join(OUTPUT_DIR, `_Last Synced ${new Date().toISOString().slice(0, 10)}.txt`),
    `Pullens Staff Files\nSynced: ${timestamp}\n\nEmployees: ${employees.length}\nPayslips: ${totalPayslips}\nDocuments: ${totalDocs}\nID Copies: ${totalIdCopies}\n`
  );

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`  DONE — ${employees.length} employees synced`);
  console.log(`  Payslips: ${totalPayslips}  |  Docs: ${totalDocs}  |  ID Copies: ${totalIdCopies}`);
  console.log(`  Location: ${OUTPUT_DIR}`);
  console.log(`  Synced at: ${timestamp}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
