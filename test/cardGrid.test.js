import { describe, it, expect } from 'vitest';
import {
  GRID_MIN_WIDTH, GRID_GAP, BODY_PADDING_X, deckZoneWidth, deckCardWidth,
} from '../web/src/lib/cardGrid.js';

// The point of this module is that the deck panel and the card browser lay
// their cards out identically. These constants ARE that promise, and they are
// duplicated in styles.css (.grid, .deckpanel-body) -- if one side moves,
// this file is where the other side finds out.
describe('grid constants mirror the card selector', () => {
  it('uses the selector\'s 120px floor and 10px gap', () => {
    expect(GRID_MIN_WIDTH).toBe(120);
    expect(GRID_GAP).toBe(10);
  });
});

describe('deckZoneWidth', () => {
  it('takes the deck body padding off the panel width', () => {
    expect(deckZoneWidth(360)).toBe(360 - BODY_PADDING_X);
  });

  it('is total for junk rather than producing a negative width', () => {
    expect(deckZoneWidth(undefined)).toBe(0);
    expect(deckZoneWidth('abc')).toBe(0);
    expect(deckZoneWidth(10)).toBe(0);
  });
});

describe('deckCardWidth', () => {
  // These are the numbers CSS `repeat(auto-fill, minmax(120px, 1fr))` with a
  // 10px gap actually produces. The function exists ONLY to predict them, so
  // the right thing to assert is the prediction itself.
  it('predicts what auto-fill will do at the default panel width', () => {
    // 336px usable: two columns fit (2*120 + 10 = 250), three do not (390).
    expect(deckCardWidth(360)).toBe(163);
  });

  it('fits more columns as the panel grows', () => {
    // 776px usable: six columns fit (6*120 + 5*10 = 770), seven do not.
    expect(deckCardWidth(800)).toBe(121);
  });

  it('never returns less than the grid floor, however narrow the panel', () => {
    expect(deckCardWidth(100)).toBe(GRID_MIN_WIDTH);
    expect(deckCardWidth(0)).toBe(GRID_MIN_WIDTH);
    expect(deckCardWidth(undefined)).toBe(GRID_MIN_WIDTH);
  });
});
