import { describe, it, expect } from 'vitest';
import { backGroupForType, deckCounts, deckWarnings, maxCopies, expandQuantities, countOccurrences } from '../web/src/lib/deck.js';

const cardsById = new Map([
  ['AS-1', { id: 'AS-1', type: 'Character', alignment: 'Minion', relativePath: 'x.jpg' }],
  ['AS-7', { id: 'AS-7', type: 'Hazard', alignment: 'Neutral', relativePath: 'y.jpg' }],
  ['BA-1', { id: 'BA-1', type: 'Site', alignment: 'Neutral', relativePath: 'z.jpg' }],
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

describe('maxCopies', () => {
  it('caps unique cards at 1 and others at 3', () => {
    expect(maxCopies({ attributes: { unique: true } })).toBe(1);
    expect(maxCopies({ attributes: {} })).toBe(3);
    expect(maxCopies({ attributes: { unique: false } })).toBe(3);
  });

  it('caps all Sites at 1 (even non-unique ones)', () => {
    expect(maxCopies({ type: 'Site', attributes: { unique: true } })).toBe(1);
    expect(maxCopies({ type: 'Site', attributes: {} })).toBe(1);
  });

  it('allows avatars up to 3 despite being unique', () => {
    expect(maxCopies({ type: 'Character', attributes: { unique: true, avatar: true } })).toBe(3);
  });
});

describe('expandQuantities / countOccurrences', () => {
  it('round-trips between a quantity map and an expanded id list', () => {
    const expanded = expandQuantities({ 'AS-7': 3, 'BA-1': 1 });
    expect(expanded).toEqual(['AS-7', 'AS-7', 'AS-7', 'BA-1']);
    expect(countOccurrences(expanded)).toEqual({ 'AS-7': 3, 'BA-1': 1 });
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
