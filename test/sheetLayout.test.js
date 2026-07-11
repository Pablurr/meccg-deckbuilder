import { describe, it, expect } from 'vitest';
import { CARD, PAGE_SIZES, gridFor, sheetLayout, backColumnIndex, chunk } from '../web/src/lib/export/sheetLayout.js';

describe('gridFor', () => {
  it('fits 3x3 on letter and A4, 6x3 on A3 landscape', () => {
    expect(gridFor(PAGE_SIZES.letter.w, PAGE_SIZES.letter.h)).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(PAGE_SIZES.a4.w, PAGE_SIZES.a4.h)).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(PAGE_SIZES.a3.w, PAGE_SIZES.a3.h)).toEqual({ cols: 6, rows: 3 });
  });
});

describe('sheetLayout', () => {
  it('centers a 3x3 grid of true-size poker cards on letter', () => {
    const l = sheetLayout({ pageW: PAGE_SIZES.letter.w, pageH: PAGE_SIZES.letter.h });
    expect(l.perPage).toBe(9);
    expect(l.cardW).toBe(CARD.w); // 180pt = 2.5in
    expect(l.cardH).toBe(CARD.h); // 252pt = 3.5in
    expect(l.marginX).toBe((612 - 3 * 180) / 2); // 36
    expect(l.marginY).toBe((792 - 3 * 252) / 2); // 18
    expect(l.cells[0]).toEqual({ row: 0, col: 0, x: 36, y: 18 });
    expect(l.cells[4].x).toBe(36 + 180); // center cell
  });
});

describe('backColumnIndex', () => {
  it('mirrors columns for duplex printing', () => {
    expect(backColumnIndex(0, 3)).toBe(2);
    expect(backColumnIndex(1, 3)).toBe(1);
    expect(backColumnIndex(2, 3)).toBe(0);
  });
});

describe('chunk', () => {
  it('splits into fixed-size pages', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
