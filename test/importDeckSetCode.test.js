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
  // This IS a direct test of the setNames fix: with `setNames: {}`, "(AS)"
  // classifies 'unknown' and never narrows, so both same-named cards survive
  // and `ambiguous` is non-empty (quantities still lands on AS-1 by the
  // matches[0] fallback, so only `ambiguous` catches the bug -- verified by
  // temporarily reintroducing `setNames: {}` and confirming only this
  // assertion breaks; see task-8-report.md).
  it('a set-code parenthetical disambiguates a name shared across sets', () => {
    const { quantities, ambiguous } = importDeckList('1x Bûrat (AS)', cards);
    expect(quantities).toEqual({ 'AS-1': 1 });
    expect(ambiguous).toEqual([]);
  });

  // NOT a test of the setNames fix: importDeckList's prose-reclaim safety
  // net (see importDeck.js) already guarantees this line lands in
  // `unmatched` unconditionally, whether or not setNames narrows anything --
  // verified the same way as above, and only this describe block's first
  // test actually regresses when setNames is broken. What THIS pins is the
  // fix from the same review round: the reclaimed path reports the same
  // (peeled) reading resolveOne's own notfound fallback would have reported,
  // so `unmatched[i].name` doesn't depend on which of the two paths
  // (resolveLines' own notfound, or the reclaim) a given miss took.
  it('an unmatched line with a peelable trailing hint reports the peeled name either way it is caught', () => {
    const { unmatched } = importDeckList('Nonexistent Card (AS)', cards);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].name).toBe('Nonexistent Card');
  });

  // Full-shape pin for the leak the review caught at importDeck.js's
  // unmatched/ambiguous push sites: both `resolved` (from resolveLines) and
  // `reclaimed` (this facade's own recovery) carry `candidates`/`typeHint` --
  // parseDocument's internal fields, which never existed pre-refactor and
  // must not leak into the public API. toEqual fails on any extra key, so
  // this is a real byte-compatibility gate, not just a smoke test.
  it('an unmatched entry has exactly the pre-refactor shape -- no leaked candidates/typeHint', () => {
    const { unmatched } = importDeckList('Nonexistent Card (AS)', cards);
    expect(unmatched[0]).toEqual({
      raw: 'Nonexistent Card (AS)',
      qty: 1,
      name: 'Nonexistent Card',
      target: 'quantities',
      matches: [],
      status: 'notfound',
    });
  });

  it('an ambiguous entry has exactly the pre-refactor shape -- no leaked candidates/typeHint', () => {
    const { ambiguous } = importDeckList('2x Bûrat', cards);
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]).toEqual({
      raw: '2x Bûrat',
      qty: 2,
      name: 'Bûrat',
      target: 'quantities',
      matches: [cards[0], cards[1]],
      status: 'ambiguous',
    });
  });
});
