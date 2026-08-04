import { describe, it, expect } from 'vitest';
import { DPI, BLEED_PX, CARD_W_BLEED, CARD_H_BLEED, CARD_W_CUT, CARD_H_CUT, TYPE_ORDER } from '../web/src/lib/constants.js';
import { TYPE_ORDER as REEXPORTED } from '../web/src/lib/deckList.js';

describe('MPC constants', () => {
  it('has the expected MPC poker bleed dimensions', () => {
    expect(CARD_W_BLEED).toBe(822);
    expect(CARD_H_BLEED).toBe(1122);
    expect(DPI).toBe(300);
  });

  it('derives the 750x1050 cut size by removing bleed from both edges', () => {
    expect(CARD_W_CUT).toBe(CARD_W_BLEED - 2 * BLEED_PX);
    expect(CARD_H_CUT).toBe(CARD_H_BLEED - 2 * BLEED_PX);
    expect(CARD_W_CUT).toBe(750);
    expect(CARD_H_CUT).toBe(1050);
  });
});

describe('TYPE_ORDER', () => {
  it('TYPE_ORDER is the play order, not an alphabetical one', () => {
    expect(TYPE_ORDER).toEqual(['Character', 'Resource', 'Hazard', 'Site', 'Region']);
  });

  it('deckList re-exports the very same array, so the two can never drift', () => {
    expect(REEXPORTED).toBe(TYPE_ORDER);
  });
});
