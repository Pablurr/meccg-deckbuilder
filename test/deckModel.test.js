import { describe, it, expect } from 'vitest';
import { normalizeDeck, totalCopies } from '../web/src/lib/deck.js';
import { createDeckStore } from '../web/src/lib/deckStore.js';
import { bumpCount, applyDelta, applyToggle, applySelectAll } from '../web/src/lib/deckMutations.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('normalizeDeck', () => {
  it('reads a legacy record as freeform with empty zones/notes', () => {
    const d = normalizeDeck({ id: 'x', name: 'Old', quantities: { 'TW-1': 2 } });
    expect(d.mode).toBe('freeform');
    expect(d.ruleset).toBeNull();
    expect(d.zones).toEqual({ sideboard: {}, pool: {}, sideboardFw: {} });
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

describe('sideboardFw zone (1.6.1)', () => {
  it('normalizeDeck always provides an empty sideboardFw map', () => {
    expect(normalizeDeck({}).zones.sideboardFw).toEqual({});
    expect(normalizeDeck({ zones: {} }).zones.sideboardFw).toEqual({});
    // A deck written before this zone existed must read as having it, empty:
    // that is the whole of the ascending-compatibility guarantee, since there
    // is no schema version number to branch on.
    expect(normalizeDeck({ zones: { sideboard: { 'TW-1': 2 } } }).zones.sideboardFw).toEqual({});
  });

  it('normalizeDeck preserves an existing sideboardFw map', () => {
    const d = normalizeDeck({ zones: { sideboardFw: { 'TW-1': 3 } } });
    expect(d.zones.sideboardFw).toEqual({ 'TW-1': 3 });
  });

  it('totalCopies counts the sideboardFw zone', () => {
    const zones = { sideboard: { a: 2 }, pool: { b: 1 }, sideboardFw: { c: 4 } };
    expect(totalCopies({ d: 3 }, zones)).toBe(10);
  });

  it('totalCopies still works when sideboardFw is absent', () => {
    expect(totalCopies({ d: 3 }, { sideboard: { a: 2 }, pool: {} })).toBe(5);
  });
});

describe('deck mutation cores', () => {
  it('bumpCount floors at zero and deletes the key', () => {
    expect(bumpCount({}, 'a', +1)).toEqual({ a: 1 });
    expect(bumpCount({ a: 2 }, 'a', -1)).toEqual({ a: 1 });
    expect(bumpCount({ a: 1 }, 'a', -1)).toEqual({});
    expect(bumpCount({ a: 1 }, 'a', -5)).toEqual({});
    // never mutates the input
    const src = { a: 1 };
    bumpCount(src, 'a', +1);
    expect(src).toEqual({ a: 1 });
  });

  it('applyDelta refuses an increment with no room, and always allows a decrement', () => {
    expect(applyDelta({ a: 3 }, 'a', +1, 0)).toEqual({ a: 3 });   // blocked
    expect(applyDelta({ a: 3 }, 'a', +1, 1)).toEqual({ a: 4 });   // room
    expect(applyDelta({ a: 3 }, 'a', +1, Infinity)).toEqual({ a: 4 });
    // A count already over its cap is never reduced: room is 0 but -1 works.
    expect(applyDelta({ a: 5 }, 'a', -1, 0)).toEqual({ a: 4 });
  });

  it('applyToggle honours the cap when adding but never when removing', () => {
    expect(applyToggle({}, 'a', 1)).toEqual({ a: 1 });
    expect(applyToggle({}, 'a', 0)).toEqual({});        // no room -> no copy
    expect(applyToggle({ a: 2 }, 'a', 0)).toEqual({});  // removal always works
  });

  it('applySelectAll skips cards with no room and consults the accumulating map', () => {
    const roomFor = (id, map) => (Object.keys(map).length >= 2 ? 0 : 1);
    expect(applySelectAll({}, ['a', 'b', 'c'], roomFor)).toEqual({ a: 1, b: 1 });
    // Already-present cards are left alone, not incremented.
    expect(applySelectAll({ a: 4 }, ['a'], () => 1)).toEqual({ a: 4 });
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
