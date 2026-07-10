import { describe, it, expect } from 'vitest';
import { bleedOps } from '../web/src/lib/export/bleedOps.js';
import { BLEED_PX, CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED } from '../web/src/lib/constants.js';

describe('bleedOps', () => {
  const ops = bleedOps();

  it('places the face at the bleed offset, unscaled', () => {
    const face = ops[0];
    expect(face).toEqual({ sx: 0, sy: 0, sw: CARD_W_CUT, sh: CARD_H_CUT, dx: BLEED_PX, dy: BLEED_PX, dw: CARD_W_CUT, dh: CARD_H_CUT });
  });

  it('tiles the full bleed canvas exactly (no gap, no overlap in area)', () => {
    const area = ops.reduce((s, o) => s + o.dw * o.dh, 0);
    expect(area).toBe(CARD_W_BLEED * CARD_H_BLEED);
  });

  it('keeps every destination rect inside the bleed canvas', () => {
    for (const o of ops) {
      expect(o.dx).toBeGreaterThanOrEqual(0);
      expect(o.dy).toBeGreaterThanOrEqual(0);
      expect(o.dx + o.dw).toBeLessThanOrEqual(CARD_W_BLEED);
      expect(o.dy + o.dh).toBeLessThanOrEqual(CARD_H_BLEED);
    }
  });

  it('replicates 1px source strips for the four edges', () => {
    const strips = ops.slice(1, 5);
    expect(strips.filter((o) => o.sh === 1)).toHaveLength(2); // top + bottom
    expect(strips.filter((o) => o.sw === 1)).toHaveLength(2); // left + right
  });
});
