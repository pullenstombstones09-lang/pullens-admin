import jsPDF from 'jspdf';

// ============================================================
// Pullens Admin — PDF Generator
// Shared utilities + Warning Form + Hearing Notice + Payslip
// ============================================================

const COLORS = {
  dark: '#1A1A2E',
  gold: '#C4A35A',
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
  // Dark header bar
  doc.setFillColor(26, 26, 46); // #1A1A2E
  doc.rect(0, 0, 210, 32, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PULLENS TOMBSTONES', 15, 14);

  // Tagline
  doc.setFontSize(7);
  doc.setTextColor(196, 163, 90); // gold
  doc.text('CAST IN STONE', 15, 20);

  // Document title
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), 195, 14, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(196, 163, 90);
    doc.text(subtitle, 195, 20, { align: 'right' });
  }

  // Gold line under header
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(0.5);
  doc.line(0, 32, 210, 32);

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
  doc.text(label, x, y + 4);
  doc.text('Date: _______________', x, y + 9);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 46);
  doc.text(title, 15, y);
  doc.setDrawColor(196, 163, 90);
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

  let y = addHeader(doc, 'PAYSLIP', `Week: ${data.week_start} — ${data.week_end}`);

  // Employee details
  y = sectionTitle(doc, y, 'Employee Details');
  labelValue(doc, 15, y, 'Name:', data.employee_name);
  labelValue(doc, 115, y, 'Code:', data.pt_code);
  y += 6;
  labelValue(doc, 15, y, 'Occupation:', data.occupation);
  labelValue(doc, 115, y, 'ID Number:', data.id_number || '—');
  y += 6;
  labelValue(doc, 15, y, 'Payment:', data.payment_method.toUpperCase());
  if (data.bank_name) {
    labelValue(doc, 115, y, 'Bank:', `${data.bank_name} (${data.bank_acc})`);
  }
  y += 6;
  labelValue(doc, 15, y, 'Pay Date:', data.pay_date);
  y += 10;

  // Earnings table
  y = sectionTitle(doc, y, 'Earnings');

  // Table header
  doc.setFillColor(26, 26, 46);
  doc.rect(15, y, 180, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', 18, y + 5);
  doc.text('Hours', 100, y + 5, { align: 'right' });
  doc.text('Rate', 140, y + 5, { align: 'right' });
  doc.text('Amount', 192, y + 5, { align: 'right' });
  y += 9;

  // Ordinary pay
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  const hourlyRate = data.weekly_wage / 40;
  doc.text('Ordinary Pay', 18, y + 4);
  doc.text(data.ordinary_hours.toFixed(1), 100, y + 4, { align: 'right' });
  doc.text(fmt(hourlyRate) + '/hr', 140, y + 4, { align: 'right' });
  doc.text(fmt(data.weekly_wage), 192, y + 4, { align: 'right' });
  y += 7;

  // Overtime
  if (data.ot_hours > 0) {
    doc.text(`Overtime (x${data.ot_rate})`, 18, y + 4);
    doc.text(data.ot_hours.toFixed(1), 100, y + 4, { align: 'right' });
    doc.text(fmt(hourlyRate * data.ot_rate) + '/hr', 140, y + 4, { align: 'right' });
    doc.text(fmt(data.ot_amount), 192, y + 4, { align: 'right' });
    y += 7;
  }

  // Gross line
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(0.4);
  doc.line(15, y + 1, 195, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GROSS PAY', 18, y + 6);
  doc.text(fmt(data.gross), 192, y + 6, { align: 'right' });
  y += 12;

  // Deductions table
  y = sectionTitle(doc, y, 'Deductions');

  doc.setFillColor(26, 26, 46);
  doc.rect(15, y, 180, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', 18, y + 5);
  doc.text('Amount', 192, y + 5, { align: 'right' });
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);

  const deductions = [
    { label: 'UIF (Employee 1%)', amount: data.uif_employee },
    { label: 'PAYE', amount: data.paye },
    { label: 'Late Deduction', amount: data.late_deduction },
    { label: 'Loan Repayment', amount: data.loan_deduction },
    { label: 'Garnishee Order', amount: data.garnishee },
    { label: 'Petty Cash Shortfall', amount: data.petty_shortfall },
  ];

  for (const d of deductions) {
    if (d.amount > 0) {
      doc.text(d.label, 18, y + 4);
      doc.text(fmt(d.amount), 192, y + 4, { align: 'right' });
      y += 7;
    }
  }

  // Total deductions
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(15, y + 1, 195, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DEDUCTIONS', 18, y + 6);
  doc.text(fmt(data.total_deductions), 192, y + 6, { align: 'right' });
  y += 14;

  // Employer contributions (shown for transparency, not deducted from pay)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(102, 102, 102);
  doc.text('Employer Contributions (not deducted from employee pay):', 15, y);
  y += 5;
  doc.text(`UIF Employer (1%): ${fmt(data.uif_employer)}`, 18, y);
  y += 8;

  // NET PAY — highlight box
  doc.setFillColor(196, 163, 90);
  doc.roundedRect(15, y, 180, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 26, 46);
  doc.text('NET PAY', 22, y + 11);
  doc.text(fmt(data.net), 190, y + 11, { align: 'right' });
  y += 24;

  // Signature
  signatureLine(doc, 15, y + 4, 'Employee Signature (Acknowledgement of Receipt)');
  signatureLine(doc, 115, y + 4, 'Authorised By');

  addFooter(doc);

  return doc.output('arraybuffer');
}
