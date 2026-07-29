import { describe, it, expect } from 'vitest';
import { backGroupForType, deckCounts, deckWarnings, expandQuantities, countOccurrences, totalCopies } from '../web/src/lib/deck.js';

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
