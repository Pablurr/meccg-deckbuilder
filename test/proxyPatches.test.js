import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SWATCH_KEYS } from '../web/src/lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATCHES = path.join(__dirname, '..', 'web', 'public', 'proxy-patches');

// Minimal PNG header reader: IHDR is always the first chunk, at byte 16.
async function pngInfo(file) {
  const buf = await readFile(file);
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25), // 6 = truecolour with alpha
  };
}

describe('proxy patch assets', () => {
  it('ships one RGBA 196x48 patch per key per language variant', async () => {
    expect(SWATCH_KEYS).toHaveLength(16);
    for (const key of SWATCH_KEYS) {
      for (const name of [`${key}.png`, `${key}-fr.png`]) {
        const info = await pngInfo(path.join(PATCHES, name));
        expect({ name, ...info }).toEqual({ name, width: 196, height: 48, colorType: 6 });
      }
    }
  });
});
