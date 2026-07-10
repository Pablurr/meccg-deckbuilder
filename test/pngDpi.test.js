import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPngDpi } from '../web/src/lib/export/pngDpi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACK_PNG = path.join(__dirname, '..', 'web', 'public', 'card-backs', 'CardBack300dpi.png');

describe('withPngDpi', () => {
  it('inserts a pHYs chunk right after IHDR with 300 DPI in px/meter', async () => {
    const png = new Uint8Array(await readFile(BACK_PNG));
    const out = withPngDpi(png, 300);
    expect(out.length).toBe(png.length + 21); // 4 len + 4 type + 9 data + 4 crc
    const dv = new DataView(out.buffer, out.byteOffset);
    // signature(8) + IHDR(25) = 33 → pHYs chunk
    expect(dv.getUint32(33)).toBe(9);
    expect(String.fromCharCode(out[37], out[38], out[39], out[40])).toBe('pHYs');
    expect(dv.getUint32(41)).toBe(11811); // Math.round(300 / 0.0254)
    expect(dv.getUint32(45)).toBe(11811);
    expect(out[49]).toBe(1); // unit: meter
  });
});
