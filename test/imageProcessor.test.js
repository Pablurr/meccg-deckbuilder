import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { toMpcBuffer } from '../src/imageProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, '..', 'remastered-all', 'as', 'minions', 'Burat.jpg');

describe('toMpcBuffer', () => {
  it('produces an 816x1110 PNG tagged at 300 DPI', async () => {
    const buf = await toMpcBuffer(SAMPLE);
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(816);
    expect(meta.height).toBe(1110);
    expect(meta.density).toBe(300);
  });
});
