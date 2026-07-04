# MECCG Deck Builder Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Backend logic is built TDD with Vitest; the React UI is built then verified manually via `npm run dev`.

**Goal:** Une app web locale pour sélectionner des cartes MECCG avec filtres et exporter un ZIP d'images retaillées au format MPC.

**Architecture:** Un seul processus Node (Fastify) qui sert un front Vite+React, les images statiques et une API (cartes, decks, export). Le traitement d'image (`sharp`) et l'assemblage ZIP (`archiver`) sont côté serveur. Decks persistés en fichiers JSON.

**Tech Stack:** Node ESM, Fastify, @fastify/static, @fastify/multipart, sharp ^0.33, archiver, Vite, React, Vitest, adm-zip (tests).

---

## File structure

```
package.json                 # scripts + deps (racine, ESM)
vite.config.js               # build front, proxy dev
src/                         # backend
├── constants.js             # dimensions MPC
├── cards.js                 # flatten cards.json, facets, index
├── imageProcessor.js        # source → PNG MPC + bleed
├── exporter.js              # buildDeckZip + backGroupForType
├── deckStore.js             # CRUD decks sur disque
└── server.js                # Fastify: statique + API
web/                         # front (Vite root)
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── api.js               # fetch wrappers
    ├── lib/filter.js        # filtrage pur (testé)
    ├── lib/deck.js          # backGroupForType + deckCounts (testé)
    └── components/{FilterBar,CardBrowser,DeckDrawer,DeckManager,ExportDialog}.jsx
test/                        # tests backend + lib
data/decks/                  # runtime (gitignored)
data/backs/                  # runtime (gitignored)
remastered-all/              # existant
```

---

### Task 1: Setup projet, git, deps

**Files:** Create `package.json`, `.gitignore`, `vitest.config.js`

- [ ] Init: `git init`, `npm init -y`, set `"type":"module"`.
- [ ] Install: `npm i fastify @fastify/static @fastify/multipart sharp archiver` ; `npm i -D vite @vitejs/plugin-react react react-dom vitest adm-zip`.
- [ ] `.gitignore`: `node_modules/`, `data/`, `web/dist/`, `.superpowers/`.
- [ ] Scripts: `"dev"`, `"start"`, `"test":"vitest run"`, `"build":"vite build"`.
- [ ] Commit `chore: project setup`.

### Task 2: constants.js (MPC dims)

**Files:** Create `src/constants.js`, `test/constants.test.js`

- [ ] Test: cut = bleed - 2*36 (744×1038), bleed 816×1110.
- [ ] Implement exports `DPI, BLEED_PX, CARD_W_BLEED, CARD_H_BLEED, CARD_W_CUT, CARD_H_CUT`.
- [ ] `npx vitest run test/constants.test.js` → PASS. Commit.

### Task 3: cards.js (flatten + facets)

**Files:** Create `src/cards.js`, `test/cards.test.js`

- [ ] Test `flattenCards` on a small fixture object `{AS:{cards:{"AS-1":{id,type,attributes:{race}}}}}` → array length 1, item has `setCode:'AS'`.
- [ ] Test `computeFacets` → sets/types/races arrays, sorted, no empties.
- [ ] Implement `flattenCards`, `computeFacets`, `loadCards(path)` (returns `{cards, facets, index}`).
- [ ] Test `loadCards` against real `remastered-all/cards.json` → 1683 cards, facets.types includes 'Resource'.
- [ ] `vitest run` → PASS. Commit.

### Task 4: imageProcessor.js (resize + bleed)

**Files:** Create `src/imageProcessor.js`, `test/imageProcessor.test.js`

- [ ] Test `toMpcBuffer('remastered-all/as/minions/Burat.jpg')` → sharp(buf).metadata() width=816 height=1110 density≈300 format='png'.
- [ ] Implement: `sharp(input).resize(CUT_W,CUT_H,{fit:'fill'})` → `.extend({...36, extendWith:'copy'})` → `.withMetadata({density:300})` → `.png().toBuffer()`. Accept path or Buffer.
- [ ] `vitest run` → PASS. Commit.

### Task 5: exporter.js (ZIP)

**Files:** Create `src/exporter.js`, `test/exporter.test.js`

- [ ] Test `backGroupForType`: Resource→playdeck, Site→locationdeck, Region→locationdeck, unknown→playdeck.
- [ ] Test `buildDeckZip` with 2 real cards (1 Resource, 1 Site) + a back file → unzip (adm-zip) contains `playdeck/fronts/...png`, `locationdeck/fronts/...png`, `manifest.txt`; returned `counts`.
- [ ] Implement `backGroupForType`, `slug`, `buildDeckZip({deckName,cards,imagesRoot,backPaths})` returning `{buffer,counts,failures}` (collect archive to buffer; per-card try/catch → failures; append manifest).
- [ ] `vitest run` → PASS. Commit.

### Task 6: deckStore.js (CRUD)

**Files:** Create `src/deckStore.js`, `test/deckStore.test.js`

- [ ] Test in temp dir: create → get → list (count) → update → remove.
- [ ] Implement `createDeckStore(dir)` with `init/list/get/create/update/remove`, JSON files, `id='d_'+rand`, timestamps.
- [ ] `vitest run` → PASS. Commit.

### Task 7: server.js (Fastify wiring)

**Files:** Create `src/server.js`, `test/server.test.js`

- [ ] Test with `fastify.inject`: GET `/api/cards` → 200, body.cards length 1683, body.facets. Deck CRUD round-trip via inject.
- [ ] Implement: register @fastify/static (remastered-all @ `/images`, web/dist @ `/`), @fastify/multipart; routes `/api/cards`, `/api/decks` CRUD, `/api/backs` (save to data/backs), `/api/export` (buildDeckZip → send zip). Export `buildServer()` for tests + `start()` guarded by `import.meta.url` main check.
- [ ] `vitest run` → PASS. Commit.

### Task 8: Front lib (filter + deck) — testé

**Files:** Create `web/src/lib/filter.js`, `web/src/lib/deck.js`, `test/filter.test.js`, `test/deck.test.js`

- [ ] Test `filterCards`: by set, type, unique, search (en+fr name substring).
- [ ] Test `deckCounts`: total, byType, byGroup via local backGroupForType.
- [ ] Implement both. Note: `backGroupForType` map duplicated here (small/stable) vs src/exporter.js — documented.
- [ ] `vitest run` → PASS. Commit.

### Task 9: Vite scaffold + App shell + api.js

**Files:** Create `web/index.html`, `web/src/main.jsx`, `web/src/App.jsx`, `web/src/api.js`, `vite.config.js`

- [ ] `vite.config.js`: root `web`, plugin react, build.outDir `../web/dist` (relative → `web/dist`), dev proxy `/api`,`/images`,`/cards.json` → `http://localhost:3000`.
- [ ] `api.js`: `getCards`, `listDecks`, `getDeck`, `saveDeck`, `updateDeck`, `deleteDeck`, `uploadBack`, `exportDeck` (POST, blob download).
- [ ] `App.jsx`: layout B (FilterBar top, CardBrowser main, DeckDrawer bottom), holds state: `cards`, `facets`, `filters`, `selectedIds` (Set), `currentDeck`. Load cards on mount.
- [ ] `npm run dev` (Vite) + backend running → app loads, cards fetched. Manual verify. Commit.

### Task 10: FilterBar + CardBrowser

**Files:** Create `web/src/components/FilterBar.jsx`, `web/src/components/CardBrowser.jsx`

- [ ] FilterBar: multi-select chips/dropdowns for facets + search input; calls `onChange(filters)`.
- [ ] CardBrowser: `filterCards(cards, filters)` → grid of `<img loading="lazy" src="/images/${relativePath}">`; click toggles selection (visual highlight); shows count.
- [ ] Manual verify: filtering + selection works. Commit.

### Task 11: DeckDrawer (compteurs + warnings)

**Files:** Create `web/src/components/DeckDrawer.jsx`

- [ ] Bottom drawer: `deckCounts` display (total, byType, byGroup); warnings (deck vide, dos manquant); buttons Save / Manage / Export.
- [ ] Manual verify counters update live. Commit.

### Task 12: DeckManager + ExportDialog

**Files:** Create `web/src/components/DeckManager.jsx`, `web/src/components/ExportDialog.jsx`

- [ ] DeckManager modal: list saved decks (load/duplicate/rename/delete) via api; save current selection as named deck.
- [ ] ExportDialog modal: import back image per group (uploadBack), then `exportDeck` → download ZIP; progress/spinner; show failures from response.
- [ ] Manual verify: save deck, reload, export ZIP downloads. Commit.

### Task 13: Prod serve + README + E2E

**Files:** Modify `package.json`, Create `README.md`

- [ ] `"start"`: `vite build && node src/server.js`. Confirm Fastify serves `web/dist` at `/` and app works on `http://localhost:3000`.
- [ ] README: install, `npm start`, MPC upload note, image-quality caveat, MPC dims constant location.
- [ ] Manual E2E: filter → select → save → export → open ZIP, verify a front is 816×1110. Commit.

## Self-review notes
- Spec coverage: filtres (T10), decks multiples (T6/T12), export MPC + bleed + backs par groupe (T4/T5/T12), compteurs/warnings informatifs (T11), local un process (T7/T13). ✓
- `backGroupForType` défini T5 (backend) et dupliqué T8 (front) — noté, map minuscule et stable.
- Dimensions MPC centralisées T2, réutilisées T4 — cohérent.
