import { describe, it, expect } from 'vitest';
import { normalizeDeck } from '../web/src/lib/deck.js';
import { createDeckStore } from '../web/src/lib/deckStore.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('normalizeDeck', () => {
  it('reads a legacy record as freeform with empty zones/notes', () => {
    const d = normalizeDeck({ id: 'x', name: 'Old', quantities: { 'TW-1': 2 } });
    expect(d.mode).toBe('freeform');
    expect(d.ruleset).toBeNull();
    expect(d.zones).toEqual({ sideboard: {}, pool: {} });
    expect(d.notes).toEqual({ starting: '', resourceStrategy: '', hazardStrategy: '', other: '' });
  });
  it('keeps a valid deckbuilding ruleset', () => {
    const d = normalizeDeck({ mode: 'deckbuilding', ruleset: { side: 'balrog', length: 'long', tournament: true } });
    expect(d.ruleset).toEqual({ side: 'balrog', length: 'long', tournament: true, ruleOverrides: {} });
  });
  it('falls back to freeform on an unknown side or length', () => {
    expect(normalizeDeck({ mode: 'deckbuilding', ruleset: { side: 'sauron', length: 'standard' } }).mode).toBe('freeform');
    expect(normalizeDeck({ mode: 'deckbuilding', ruleset: { side: 'wizard', length: 'epic' } }).mode).toBe('freeform');
  });
});

describe('deckStore ordering & projection', () => {
  it('sorts by order asc, then updatedAt desc, then id; projects mode/side/order', async () => {
    const store = createDeckStore(memStorage());
    const a = await store.create({ name: 'A' });
    const b = await store.create({ name: 'B', mode: 'deckbuilding', ruleset: { side: 'wizard', length: 'standard', tournament: false } });
    await store.update(a.id, { order: 2 });
    await store.update(b.id, { order: 1 });
    const rows = await store.list();
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
    expect(rows[0].side).toBe('wizard');
    expect(rows[0].mode).toBe('deckbuilding');
    expect(rows[1].side).toBeUndefined();
  });
  it('decks without order sort after ordered ones by updatedAt desc and never disappear', async () => {
    const store = createDeckStore(memStorage());
    const a = await store.create({ name: 'NoOrder' });
    const b = await store.create({ name: 'Ordered' });
    await store.update(b.id, { order: 1 });
    const rows = await store.list();
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Ordered');
  });
});

import { maxCopies } from '../web/src/lib/deck.js';

describe('copy limits are data, not clamps', () => {
  it('maxCopies still reports the classic limits (validator reference)', () => {
    expect(maxCopies({ type: 'Site', attributes: {} })).toBe(1);
    expect(maxCopies({ type: 'Resource', attributes: { unique: true } })).toBe(1);
    expect(maxCopies({ type: 'Resource', attributes: {} })).toBe(3);
    expect(maxCopies({ type: 'Character', attributes: { avatar: true } })).toBe(3);
  });
});
