# Static CDN-First Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the MECCG deck builder into a fully static SPA (no server) deployable on Cloudflare Pages: CDN images, localStorage decks, in-browser ZIP/PDF export.

**Architecture:** All server responsibilities move into the browser behind `web/src/api.js`, whose exported function signatures stay identical — so `App.jsx`, `DeckManager.jsx` and `ExportDialog.jsx` barely change. Export fidelity is guaranteed by reusing `constants.js` values, porting `sheetLayout` math verbatim, canvas edge-replication bleed matching sharp's `extend 'copy'`, and a `pHYs` PNG chunk for the 300-DPI tag.

**Tech Stack:** Vite + React (existing), JSZip (ZIP), pdf-lib (PDF), Canvas API (bleed), localStorage (decks), Cloudflare Pages (hosting).

**Branch:** `static-cdn-migration` (already created; spec committed).

**Spec:** `docs/superpowers/specs/2026-07-10-static-cdn-migration-design.md`

---

## Key facts (verified during design — do not re-derive)

- jsDelivr sends `Access-Control-Allow-Origin: *` on card images → canvas readback works.
- `cards/remastered-all/cards.json` is 3.4 MB raw; shape: `{ SET: { imageBaseUrl: {en,es,fr,...}, cards: { "AS-1": {...} } } }`, 1683 cards. Each card has `image` ("Burat.jpg") and `relativePath` (nested, obsolete after this migration).
- `imageBaseUrl[lang]` ends with `/`; full URL = base + `card.image`. Upstream `en` coverage is 100 %.
- Card fronts on the CDN are JPEG; shipped default backs are PNG.
- pdfkit's origin is top-left; **pdf-lib's origin is bottom-left** — every y must be flipped: `pdfY = pageH - y - height`.
- All components call the backend exclusively through `web/src/api.js` (verified by grep).
- The old server pipeline: `toMpcBuffer` = resize to 750×1050 + 36 px edge-replicated bleed → 822×1122 PNG @300 DPI. `toCutBuffer` = resize to 750×1050 (PDF path). Direct JPEG embedding in the PDF replaces `toCutBuffer` with no quality loss (PDF scales vectorially).

## Deliberate behavior changes (approved in design)

- Export image fetch falls back to English when the localized file 404s (matches on-screen `<img>` fallback) instead of recording a failure.
- Bleed/fetch is done once per unique card id (copies reuse it) — same output, fewer downloads; a failing card yields one failure entry instead of one per copy.
- Custom backs are normalized in-browser to a cut-size (750×1050) JPEG data URL (quality 0.9) stored with the deck, instead of a server upload.
- `data/` on disk is left untouched (it may hold the user's old decks); it simply stops being used.
- Do not touch `MECCG/` (user manages it manually).

## File structure

**Create**
- `web/src/lib/constants.js` — MPC dimensions (copied from `src/constants.js`, same values)
- `web/src/lib/parseCards.js` — pure transforms of raw cards.json (flatten, facets, index)
- `web/src/lib/deckStore.js` — localStorage CRUD, injectable storage
- `web/src/lib/export/backGroups.js` — BACK_GROUPS, backGroupForType, slug
- `web/src/lib/export/images.js` — fetchBytes, fetchCardImageBytes (lang fallback), dataUrlToBytes, mapLimit
- `web/src/lib/export/pngDpi.js` — pHYs chunk injection (300 DPI tag)
- `web/src/lib/export/bleedOps.js` — pure bleed geometry (drawImage op list)
- `web/src/lib/export/bleedCanvas.js` — browser-only canvas renderer (`toMpcPng`)
- `web/src/lib/export/zip.js` — buildDeckZip (JSZip)
- `web/src/lib/export/sheetLayout.js` — CARD, PAGE_SIZES, gridFor, sheetLayout, backColumnIndex, chunk
- `web/src/lib/export/pdf.js` — buildSheetPdf (pdf-lib)
- `web/public/cards.json`, `web/public/card-backs/*.png`, `web/public/_redirects`
- Tests: `test/parseCards.test.js`, `test/lang.test.js`, `test/backGroups.test.js`, `test/pngDpi.test.js`, `test/bleedOps.test.js`, `test/images.test.js`, `test/zip.test.js`, `test/sheetLayout.test.js`, `test/pdf.test.js` (+ rewrite `test/deckStore.test.js`)

**Modify:** `web/src/api.js` (staged rewrite, same signatures), `web/src/lib/lang.js`, `web/src/lib/deck.js:74`, `web/src/components/ExportDialog.jsx` (2 spots), `web/src/lib/i18n.js` (1 key ×2 langs), `test/constants.test.js`, `test/deck.test.js`, `vite.config.js`, `vitest` config untouched, `package.json`, `.claude/launch.json`, `README.md`.

**Delete (Task 7):** all of `src/`, `test/{cards,server,exporter,imageProcessor,imageSource,sheetPdf}.test.js`, root `card-backs/` (after copy), root `meccg-logo.png` (if unreferenced), server deps.

---

### Task 1: Pure card parsing + shared constants

**Files:**
- Create: `web/src/lib/constants.js`, `web/src/lib/parseCards.js`, `test/parseCards.test.js`, `web/public/cards.json` (copy)
- Modify: `test/constants.test.js:2`, `web/src/lib/deck.js:74`, `test/deck.test.js:5-7`

- [ ] **Step 1: Copy static data + constants**

```bash
cp cards/remastered-all/cards.json web/public/cards.json
cp src/constants.js web/src/lib/constants.js
```

(`src/constants.js` stays in place until Task 7 — the old server still imports it.)

- [ ] **Step 2: Update `test/constants.test.js` import**

Change line 2 to:

```js
import { DPI, BLEED_PX, CARD_W_BLEED, CARD_H_BLEED, CARD_W_CUT, CARD_H_CUT } from '../web/src/lib/constants.js';
```

- [ ] **Step 3: Write the failing test** — `test/parseCards.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards, computeFacets, parseCards } from '../web/src/lib/parseCards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'web', 'public', 'cards.json');

const fixture = {
  AS: {
    imageBaseUrl: { en: 'https://cdn/en/as/', fr: 'https://cdn/fr/as/' },
    cards: {
      'AS-1': { id: 'AS-1', type: 'Character', alignment: 'Minion', rarity: 'U2', attributes: { race: 'Troll', keywords: ['Maia'] }, image: 'Burat.jpg', text: { en: '<p>+1 <b>prowess</b> against Dwarves.</p>', fr: '<p>+1 prouesse contre les Nains.</p>', es: '' } },
      'AS-2': { id: 'AS-2', type: 'Resource', alignment: 'Hero', rarity: 'C1', attributes: { subtype: 'Short-event' }, image: 'x.jpg' },
    },
  },
  BA: {
    imageBaseUrl: { en: 'https://cdn/en/ba/' },
    cards: {
      'BA-1': { id: 'BA-1', type: 'Site', alignment: 'Neutral', rarity: 'R', attributes: {}, image: 'y.jpg' },
    },
  },
};

describe('flattenCards', () => {
  it('flattens nested sets into an array with setCode and per-set imageBaseUrl', () => {
    const cards = flattenCards(fixture);
    expect(cards).toHaveLength(3);
    expect(cards[0].setCode).toBe('AS');
    expect(cards[0].id).toBe('AS-1');
    expect(cards[0].image).toBe('Burat.jpg');
    expect(cards[0].imageBaseUrl.en).toBe('https://cdn/en/as/');
    expect(cards[2].imageBaseUrl.en).toBe('https://cdn/en/ba/');
    expect(cards[0].relativePath).toBeUndefined();
  });

  it('builds a stripped, concatenated searchable text field', () => {
    const cards = flattenCards(fixture);
    expect(cards[0].text).toBe('+1 prowess against Dwarves. +1 prouesse contre les Nains.');
    expect(cards[1].text).toBe('');
  });
});

describe('computeFacets', () => {
  it('produces sorted, de-duplicated, non-empty facet lists', () => {
    const facets = computeFacets(flattenCards(fixture));
    expect(facets.sets).toEqual(['AS', 'BA']);
    expect(facets.types).toEqual(['Character', 'Resource', 'Site']);
    expect(facets.races).toEqual(['Troll']);
    expect(facets.keywords).toEqual(['Maia']);
  });
});

describe('parseCards (real data)', () => {
  it('parses all 1683 cards from web/public/cards.json', async () => {
    const raw = JSON.parse(await readFile(CARDS_JSON, 'utf-8'));
    const { cards, facets, index } = parseCards(raw);
    expect(cards).toHaveLength(1683);
    expect(facets.sets).toEqual(['AS', 'BA', 'DM', 'LE', 'TD', 'TW', 'WH']);
    const burat = index.get('AS-1');
    expect(burat.name.en).toBe('Bûrat');
    expect(burat.image).toBe('Burat.jpg');
    expect(burat.imageBaseUrl.en).toMatch(/en-remaster\/as\/$/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/parseCards.test.js`
Expected: FAIL — cannot resolve `../web/src/lib/parseCards.js`

- [ ] **Step 5: Write `web/src/lib/parseCards.js`**

```js
// Pure transforms over the raw cards.json shape:
//   { SET: { imageBaseUrl: {en,es,fr,...}, cards: { "AS-1": {...} } } }
// Runs in the browser; no IO here.

// Strip HTML tags and collapse whitespace, for the searchable card text.
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Plain-text, searchable card text: en + fr + es game text, tags stripped.
function searchableText(text) {
  const t = text || {};
  return [t.en, t.fr, t.es].map(stripHtml).filter(Boolean).join(' ');
}

// Flatten the nested cards.json into a single array of normalized card
// objects. Each card carries a reference to its set's CDN roots
// (imageBaseUrl, keyed by language) so image URLs can be built anywhere.
export function flattenCards(raw) {
  const out = [];
  for (const [setCode, setObj] of Object.entries(raw || {})) {
    const cards = (setObj && setObj.cards) || {};
    const imageBaseUrl = (setObj && setObj.imageBaseUrl) || {};
    for (const [cardId, card] of Object.entries(cards)) {
      out.push({
        id: card.id ?? cardId,
        setCode,
        name: card.name || {},
        type: card.type || '',
        alignment: card.alignment || '',
        rarity: card.rarity || '',
        artist: card.artist || '',
        image: card.image || '', // bare filename, e.g. "Burat.jpg"
        imageBaseUrl, // shared per-set reference, e.g. { en: "https://cdn.../as/" }
        attributes: card.attributes || {},
        text: searchableText(card.text),
      });
    }
  }
  return out;
}

function uniqSorted(values) {
  return [...new Set(values.filter((v) => v !== undefined && v !== null && v !== ''))].sort();
}

// Build the list of available filter values from a flattened card array.
export function computeFacets(cards) {
  return {
    sets: uniqSorted(cards.map((c) => c.setCode)),
    types: uniqSorted(cards.map((c) => c.type)),
    alignments: uniqSorted(cards.map((c) => c.alignment)),
    rarities: uniqSorted(cards.map((c) => c.rarity)),
    races: uniqSorted(cards.map((c) => c.attributes.race)),
    subtypes: uniqSorted(cards.map((c) => c.attributes.subtype)),
    skills: uniqSorted(cards.map((c) => c.attributes.skills)),
    keywords: uniqSorted(cards.flatMap((c) => c.attributes.keywords || [])),
  };
}

// One-stop parse: cards + facets + id index.
export function parseCards(raw) {
  const cards = flattenCards(raw);
  return { cards, facets: computeFacets(cards), index: new Map(cards.map((c) => [c.id, c])) };
}
```

- [ ] **Step 6: Switch the missing-image check off `relativePath`**

`web/src/lib/deck.js:74` — change `!c.relativePath` to `!c.image`:

```js
  const missingImg = cardIds.map((id) => cardsById.get(id)).filter((c) => c && !c.image);
```

`test/deck.test.js:5-7` — replace `relativePath:` with `image:` in the three fixture lines (values `'x.jpg'`, `'y.jpg'`, `'z.jpg'` unchanged).

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS (old `test/cards.test.js` still passes — `src/cards.js` is untouched until Task 7).

- [ ] **Step 8: Commit**

```bash
git add web/public/cards.json web/src/lib/constants.js web/src/lib/parseCards.js test/parseCards.test.js test/constants.test.js web/src/lib/deck.js test/deck.test.js
git commit -m "feat: pure parseCards + static cards.json asset, image-field checks"
```

---

### Task 2: CDN image display + static getCards

**Files:**
- Modify: `web/src/lib/lang.js:31-45`, `web/src/api.js:7`, `vite.config.js`
- Create: `test/lang.test.js`
- Copy: `card-backs/*.png` → `web/public/card-backs/`

- [ ] **Step 1: Write the failing test** — `test/lang.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cardImageSrc, cardImageEn, cardName } from '../web/src/lib/lang.js';

const card = {
  id: 'AS-1',
  image: 'Burat.jpg',
  name: { en: 'Bûrat', fr: 'Bûrat-fr' },
  imageBaseUrl: { en: 'https://cdn/en/as/', fr: 'https://cdn/fr/as/' },
};

describe('cardImageSrc (CDN)', () => {
  it('builds the URL from the per-set base for the language', () => {
    expect(cardImageSrc(card, 'fr')).toBe('https://cdn/fr/as/Burat.jpg');
    expect(cardImageSrc(card, 'en')).toBe('https://cdn/en/as/Burat.jpg');
  });
  it('falls back to English when the language has no base', () => {
    expect(cardImageSrc(card, 'es')).toBe('https://cdn/en/as/Burat.jpg');
  });
  it('returns empty string when data is missing', () => {
    expect(cardImageSrc({}, 'en')).toBe('');
  });
  it('cardImageEn always returns the English URL', () => {
    expect(cardImageEn(card)).toBe('https://cdn/en/as/Burat.jpg');
  });
});

describe('cardName', () => {
  it('uses the requested language with en fallback', () => {
    expect(cardName(card, 'fr')).toBe('Bûrat-fr');
    expect(cardName({ id: 'X' }, 'fr')).toBe('X');
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run test/lang.test.js` — Expected: FAIL (current lang.js returns `/images/...` paths).

- [ ] **Step 3: Rewrite the image helpers in `web/src/lib/lang.js`**

Replace lines 31-45 (the comment block + `cardImageEn` + `cardImageSrc`) with:

```js
// CDN image URL for a card: per-set imageBaseUrl (attached by parseCards)
// + bare filename. Falls back to the English base when the requested
// language has none (matches the on-screen <img> onError fallback).
export function cardImageEn(card) {
  const base = (card && card.imageBaseUrl) || {};
  return base.en && card.image ? base.en + card.image : '';
}

export function cardImageSrc(card, lang = 'en') {
  const base = (card && card.imageBaseUrl) || {};
  const root = base[lang] || base.en;
  return root && card && card.image ? root + card.image : '';
}
```

- [ ] **Step 4: Swap `getCards` in `web/src/api.js`**

Replace line 7 (`export const getCards = () => json('/api/cards');`) with:

```js
import { parseCards } from './lib/parseCards.js';

let _index = null; // id -> card, set by getCards(); used by the export functions

export async function getCards() {
  const res = await fetch('/cards.json');
  if (!res.ok) throw new Error(`GET /cards.json → ${res.status}`);
  const { cards, facets, index } = parseCards(await res.json());
  _index = index;
  return { cards, facets, defaultBacks: { playdeck: true, locationdeck: true } };
}

export function requireIndex() {
  if (!_index) throw new Error('cards not loaded yet');
  return _index;
}
```

(The `import` goes at the top of the file.)

- [ ] **Step 5: Ship the default backs and prune stale proxies**

```bash
mkdir -p web/public/card-backs
cp card-backs/CardBack300dpi.png card-backs/SiteCardBack300dpi.png web/public/card-backs/
```

In `vite.config.js`, remove the `'/images': API,` and `'/cards.json': API,` proxy lines (keep `/api` and `/backs` until Tasks 3-6 land). `/cards.json` must be served by Vite's public dir, not proxied.

- [ ] **Step 6: Run tests** — `npx vitest run` — Expected: PASS.

- [ ] **Step 7: Manual browser verification**

Start the Vite dev server (use the preview tools; the old Node server is NOT needed for browsing anymore, only for decks/export). Load the app: cards must render with images loaded from `https://cdn.jsdelivr.net/...` (check the network panel), FR/EN display toggle works, filters work.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/lang.js web/src/api.js test/lang.test.js vite.config.js web/public/card-backs
git commit -m "feat: CDN card images + static cards.json loading (no image server)"
```

---

### Task 3: localStorage deck store + in-browser custom backs

**Files:**
- Create: `web/src/lib/deckStore.js`
- Rewrite: `test/deckStore.test.js`
- Modify: `web/src/api.js` (deck fns + uploadBack), `web/src/components/ExportDialog.jsx:145-149`, `web/src/lib/i18n.js:108,217`

- [ ] **Step 1: Rewrite `test/deckStore.test.js`** (it currently tests the doomed server store):

```js
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
});
```

- [ ] **Step 2: Run it** — `npx vitest run test/deckStore.test.js` — Expected: FAIL (module missing).

- [ ] **Step 3: Write `web/src/lib/deckStore.js`**

```js
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
```

- [ ] **Step 4: Run it** — `npx vitest run test/deckStore.test.js` — Expected: PASS.

- [ ] **Step 5: Swap the deck + back functions in `web/src/api.js`**

Replace lines 9-19 (the five `/api/decks` functions and `uploadBack`) with:

```js
import { createDeckStore } from './lib/deckStore.js';
import { CARD_W_CUT, CARD_H_CUT } from './lib/constants.js';

const store = createDeckStore();

export const listDecks = () => store.list();
export const getDeck = (id) => store.get(id);
export const createDeck = (body) => store.create(body || {});
export const updateDeck = (id, body) => store.update(id, body || {});
export const deleteDeck = async (id) => {
  await store.remove(id);
  return { ok: true };
};

// Custom back: normalized in the browser to a cut-size JPEG data URL and
// stored with the deck (bounded size, fits in localStorage).
export async function uploadBack(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W_CUT;
  canvas.height = CARD_H_CUT;
  canvas.getContext('2d').drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();
  return { path: canvas.toDataURL('image/jpeg', 0.9) };
}
```

(Imports at the top of the file. The `json()` helper at lines 1-5 loses its last callers once export swaps land in Tasks 5-6 — leave it for now.)

- [ ] **Step 6: Fix the custom-back label (data URLs are huge)**

`web/src/lib/i18n.js` — replace line 108 `'export.back.current': 'Dos : {path}',` with `'export.back.custom': 'Dos personnalisé',` and line 217 `'export.back.current': 'Back: {path}',` with `'export.back.custom': 'Custom back',` (line numbers approximate — locate by key).

`web/src/components/ExportDialog.jsx:145-149` — replace:

```jsx
                {backs[g.key]
                  ? t('export.back.current', { path: backs[g.key] })
                  : defaultBacks[g.key]
                    ? t('export.back.default')
                    : t('export.back.none')}
```

with:

```jsx
                {backs[g.key]
                  ? t('export.back.custom')
                  : defaultBacks[g.key]
                    ? t('export.back.default')
                    : t('export.back.none')}
```

- [ ] **Step 7: Run tests** — `npx vitest run` — Expected: PASS (i18n parity test, if any, still sees the key in both languages).

- [ ] **Step 8: Manual browser verification**

In the dev server: save a deck, reload the page, open the deck manager — the deck persists. Duplicate and delete work. Pick a custom back image in the export dialog — label shows "Dos personnalisé". DevTools → Application → localStorage shows `meccg.decks.v1`.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/deckStore.js test/deckStore.test.js web/src/api.js web/src/components/ExportDialog.jsx web/src/lib/i18n.js
git commit -m "feat: localStorage deck store and in-browser custom backs"
```

---

### Task 4: Export foundations (fetch, bleed geometry, PNG DPI, back groups)

**Files:**
- Create: `web/src/lib/export/backGroups.js`, `web/src/lib/export/images.js`, `web/src/lib/export/pngDpi.js`, `web/src/lib/export/bleedOps.js`, `web/src/lib/export/bleedCanvas.js`
- Test: `test/backGroups.test.js`, `test/images.test.js`, `test/pngDpi.test.js`, `test/bleedOps.test.js`

- [ ] **Step 1: Write the failing tests** (all four files):

`test/backGroups.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { backGroupForType, slug } from '../web/src/lib/export/backGroups.js';

describe('backGroupForType', () => {
  it('routes sites/regions to locationdeck, everything else to playdeck', () => {
    expect(backGroupForType('Site')).toBe('locationdeck');
    expect(backGroupForType('Region')).toBe('locationdeck');
    expect(backGroupForType('Character')).toBe('playdeck');
    expect(backGroupForType('Hazard')).toBe('playdeck');
    expect(backGroupForType(undefined)).toBe('playdeck');
  });
});

describe('slug', () => {
  it('strips diacritics and non-alphanumerics', () => {
    expect(slug('Bûrat')).toBe('Burat');
    expect(slug('All the Bells Ringing!')).toBe('All-the-Bells-Ringing');
    expect(slug('')).toBe('card');
  });
});
```

`test/images.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { dataUrlToBytes, mapLimit } from '../web/src/lib/export/images.js';

describe('dataUrlToBytes', () => {
  it('decodes a base64 data URL to bytes', () => {
    // "ABC" base64-encoded
    const bytes = dataUrlToBytes('data:text/plain;base64,QUJD');
    expect([...bytes]).toEqual([65, 66, 67]);
  });
});

describe('mapLimit', () => {
  it('maps all items, preserving order, with bounded concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
```

`test/pngDpi.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPngDpi } from '../web/src/lib/export/pngDpi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACK_PNG = path.join(__dirname, '..', 'web', 'public', 'card-backs', 'CardBack300dpi.png');

describe('withPngDpi', () => {
  it('inserts a pHYs chunk right after IHDR with 300 DPI in px/meter', async () => {
    const png = new Uint8Array(await readFile(BACK_PNG));
    const out = withPngDpi(png, 300);
    expect(out.length).toBe(png.length + 21); // 4 len + 4 type + 9 data + 4 crc
    const dv = new DataView(out.buffer, out.byteOffset);
    // signature(8) + IHDR(25) = 33 → pHYs chunk
    expect(dv.getUint32(33)).toBe(9);
    expect(String.fromCharCode(out[37], out[38], out[39], out[40])).toBe('pHYs');
    expect(dv.getUint32(41)).toBe(11811); // Math.round(300 / 0.0254)
    expect(dv.getUint32(45)).toBe(11811);
    expect(out[49]).toBe(1); // unit: meter
  });
});
```

`test/bleedOps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { bleedOps } from '../web/src/lib/export/bleedOps.js';
import { BLEED_PX, CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED } from '../web/src/lib/constants.js';

describe('bleedOps', () => {
  const ops = bleedOps();

  it('places the face at the bleed offset, unscaled', () => {
    const face = ops[0];
    expect(face).toEqual({ sx: 0, sy: 0, sw: CARD_W_CUT, sh: CARD_H_CUT, dx: BLEED_PX, dy: BLEED_PX, dw: CARD_W_CUT, dh: CARD_H_CUT });
  });

  it('tiles the full bleed canvas exactly (no gap, no overlap in area)', () => {
    const area = ops.reduce((s, o) => s + o.dw * o.dh, 0);
    expect(area).toBe(CARD_W_BLEED * CARD_H_BLEED);
  });

  it('keeps every destination rect inside the bleed canvas', () => {
    for (const o of ops) {
      expect(o.dx).toBeGreaterThanOrEqual(0);
      expect(o.dy).toBeGreaterThanOrEqual(0);
      expect(o.dx + o.dw).toBeLessThanOrEqual(CARD_W_BLEED);
      expect(o.dy + o.dh).toBeLessThanOrEqual(CARD_H_BLEED);
    }
  });

  it('replicates 1px source strips for the four edges', () => {
    const strips = ops.slice(1, 5);
    expect(strips.filter((o) => o.sh === 1)).toHaveLength(2); // top + bottom
    expect(strips.filter((o) => o.sw === 1)).toHaveLength(2); // left + right
  });
});
```

- [ ] **Step 2: Run them** — `npx vitest run test/backGroups.test.js test/images.test.js test/pngDpi.test.js test/bleedOps.test.js` — Expected: FAIL (modules missing).

- [ ] **Step 3: Write `web/src/lib/export/backGroups.js`**

```js
// Which back a card uses, by card type. Ported verbatim from the old
// server exporter so ZIP/PDF output stays identical.
export const BACK_GROUPS = {
  Character: 'playdeck',
  Resource: 'playdeck',
  Hazard: 'playdeck',
  Site: 'locationdeck',
  Region: 'locationdeck',
};

export function backGroupForType(type) {
  return BACK_GROUPS[type] || 'playdeck';
}

export function slug(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'card'
  );
}
```

- [ ] **Step 4: Write `web/src/lib/export/images.js`**

```js
// Shared image fetching for the in-browser exports.

export async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Front image bytes for a card in a language, falling back to English when
// the localized file is missing (matches the on-screen <img> fallback).
export async function fetchCardImageBytes(card, lang = 'en') {
  const base = card.imageBaseUrl || {};
  const root = base[lang] || base.en;
  if (!root || !card.image) throw new Error(`no image URL for ${card.id}`);
  try {
    return await fetchBytes(root + card.image);
  } catch (e) {
    if (base.en && root !== base.en) return fetchBytes(base.en + card.image);
    throw e;
  }
}

export function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Map fn over items with at most `limit` in flight; preserves order.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 5: Write `web/src/lib/export/pngDpi.js`**

```js
// Inject a pHYs chunk so exported PNGs carry the print DPI, matching the
// old server pipeline (sharp's withMetadata({ density })). Canvas-produced
// PNGs never contain a pHYs chunk, and the PNG spec guarantees IHDR is the
// first chunk, so inserting at byte 33 (8 signature + 25 IHDR) is safe.

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function withPngDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254); // pixels per meter
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: meter
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33), 0); // signature + IHDR
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}
```

- [ ] **Step 6: Write `web/src/lib/export/bleedOps.js`**

```js
import { BLEED_PX, CARD_W_CUT, CARD_H_CUT } from '../constants.js';

// Pure geometry for canvas edge-replicated bleed (the equivalent of sharp's
// extend({ extendWith: 'copy' })): a list of drawImage operations mapping
// source rects on the cut-size face to destination rects on the bleed canvas.
// 1px edge strips and corner pixels are stretched into the bleed margin.
export function bleedOps({ w = CARD_W_CUT, h = CARD_H_CUT, b = BLEED_PX } = {}) {
  return [
    { sx: 0, sy: 0, sw: w, sh: h, dx: b, dy: b, dw: w, dh: h }, // face
    { sx: 0, sy: 0, sw: w, sh: 1, dx: b, dy: 0, dw: w, dh: b }, // top edge
    { sx: 0, sy: h - 1, sw: w, sh: 1, dx: b, dy: b + h, dw: w, dh: b }, // bottom edge
    { sx: 0, sy: 0, sw: 1, sh: h, dx: 0, dy: b, dw: b, dh: h }, // left edge
    { sx: w - 1, sy: 0, sw: 1, sh: h, dx: b + w, dy: b, dw: b, dh: h }, // right edge
    { sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, dw: b, dh: b }, // top-left corner
    { sx: w - 1, sy: 0, sw: 1, sh: 1, dx: b + w, dy: 0, dw: b, dh: b }, // top-right corner
    { sx: 0, sy: h - 1, sw: 1, sh: 1, dx: 0, dy: b + h, dw: b, dh: b }, // bottom-left corner
    { sx: w - 1, sy: h - 1, sw: 1, sh: 1, dx: b + w, dy: b + h, dw: b, dh: b }, // bottom-right corner
  ];
}
```

- [ ] **Step 7: Write `web/src/lib/export/bleedCanvas.js`** (browser-only, no unit test — verified in Task 5's manual check):

```js
import { CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { bleedOps } from './bleedOps.js';
import { withPngDpi } from './pngDpi.js';

// Image bytes (JPEG/PNG) -> MPC-ready PNG bytes: resize to the cut size,
// replicate the edges outward as bleed, tag 300 DPI. Browser-only (canvas).
export async function toMpcPng(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const face = document.createElement('canvas');
  face.width = CARD_W_CUT;
  face.height = CARD_H_CUT;
  const fctx = face.getContext('2d');
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();

  const out = document.createElement('canvas');
  out.width = CARD_W_BLEED;
  out.height = CARD_H_BLEED;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false; // exact pixel replication for the bleed strips
  for (const o of bleedOps()) ctx.drawImage(face, o.sx, o.sy, o.sw, o.sh, o.dx, o.dy, o.dw, o.dh);

  const blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png')
  );
  return withPngDpi(new Uint8Array(await blob.arrayBuffer()), DPI);
}
```

- [ ] **Step 8: Run the tests** — `npx vitest run` — Expected: PASS (all four new files + existing suite).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/export test/backGroups.test.js test/images.test.js test/pngDpi.test.js test/bleedOps.test.js
git commit -m "feat: export foundations - CDN fetch, bleed geometry, pHYs DPI tag, back groups"
```

---

### Task 5: In-browser MPC ZIP export

**Files:**
- Create: `web/src/lib/export/zip.js`, `test/zip.test.js`
- Modify: `web/src/api.js` (replace `exportDeck`)

- [ ] **Step 1: Install JSZip**

Run: `npm install jszip`

- [ ] **Step 2: Write the failing test** — `test/zip.test.js` (JSZip runs in node; fake PNG bytes are fine — the zip layer never decodes images):

```js
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDeckZip } from '../web/src/lib/export/zip.js';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const cards = [
  { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } },
  { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } }, // second copy
  { id: 'BA-1', type: 'Site', name: { en: 'Moria' } },
  { id: 'XX-9', type: 'Hazard', name: { en: 'Broken' } }, // will fail
];

const getFrontPng = async (card) => {
  if (card.id === 'XX-9') throw new Error('404');
  return FAKE_PNG;
};
const getBackPng = async () => FAKE_PNG;

describe('buildDeckZip', () => {
  it('builds the same tree as the server exporter: fronts per group, back, manifest', async () => {
    const { bytes, counts, failures } = await buildDeckZip({ deckName: 'Test', cards, getFrontPng, getBackPng });
    expect(counts).toEqual({ playdeck: 2, locationdeck: 1 });
    expect(failures).toEqual([{ id: 'XX-9', error: '404' }]);

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      'locationdeck/',
      'locationdeck/back.png',
      'locationdeck/fronts/',
      'locationdeck/fronts/BA-1_Moria.png',
      'manifest.txt',
      'playdeck/',
      'playdeck/back.png',
      'playdeck/fronts/',
      'playdeck/fronts/AS-1_Burat_c1.png',
      'playdeck/fronts/AS-1_Burat_c2.png',
    ]);

    const manifest = await zip.file('manifest.txt').async('string');
    expect(manifest).toContain('Deck: Test');
    expect(manifest).toContain('MPC format: 822x1122px @ 300 DPI (with bleed)');
    expect(manifest).toContain('Counts: playdeck=2, locationdeck=1');
    expect(manifest).toContain('XX-9: 404');
  });

  it('omits a group back when the group is empty', async () => {
    const { bytes } = await buildDeckZip({
      deckName: 'OnlyPlay',
      cards: [{ id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } }],
      getFrontPng,
      getBackPng,
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('locationdeck/back.png')).toBeNull();
    expect(zip.file('playdeck/back.png')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run it** — `npx vitest run test/zip.test.js` — Expected: FAIL (module missing).

- [ ] **Step 4: Write `web/src/lib/export/zip.js`** (port of `src/exporter.js`, image processing injected):

```js
import JSZip from 'jszip';
import { CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { backGroupForType, slug } from './backGroups.js';

// Browser port of the old server exporter: identical tree, filenames and
// manifest. getFrontPng/getBackPng return MPC-ready PNG bytes (the caller
// wires fetching + bleed; this layer never touches pixels).
export async function buildDeckZip({ deckName = 'deck', cards = [], getFrontPng, getBackPng }) {
  const zip = new JSZip();
  const counts = { playdeck: 0, locationdeck: 0 };
  const failures = [];
  const manifest = [
    `Deck: ${deckName}`,
    `MPC format: ${CARD_W_BLEED}x${CARD_H_BLEED}px @ ${DPI} DPI (with bleed)`,
    '',
    'group\tid\tname',
  ];

  // A card may appear multiple times (copies); give each copy a unique filename.
  const totalPerId = {};
  for (const card of cards) totalPerId[card.id] = (totalPerId[card.id] || 0) + 1;
  const seenPerId = {};

  for (const card of cards) {
    const group = backGroupForType(card.type);
    try {
      const png = await getFrontPng(card);
      seenPerId[card.id] = (seenPerId[card.id] || 0) + 1;
      const suffix = totalPerId[card.id] > 1 ? `_c${seenPerId[card.id]}` : '';
      zip.file(`${group}/fronts/${card.id}_${slug(card.name && card.name.en)}${suffix}.png`, png);
      counts[group] += 1;
      manifest.push(`${group}\t${card.id}\t${(card.name && card.name.en) || ''}`);
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
    }
  }

  for (const group of ['playdeck', 'locationdeck']) {
    if (counts[group] > 0) {
      try {
        const back = await getBackPng(group);
        if (back) zip.file(`${group}/back.png`, back);
      } catch (e) {
        failures.push({ id: `${group}-back`, error: e.message });
      }
    }
  }

  manifest.push('', `Counts: playdeck=${counts.playdeck}, locationdeck=${counts.locationdeck}`);
  if (failures.length) {
    manifest.push('', 'FAILURES:');
    for (const f of failures) manifest.push(`  ${f.id}: ${f.error}`);
  }
  zip.file('manifest.txt', manifest.join('\n'));

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes, counts, failures };
}
```

- [ ] **Step 5: Run it** — `npx vitest run test/zip.test.js` — Expected: PASS. (If the folder-entry names differ — JSZip may not emit implicit directory entries — adjust the expected `names` array to the actual file list; the five file entries are the contract.)

- [ ] **Step 6: Swap `exportDeck` in `web/src/api.js`**

Add imports at the top:

```js
import { fetchBytes, fetchCardImageBytes, dataUrlToBytes, mapLimit } from './lib/export/images.js';
import { toMpcPng } from './lib/export/bleedCanvas.js';
import { buildDeckZip } from './lib/export/zip.js';
```

Add the shared helpers (above `exportDeck`):

```js
const DEFAULT_BACK_URLS = {
  playdeck: '/card-backs/CardBack300dpi.png',
  locationdeck: '/card-backs/SiteCardBack300dpi.png',
};

// Back image bytes per group: custom data URL if assigned, else shipped default.
// Legacy non-dataURL assignments (old server paths) fall back to the default.
function makeGetBackBytes(backAssignments = {}) {
  return async (group) => {
    const v = backAssignments[group];
    if (v && String(v).startsWith('data:')) return dataUrlToBytes(v);
    return fetchBytes(DEFAULT_BACK_URLS[group]);
  };
}

// Fetch + process each unique card's front once (copies reuse it), with
// bounded concurrency. Returns a lookup that throws for failed cards.
async function prefetchFronts(cards, lang, process) {
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  const cache = new Map();
  await mapLimit(unique, 6, async (card) => {
    try {
      cache.set(card.id, { bytes: await process(await fetchCardImageBytes(card, lang)) });
    } catch (e) {
      cache.set(card.id, { error: e });
    }
  });
  return (card) => {
    const r = cache.get(card.id);
    if (!r) throw new Error(`no image for ${card.id}`);
    if (r.error) throw r.error;
    return r.bytes;
  };
}
```

Replace the whole old `exportDeck` (the `/api/export` fetch, lines 35-46) with:

```js
// Builds the MPC ZIP in the browser and triggers the download.
export async function exportDeck({ deckName, cardIds, backAssignments, lang = 'en' }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const getFrontPng = await prefetchFronts(cards, lang, toMpcPng);
  const getBackBytes = makeGetBackBytes(backAssignments);
  const getBackPng = async (group) => toMpcPng(await getBackBytes(group));
  const { bytes, counts, failures } = await buildDeckZip({ deckName, cards, getFrontPng, getBackPng });
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), `${safeName(deckName)}_${lang}_MPC.zip`);
  return { counts, failures };
}
```

(`ExportDialog.jsx` needs no change — same signature and return shape.)

- [ ] **Step 7: Run the full suite** — `npx vitest run` — Expected: PASS.

- [ ] **Step 8: Manual verification (fidelity check)**

In the dev browser: select 3-4 cards (mix of Character/Site, include one card twice), export the MPC ZIP in `en` and once in `fr`. Unzip and check: 822×1122 px PNGs, bleed looks like edge replication (no white border), `_c1`/`_c2` suffixes on the duplicated card, `playdeck/back.png` + `locationdeck/back.png` present, manifest correct. Verify a PNG reports 300 DPI (e.g. `magick identify -format "%x x %y" file.png` or any image inspector).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json web/src/lib/export/zip.js test/zip.test.js web/src/api.js
git commit -m "feat: in-browser MPC ZIP export (JSZip + canvas bleed)"
```

---

### Task 6: In-browser PDF sheet export

**Files:**
- Create: `web/src/lib/export/sheetLayout.js`, `web/src/lib/export/pdf.js`, `test/sheetLayout.test.js`, `test/pdf.test.js`
- Modify: `web/src/api.js` (replace `exportPdf`, drop the now-dead `json()` helper)

- [ ] **Step 1: Install pdf-lib**

Run: `npm install pdf-lib`

- [ ] **Step 2: Write the failing layout test** — `test/sheetLayout.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CARD, PAGE_SIZES, gridFor, sheetLayout, backColumnIndex, chunk } from '../web/src/lib/export/sheetLayout.js';

describe('gridFor', () => {
  it('fits 3x3 on letter and A4, 6x3 on A3 landscape', () => {
    expect(gridFor(PAGE_SIZES.letter.w, PAGE_SIZES.letter.h)).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(PAGE_SIZES.a4.w, PAGE_SIZES.a4.h)).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(PAGE_SIZES.a3.w, PAGE_SIZES.a3.h)).toEqual({ cols: 6, rows: 3 });
  });
});

describe('sheetLayout', () => {
  it('centers a 3x3 grid of true-size poker cards on letter', () => {
    const l = sheetLayout({ pageW: PAGE_SIZES.letter.w, pageH: PAGE_SIZES.letter.h });
    expect(l.perPage).toBe(9);
    expect(l.cardW).toBe(CARD.w); // 180pt = 2.5in
    expect(l.cardH).toBe(CARD.h); // 252pt = 3.5in
    expect(l.marginX).toBe((612 - 3 * 180) / 2); // 36
    expect(l.marginY).toBe((792 - 3 * 252) / 2); // 18
    expect(l.cells[0]).toEqual({ row: 0, col: 0, x: 36, y: 18 });
    expect(l.cells[4].x).toBe(36 + 180); // center cell
  });
});

describe('backColumnIndex', () => {
  it('mirrors columns for duplex printing', () => {
    expect(backColumnIndex(0, 3)).toBe(2);
    expect(backColumnIndex(1, 3)).toBe(1);
    expect(backColumnIndex(2, 3)).toBe(0);
  });
});

describe('chunk', () => {
  it('splits into fixed-size pages', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
```

- [ ] **Step 3: Run it** — `npx vitest run test/sheetLayout.test.js` — Expected: FAIL.

- [ ] **Step 4: Write `web/src/lib/export/sheetLayout.js`** (verbatim port of the pure math from `src/sheetPdf.js`, minus pdfkit):

```js
// Pure sheet-layout math, ported verbatim from the old server sheetPdf.
// Coordinates are TOP-LEFT based (like pdfkit); the pdf-lib renderer flips y.
const PT = 72; // PDF points per inch

export const CARD = { w: 2.5 * PT, h: 3.5 * PT }; // 180 x 252 (poker cut size)

// Page dimensions in points, in the working orientation. A3 uses landscape to
// fit 18 cards (= two A4 sheets) instead of 16 in portrait, to save paper.
export const PAGE_SIZES = {
  letter: { w: 8.5 * PT, h: 11 * PT }, // 612 x 792
  a4: { w: 595.28, h: 841.89 },
  a3: { w: 1190.55, h: 841.89 }, // landscape
};

// How many whole poker cards fit on a page (floor division on each axis).
export function gridFor(pageW, pageH, cardW = CARD.w, cardH = CARD.h) {
  return {
    cols: Math.max(1, Math.floor(pageW / cardW)),
    rows: Math.max(1, Math.floor(pageH / cardH)),
  };
}

// Card cell rectangles centered on the page.
export function sheetLayout({ pageW = PAGE_SIZES.letter.w, pageH = PAGE_SIZES.letter.h, cardW = CARD.w, cardH = CARD.h, cols, rows } = {}) {
  if (cols == null || rows == null) {
    const g = gridFor(pageW, pageH, cardW, cardH);
    cols = g.cols;
    rows = g.rows;
  }
  const marginX = (pageW - cols * cardW) / 2;
  const marginY = (pageH - rows * cardH) / 2;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ row, col, x: marginX + col * cardW, y: marginY + row * cardH });
    }
  }
  return { marginX, marginY, cardW, cardH, cols, rows, perPage: cols * rows, cells };
}

// For duplex printing flipped on the long (left-right) edge, back columns mirror.
export function backColumnIndex(col, cols) {
  return cols - 1 - col;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
```

- [ ] **Step 5: Run it** — `npx vitest run test/sheetLayout.test.js` — Expected: PASS.

- [ ] **Step 6: Write the failing PDF test** — `test/pdf.test.js` (pdf-lib runs in node; a real 1×1 JPEG exercises embedJpg):

```js
import { describe, it, expect } from 'vitest';
import { buildSheetPdf } from '../web/src/lib/export/pdf.js';

// Minimal valid 1x1 white JPEG.
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  'base64'
);
const bytes1x1 = new Uint8Array(JPEG_1x1);

const cards = Array.from({ length: 10 }, (_, i) => ({ id: `AS-${i}`, type: i === 0 ? 'Site' : 'Character', name: { en: `Card ${i}` } }));

const getFrontBytes = (card) => {
  if (card.id === 'AS-9') throw new Error('boom');
  return bytes1x1;
};
const getBackBytes = async () => bytes1x1;

describe('buildSheetPdf', () => {
  it('paginates 9 printable cards onto one letter fronts page + one backs page', async () => {
    const { bytes, failures, pageCount } = await buildSheetPdf({ cards, getFrontBytes, getBackBytes, includeBacks: true, format: 'letter' });
    expect(failures).toEqual([{ id: 'AS-9', error: 'boom' }]);
    expect(pageCount).toBe(2); // 9 printable cards -> 1 fronts page (+1 backs)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('doubles pages only when includeBacks is on', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `C-${i}`, type: 'Character', name: { en: `C${i}` } }));
    const noBacks = await buildSheetPdf({ cards: twelve, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: false, format: 'letter' });
    expect(noBacks.pageCount).toBe(2); // 12 cards / 9 per page -> 2 pages
    const withBacks = await buildSheetPdf({ cards: twelve, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: true, format: 'letter' });
    expect(withBacks.pageCount).toBe(4);
  });

  it('uses the 18-card A3 grid', async () => {
    const many = Array.from({ length: 18 }, (_, i) => ({ id: `C-${i}`, type: 'Character', name: { en: `C${i}` } }));
    const r = await buildSheetPdf({ cards: many, getFrontBytes: () => bytes1x1, getBackBytes, includeBacks: false, format: 'a3' });
    expect(r.pageCount).toBe(1);
  });
});
```

- [ ] **Step 7: Run it** — `npx vitest run test/pdf.test.js` — Expected: FAIL.

- [ ] **Step 8: Write `web/src/lib/export/pdf.js`**

```js
import { PDFDocument, rgb } from 'pdf-lib';
import { PAGE_SIZES, sheetLayout, backColumnIndex, chunk } from './sheetLayout.js';
import { backGroupForType } from './backGroups.js';

const GRAY = rgb(0.533, 0.533, 0.533);

// Fronts from the CDN are JPEG; backs may be PNG (shipped defaults) or JPEG
// (normalized custom uploads). Sniff the signature instead of trusting names.
function embedAuto(doc, bytes) {
  const isPng = bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return isPng ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

// Short corner crop marks just outside a card rectangle. Layout coords are
// top-left based; pdf-lib's origin is bottom-left, so y flips here.
function cropMarks(page, pageH, x, y, w, h, len = 9) {
  const seg = (x1, y1, x2, y2) =>
    page.drawLine({ start: { x: x1, y: pageH - y1 }, end: { x: x2, y: pageH - y2 }, thickness: 0.4, color: GRAY });
  const corners = [
    [x, y, -len, 0, 0, -len], // top-left
    [x + w, y, len, 0, 0, -len], // top-right
    [x, y + h, -len, 0, 0, len], // bottom-left
    [x + w, y + h, len, 0, 0, len], // bottom-right
  ];
  for (const [cx, cy, hdx, hdy, vdx, vdy] of corners) {
    seg(cx, cy, cx + hdx, cy + hdy);
    seg(cx, cy, cx + vdx, cy + vdy);
  }
}

// Browser port of the old server sheetPdf: true-size poker cards on a
// centered grid with crop marks, optional mirrored backs pages for duplex.
// Original image bytes are embedded directly — the PDF scales them to
// 2.5x3.5in vectorially, so no canvas resampling is needed (or wanted).
export async function buildSheetPdf({ cards = [], getFrontBytes, getBackBytes, includeBacks = true, format = 'letter' }) {
  const pageSize = PAGE_SIZES[format] || PAGE_SIZES.letter;
  const layout = sheetLayout({ pageW: pageSize.w, pageH: pageSize.h });
  const doc = await PDFDocument.create();

  // Embed each unique front once; copies reuse the embedded image.
  const frontImg = new Map();
  const failures = [];
  for (const card of cards) {
    if (frontImg.has(card.id)) continue;
    try {
      frontImg.set(card.id, await embedAuto(doc, await getFrontBytes(card)));
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
      frontImg.set(card.id, null);
    }
  }

  const backImg = new Map();
  if (includeBacks) {
    for (const group of ['playdeck', 'locationdeck']) {
      try {
        const bytes = await getBackBytes(group);
        if (bytes) backImg.set(group, await embedAuto(doc, bytes));
      } catch (e) {
        failures.push({ id: `${group}-back`, error: e.message });
      }
    }
  }

  const drawCard = (page, img, cell) => {
    if (img) page.drawImage(img, { x: cell.x, y: pageSize.h - cell.y - layout.cardH, width: layout.cardW, height: layout.cardH });
    cropMarks(page, pageSize.h, cell.x, cell.y, layout.cardW, layout.cardH);
  };

  const printable = cards.filter((c) => frontImg.get(c.id));
  const pages = chunk(printable, layout.perPage);

  for (const pageCards of pages) {
    const front = doc.addPage([pageSize.w, pageSize.h]);
    pageCards.forEach((card, i) => drawCard(front, frontImg.get(card.id), layout.cells[i]));

    if (includeBacks) {
      const back = doc.addPage([pageSize.w, pageSize.h]);
      pageCards.forEach((card, i) => {
        const row = Math.floor(i / layout.cols);
        const col = i % layout.cols;
        const cell = layout.cells[row * layout.cols + backColumnIndex(col, layout.cols)];
        drawCard(back, backImg.get(backGroupForType(card.type)), cell);
      });
    }
  }

  return { bytes: await doc.save(), failures, pageCount: pages.length * (includeBacks ? 2 : 1) };
}
```

- [ ] **Step 9: Run it** — `npx vitest run test/pdf.test.js` — Expected: PASS.

- [ ] **Step 10: Swap `exportPdf` in `web/src/api.js`**

Add the import: `import { buildSheetPdf } from './lib/export/pdf.js';`

Replace the whole old `exportPdf` (the `/api/export-pdf` fetch) with:

```js
// Builds the print-sheet PDF in the browser and triggers the download.
export async function exportPdf({ deckName, cardIds, backAssignments, includeBacks, format = 'letter', lang = 'en' }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const getFrontBytes = await prefetchFronts(cards, lang, async (b) => b); // raw bytes, PDF scales them
  const { bytes, failures, pageCount } = await buildSheetPdf({
    cards,
    getFrontBytes,
    getBackBytes: makeGetBackBytes(backAssignments),
    includeBacks,
    format,
  });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeName(deckName)}_${format}_${lang}_sheets.pdf`);
  return { pages: pageCount, failures };
}
```

Then delete the now-unused `json()` helper at the top of `api.js` (nothing calls it anymore).

- [ ] **Step 11: Run the full suite** — `npx vitest run` — Expected: PASS.

- [ ] **Step 12: Manual verification (fidelity check)**

Export a 10+ card deck as PDF in letter (with backs) and A3 (without): true 2.5″×3.5″ cards (measure in a PDF viewer), 3×3 then 6×3 grids centered, crop marks at corners, backs pages mirrored column-wise (first card's back on the right), Site cards get the location back. Compare side by side with a server-generated PDF from before the migration if available.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json web/src/lib/export/sheetLayout.js web/src/lib/export/pdf.js test/sheetLayout.test.js test/pdf.test.js web/src/api.js
git commit -m "feat: in-browser PDF sheet export (pdf-lib, direct image embedding)"
```

---

### Task 7: Remove the server, prune deps, finalize static build

**Files:**
- Delete: `src/` (all 8 files), `test/cards.test.js`, `test/server.test.js`, `test/exporter.test.js`, `test/imageProcessor.test.js`, `test/imageSource.test.js`, `test/sheetPdf.test.js`, root `card-backs/`, root `meccg-logo.png` (conditional)
- Modify: `package.json`, `vite.config.js`, `.claude/launch.json`, `README.md`
- Create: `web/public/_redirects`

- [ ] **Step 1: Delete the server and its tests**

```bash
git rm src/server.js src/deckStore.js src/exporter.js src/imageProcessor.js src/imageSource.js src/sheetPdf.js src/cards.js src/constants.js
git rm test/cards.test.js test/server.test.js test/exporter.test.js test/imageProcessor.test.js test/imageSource.test.js test/sheetPdf.test.js
git rm -r card-backs
```

- [ ] **Step 2: Conditionally remove the stray root logo**

Run: `grep -rn "meccg-logo" --include="*.js" --include="*.jsx" --include="*.html" --include="*.json" --include="*.md" web/ README.md package.json` — if the only hits reference `web/public/meccg-logo.png` (or nothing references the root copy), run `git rm meccg-logo.png`. Otherwise leave it and note why.

- [ ] **Step 3: Prune dependencies and scripts**

```bash
npm uninstall fastify @fastify/static @fastify/multipart sharp archiver pdfkit adm-zip
```

In `package.json`, set:

```json
  "description": "Static MECCG deck builder with in-browser MPC/PDF print export",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

(`jszip` and `pdf-lib` stay in `dependencies`; react/vite/vitest stay in `devDependencies` — move `react` and `react-dom` to `dependencies` if you prefer convention, but Vite bundles either way.)

- [ ] **Step 4: Finish the static config**

`vite.config.js` — remove the whole `server.proxy` block and the `const API = ...` line:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

`.claude/launch.json` — replace the configuration:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "meccg",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173,
      "autoPort": true
    }
  ]
}
```

Create `web/public/_redirects` (SPA fallback for Cloudflare Pages):

```
/* /index.html 200
```

`.gitignore` — leave as is: `data/` and `cards/` stay ignored because both directories remain on disk (old decks / local image trees) but are no longer used by the app. Deleting them from disk is an optional manual step for the user.

- [ ] **Step 5: Update `README.md`**

Rewrite the architecture/run sections to state: fully static Vite SPA; images from jsDelivr CDN; decks in localStorage (export/import JSON for backup); in-browser ZIP (MPC) and PDF export; `npm run dev` to develop, `npm run build` → `web/dist`; deploy on Cloudflare Pages with build command `npm run build` and output directory `web/dist` (the `_redirects` file handles SPA routing); alternative one-shot deploy: `npx wrangler pages deploy web/dist`. Keep any card-data documentation that is still accurate; remove all mentions of the Node server, `/api`, `data/decks`, sharp/pdfkit, and local image trees.

- [ ] **Step 6: Full verification**

```bash
npx vitest run
npm run build
```

Expected: all tests pass; build succeeds into `web/dist` containing `index.html`, `cards.json`, `card-backs/`, `_redirects`, hashed assets.

Then run `npm run preview` (or the dev server) and verify the complete flow in the browser: browse + filter cards (CDN images), save/load/delete a deck, import/export, MPC ZIP export, PDF export, custom back. Check the console for errors and the network panel for any remaining `/api` calls (there must be none).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat!: fully static app - remove Node server, deps and dead tests"
```

---

### Task 8: Deploy to Cloudflare Pages

This task needs the user (account/dashboard access). Prepare everything, then hand over.

- [ ] **Step 1: Check the remote**

Run: `git remote -v`. If there is no GitHub remote, ask the user whether to create one (`gh repo create` — needs their choice of name/visibility) or to use direct upload instead.

- [ ] **Step 2: Merge/push**

After user approval: merge `static-cdn-migration` into `main` (or open a PR per the user's preference) and push.

- [ ] **Step 3: Connect Cloudflare Pages (user action, guide them)**

Dashboard → Workers & Pages → Create → Pages → Connect to Git → select the repo. Settings:
- Build command: `npm run build`
- Build output directory: `web/dist`
- No environment variables needed.

Alternative without Git integration: `npx wrangler pages deploy web/dist --project-name meccg-deckbuilder` (requires `wrangler login`).

- [ ] **Step 4: Post-deploy smoke test**

On the deployed URL: cards render (CDN), deck save/reload, one ZIP export, one PDF export, deep-link a route and hard-refresh (the `_redirects` fallback must serve the app, not a 404).

---

## Self-review notes (already applied)

- **Spec coverage:** data/images (T1-T2), decks (T3), backs (T3-T4), ZIP (T5), PDF (T6), cleanup + build + `_redirects` (T7), deploy (T8), README (T7). `MECCG/` untouched everywhere.
- **Type consistency:** `getFrontPng`/`getBackPng` return `Uint8Array` (zip), `getFrontBytes`/`getBackBytes` return `Uint8Array` (pdf); `prefetchFronts` returns a sync lookup — awaiting it is harmless where done. `requireIndex` is exported from `api.js` in T2 and used in T5/T6.
- **Known acceptable diffs vs server output:** one failure entry per unique failing card (was per copy); PDF embeds original JPEGs (was resampled 750×1050 — same visual result, smaller files); ZIP may lack explicit directory entries (JSZip) — MPC upload does not care. Manifest, naming, dimensions, DPI tag: identical.
