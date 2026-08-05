import { describe, it, expect } from 'vitest';
import { backGroupForType, deckCounts, deckWarnings, expandQuantities, countOccurrences, totalCopies, deckSignature, deckPayload } from '../web/src/lib/deck.js';

const cardsById = new Map([
  ['AS-1', { id: 'AS-1', type: 'Character', alignment: 'Minion', image: 'x.jpg' }],
  ['AS-7', { id: 'AS-7', type: 'Hazard', alignment: 'Neutral', image: 'y.jpg' }],
  ['BA-1', { id: 'BA-1', type: 'Site', alignment: 'Neutral', image: 'z.jpg' }],
]);

describe('backGroupForType', () => {
  it('splits play deck vs location deck', () => {
    expect(backGroupForType('Character')).toBe('playdeck');
    expect(backGroupForType('Site')).toBe('locationdeck');
    expect(backGroupForType('Region')).toBe('locationdeck');
  });
});

describe('deckCounts', () => {
  it('counts totals, types and groups', () => {
    const counts = deckCounts(cardsById, ['AS-1', 'AS-7', 'BA-1']);
    expect(counts.total).toBe(3);
    expect(counts.byType).toEqual({ Character: 1, Hazard: 1, Site: 1 });
    expect(counts.byGroup).toEqual({ playdeck: 2, locationdeck: 1 });
  });

  it('counts repeated copies', () => {
    const counts = deckCounts(cardsById, ['AS-7', 'AS-7', 'AS-7', 'BA-1']);
    expect(counts.total).toBe(4);
    expect(counts.byType).toEqual({ Hazard: 3, Site: 1 });
    expect(counts.byGroup).toEqual({ playdeck: 3, locationdeck: 1 });
  });
});

describe('expandQuantities / countOccurrences', () => {
  it('round-trips between a quantity map and an expanded id list', () => {
    const expanded = expandQuantities({ 'AS-7': 3, 'BA-1': 1 });
    expect(expanded).toEqual(['AS-7', 'AS-7', 'AS-7', 'BA-1']);
    expect(countOccurrences(expanded)).toEqual({ 'AS-7': 3, 'BA-1': 1 });
  });
});

// The bug this pins: the drawer gated "view deck" on deckCounts().total, which
// counts the play deck only. A card added to the pool from the card modal --
// the sole way to reach the pool on a phone -- therefore left the button
// disabled, so the card was in the deck with no way to see it. Every zone
// counts, and the zone-only cases are the ones that regress.
describe('totalCopies', () => {
  it('counts every zone, not just the play deck', () => {
    expect(totalCopies({ 'AS-7': 2 }, { sideboard: { 'AS-1': 1 }, pool: { 'BA-1': 3 } })).toBe(6);
  });

  it('is non-zero when only the pool holds a card', () => {
    expect(totalCopies({}, { sideboard: {}, pool: { 'AS-1': 1 } })).toBe(1);
  });

  it('is non-zero when only the sideboard holds a card', () => {
    expect(totalCopies({}, { sideboard: { 'AS-1': 1 }, pool: {} })).toBe(1);
  });

  it('is zero for a genuinely empty deck, and total for missing arguments', () => {
    expect(totalCopies({}, { sideboard: {}, pool: {} })).toBe(0);
    expect(totalCopies()).toBe(0);
    expect(totalCopies({ 'AS-7': 1 })).toBe(1); // zones absent entirely
  });
});

describe('deckWarnings', () => {
  it('warns on empty deck', () => {
    expect(deckWarnings(cardsById, [])).toContainEqual({ code: 'emptyDeck' });
  });

  it('warns when a used group has no back assigned', () => {
    const w = deckWarnings(cardsById, ['AS-1', 'BA-1'], { playdeck: 'backs/a.png' });
    expect(w).toContainEqual({ code: 'missingBack', group: 'locationdeck' });
    expect(w.some((m) => m.code === 'missingBack' && m.group === 'playdeck')).toBe(false);
  });
});

describe('deckSignature', () => {
  const base = {
    deck: { name: 'A', mode: 'freeform', ruleset: null, notes: { starting: 'x' }, backAssignments: {} },
    quantities: { 'AS-7': 2 },
    zones: { pool: {}, sideboard: { 'AS-1': 1 }, sideboardFw: {} },
  };

  // The trap this function exists to avoid: JSON.stringify walks keys in
  // insertion order, so two identical decks built by different click orders
  // would hash differently and the Save button would light up on its own.
  it('ignores key insertion order', () => {
    const shuffled = {
      ...base,
      quantities: { 'AS-7': 2 },
      zones: { sideboardFw: {}, sideboard: { 'AS-1': 1 }, pool: {} },
      deck: { backAssignments: {}, notes: { starting: 'x' }, ruleset: null, mode: 'freeform', name: 'A' },
    };
    expect(deckSignature(shuffled)).toBe(deckSignature(base));
  });

  it('changes when any persisted field changes', () => {
    const sig = deckSignature(base);
    expect(deckSignature({ ...base, deck: { ...base.deck, name: 'B' } })).not.toBe(sig);
    expect(deckSignature({ ...base, quantities: { 'AS-7': 3 } })).not.toBe(sig);
    expect(deckSignature({ ...base, zones: { ...base.zones, pool: { 'BA-1': 1 } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, notes: { starting: 'y' } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, backAssignments: { playdeck: 'b.png' } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, mode: 'deckbuilding', ruleset: { side: 'wizard', length: 'standard', tournament: false, ruleOverrides: {} } } })).not.toBe(sig);
  });

  // A deck saved a second ago must not read as modified because storage
  // handed back an id and a position.
  it('ignores id, order and updatedAt', () => {
    const sig = deckSignature(base);
    expect(deckSignature({ ...base, deck: { ...base.deck, id: 'd1', order: 3, updatedAt: 12345 } })).toBe(sig);
  });
});

describe('deckPayload', () => {
  it('carries every field a saved deck needs, and takes its name from the argument', () => {
    const p = deckPayload({
      deck: { id: 'd1', name: 'Old', mode: 'freeform', ruleset: null, notes: { starting: 's' }, backAssignments: { playdeck: 'b.png' }, order: 2 },
      cardIds: ['AS-7', 'AS-7'],
      quantities: { 'AS-7': 2 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      name: 'New',
    });
    expect(p).toEqual({
      name: 'New',
      cardIds: ['AS-7', 'AS-7'],
      quantities: { 'AS-7': 2 },
      backAssignments: { playdeck: 'b.png' },
      mode: 'freeform',
      ruleset: null,
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      notes: { starting: 's' },
      order: 2,
    });
  });

  it('falls back to the deck name when no name is given', () => {
    const p = deckPayload({
      deck: { name: 'Kept', backAssignments: {} },
      cardIds: [], quantities: {}, zones: {},
    });
    expect(p.name).toBe('Kept');
  });
});
