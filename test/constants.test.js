import { describe, it, expect } from 'vitest';
import { DPI, BLEED_PX, CARD_W_BLEED, CARD_H_BLEED, CARD_W_CUT, CARD_H_CUT } from '../src/constants.js';

describe('MPC constants', () => {
  it('has the expected bleed dimensions', () => {
    expect(CARD_W_BLEED).toBe(816);
    expect(CARD_H_BLEED).toBe(1110);
    expect(DPI).toBe(300);
  });

  it('derives cut size by removing bleed from both edges', () => {
    expect(CARD_W_CUT).toBe(CARD_W_BLEED - 2 * BLEED_PX);
    expect(CARD_H_CUT).toBe(CARD_H_BLEED - 2 * BLEED_PX);
    expect(CARD_W_CUT).toBe(744);
    expect(CARD_H_CUT).toBe(1038);
  });
});
