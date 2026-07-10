import { describe, it, expect } from 'vitest';
import { dataUrlToBytes, mapLimit } from '../web/src/lib/export/images.js';

describe('dataUrlToBytes', () => {
  it('decodes a base64 data URL to bytes', () => {
    // "ABC" base64-encoded
    const bytes = dataUrlToBytes('data:text/plain;base64,QUJD');
    expect([...bytes]).toEqual([65, 66, 67]);
  });
});

describe('mapLimit', () => {
  it('maps all items, preserving order, with bounded concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
