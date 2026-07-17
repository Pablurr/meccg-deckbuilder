import { PDFDocument, rgb } from 'pdf-lib';
import { PAGE_SIZES, sheetLayout, backColumnIndex, chunk } from './sheetLayout.js';
import { backGroupForType } from './backGroups.js';

const GRAY = rgb(0.533, 0.533, 0.533);
const WHITE = rgb(1, 1, 1);

// Fronts from the CDN are JPEG; backs may be PNG (shipped defaults) or JPEG
// (normalized custom uploads). Sniff the signature instead of trusting names.
function embedAuto(doc, bytes) {
  const isPng = bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return isPng ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

// Short corner crop marks just outside a card rectangle. Layout coords are
// top-left based; pdf-lib's origin is bottom-left, so y flips here.
function cropMarks(page, pageH, x, y, w, h, len = 9) {
  const seg = (x1, y1, x2, y2) =>
    page.drawLine({ start: { x: x1, y: pageH - y1 }, end: { x: x2, y: pageH - y2 }, thickness: 0.4, color: GRAY });
  const corners = [
    [x, y, -len, 0, 0, -len], // top-left
    [x + w, y, len, 0, 0, -len], // top-right
    [x, y + h, -len, 0, 0, len], // bottom-left
    [x + w, y + h, len, 0, 0, len], // bottom-right
  ];
  for (const [cx, cy, hdx, hdy, vdx, vdy] of corners) {
    seg(cx, cy, cx + hdx, cy + hdy);
    seg(cx, cy, cx + vdx, cy + vdy);
  }
}

// Hairline white lines along the interior seams between touching cards. Cards
// are laid out edge-to-edge, so adjacent black borders merge; drawn over the
// images (white), these thin lines split the seam into a visible cut guide.
// Kept very thin so they barely show once printed. y flips for pdf-lib.
function seamLines(page, pageH, layout, thickness) {
  const { marginX, marginY, cardW, cardH, cols, rows } = layout;
  const gridW = cols * cardW;
  const gridH = rows * cardH;
  for (let c = 1; c < cols; c++) {
    const x = marginX + c * cardW;
    page.drawLine({ start: { x, y: pageH - marginY }, end: { x, y: pageH - (marginY + gridH) }, thickness, color: WHITE });
  }
  for (let r = 1; r < rows; r++) {
    const y = marginY + r * cardH;
    page.drawLine({ start: { x: marginX, y: pageH - y }, end: { x: marginX + gridW, y: pageH - y }, thickness, color: WHITE });
  }
}

// Browser port of the old server sheetPdf: true-size poker cards on a
// centered grid with crop marks, optional mirrored backs pages for duplex.
// Original image bytes are embedded directly — the PDF scales them to
// 2.5x3.5in vectorially, so no canvas resampling is needed (or wanted).
export async function buildSheetPdf({ cards = [], getFrontBytes, getBackBytes, includeBacks = true, format = 'letter', seamWidth = 0.5 }) {
  const pageSize = PAGE_SIZES[format] || PAGE_SIZES.letter;
  const layout = sheetLayout({ pageW: pageSize.w, pageH: pageSize.h });
  const doc = await PDFDocument.create();

  // Embed each unique front once; copies reuse the embedded image.
  const frontImg = new Map();
  const failures = [];
  for (const card of cards) {
    if (frontImg.has(card.id)) continue;
    try {
      frontImg.set(card.id, await embedAuto(doc, await getFrontBytes(card)));
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
      frontImg.set(card.id, null);
    }
  }

  const backImg = new Map();
  if (includeBacks) {
    for (const group of ['playdeck', 'locationdeck']) {
      try {
        const bytes = await getBackBytes(group);
        if (bytes) backImg.set(group, await embedAuto(doc, bytes));
      } catch (e) {
        failures.push({ id: `${group}-back`, error: e.message });
      }
    }
  }

  const drawCard = (page, img, cell) => {
    if (img) page.drawImage(img, { x: cell.x, y: pageSize.h - cell.y - layout.cardH, width: layout.cardW, height: layout.cardH });
    cropMarks(page, pageSize.h, cell.x, cell.y, layout.cardW, layout.cardH);
  };

  const printable = cards.filter((c) => frontImg.get(c.id));
  const pages = chunk(printable, layout.perPage);

  for (const pageCards of pages) {
    const front = doc.addPage([pageSize.w, pageSize.h]);
    pageCards.forEach((card, i) => drawCard(front, frontImg.get(card.id), layout.cells[i]));
    if (seamWidth > 0) seamLines(front, pageSize.h, layout, seamWidth);

    if (includeBacks) {
      const back = doc.addPage([pageSize.w, pageSize.h]);
      pageCards.forEach((card, i) => {
        const row = Math.floor(i / layout.cols);
        const col = i % layout.cols;
        const cell = layout.cells[row * layout.cols + backColumnIndex(col, layout.cols)];
        drawCard(back, backImg.get(backGroupForType(card.type)), cell);
      });
      if (seamWidth > 0) seamLines(back, pageSize.h, layout, seamWidth);
    }
  }

  return { bytes: await doc.save(), failures, pageCount: pages.length * (includeBacks ? 2 : 1) };
}
