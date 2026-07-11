import { describe, it, expect } from 'vitest';
import { buildSheetPdf } from '../web/src/lib/export/pdf.js';

// Minimal valid 1x1 white JPEG.
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  'base64'
);
const bytes1x1 = new Uint8Array(JPEG_1x1);

const cards = Array.from({ length: 10 }, (_, i) => ({ id: `AS-${i}`, type: i === 0 ? 'Site' : 'Character', name: { en: `Card ${i}` } }));

const getFrontBytes = (card) => {
  if (card.id === 'AS-9') throw new Error('boom');
  return bytes1x1;
};
const getBackBytes = async () => bytes1x1;

describe('buildSheetPdf', () => {
  it('paginates 9 printable cards onto one letter fronts page + one backs page', async () => {
    const { bytes, failures, pageCount } = await buildSheetPdf({ cards, getFrontBytes, getBackBytes, includeBacks: true, format: 'letter' });
    expect(failures).toEqual([{ id: 'AS-9', error: 'boom' }]);
    expect(pageCount).toBe(2); // 9 printable cards -> 1 fronts page (+1 backs)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('doubles pages only when includeBacks is on', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `C-${i}`, type: 'Character', name: { en: `C${i}` } }));
    const noBacks = await buildSheetPdf({ cards: twelve, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: false, format: 'letter' });
    expect(noBacks.pageCount).toBe(2); // 12 cards / 9 per page -> 2 pages
    const withBacks = await buildSheetPdf({ cards: twelve, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: true, format: 'letter' });
    expect(withBacks.pageCount).toBe(4);
  });

  it('uses the 18-card A3 grid', async () => {
    const many = Array.from({ length: 18 }, (_, i) => ({ id: `C-${i}`, type: 'Character', name: { en: `C${i}` } }));
    const r = await buildSheetPdf({ cards: many, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: false, format: 'a3' });
    expect(r.pageCount).toBe(1);
  });
});
