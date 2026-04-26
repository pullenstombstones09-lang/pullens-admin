import jsPDF from 'jspdf';
import { LOGO_BASE64 } from './logo-base64';

// ============================================================
// Pullens Admin — PDF Generator
// Shared utilities + Warning Form + Hearing Notice + Payslip
// ============================================================

const COLORS = {
  dark: '#1A1A2E',
  gold: '#2563EB',
  grey: '#666666',
  lightGrey: '#999999',
  lineGrey: '#DDDDDD',
  bg: '#F5F3EF',
  white: '#FFFFFF',
  black: '#333333',
};

const COMPANY = {
  name: 'PULLENS TOMBSTONES',
  legal: 'Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones',
  reg: '2011/105461/23',
  coid: '990001280518',
  uif: '2573997/9',
  address: '46 Allandale Drive, Allandale, Pietermaritzburg, KZN',
  tagline: 'CAST IN STONE',
};

// ============================================================
// HELPERS
// ============================================================

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // White header with logo
  // Logo: aspect ratio ~2.08:1 (2254x1084), display at ~50x24mm
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 10, 4, 55, 26);
  } catch {
    // Fallback if image fails
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 46);
    doc.text('PULLENS TOMBSTONES', 15, 18);
  }

  // Document title — right aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text(title.toUpperCase(), 195, 14, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(subtitle, 195, 21, { align: 'right' });
  }

  // Gold line under header
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(12, 32, 198, 32);

  // Thin dark line below gold
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.2);
  doc.line(12, 33, 198, 33);

  return 38; // next Y position
}

function addFooter(doc: jsPDF, pageNum?: number) {
  const y = 282;
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(153, 153, 153);
  doc.text(`${COMPANY.legal} | ${COMPANY.address}`, 15, y + 4);
  doc.text(`Reg: ${COMPANY.reg} | COID: ${COMPANY.coid} | UIF: ${COMPANY.uif}`, 15, y + 8);
  doc.text('CONFIDENTIAL', 195, y + 4, { align: 'right' });
  if (pageNum) {
    doc.text(`Page ${pageNum}`, 195, y + 8, { align: 'right' });
  }
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string, labelWidth = 40) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(value || '—', x + labelWidth, y);
}

function signatureLine(doc: jsPDF, x: number, y: number, label: string, width = 70) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + width, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(102, 102, 102);
  doc.text(label, x, y + 5);

  doc.line(x, y + 18, x + width, y + 18);
  doc.text('Date:', x, y + 23);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 46);
  doc.text(title, 15, y);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(15, y + 1.5, 195, y + 1.5);
  return y + 8;
}

function wrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.5): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// ============================================================
// 1. WARNING FORM PDF
// ============================================================

export interface WarningPdfData {
  employee_name: string;
  pt_code: string;
  occupation: string;
  start_date: string;
  warning_level: 'verbal' | 'written' | 'final';
  category: 'A' | 'B' | 'C';
  offence: string;
  description: string;
  date_of_offence: string;
  issued_date: string;
  expiry_date: string;
  issued_by: string;
  prior_warnings?: string[];
  employee_response?: string;
}

export function generateWarningPdf(data: WarningPdfData): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');

  const levelLabel = data.warning_level === 'verbal' ? 'VERBAL WARNING' :
    data.warning_level === 'written' ? 'WRITTEN WARNING' : 'FINAL WRITTEN WARNING';

  let y = addHeader(doc, levelLabel, `Category ${data.category} Misconduct`);

  // Employee details
  y = sectionTitle(doc, y, 'Employee Details');
  labelValue(doc, 15, y, 'Name:', data.employee_name);
  labelValue(doc, 115, y, 'Code:', data.pt_code);
  y += 6;
  labelValue(doc, 15, y, 'Occupation:', data.occupation);
  labelValue(doc, 115, y, 'Start Date:', data.start_date);
  y += 10;

  // Offence details
  y = sectionTitle(doc, y, 'Offence Details');
  labelValue(doc, 15, y, 'Date of Offence:', data.date_of_offence);
  labelValue(doc, 115, y, 'Category:', `Category ${data.category}`);
  y += 6;
  labelValue(doc, 15, y, 'Offence Type:', data.offence);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text('Description:', 15, y);
  y += 5;
  y = wrappedText(doc, data.description, 15, y, 175);
  y += 6;

  // Prior warnings
  if (data.prior_warnings && data.prior_warnings.length > 0) {
    y = sectionTitle(doc, y, 'Prior Active Warnings');
    for (const w of data.prior_warnings) {
      doc.setFontSize(8.5);
      doc.setTextColor(51, 51, 51);
      doc.text(`• ${w}`, 18, y);
      y += 5;
    }
    y += 4;
  }

  // Warning issued
  y = sectionTitle(doc, y, 'Warning Issued');

  // Warning level box
  doc.setFillColor(245, 243, 239);
  doc.roundedRect(15, y, 180, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 26, 46);
  doc.text(levelLabel, 105, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(`Valid from ${data.issued_date} to ${data.expiry_date}`, 105, y + 15, { align: 'center' });
  y += 28;

  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  doc.text('You are hereby warned that a repetition of this or any similar offence may result in further', 15, y);
  y += 4.5;
  doc.text('disciplinary action, which may include dismissal following a disciplinary hearing.', 15, y);
  y += 10;

  // Employee response
  y = sectionTitle(doc, y, 'Employee Response');
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) {
    doc.line(15, y + i * 7, 195, y + i * 7);
  }
  if (data.employee_response) {
    doc.setFontSize(8.5);
    doc.setTextColor(51, 51, 51);
    doc.text(data.employee_response, 15, y - 2);
  }
  y += 32;

  // Signatures
  y = sectionTitle(doc, y, 'Signatures');
  signatureLine(doc, 15, y + 8, 'Issued By: ' + data.issued_by);
  signatureLine(doc, 115, y + 8, 'Employee Signature');
  signatureLine(doc, 15, y + 28, 'Witness');

  // Refusal note
  y += 42;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(153, 153, 153);
  doc.text('If the employee refuses to sign, the witness must note: "Employee refused to sign. Warning was read and explained."', 15, y);

  addFooter(doc);

  return doc.output('arraybuffer');
}

// ============================================================
// 2. HEARING NOTICE PDF
// ============================================================

export interface HearingNoticePdfData {
  employee_name: string;
  pt_code: string;
  occupation: string;
  charges: string[];
  hearing_date: string;
  hearing_time: string;
  hearing_venue: string;
  chairperson: string;
  notice_date: string;
  issued_by: string;
  prior_warnings?: string[];
}

export function generateHearingNoticePdf(data: HearingNoticePdfData): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');

  let y = addHeader(doc, 'NOTICE OF DISCIPLINARY HEARING', 'Strictly Confidential');

  // Notice date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(102, 102, 102);
  doc.text(`Date: ${data.notice_date}`, 195, y, { align: 'right' });
  y += 6;

  // Employee details
  y = sectionTitle(doc, y, 'Addressed To');
  labelValue(doc, 15, y, 'Name:', data.employee_name);
  labelValue(doc, 115, y, 'Code:', data.pt_code);
  y += 6;
  labelValue(doc, 15, y, 'Occupation:', data.occupation);
  y += 10;

  // Hearing details
  y = sectionTitle(doc, y, 'Hearing Details');
  labelValue(doc, 15, y, 'Date:', data.hearing_date);
  labelValue(doc, 115, y, 'Time:', data.hearing_time);
  y += 6;
  labelValue(doc, 15, y, 'Venue:', data.hearing_venue);
  labelValue(doc, 115, y, 'Chairperson:', data.chairperson);
  y += 10;

  // Charges
  y = sectionTitle(doc, y, 'Charge(s)');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  doc.text('You are hereby charged with the following:', 15, y);
  y += 6;
  for (let i = 0; i < data.charges.length; i++) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Charge ${i + 1}:`, 18, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.charges[i], 155);
    doc.text(lines, 45, y);
    y += lines.length * 4.5 + 4;
  }
  y += 4;

  // Prior warnings
  if (data.prior_warnings && data.prior_warnings.length > 0) {
    y = sectionTitle(doc, y, 'Relevant Prior Warnings');
    for (const w of data.prior_warnings) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 51, 51);
      doc.text(`• ${w}`, 18, y);
      y += 5;
    }
    y += 4;
  }

  // Rights
  y = sectionTitle(doc, y, 'Your Rights');
  const rights = [
    'You have the right to be represented by a fellow employee or shop steward at this hearing.',
    'You have the right to call witnesses and present evidence in your defence.',
    'You have the right to cross-examine any witnesses called by the employer.',
    'You have the right to an interpreter if required.',
    'You have the right to be informed of the outcome in writing.',
    'Failure to attend the hearing without valid reason may result in the hearing proceeding in your absence.',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  for (const r of rights) {
    doc.text(`• ${r}`, 18, y);
    y += 5.5;
  }
  y += 6;

  // Preparation
  y = sectionTitle(doc, y, 'Preparation');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  doc.text('You are given reasonable time to prepare your case. If you require additional time, you must', 15, y);
  y += 4.5;
  doc.text('request a postponement IN WRITING before the scheduled hearing date.', 15, y);
  y += 10;

  // Signatures
  signatureLine(doc, 15, y + 4, 'Issued By: ' + data.issued_by);
  signatureLine(doc, 115, y + 4, 'Employee Acknowledgement');

  addFooter(doc);

  return doc.output('arraybuffer');
}

// ============================================================
// 3. PAYSLIP PDF
// ============================================================

export interface PayslipPdfData {
  employee_name: string;
  pt_code: string;
  occupation: string;
  id_number: string;
  payment_method: string;
  bank_name: string;
  bank_acc: string;
  week_start: string;
  week_end: string;
  pay_date: string;

  // Earnings
  weekly_wage: number;
  ordinary_hours: number;
  ot_hours: number;
  ot_rate: number;
  ot_amount: number;
  gross: number;

  // Deductions
  late_deduction: number;
  uif_employee: number;
  uif_employer: number;
  paye: number;
  loan_deduction: number;
  garnishee: number;
  petty_shortfall: number;
  total_deductions: number;
  net: number;
}

export function generatePayslipPdf(data: PayslipPdfData): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');
  const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const L = 12;      // left margin
  const R = 198;     // right edge
  const MID = 105;   // column split
  const W = R - L;   // full width

  // ─── HEADER BAND ───────────────────────────────────────────
  // Dark navy strip across top
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 36, 'F');

  // Logo (white area behind it would be the image)
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', L, 3, 48, 23);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(COMPANY.name, L + 2, 16);
  }

  // Right side: PAYSLIP title + period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYSLIP', R, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(196, 163, 90); // gold
  doc.text(`Pay Period: ${data.week_start}  to  ${data.week_end}`, R, 21, { align: 'right' });
  doc.text(`Pay Date: ${data.pay_date}`, R, 27, { align: 'right' });

  // Gold accent line at bottom of header
  doc.setFillColor(196, 163, 90);
  doc.rect(0, 36, 210, 1.2, 'F');

  let y = 42;

  // ─── EMPLOYEE DETAILS ──────────────────────────────────────
  // Two-column info block with light background
  doc.setFillColor(248, 247, 245);
  doc.roundedRect(L, y, W, 28, 1.5, 1.5, 'F');

  const empY = y + 5;

  // Left column
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Employee Name', L + 4, empY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.text(data.employee_name, L + 4, empY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Occupation', L + 4, empY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(data.occupation, L + 4, empY + 18);

  // Middle column
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Employee Code', 80, empY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(data.pt_code, 80, empY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('ID Number', 80, empY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(data.id_number || '—', 80, empY + 18);

  // Right column
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Payment Method', 145, empY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(data.payment_method.toUpperCase(), 145, empY + 5.5);

  if (data.bank_name) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text('Bank', 145, empY + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(`${data.bank_name}  •  ${data.bank_acc}`, 145, empY + 18);
  }

  y += 33;

  // ─── EARNINGS & DEDUCTIONS — SIDE BY SIDE ──────────────────
  const colL = L;            // left column start
  const colLW = MID - L - 2; // left column width
  const colR = MID + 2;     // right column start
  const colRW = R - MID - 2; // right column width

  // Section labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(26, 26, 46);
  doc.text('EARNINGS', colL, y + 4);
  doc.text('DEDUCTIONS', colR, y + 4);

  y += 7;

  // Column headers — Earnings
  doc.setFillColor(26, 26, 46);
  doc.rect(colL, y, colLW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', colL + 3, y + 4.5);
  doc.text('Hours', colL + colLW * 0.5, y + 4.5, { align: 'right' });
  doc.text('Rate', colL + colLW * 0.72, y + 4.5, { align: 'right' });
  doc.text('Amount', colL + colLW - 2, y + 4.5, { align: 'right' });

  // Column headers — Deductions
  doc.setFillColor(26, 26, 46);
  doc.rect(colR, y, colRW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', colR + 3, y + 4.5);
  doc.text('Amount', colR + colRW - 2, y + 4.5, { align: 'right' });

  y += 8.5;
  const rowH = 6.5;
  let earningsY = y;
  let deductionsY = y;
  const hourlyRate = data.weekly_wage / 40;

  // ── Earnings rows ──
  // Ordinary pay
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  doc.text('Basic Pay', colL + 3, earningsY + 4.5);
  doc.setFontSize(7.5);
  doc.text(data.ordinary_hours.toFixed(1), colL + colLW * 0.5, earningsY + 4.5, { align: 'right' });
  doc.text(fmt(hourlyRate), colL + colLW * 0.72, earningsY + 4.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(data.weekly_wage), colL + colLW - 2, earningsY + 4.5, { align: 'right' });
  earningsY += rowH;

  // Overtime
  if (data.ot_hours > 0) {
    doc.setFillColor(248, 247, 245);
    doc.rect(colL, earningsY, colLW, rowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(`Overtime (x${data.ot_rate.toFixed(1)})`, colL + 3, earningsY + 4.5);
    doc.setFontSize(7.5);
    doc.text(data.ot_hours.toFixed(1), colL + colLW * 0.5, earningsY + 4.5, { align: 'right' });
    doc.text(fmt(hourlyRate * data.ot_rate), colL + colLW * 0.72, earningsY + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(data.ot_amount), colL + colLW - 2, earningsY + 4.5, { align: 'right' });
    earningsY += rowH;
  }

  // Gross pay total
  earningsY += 1;
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.4);
  doc.line(colL, earningsY, colL + colLW, earningsY);
  earningsY += 1;
  doc.setFillColor(248, 247, 245);
  doc.rect(colL, earningsY, colLW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 46);
  doc.text('GROSS PAY', colL + 3, earningsY + 5);
  doc.text(fmt(data.gross), colL + colLW - 2, earningsY + 5, { align: 'right' });
  earningsY += 9;

  // ── Deductions rows ──
  const deductionItems = [
    { label: 'UIF (Employee 1%)', amount: data.uif_employee },
    { label: 'PAYE', amount: data.paye },
    { label: 'Late Deduction', amount: data.late_deduction },
    { label: 'Loan Repayment', amount: data.loan_deduction },
    { label: 'Garnishee Order', amount: data.garnishee },
    { label: 'Petty Cash Shortfall', amount: data.petty_shortfall },
  ].filter(d => d.amount > 0);

  let rowIdx = 0;
  for (const d of deductionItems) {
    if (rowIdx % 2 === 1) {
      doc.setFillColor(248, 247, 245);
      doc.rect(colR, deductionsY, colRW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(d.label, colR + 3, deductionsY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 40, 40);
    doc.text(`-${fmt(d.amount)}`, colR + colRW - 2, deductionsY + 4.5, { align: 'right' });
    deductionsY += rowH;
    rowIdx++;
  }

  // Total deductions
  deductionsY += 1;
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.4);
  doc.line(colR, deductionsY, colR + colRW, deductionsY);
  deductionsY += 1;
  doc.setFillColor(248, 247, 245);
  doc.rect(colR, deductionsY, colRW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 46);
  doc.text('TOTAL DEDUCTIONS', colR + 3, deductionsY + 5);
  doc.setTextColor(180, 40, 40);
  doc.text(`-${fmt(data.total_deductions)}`, colR + colRW - 2, deductionsY + 5, { align: 'right' });
  deductionsY += 9;

  // Move past both columns
  y = Math.max(earningsY, deductionsY) + 4;

  // ─── NET PAY — PROMINENT BOX ──────────────────────────────
  doc.setFillColor(26, 26, 46);
  doc.roundedRect(L, y, W, 18, 2, 2, 'F');

  // Gold accent bar on left
  doc.setFillColor(196, 163, 90);
  doc.rect(L, y, 3, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(196, 163, 90);
  doc.text('NET PAY', L + 8, y + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(fmt(data.net), R - 4, y + 12.5, { align: 'right' });

  y += 24;

  // ─── EMPLOYER CONTRIBUTIONS (BCEA transparency) ────────────
  doc.setFillColor(248, 247, 245);
  doc.roundedRect(L, y, W, 10, 1, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Employer Contributions (not deducted from employee pay)', L + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`UIF Employer (1%): ${fmt(data.uif_employer)}`, L + 4, y + 8.5);

  y += 16;

  // ─── SIGNATURES ────────────────────────────────────────────
  // Two signature blocks side by side
  const sigW = (W - 10) / 2;

  // Employee signature
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(L, y + 12, L + sigW, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Employee Signature', L, y + 17);
  doc.text('(Acknowledgement of receipt)', L, y + 21);

  // Date under employee sig
  doc.line(L, y + 30, L + sigW * 0.5, y + 30);
  doc.text('Date', L, y + 35);

  // Authorised by
  doc.line(L + sigW + 10, y + 12, R, y + 12);
  doc.text('Authorised By', L + sigW + 10, y + 17);

  // Date under auth
  doc.line(L + sigW + 10, y + 30, L + sigW + 10 + sigW * 0.5, y + 30);
  doc.text('Date', L + sigW + 10, y + 35);

  // ─── FOOTER ────────────────────────────────────────────────
  const fy = 275;
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(0.4);
  doc.line(L, fy, R, fy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(153, 153, 153);
  doc.text(COMPANY.legal, L, fy + 4);
  doc.text(`${COMPANY.address}`, L, fy + 8);
  doc.text(`Reg: ${COMPANY.reg}  |  COID: ${COMPANY.coid}  |  UIF: ${COMPANY.uif}`, L, fy + 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text('BCEA Section 33 compliant payslip  •  CONFIDENTIAL', R, fy + 4, { align: 'right' });

  return doc.output('arraybuffer');
}
