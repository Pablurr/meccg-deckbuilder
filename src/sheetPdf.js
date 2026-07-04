import PDFDocument from 'pdfkit';
import path from 'node:path';
import { toCutBuffer } from './imageProcessor.js';
import { backGroupForType } from './exporter.js';

// PDF points: 72pt per inch.
const PT = 72;
export const LETTER = { w: 8.5 * PT, h: 11 * PT }; // 612 x 792
export const CARD = { w: 2.5 * PT, h: 3.5 * PT }; // 180 x 252 (poker cut size)
export const COLS = 3;
export const ROWS = 3; // 3x3 poker cards is the largest grid that fits US Letter at true size

// Pure layout: card cell rectangles centered on the page.
export function sheetLayout({ pageW = LETTER.w, pageH = LETTER.h, cardW = CARD.w, cardH = CARD.h, cols = COLS, rows = ROWS } = {}) {
  const marginX = (pageW - cols * cardW) / 2;
  const marginY = (pageH - rows * cardH) / 2;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ row, col, x: marginX + col * cardW, y: marginY + row * cardH });
    }
  }
  return { marginX, marginY, cardW, cardH, cols, rows, perPage: cols * rows, cells };
}

// For duplex printing flipped on the long (left-right) edge, back columns mirror.
export function backColumnIndex(col, cols = COLS) {
  return cols - 1 - col;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Draw short corner crop marks just outside a card rectangle.
function cropMarks(doc, x, y, w, h, len = 9) {
  doc.save().lineWidth(0.4).strokeColor('#888');
  const corners = [
    [x, y, -len, 0, 0, -len], // top-left
    [x + w, y, len, 0, 0, -len], // top-right
    [x, y + h, -len, 0, 0, len], // bottom-left
    [x + w, y + h, len, 0, 0, len], // bottom-right
  ];
  for (const [cx, cy, hdx, hdy, vdx, vdy] of corners) {
    doc.moveTo(cx, cy).lineTo(cx + hdx, cy + hdy).stroke();
    doc.moveTo(cx, cy).lineTo(cx + vdx, cy + vdy).stroke();
  }
  doc.restore();
}

// Build a US-Letter PDF with 3x3 poker cards per page at true size, with crop
// marks. If includeBacks, a mirrored backs page follows each fronts page so the
// deck can be duplex-printed (flip on long edge).
// - cards: flattened card objects
// - imagesRoot: root for relativePath
// - backPaths: { playdeck, locationdeck } absolute paths (defaults applied by caller)
export async function buildSheetPdf({ cards = [], imagesRoot, backPaths = {}, includeBacks = true }) {
  const layout = sheetLayout();
  const doc = new PDFDocument({ size: 'letter', margin: 0 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', resolve));

  // Pre-render cut-size buffers once.
  const frontBuf = new Map();
  const backBuf = new Map();
  const failures = [];
  for (const card of cards) {
    try {
      frontBuf.set(card.id, await toCutBuffer(path.join(imagesRoot, card.relativePath)));
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
    }
  }
  if (includeBacks) {
    for (const group of ['playdeck', 'locationdeck']) {
      if (backPaths[group]) {
        try {
          backBuf.set(group, await toCutBuffer(backPaths[group]));
        } catch (e) {
          failures.push({ id: `${group}-back`, error: e.message });
        }
      }
    }
  }

  const printable = cards.filter((c) => frontBuf.has(c.id));
  const pages = chunk(printable, layout.perPage);

  pages.forEach((pageCards, pageIdx) => {
    if (pageIdx > 0) doc.addPage({ size: 'letter', margin: 0 });
    // Fronts
    pageCards.forEach((card, i) => {
      const cell = layout.cells[i];
      doc.image(frontBuf.get(card.id), cell.x, cell.y, { width: layout.cardW, height: layout.cardH });
      cropMarks(doc, cell.x, cell.y, layout.cardW, layout.cardH);
    });

    if (includeBacks) {
      doc.addPage({ size: 'letter', margin: 0 });
      pageCards.forEach((card, i) => {
        const row = Math.floor(i / layout.cols);
        const col = i % layout.cols;
        const mirroredCol = backColumnIndex(col, layout.cols);
        const cell = layout.cells[row * layout.cols + mirroredCol];
        const buf = backBuf.get(backGroupForType(card.type));
        if (buf) doc.image(buf, cell.x, cell.y, { width: layout.cardW, height: layout.cardH });
        cropMarks(doc, cell.x, cell.y, layout.cardW, layout.cardH);
      });
    }
  });

  doc.end();
  await done;
  return { buffer: Buffer.concat(chunks), failures, pageCount: pages.length * (includeBacks ? 2 : 1) };
}
