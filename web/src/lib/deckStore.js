// localStorage-backed deck store. Same API and record shapes as the old
// server-side store so web/src/api.js is a drop-in swap.
const KEY = 'meccg.decks.v1';

function newId() {
  return 'd_' + Math.random().toString(36).slice(2, 10);
}

export function createDeckStore(storage = globalThis.localStorage) {
  const readAll = () => {
    try {
      return JSON.parse(storage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const writeAll = (decks) => storage.setItem(KEY, JSON.stringify(decks));

  return {
    async list() {
      return Object.values(readAll())
        .map((d) => ({ id: d.id, name: d.name, count: (d.cardIds || []).length, updatedAt: d.updatedAt }))
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    },

    async get(id) {
      const d = readAll()[id];
      if (!d) throw new Error('not found');
      return d;
    },

    async create({ name, cardIds = [], quantities = {}, backAssignments = {} } = {}) {
      const now = new Date().toISOString();
      const deck = { id: newId(), name: name || 'Untitled', cardIds, quantities, backAssignments, createdAt: now, updatedAt: now };
      const all = readAll();
      all[deck.id] = deck;
      writeAll(all);
      return deck;
    },

    async update(id, patch) {
      const all = readAll();
      if (!all[id]) throw new Error('not found');
      const deck = { ...all[id], ...patch, id, updatedAt: new Date().toISOString() };
      all[id] = deck;
      writeAll(all);
      return deck;
    },

    async remove(id) {
      const all = readAll();
      delete all[id];
      writeAll(all);
    },
  };
}
