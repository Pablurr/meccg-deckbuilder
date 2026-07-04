import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetLayout, backColumnIndex, buildSheetPdf, LETTER, CARD } from '../src/sheetPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_ROOT = path.join(__dirname, '..', 'remastered-all');

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

describe('backColumnIndex', () => {
  it('mirrors columns for duplex long-edge flip', () => {
    expect(backColumnIndex(0)).toBe(2);
    expect(backColumnIndex(1)).toBe(1);
    expect(backColumnIndex(2)).toBe(0);
  });
});

describe('buildSheetPdf', () => {
  const cards = [
    { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
    { id: 'AS-7', type: 'Hazard', name: { en: 'Alatar' }, relativePath: 'as/perils/AlatartheHunter.jpg' },
  ];

  it('returns a PDF buffer with fronts only', async () => {
    const { buffer, pageCount, failures } = await buildSheetPdf({ cards, imagesRoot: IMAGES_ROOT, includeBacks: false });
    expect(failures).toEqual([]);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount).toBe(1); // 2 cards → 1 fronts page
  });

  it('adds a mirrored backs page when includeBacks', async () => {
    const backPath = path.join(IMAGES_ROOT, '..', 'card-backs', 'CardBack300dpi.png');
    const { buffer, pageCount } = await buildSheetPdf({
      cards,
      imagesRoot: IMAGES_ROOT,
      backPaths: { playdeck: backPath },
      includeBacks: true,
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount).toBe(2); // 1 fronts + 1 backs page
  });
});
