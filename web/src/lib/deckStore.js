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
  const writeAll = (decks) => {
    try {
      storage.setItem(KEY, JSON.stringify(decks));
    } catch (e) {
      // localStorage is full — custom card backs are stored as (large) data
      // URLs, so a deck carrying backs can push past the ~5 MB quota. Surface a
      // clear, identifiable error instead of a raw DOMException.
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)) {
        throw new Error('storage-full');
      }
      throw e;
    }
  };

  return {
    async list() {
      const rows = Object.values(readAll()).map((d) => ({
        id: d.id, name: d.name, count: Object.values(d.quantities || {}).reduce((s, n) => s + n, 0) || (d.cardIds || []).length,
        updatedAt: d.updatedAt, order: typeof d.order === 'number' ? d.order : null,
        mode: d.mode, side: d.ruleset && d.ruleset.side,
      }));
      return rows.sort((a, b) => {
        if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
        if (a.order != null && b.order == null) return -1;
        if (a.order == null && b.order != null) return 1;
        const t = String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        return t !== 0 ? t : String(a.id).localeCompare(String(b.id));
      });
    },

    async get(id) {
      const d = readAll()[id];
      if (!d) throw new Error('not found');
      return d;
    },

    async create({ name, cardIds = [], quantities = {}, backAssignments = {}, mode, ruleset, zones, notes, order } = {}) {
      const now = new Date().toISOString();
      const deck = { id: newId(), name: name || 'Untitled', cardIds, quantities, backAssignments, mode, ruleset, zones, notes, order, createdAt: now, updatedAt: now };
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

    // Batch reorder: one read, apply every `order` patch in memory, one
    // `writeAll` — unlike calling update() once per row, a storage-full
    // failure here leaves the stored order completely unchanged instead of
    // half-applied (see DeckManager's persistOrder). `orderedIds` is the
    // desired sequence; each id gets order = its 1-based index in that array.
    // Ids that no longer exist (deleted in another tab) are ignored rather
    // than throwing.
    async reorder(orderedIds) {
      const all = readAll();
      const now = new Date().toISOString();
      orderedIds.forEach((id, i) => {
        if (all[id]) all[id] = { ...all[id], order: i + 1, updatedAt: now };
      });
      writeAll(all);
    },

    async remove(id) {
      const all = readAll();
      delete all[id];
      writeAll(all);
    },
  };
}
