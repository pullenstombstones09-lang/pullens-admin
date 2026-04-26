import jsPDF from 'jspdf';
import { LOGO_BASE64 } from './logo-base64';
import type { PayslipPdfData } from './pdf-generator';

// Generates a single PDF with all payslips — one per page
// Uses the exact same layout as the individual payslip

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

function renderPayslipPage(doc: jsPDF, data: PayslipPdfData, pageNum: number, totalPages: number) {
  const L = 12;
  const R = 198;
  const MID = 105;
  const W = R - L;

  // ─── HEADER BAND ───
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 36, 'F');

  try {
    doc.addImage(LOGO_BASE64, 'JPEG', L, 3, 48, 23);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(COMPANY.name, L + 2, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYSLIP', R, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(196, 163, 90);
  doc.text(`Pay Period: ${data.week_start}  to  ${data.week_end}`, R, 21, { align: 'right' });
  doc.text(`Pay Date: ${data.pay_date}`, R, 27, { align: 'right' });

  doc.setFillColor(196, 163, 90);
  doc.rect(0, 36, 210, 1.2, 'F');

  let y = 42;

  // ─── EMPLOYEE DETAILS ───
  doc.setFillColor(248, 247, 245);
  doc.roundedRect(L, y, W, 28, 1.5, 1.5, 'F');

  const empY = y + 5;

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

  // ─── EARNINGS & DEDUCTIONS — SIDE BY SIDE ───
  const colL = L;
  const colLW = MID - L - 2;
  const colR = MID + 2;
  const colRW = R - MID - 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(26, 26, 46);
  doc.text('EARNINGS', colL, y + 4);
  doc.text('DEDUCTIONS', colR, y + 4);
  y += 7;

  const rowH = 6.5;

  // Earnings header
  doc.setFillColor(26, 26, 46);
  doc.rect(colL, y, colLW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', colL + 3, y + 4.5);
  doc.text('Hours', colL + colLW * 0.5, y + 4.5, { align: 'right' });
  doc.text('Rate', colL + colLW * 0.72, y + 4.5, { align: 'right' });
  doc.text('Amount', colL + colLW - 2, y + 4.5, { align: 'right' });

  // Deductions header
  doc.setFillColor(26, 26, 46);
  doc.rect(colR, y, colRW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', colR + 3, y + 4.5);
  doc.text('Amount', colR + colRW - 2, y + 4.5, { align: 'right' });

  y += 8.5;
  let earningsY = y;
  let deductionsY = y;
  const hourlyRate = data.weekly_wage / 40;

  // Basic pay
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

  // Gross total
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

  // Deduction rows
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

  y = Math.max(earningsY, deductionsY) + 4;

  // ─── NET PAY ───
  doc.setFillColor(26, 26, 46);
  doc.roundedRect(L, y, W, 18, 2, 2, 'F');
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

  // ─── EMPLOYER CONTRIBUTIONS ───
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

  // ─── SIGNATURES ───
  const sigW = (W - 10) / 2;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);

  doc.line(L, y + 12, L + sigW, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Employee Signature', L, y + 17);
  doc.text('(Acknowledgement of receipt)', L, y + 21);
  doc.line(L, y + 30, L + sigW * 0.5, y + 30);
  doc.text('Date', L, y + 35);

  doc.line(L + sigW + 10, y + 12, R, y + 12);
  doc.text('Authorised By', L + sigW + 10, y + 17);
  doc.line(L + sigW + 10, y + 30, L + sigW + 10 + sigW * 0.5, y + 30);
  doc.text('Date', L + sigW + 10, y + 35);

  // ─── FOOTER ───
  const fy = 275;
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(0.4);
  doc.line(L, fy, R, fy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(153, 153, 153);
  doc.text(COMPANY.legal, L, fy + 4);
  doc.text(COMPANY.address, L, fy + 8);
  doc.text(`Reg: ${COMPANY.reg}  |  COID: ${COMPANY.coid}  |  UIF: ${COMPANY.uif}`, L, fy + 12);

  doc.setFont('helvetica', 'italic');
  doc.text(`BCEA Section 33 compliant  •  CONFIDENTIAL  •  Page ${pageNum} of ${totalPages}`, R, fy + 4, { align: 'right' });
}

export function generateAllPayslipsPdf(payslips: PayslipPdfData[]): ArrayBuffer {
  const doc = new jsPDF('p', 'mm', 'a4');
  const totalPages = payslips.length;

  for (let i = 0; i < payslips.length; i++) {
    if (i > 0) doc.addPage();
    renderPayslipPage(doc, payslips[i], i + 1, totalPages);
  }

  return doc.output('arraybuffer');
}
