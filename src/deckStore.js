import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

function newId() {
  return 'd_' + Math.random().toString(36).slice(2, 10);
}

// A deck is stored as one JSON file per deck in `dir`.
export function createDeckStore(dir) {
  const file = (id) => path.join(dir, `${id}.json`);

  return {
    async init() {
      await mkdir(dir, { recursive: true });
    },

    async list() {
      let files;
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
      const decks = await Promise.all(
        files.map(async (f) => {
          const d = JSON.parse(await readFile(path.join(dir, f), 'utf-8'));
          return { id: d.id, name: d.name, count: (d.cardIds || []).length, updatedAt: d.updatedAt };
        })
      );
      return decks.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    },

    async get(id) {
      return JSON.parse(await readFile(file(id), 'utf-8'));
    },

    async create({ name, cardIds = [], backAssignments = {} }) {
      const now = new Date().toISOString();
      const deck = { id: newId(), name: name || 'Untitled', cardIds, backAssignments, createdAt: now, updatedAt: now };
      await writeFile(file(deck.id), JSON.stringify(deck, null, 2));
      return deck;
    },

    async update(id, patch) {
      const deck = await this.get(id);
      const updated = { ...deck, ...patch, id, updatedAt: new Date().toISOString() };
      await writeFile(file(id), JSON.stringify(updated, null, 2));
      return updated;
    },

    async remove(id) {
      await unlink(file(id));
    },
  };
}
