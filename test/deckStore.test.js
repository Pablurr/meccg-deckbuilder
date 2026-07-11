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
    expect(list).toEqual([{ id: deck.id, name: 'Test', count: 2, updatedAt: deck.updatedAt }]);
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
});
