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

  // Finding #7 (final review): a deckbuilding deck's per-rule "ignore" choices
  // (ruleset.ruleOverrides) used to be destroyed the moment the deck flipped
  // to freeform, since normalizeDeck nulls `ruleset` there and DeckSetupDialog
  // read overrides only from ruleset.ruleOverrides. They're now mirrored into
  // the top-level `savedRuleOverrides` field on every normalizeDeck call, so
  // they outlive a null ruleset and DeckSetupDialog.confirm can fall back to
  // them (see DeckSetupDialog.jsx) when re-entering deckbuilding.
  it('preserves ruleOverrides across a deckbuilding -> freeform -> deckbuilding round-trip', () => {
    const deckbuilding = normalizeDeck({
      mode: 'deckbuilding',
      ruleset: { side: 'balrog', length: 'long', tournament: true, ruleOverrides: { 'BALROG-MIND': false } },
    });
    expect(deckbuilding.savedRuleOverrides).toEqual({ 'BALROG-MIND': false });

    // App.applySetup's freeform branch: normalizeDeck({ ...prev, mode: 'freeform', ruleset: null }).
    const freeform = normalizeDeck({ ...deckbuilding, mode: 'freeform', ruleset: null });
    expect(freeform.ruleset).toBeNull();
    expect(freeform.savedRuleOverrides).toEqual({ 'BALROG-MIND': false }); // survives the null ruleset

    // DeckSetupDialog.confirm falls back to initial.savedRuleOverrides once
    // ruleset.ruleOverrides no longer exists.
    const restoredOverrides = (freeform.ruleset && freeform.ruleset.ruleOverrides) || freeform.savedRuleOverrides || {};
    const backToDeckbuilding = normalizeDeck({
      ...freeform,
      mode: 'deckbuilding',
      ruleset: { side: 'balrog', length: 'long', tournament: true, ruleOverrides: restoredOverrides },
    });
    expect(backToDeckbuilding.ruleset.ruleOverrides).toEqual({ 'BALROG-MIND': false });
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

  it('reordering swaps order values and a rename does not change position', async () => {
    const store = createDeckStore(memStorage());
    const a = await store.create({ name: 'First' });
    const b = await store.create({ name: 'Second' });
    await store.update(a.id, { order: 1 });
    await store.update(b.id, { order: 2 });
    // swap
    await store.update(a.id, { order: 2 });
    await store.update(b.id, { order: 1 });
    let rows = await store.list();
    expect(rows.map((r) => r.name)).toEqual(['Second', 'First']);
    await store.update(b.id, { name: 'Second renamed' });
    rows = await store.list();
    expect(rows[0].name).toBe('Second renamed'); // still first
  });
});
