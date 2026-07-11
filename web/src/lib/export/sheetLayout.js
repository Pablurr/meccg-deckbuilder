// Pure sheet-layout math, ported verbatim from the old server sheetPdf.
// Coordinates are TOP-LEFT based (like pdfkit); the pdf-lib renderer flips y.
const PT = 72; // PDF points per inch

export const CARD = { w: 2.5 * PT, h: 3.5 * PT }; // 180 x 252 (poker cut size)

// Page dimensions in points, in the working orientation. A3 uses landscape to
// fit 18 cards (= two A4 sheets) instead of 16 in portrait, to save paper.
export const PAGE_SIZES = {
  letter: { w: 8.5 * PT, h: 11 * PT }, // 612 x 792
  a4: { w: 595.28, h: 841.89 },
  a3: { w: 1190.55, h: 841.89 }, // landscape
};

// How many whole poker cards fit on a page (floor division on each axis).
export function gridFor(pageW, pageH, cardW = CARD.w, cardH = CARD.h) {
  return {
    cols: Math.max(1, Math.floor(pageW / cardW)),
    rows: Math.max(1, Math.floor(pageH / cardH)),
  };
}

// Card cell rectangles centered on the page.
export function sheetLayout({ pageW = PAGE_SIZES.letter.w, pageH = PAGE_SIZES.letter.h, cardW = CARD.w, cardH = CARD.h, cols, rows } = {}) {
  if (cols == null || rows == null) {
    const g = gridFor(pageW, pageH, cardW, cardH);
    cols = g.cols;
    rows = g.rows;
  }
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
export function backColumnIndex(col, cols) {
  return cols - 1 - col;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
