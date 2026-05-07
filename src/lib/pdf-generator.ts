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
  doc.text(value || '-', x + labelWidth, y);
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
  weekly_hours: number;
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

  // Signature (optional — included when payslip has been signed)
  signature_url?: string;
  signed_at?: string;
}

export function generatePayslipPdf(data: PayslipPdfData): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');
  const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const pw = 210; // page width
  const mx = 15; // margin x
  const cw = pw - mx * 2; // content width
  const hourlyRate = data.weekly_wage / (data.weekly_hours || 40);

  // Format dates readable
  const fmtDate = (d: string) => {
    try {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  // ── HEADER ──────────────────────────────────────────────────────────
  // Logo — proportional, not stretched (original ~2:1 ratio)
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', mx, 8, 40, 20);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text('PULLENS TOMBSTONES', mx, 18);
  }

  // Right side — PAYSLIP title + pay period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('PAYSLIP', pw - mx, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Pay Period: ${fmtDate(data.week_start)} - ${fmtDate(data.week_end)}`, pw - mx, 20, { align: 'right' });
  doc.text(`Pay Date: ${fmtDate(data.pay_date)}`, pw - mx, 25, { align: 'right' });

  // Thin blue line
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.6);
  doc.line(mx, 32, pw - mx, 32);

  let y = 40;

  // ── EMPLOYEE INFO — two column grid ─────────────────────────────────
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(mx, y, cw, 28, 2, 2, 'F');

  const col1 = mx + 5;
  const col2 = 110;
  const labelStyle = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); };
  const valueStyle = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30); };

  y += 7;
  labelStyle(); doc.text('Employee Name', col1, y);
  labelStyle(); doc.text('Employee Code', col2, y);
  y += 5;
  valueStyle(); doc.text(data.employee_name || '-', col1, y);
  valueStyle(); doc.text(data.pt_code || '-', col2, y);

  y += 8;
  labelStyle(); doc.text('Occupation', col1, y);
  labelStyle(); doc.text('ID Number', col2, y);
  y += 5;
  valueStyle(); doc.text(data.occupation || '-', col1, y);
  valueStyle(); doc.text(data.id_number || '-', col2, y);

  y += 10;

  // Bank details (if available)
  if (data.bank_name) {
    labelStyle(); doc.text('Bank', col1, y);
    valueStyle(); doc.text(`${data.bank_name} - ${data.bank_acc}`, col1 + 20, y);
    y += 6;
  }

  y += 4;

  // ── EARNINGS TABLE ──────────────────────────────────────────────────
  // Section label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('EARNINGS', mx, y);
  y += 3;

  // Table header
  doc.setFillColor(30, 64, 175);
  doc.rect(mx, y, cw, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', mx + 3, y + 5);
  doc.text('Hours', 95, y + 5, { align: 'right' });
  doc.text('Rate', 140, y + 5, { align: 'right' });
  doc.text('Amount', pw - mx - 3, y + 5, { align: 'right' });
  y += 9;

  // Ordinary pay row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text('Ordinary Pay', mx + 3, y + 4);
  doc.text(data.ordinary_hours.toFixed(1), 95, y + 4, { align: 'right' });
  doc.text(fmt(hourlyRate) + '/hr', 140, y + 4, { align: 'right' });
  doc.text(fmt(data.weekly_wage), pw - mx - 3, y + 4, { align: 'right' });
  y += 8;

  // Overtime row
  if (data.ot_hours > 0) {
    doc.setFillColor(250, 250, 252);
    doc.rect(mx, y - 2, cw, 8, 'F');
    doc.setTextColor(40, 40, 40);
    doc.text(`Overtime (x${data.ot_rate.toFixed(1)})`, mx + 3, y + 4);
    doc.text(data.ot_hours.toFixed(1), 95, y + 4, { align: 'right' });
    doc.text(fmt(hourlyRate * data.ot_rate) + '/hr', 140, y + 4, { align: 'right' });
    doc.text(fmt(data.ot_amount), pw - mx - 3, y + 4, { align: 'right' });
    y += 8;
  }

  // Gross pay total
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.4);
  doc.line(mx, y, pw - mx, y);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('GROSS PAY', mx + 3, y + 4);
  doc.text(fmt(data.gross), pw - mx - 3, y + 4, { align: 'right' });
  y += 12;

  // ── DEDUCTIONS TABLE ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('DEDUCTIONS', mx, y);
  y += 3;

  doc.setFillColor(30, 64, 175);
  doc.rect(mx, y, cw, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', mx + 3, y + 5);
  doc.text('Amount', pw - mx - 3, y + 5, { align: 'right' });
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);

  const deductions = [
    { label: 'UIF (Employee 1%)', amount: data.uif_employee },
    { label: 'PAYE', amount: data.paye },
    { label: 'Late Deduction', amount: data.late_deduction },
    { label: 'Loan Repayment', amount: data.loan_deduction },
    { label: 'Garnishee Order', amount: data.garnishee },
    { label: 'Petty Cash Shortfall', amount: data.petty_shortfall },
  ];

  let stripe = false;
  for (const d of deductions) {
    if (d.amount > 0) {
      if (stripe) {
        doc.setFillColor(250, 250, 252);
        doc.rect(mx, y - 2, cw, 8, 'F');
      }
      doc.setTextColor(40, 40, 40);
      doc.text(d.label, mx + 3, y + 4);
      doc.text(fmt(d.amount), pw - mx - 3, y + 4, { align: 'right' });
      y += 8;
      stripe = !stripe;
    }
  }

  // Total deductions
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(mx, y, pw - mx, y);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL DEDUCTIONS', mx + 3, y + 4);
  doc.text(fmt(data.total_deductions), pw - mx - 3, y + 4, { align: 'right' });
  y += 10;

  // Employer contributions — small italic note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(`Employer UIF Contribution (1%): ${fmt(data.uif_employer)} - not deducted from pay`, mx, y);
  y += 10;

  // ── NET PAY BOX ─────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(mx, y, cw, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAY', mx + 8, y + 12);
  doc.setFontSize(16);
  doc.text(fmt(data.net), pw - mx - 8, y + 12, { align: 'right' });
  y += 28;

  // ── SIGNATURES ──────────────────────────────────────────────────────
  if (data.signature_url) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Employee Signature:', mx, y);
    y += 2;
    try {
      doc.addImage(data.signature_url, 'PNG', mx, y, 55, 18);
    } catch {
      signatureLine(doc, mx, y + 14, 'Employee Signature');
    }
    y += 20;
    if (data.signed_at) {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Signed: ${data.signed_at}`, mx, y);
    }
    signatureLine(doc, 115, y - 6, 'Authorised By');
  } else {
    signatureLine(doc, mx, y, 'Employee Signature');
    signatureLine(doc, 115, y, 'Authorised By');
  }

  addFooter(doc);

  return doc.output('arraybuffer');
}
