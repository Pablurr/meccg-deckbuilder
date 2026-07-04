import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { toMpcBuffer, toCutBuffer } from '../src/imageProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, '..', 'remastered-all', 'as', 'minions', 'Burat.jpg');

describe('toMpcBuffer', () => {
  it('produces an 822x1122 PNG tagged at 300 DPI', async () => {
    const buf = await toMpcBuffer(SAMPLE);
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(822);
    expect(meta.height).toBe(1122);
    expect(meta.density).toBe(300);
  });
});

describe('toCutBuffer', () => {
  it('produces a 750x1050 PNG (cut size, no bleed) at 300 DPI', async () => {
    const buf = await toCutBuffer(SAMPLE);
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(750);
    expect(meta.height).toBe(1050);
    expect(meta.density).toBe(300);
  });
});
