// Generates the Pullens Biometric Enrolment List as a one-page printable DOCX.

import fs from 'node:fs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel, PageOrientation,
} from 'docx';

const PRIMARY = '1E40AF';     // royal blue
const ACCENT = 'C4A35A';      // gold
const SOFT = 'F4F6FB';
const RULE_GREY = 'BFBFBF';

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY };
const borders = { top: border, bottom: border, left: border, right: border };

// A4 with 1" margins → content width = 11906 - 2880 = 9026 DXA
const CONTENT_W = 9026;

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: opts.spacing || { before: 60, after: 60 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
        size: opts.size || 20,    // half-points; 20 = 10pt
        font: 'Calibri',
      }),
    ],
  });
}

function heading(text, size = 26, color = PRIMARY) {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, color, size, font: 'Calibri' })],
  });
}

function rule() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY, space: 1 } },
    spacing: { before: 0, after: 60 },
    children: [new TextRun('')],
  });
}

function headerCell(text, w) {
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: PRIMARY, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })] })],
  });
}

function bodyCell(text, w, opts = {}) {
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, size: opts.size || 20, color: opts.color, font: 'Calibri' })],
    })],
  });
}

// ---- Tables ----
const enrolColWidths = [1300, 3826, 1900, 2000]; // PT | Name | Device employeeNo | Notes
const enrolTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: enrolColWidths,
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('PT Code', enrolColWidths[0]),
        headerCell('Full Name', enrolColWidths[1]),
        headerCell('Use employeeNo', enrolColWidths[2]),
        headerCell('Notes', enrolColWidths[3]),
      ],
    }),
    ...[
      ['PT010', 'Sibusiso Mdawe', '9025', ''],
      ['PT011', 'Lindokuhle Khanyile', '9029', ''],
      ['PT019', 'Ayanda Mhlongo', '9020', ''],
      ['PT036', 'Philani Rasta', '9015', ''],
      ['PT037', 'Siphiwe Sibangani Dumakude', '9011', ''],
      ['PT038', 'Nhlanhla "Lucky" Ndlovu', '9012', ''],
    ].map((row, i) =>
      new TableRow({
        children: [
          bodyCell(row[0], enrolColWidths[0], { bold: true, shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[1], enrolColWidths[1], { shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[2], enrolColWidths[2], { bold: true, color: PRIMARY, align: AlignmentType.CENTER, shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[3], enrolColWidths[3], { italics: true, color: '666666', shade: i % 2 ? SOFT : undefined }),
        ],
      })
    ),
  ],
});

const futureColWidths = [1300, 3826, 2000, 1900]; // PT | Name | Site | Device employeeNo
const futureTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: futureColWidths,
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('PT Code', futureColWidths[0]),
        headerCell('Full Name', futureColWidths[1]),
        headerCell('Site', futureColWidths[2]),
        headerCell('Suggested employeeNo', futureColWidths[3]),
      ],
    }),
    ...[
      ['PT023', 'Sanelisiwe Faith Nxele', 'Church Street', '9040'],
      ['PT024', 'Gugulethu Cele', 'Pinetown', '9041'],
      ['PT028', 'Randhir Singh', 'Pinetown', '9042'],
      ['PT029', 'Fika Jabulani Mdlalose', 'Pinetown', '9038'],
      ['PT032', 'Zandile Mchunu', 'Church Street', '9043'],
      ['PT039', 'Lungiswa Mpambane', 'Ladysmith', '9044'],
    ].map((row, i) =>
      new TableRow({
        children: [
          bodyCell(row[0], futureColWidths[0], { bold: true, shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[1], futureColWidths[1], { shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[2], futureColWidths[2], { color: '444444', shade: i % 2 ? SOFT : undefined }),
          bodyCell(row[3], futureColWidths[3], { bold: true, color: PRIMARY, align: AlignmentType.CENTER, shade: i % 2 ? SOFT : undefined }),
        ],
      })
    ),
  ],
});

// ---- Document ----
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 20 },
        children: [new TextRun({ text: 'Pullens Tombstones', size: 18, color: '666666', font: 'Calibri' })],
      }),
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: 'Biometric Enrolment List', bold: true, size: 36, color: PRIMARY, font: 'Calibri' })],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: 'Allandale HikVision DS-K1T343MWX  ·  22 May 2026', italics: true, size: 18, color: '666666', font: 'Calibri' })],
      }),
      rule(),

      heading('1.  Device label to fix (1)'),
      p('On the device, rename user 9019 from "Albert Johannes Masindo" to "Thabiso Msindo". The enrolled face is correct — only the display label is wrong.', { italics: true, color: '444444' }),

      heading('2.  To enrol at Allandale (6)'),
      p('Use the EXACT employeeNo below for each person. Don\'t let the device auto-assign — type the number yourself.', { italics: true, color: '444444' }),
      enrolTable,

      heading('3.  Future enrolment (satellite devices)'),
      p('These staff stay on manual register entry for now. Enrol them at their site when the satellite biometric arrives.', { italics: true, color: '444444' }),
      futureTable,

      new Paragraph({
        spacing: { before: 280 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '— 28 already enrolled and mapped to PT codes —', size: 16, color: '888888', italics: true, font: 'Calibri' })],
      }),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
const outPath = 'C:/Users/Annika/Desktop/Pullens_Biometric_Enrolment_List.docx';
fs.writeFileSync(outPath, buf);
console.log(`Wrote ${outPath} (${buf.length} bytes)`);
