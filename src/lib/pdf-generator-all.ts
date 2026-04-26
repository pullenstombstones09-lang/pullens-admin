import jsPDF from 'jspdf';
import { LOGO_BASE64 } from './logo-base64';
import type { PayslipPdfData } from './pdf-generator';

// Generates a single PDF with all payslips — one per page
// Reuses the same layout as the individual payslip generator

const COMPANY = {
  name: 'PULLENS TOMBSTONES',
  legal: 'Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones',
  reg: '2011/105461/23',
  coid: '990001280518',
  uif: '2573997/9',
  address: '46 Allandale Drive, Allandale, Pietermaritzburg, KZN',
};

function fmt(n: number) {
  return `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function addHeader(doc: jsPDF, subtitle: string): number {
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 10, 4, 55, 26);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 46);
    doc.text('PULLENS TOMBSTONES', 15, 18);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text('PAYSLIP', 195, 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(subtitle, 195, 21, { align: 'right' });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(12, 32, 198, 32);
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.2);
  doc.line(12, 33, 198, 33);

  return 38;
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
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
  doc.text(`Page ${pageNum} of ${totalPages}`, 195, y + 8, { align: 'right' });
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

function renderPayslipPage(doc: jsPDF, data: PayslipPdfData) {
  let y = addHeader(doc, `Week: ${data.week_start} — ${data.week_end}`);

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

  const hourlyRate = data.weekly_wage / 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 51, 51);
  doc.text('Ordinary Pay', 18, y + 4);
  doc.text(data.ordinary_hours.toFixed(1), 100, y + 4, { align: 'right' });
  doc.text(fmt(hourlyRate) + '/hr', 140, y + 4, { align: 'right' });
  doc.text(fmt(data.weekly_wage), 192, y + 4, { align: 'right' });
  y += 7;

  if (data.ot_hours > 0) {
    doc.text(`Overtime (x${data.ot_rate.toFixed(1)})`, 18, y + 4);
    doc.text(data.ot_hours.toFixed(1), 100, y + 4, { align: 'right' });
    doc.text(fmt(hourlyRate * data.ot_rate) + '/hr', 140, y + 4, { align: 'right' });
    doc.text(fmt(data.ot_amount), 192, y + 4, { align: 'right' });
    y += 7;
  }

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(15, y + 1, 195, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
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

  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(15, y + 1, 195, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DEDUCTIONS', 18, y + 6);
  doc.text(fmt(data.total_deductions), 192, y + 6, { align: 'right' });
  y += 14;

  // Employer contributions
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(102, 102, 102);
  doc.text('Employer Contributions (not deducted from employee pay):', 15, y);
  y += 5;
  doc.text(`UIF Employer (1%): ${fmt(data.uif_employer)}`, 18, y);
  y += 8;

  // NET PAY box
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(15, y, 180, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 26, 46);
  doc.text('NET PAY', 22, y + 11);
  doc.text(fmt(data.net), 190, y + 11, { align: 'right' });
  y += 24;

  // Signature
  y += 8;
  signatureLine(doc, 15, y, 'Employee Signature (Acknowledgement of Receipt)');
  signatureLine(doc, 115, y, 'Authorised By');
}

export function generateAllPayslipsPdf(payslips: PayslipPdfData[]): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');
  const totalPages = payslips.length;

  for (let i = 0; i < payslips.length; i++) {
    if (i > 0) doc.addPage();
    renderPayslipPage(doc, payslips[i]);
    addFooter(doc, i + 1, totalPages);
  }

  return doc.output('arraybuffer');
}
