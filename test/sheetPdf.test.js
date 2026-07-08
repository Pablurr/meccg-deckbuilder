import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetLayout, backColumnIndex, buildSheetPdf, gridFor, PAGE_SIZES, LETTER, CARD } from '../src/sheetPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_ROOT = path.join(__dirname, '..', 'cards', 'remastered-all');

describe('sheetLayout', () => {
  it('centers a 3x3 grid of poker cards on US Letter', () => {
    const l = sheetLayout();
    expect(l.perPage).toBe(9);
    expect(l.cells).toHaveLength(9);
    // 3 cols * 180pt = 540; (612-540)/2 = 36pt margin
    expect(l.marginX).toBeCloseTo(36, 5);
    // 3 rows * 252pt = 756; (792-756)/2 = 18pt margin
    expect(l.marginY).toBeCloseTo(18, 5);
    // first cell at the margin, last cell bottom-right
    expect(l.cells[0]).toMatchObject({ row: 0, col: 0, x: 36, y: 18 });
    const last = l.cells[8];
    expect(last.x + CARD.w).toBeCloseTo(LETTER.w - 36, 5);
    expect(last.y + CARD.h).toBeCloseTo(LETTER.h - 18, 5);
  });
});

describe('gridFor', () => {
  it('computes how many poker cards fit per page size', () => {
    expect(gridFor(PAGE_SIZES.letter.w, PAGE_SIZES.letter.h)).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(PAGE_SIZES.a4.w, PAGE_SIZES.a4.h)).toEqual({ cols: 3, rows: 3 });
    // A3 is landscape → 6x3 = 18 (two A4 sheets' worth)
    expect(gridFor(PAGE_SIZES.a3.w, PAGE_SIZES.a3.h)).toEqual({ cols: 6, rows: 3 });
  });
});

describe('sheetLayout per format', () => {
  it('A3 landscape lays out a centered 6x3 grid (18 per page)', () => {
    const l = sheetLayout({ pageW: PAGE_SIZES.a3.w, pageH: PAGE_SIZES.a3.h });
    expect(l.perPage).toBe(18);
    expect(l.cols).toBe(6);
    expect(l.marginX).toBeCloseTo((PAGE_SIZES.a3.w - 6 * CARD.w) / 2, 4);
  });
});

describe('backColumnIndex', () => {
  it('mirrors columns for duplex long-edge flip', () => {
    expect(backColumnIndex(0, 3)).toBe(2);
    expect(backColumnIndex(1, 3)).toBe(1);
    expect(backColumnIndex(2, 3)).toBe(0);
    // a3 grid has 4 columns
    expect(backColumnIndex(0, 4)).toBe(3);
    expect(backColumnIndex(3, 4)).toBe(0);
  });
});

describe('buildSheetPdf', () => {
  const cards = [
    { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
    { id: 'AS-7', type: 'Hazard', name: { en: 'Alatar' }, relativePath: 'as/perils/AlatartheHunter.jpg' },
  ];

  it('returns a PDF buffer with fronts only', async () => {
    const { buffer, pageCount, failures } = await buildSheetPdf({ cards, getImage: (c) => path.join(IMAGES_ROOT, c.relativePath), includeBacks: false });
    expect(failures).toEqual([]);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount).toBe(1); // 2 cards → 1 fronts page
  });

  it('adds a mirrored backs page when includeBacks', async () => {
    const backPath = path.join(IMAGES_ROOT, '..', 'card-backs', 'CardBack300dpi.png');
    const { buffer, pageCount } = await buildSheetPdf({
      cards,
      getImage: (c) => path.join(IMAGES_ROOT, c.relativePath),
      backPaths: { playdeck: backPath },
      includeBacks: true,
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount).toBe(2); // 1 fronts + 1 backs page
  });

  it('produces an A3 landscape PDF with the A3 media box', async () => {
    const { buffer, failures } = await buildSheetPdf({ cards, getImage: (c) => path.join(IMAGES_ROOT, c.relativePath), includeBacks: false, format: 'a3' });
    expect(failures).toEqual([]);
    const s = buffer.toString('latin1');
    const boxes = [...new Set([...s.matchAll(/MediaBox\s*\[([^\]]+)\]/g)].map((m) => m[1].trim()))];
    // A3 landscape = 1190.55 x 841.89 pt
    expect(boxes.some((b) => b.startsWith('0 0 1190'))).toBe(true);
  });
});
