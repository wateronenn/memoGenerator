const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType,
} = require('docx');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('/mnt/user-data/outputs'));

app.post('/generate-docx', async (req, res) => {
  try {
    const { data, subject, context } = req.body;

    const font = "TH SarabunPSK";
    const sz = 28;
    const szHd = 40;

    const makeCell = (text, bold = false, colspan = 1, shade = false) => new TableCell({
      columnSpan: colspan,
      verticalAlign: VerticalAlign.CENTER,
      shading: shade ? { fill: "E8EDFA", type: ShadingType.CLEAR } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        children: [new TextRun({ text: String(text || ''), font, size: sz, bold })],
      })],
    });

    const dateFormatted = data.date
      ? new Date(data.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory' })
      : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const borders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    };

    const headerTable = new Table({
      width: { size: 9200, type: WidthType.DXA },
      columnWidths: [2300, 2300, 2300, 2300],
      borders,
      rows: [
        new TableRow({ children: [
          makeCell("DATE:", true), makeCell(dateFormatted),
          makeCell("SALES DEAL NO:", true), makeCell(data.dealNo || ''),
        ]}),
        new TableRow({ children: [
          makeCell("ATTENTION:", true), makeCell(data.attention || '', false, 3),
        ]}),
        new TableRow({ children: [
          makeCell("CC:", true), makeCell(data.cc || ''),
          makeCell("GL NO.", true), makeCell(data.glNo || '#######'),
        ]}),
        new TableRow({ children: [
          makeCell("REQUEST FROM:", true), makeCell(data.from || ''),
          makeCell("BUDGET:", true), makeCell(data.budget || ''),
        ]}),
        new TableRow({ children: [
          makeCell("SUBJECT:", true, 1, true),
          makeCell(subject, false, 2, true),
          makeCell("CHANNEL: " + (data.channel || ''), false, 1, true),
        ]}),
      ],
    });

    const contextParas = (context || '').split('\n').map(line =>
      new Paragraph({
        children: [new TextRun({ text: line, font, size: sz, bold: true })],
        spacing: { after: 80 },
      })
    );

    const p = (text, opts = {}) => new Paragraph({
      children: [new TextRun({ text, font, size: sz, ...opts })],
      spacing: { before: opts.before || 0, after: opts.after || 80 },
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 280 },
            children: [new TextRun({ text: "MEMORANDUM", font, size: szHd, bold: true })],
          }),
          headerTable,
          new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),
          ...contextParas,
          new Paragraph({ spacing: { before: 240, after: 60 }, children: [] }),
          p("เห็นควรอนุมัติ", { after: 40 }),
          p("ไม่เห็นควรอนุมัติ", { after: 180 }),
          p("(................................)   คุณ ABCD", { after: 60 }),
          p("เห็นควรอนุมัติ    ไม่เห็นควรอนุมัติ", { after: 180 }),
          p("(................................)   คุณ ABC", { after: 180 }),
          p("รับรองเอกสารโดย", { before: 120, after: 60 }),
          p("(................................)", { after: 40 }),
          p("ผู้จัดการแผนกขาย 2", { after: 120 }),
          p("(................................)", { after: 40 }),
          p("ตำแหน่ง", { after: 180 }),
          p("ขอแสดงความนับถือ", { before: 120, after: 120 }),
          p("(................................)", { after: 40 }),
          p("ผู้แทนขาย", { after: 0 }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `Memorandum_${(data.scenarioName || 'memo').replace(/\s+/g, '_')}_${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3456;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
