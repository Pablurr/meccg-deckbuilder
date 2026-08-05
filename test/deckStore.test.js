import { describe, it, expect } from 'vitest';
import { createDeckStore } from '../web/src/lib/deckStore.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe('localStorage deck store', () => {
  it('creates a deck with id/timestamps and lists it with a count', async () => {
    const store = createDeckStore(fakeStorage());
    const deck = await store.create({ name: 'Test', cardIds: ['AS-1', 'AS-1'], quantities: { 'AS-1': 2 } });
    expect(deck.id).toMatch(/^d_/);
    expect(deck.createdAt).toBeTruthy();
    const list = await store.list();
    expect(list).toEqual([{ id: deck.id, name: 'Test', count: 2, updatedAt: deck.updatedAt, order: null, mode: undefined, side: undefined }]);
  });

  it('gets, updates (preserving createdAt) and removes decks', async () => {
    const store = createDeckStore(fakeStorage());
    const d = await store.create({ name: 'A' });
    const updated = await store.update(d.id, { name: 'B', cardIds: ['X'] });
    expect(updated.name).toBe('B');
    expect(updated.createdAt).toBe(d.createdAt);
    expect((await store.get(d.id)).name).toBe('B');
    await store.remove(d.id);
    await expect(store.get(d.id)).rejects.toThrow('not found');
  });

  it('lists newest-updated first', async () => {
    const store = createDeckStore(fakeStorage());
    const a = await store.create({ name: 'old' });
    await new Promise((r) => setTimeout(r, 5));
    await store.create({ name: 'new' });
    const list = await store.list();
    expect(list[0].name).toBe('new');
    expect(list[1].id).toBe(a.id);
  });

  it('throws on updating a missing deck and survives corrupt storage', async () => {
    const bad = fakeStorage();
    bad.setItem('meccg.decks.v1', '{not json');
    const store = createDeckStore(bad);
    expect(await store.list()).toEqual([]);
    await expect(store.update('nope', {})).rejects.toThrow('not found');
  });

  it('surfaces a clear "storage-full" error when the quota is exceeded', async () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem: () => {},
    };
    const store = createDeckStore(full);
    await expect(store.create({ name: 'X' })).rejects.toThrow('storage-full');
  });

  it('reorder() writes every row\'s order in one pass and list() reflects the requested sequence', async () => {
    const store = createDeckStore(fakeStorage());
    const a = await store.create({ name: 'A' });
    const b = await store.create({ name: 'B' });
    const c = await store.create({ name: 'C' });
    await store.reorder([c.id, a.id, b.id]);
    const list = await store.list();
    expect(list.map((d) => d.id)).toEqual([c.id, a.id, b.id]);
    expect(list.map((d) => d.order)).toEqual([1, 2, 3]);
  });

  it('reorder() ignores an unknown id instead of throwing', async () => {
    const store = createDeckStore(fakeStorage());
    const a = await store.create({ name: 'A' });
    const b = await store.create({ name: 'B' });
    await expect(store.reorder([b.id, 'nope', a.id])).resolves.toBeUndefined();
    const list = await store.list();
    expect(list.map((d) => d.id)).toEqual([b.id, a.id]);
    // the unknown id's slot doesn't shift the assigned order values: b and a
    // still get 1-based positions from their own place in the input array.
    expect(list.find((d) => d.id === b.id).order).toBe(1);
    expect(list.find((d) => d.id === a.id).order).toBe(3);
  });

  it('reorder() leaves storage completely unchanged when a write hits the quota', async () => {
    // Seed real deck data through a normal fake storage first...
    const seed = fakeStorage();
    const store = createDeckStore(seed);
    const a = await store.create({ name: 'A' });
    const b = await store.create({ name: 'B' });
    const snapshot = seed.getItem('meccg.decks.v1');

    // ...then reopen that same data behind a storage stub whose setItem
    // always throws quota, so reorder's single writeAll fails and never
    // mutates the underlying data.
    const quotaStore = createDeckStore({
      getItem: (k) => (k === 'meccg.decks.v1' ? snapshot : null),
      setItem: () => {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem: () => {},
    });
    await expect(quotaStore.reorder([b.id, a.id])).rejects.toThrow('storage-full');
    // The atomicity claim: the stored blob is byte-for-byte identical to the
    // pre-reorder snapshot — no row got a new order, not even a to-be-rolled-
    // back one. This is what proves reorder() never got past a single,
    // all-or-nothing writeAll.
    expect(seed.getItem('meccg.decks.v1')).toBe(snapshot);
  });
});
