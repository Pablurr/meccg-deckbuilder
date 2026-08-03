import { describe, it, expect } from 'vitest';
import { importDeckList } from '../web/src/lib/importDeck.js';

// Task 8's correction to its own brief: the brief's importDeckList called
// resolveLines with `setNames: {}`, which is wrong. classifyHint resolves a
// parenthetical set code by iterating setNames; an empty table means the
// loop never runs, so "(AS)" always classifies as 'unknown' -- a set code
// can no longer disambiguate a shared name, and (since isMarked only counts
// an 'id'/'set'/'alignment' hint as a mark) an unmatched line carrying only a
// set-code hint gets silently routed to resolveLines' prose bucket instead
// of being reported in `unmatched`.
//
// The fix builds a minimal table from `cards` themselves: codes only, no
// display names, since a set's spelled-out name lives in cards.json's `sets`
// block, which this pure-data function is never given. Codes resolving and
// names not is the correct, honest behaviour for this entry point -- see
// importDeck.js's importDeckList for the same comment in context.
const cards = [
  { id: 'AS-1', setCode: 'AS', name: { en: 'Bûrat', fr: 'Bûrat' } },
  { id: 'TW-1', setCode: 'TW', name: { en: 'Bûrat', fr: 'Bûrat' } },
];

describe('importDeckList: parenthetical set-code hints', () => {
  it('a set-code parenthetical disambiguates a name shared across sets', () => {
    const { quantities, ambiguous } = importDeckList('1x Bûrat (AS)', cards);
    expect(quantities).toEqual({ 'AS-1': 1 });
    expect(ambiguous).toEqual([]);
  });

  it('an unmatched line carrying a real set-code parenthetical is reported, not silently dropped as prose', () => {
    const { unmatched } = importDeckList('Nonexistent Card (AS)', cards);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].name).toBe('Nonexistent Card');
  });
});
