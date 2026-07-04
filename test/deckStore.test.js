import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { createDeckStore } from '../src/deckStore.js';

describe('deckStore', () => {
  let dir;
  let store;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'meccg-decks-'));
    store = createDeckStore(dir);
    await store.init();
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates, reads, lists, updates and removes decks', async () => {
    const created = await store.create({ name: 'My Deck', cardIds: ['AS-1', 'BA-1'] });
    expect(created.id).toMatch(/^d_/);
    expect(created.createdAt).toBeTruthy();

    const fetched = await store.get(created.id);
    expect(fetched.name).toBe('My Deck');
    expect(fetched.cardIds).toEqual(['AS-1', 'BA-1']);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: created.id, name: 'My Deck', count: 2 });

    const updated = await store.update(created.id, { name: 'Renamed', cardIds: ['AS-1'] });
    expect(updated.name).toBe('Renamed');
    expect(updated.cardIds).toEqual(['AS-1']);
    expect(updated.id).toBe(created.id);

    await store.remove(created.id);
    expect(await store.list()).toHaveLength(0);
  });
});
