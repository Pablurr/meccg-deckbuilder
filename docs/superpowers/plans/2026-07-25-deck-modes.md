# Deck Modes (freeform vs assisted deckbuilding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two per-deck modes — freeform printing (no copy limits) and assisted deckbuilding (side + length + tournament, rule warnings, zones, notes) — plus ordered exports, deck-management niceties, a rules documentation page, and a fully trilingual EN/FR/ES UI.

**Architecture:** Declarative rule data (`web/src/lib/rules/`) consumed by a pure validator that emits translatable descriptors; zone state (`sideboard`/`pool`) lives beside `quantities` on the deck record; all UI (tabs, counters, warnings, docs page) renders from those pure modules. Exports share one ordering helper so PDF and text cannot disagree.

**Tech Stack:** React 18 + Vite, Vitest, pdf-lib, localStorage persistence. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-24-deck-modes-design.md` — read it before starting any phase.

## Global Constraints

- **Terminology:** the four camps are **sides** (`side` in code; UI: Camp / Side / Bando). The word **"faction" must never** denote a side in code, UI strings or warnings — it is a MECCG card category.
- **No hard blocking, ever.** No mode, severity or rule may prevent adding a card. Validation reports; the user decides.
- **No runtime rule fetching.** Rules are committed data. The app stays a static offline-capable SPA.
- **Stub-first rules:** rule *values* are stubs pending the user's sourcing; rule *ids, shape, statuses* are real. Unverified rules ship `defaultEnabled: false` and emit nothing.
- **Every new user-facing string** gets `en`, `fr` **and** `es` entries at introduction time (the `es` dictionary starts partial; missing keys fall back to `en` until Phase 8 completes it).
- **Backward compatibility:** a stored deck without `mode` loads as freeform; unknown side/length falls back to freeform; unknown `ruleOverrides` ids are ignored.
- **Tests:** `npm test` (Vitest) must pass at the end of every task. Existing ~59 tests must never regress.
- Node 24; run everything from the repo root. Dev server: `npm run dev:web` (Vite :5173).

## Model assignment (subagent-driven execution)

Least capable model that can do the job, per the Model Selection rules. **Turn count beats token price**: the cheapest tier is only used where the plan text already contains the complete code, making the work transcription plus verification. Reviewers have a mid-tier floor; the two highest-risk diffs and the final whole-branch review get the most capable model.

| Task | Implementer | Reviewer | Why |
|---|---|---|---|
| 1 Deck model & store | sonnet | sonnet | Multi-file, integrates into existing store |
| 2 Remove copy clamp | sonnet | sonnet | Touches 4 components; scope grew mid-flight |
| 3 es dictionary groundwork | sonnet | sonnet | Discovery-then-implement in an 11 KB file |
| 4 Setup dialog + App state | sonnet | sonnet | New component + wiring across 3 files |
| 5 zones.js | **haiku** | sonnet | Complete code in plan → transcription |
| 6 sides.js + formats.js | sonnet | sonnet | Data + one function, id verification needed |
| 7 banned.js | sonnet | sonnet | Iterative name-resolution against real data |
| 8 validate.js | sonnet | **opus** | Feature's central module; subtle rule logic |
| 9 Extract MiniCard | sonnet | *(controller)* | Pure verbatim move, verified from diff shape |
| 10 App zone state | sonnet | sonnet | State wiring + persistence |
| 11 Zone tabs + drop | sonnet | sonnet | Largest UI change of Phase 3 |
| 12 Browser counters + filter | sonnet | sonnet | Per-cell state, legality filter |
| 13 Rule warnings UI | sonnet | **opus** | 20 user-facing messages ×3 languages; the copy is an acceptance criterion |
| 14 Notes tab | sonnet | sonnet | Small component + wiring |
| 15 Deck list rename/reorder/badge | sonnet | sonnet | UI + store ordering |
| 16 deckSections.js | **haiku** | sonnet | Complete code + tests in plan → transcription |
| 17 Markdown sections + import | sonnet | **opus** | Parser state machine; round-trip fidelity and the notes-swallowing hazard |
| 18 Export dialog ordering | sonnet | sonnet | Integration across PDF/ZIP/text |
| 19 Documentation page | sonnet | sonnet | Large component, prose ×3 languages |
| 20 Complete es translation | sonnet | sonnet | Mechanical but large; parity test is the gate |
| 21 Terminology guard test | **haiku** | *(controller)* | One test, complete code in plan |
| 22 Final pass + README | sonnet | — | Smoke test and docs |
| **Final whole-branch review** | — | **opus** | Broad architectural judgement across 30+ commits |

Fix subagents inherit their task's implementer tier, except single-file mechanical fixes which drop to haiku. Where the table says *(controller)* the diff is small enough that the controller verifies it directly rather than paying for a dispatch — the reasoning is recorded in the progress ledger either way.

## File Structure (end state)

```
web/src/lib/rules/
  zones.js        # zonesFor(card) — which counters a card shows
  sides.js        # SIDES data: alignments, copies, pool, sites, specific-handling
  formats.js      # LENGTHS data: sideboard caps per game length
  banned.js       # banned name lists + resolveBanned(cards)
  validate.js     # RULES registry + validateDeck() → descriptors
web/src/lib/export/deckSections.js   # canonical export ordering
web/src/components/
  DeckSetupDialog.jsx   # mode / side / length / tournament chooser
  MiniCard.jsx          # extracted from DeckPanel
  DeckNotes.jsx         # four free-text areas
  RulesDoc.jsx          # documentation page (prose + generated tables + checkboxes)
test/
  deckModel.test.js     # normalizeDeck, store order/projection
  rules.test.js         # zones, sides, banned resolution, validateDeck
  deckSections.test.js  # export ordering + text round-trip
```

---

# Phase 1 — Deck model & modes

Deliverable: decks carry `mode`/`ruleset`/`zones`/`notes`/`order`; freeform has no copy caps; a setup dialog chooses the mode; everything persists and old decks still load.

### Task 1: Deck normalization + store fields

**Files:**
- Modify: `web/src/lib/constants.js` (add id lists)
- Modify: `web/src/lib/deck.js` (add `normalizeDeck`)
- Modify: `web/src/lib/deckStore.js` (persist new fields, `order` sort, richer `list()`)
- Test: `test/deckModel.test.js` (create)

**Interfaces:**
- Produces: `SIDE_IDS = ['wizard','ringwraith','fallen-wizard','balrog']`, `LENGTH_IDS = ['starter','standard','long','campaign']` (constants.js); `normalizeDeck(record) → { id, name, quantities, backAssignments, mode, ruleset|null, zones:{sideboard,pool}, notes:{starting,resourceStrategy,hazardStrategy,other}, order }` (deck.js); `deckStore.list()` rows gain `{ mode, side, order }`.

- [ ] **Step 1: Write the failing tests**

```js
// test/deckModel.test.js
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/deckModel.test.js`
Expected: FAIL — `normalizeDeck` is not exported; `side`/`mode` missing from list rows.

- [ ] **Step 3: Implement**

In `web/src/lib/constants.js` append:

```js
export const SIDE_IDS = ['wizard', 'ringwraith', 'fallen-wizard', 'balrog'];
export const LENGTH_IDS = ['starter', 'standard', 'long', 'campaign'];
```

In `web/src/lib/deck.js` add (import `SIDE_IDS`, `LENGTH_IDS` from `./constants.js`):

```js
export const EMPTY_NOTES = { starting: '', resourceStrategy: '', hazardStrategy: '', other: '' };

// Fill mode/ruleset/zones/notes with safe defaults. A record without `mode`
// (every pre-existing deck) reads as freeform; a deckbuilding record whose
// side or length is unknown falls back to freeform rather than throwing.
export function normalizeDeck(d = {}) {
  const zones = {
    sideboard: { ...((d.zones && d.zones.sideboard) || {}) },
    pool: { ...((d.zones && d.zones.pool) || {}) },
  };
  const notes = { ...EMPTY_NOTES, ...(d.notes || {}) };
  let mode = d.mode === 'deckbuilding' ? 'deckbuilding' : 'freeform';
  let ruleset = null;
  if (mode === 'deckbuilding') {
    const r = d.ruleset || {};
    if (SIDE_IDS.includes(r.side) && LENGTH_IDS.includes(r.length)) {
      ruleset = { side: r.side, length: r.length, tournament: !!r.tournament, ruleOverrides: { ...(r.ruleOverrides || {}) } };
    } else {
      mode = 'freeform';
    }
  }
  return { ...d, mode, ruleset, zones, notes, order: typeof d.order === 'number' ? d.order : null };
}
```

In `web/src/lib/deckStore.js`:
- In `create()`, accept and store the new fields:

```js
async create({ name, cardIds = [], quantities = {}, backAssignments = {}, mode, ruleset, zones, notes, order } = {}) {
  const now = new Date().toISOString();
  const deck = { id: newId(), name: name || 'Untitled', cardIds, quantities, backAssignments, mode, ruleset, zones, notes, order, createdAt: now, updatedAt: now };
  // ... unchanged writeAll ...
```

- Replace the `list()` sort/projection:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/deckModel.test.js` — Expected: PASS. Then `npm test` — no regressions.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/constants.js web/src/lib/deck.js web/src/lib/deckStore.js test/deckModel.test.js
git commit -m "feat: deck record gains mode/ruleset/zones/notes/order with safe normalization"
```

### Task 2: Remove the copy clamp (no hard blocking)

**Files:**
- Modify: `web/src/lib/deck.js:20-27` (`maxCopies`)
- Modify: `web/src/App.jsx:73-83` (`changeQty`), `web/src/App.jsx:104-113` (`importQuantities`)
- Test: `test/deckModel.test.js` (extend)

**Interfaces:**
- Produces: `maxCopies(card)` unchanged signature but **only used as validator reference data from Phase 2 on** — the UI no longer clamps with it.

- [ ] **Step 1: Write the failing test**

Append to `test/deckModel.test.js`:

```js
import { maxCopies } from '../web/src/lib/deck.js';

describe('copy limits are data, not clamps', () => {
  it('maxCopies still reports the classic limits (validator reference)', () => {
    expect(maxCopies({ type: 'Site', attributes: {} })).toBe(1);
    expect(maxCopies({ type: 'Resource', attributes: { unique: true } })).toBe(1);
    expect(maxCopies({ type: 'Resource', attributes: {} })).toBe(3);
    expect(maxCopies({ type: 'Character', attributes: { avatar: true } })).toBe(3);
  });
});
```

(The UI-side proof is manual: the `+` button must go past 3 / past 1.)

- [ ] **Step 2: Run test**

Run: `npx vitest run test/deckModel.test.js` — Expected: PASS immediately. **This is a characterization test, not a TDD RED step**: `maxCopies` keeps its current behaviour on purpose, and the test pins those values so Step 3's App change cannot quietly delete them. The behavioural change in this task is in `App.jsx` and is verified manually (the counter must pass the old caps) — there is no unit test for it because the clamp lived in a React event handler, not in a pure module.

- [ ] **Step 3: Unclamp the App**

In `web/src/App.jsx` replace `changeQty` (spec: *no hard blocking, ever* — both modes):

```js
// delta is +1 / -1; only the floor is clamped. Copy limits are reported by
// the deckbuilding validator, never enforced by the counter.
function changeQty(id, delta) {
  setQuantities((prev) => {
    const next = Math.max(0, (prev[id] || 0) + delta);
    const out = { ...prev };
    if (next <= 0) delete out[id];
    else out[id] = next;
    return out;
  });
}
```

In `importQuantities`, drop the `maxCopies` clamp: `clamped[id] = Math.max(1, count);` and remove the now-unused `maxCopies` import from App.jsx.

- [ ] **Step 4: Verify**

Run: `npm test` — PASS. Manual: `npm run dev:web`, add a Site 3× and a non-unique card 5× — counters must not stop at the old caps.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.jsx test/deckModel.test.js
git commit -m "feat: remove copy clamps from the UI - limits become validator data"
```

### Task 3: i18n groundwork — es dictionary with en fallback

**Files:**
- Modify: `web/src/lib/i18n.js`
- Test: existing i18n parity test (locate it in `test/` before editing)

- [ ] **Step 1: Read `web/src/lib/i18n.js`** to learn the exact dictionary shape and how `makeT(lang)` resolves keys, and find the existing fr/en key-parity test in `test/`.

- [ ] **Step 2: Add an `es` dictionary + fallback lookup**

Add an (initially small) `es` dictionary alongside `fr`/`en`, and make lookup fall back: resolve `dict[lang][key] ?? dict.en[key] ?? key`. Do **not** add es to the strict parity test yet (Phase 8 does); if the parity test enumerates languages, keep it scoped to `['fr','en']` for now.

- [ ] **Step 3: Verify** — `npm test` passes; dev server with `es` selected still renders (English chrome, Spanish card names).

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/i18n.js
git commit -m "feat: es UI dictionary with en fallback (to be completed in the trilingual phase)"
```

### Task 4: DeckSetupDialog + App mode state

**Files:**
- Create: `web/src/components/DeckSetupDialog.jsx`
- Modify: `web/src/App.jsx` (deck state carries the normalized record; `newDeck` opens the dialog), `web/src/components/DeckManager.jsx` (persist new fields), `web/src/lib/i18n.js` (keys), `web/src/styles.css`

**Interfaces:**
- Produces: `<DeckSetupDialog initial onConfirm({mode, ruleset}) onClose />`; App state `deck` now always holds a **normalized** record (`normalizeDeck` applied on load/new/import).

- [ ] **Step 1: Implement the dialog**

```jsx
// web/src/components/DeckSetupDialog.jsx
import React, { useState } from 'react';
import { useT } from '../i18n.jsx';
import { SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';

// Mode + (side, length, tournament) chooser, shown on deck creation and from
// deck settings. Emits a partial deck: { mode, ruleset }.
export default function DeckSetupDialog({ initial = {}, onConfirm, onClose }) {
  const t = useT();
  const [mode, setMode] = useState(initial.mode || 'freeform');
  const r = initial.ruleset || {};
  const [side, setSide] = useState(r.side || 'wizard');
  const [length, setLength] = useState(r.length || 'standard');
  const [tournament, setTournament] = useState(!!r.tournament);

  function confirm() {
    onConfirm(mode === 'deckbuilding'
      ? { mode, ruleset: { side, length, tournament, ruleOverrides: r.ruleOverrides || {} } }
      : { mode: 'freeform', ruleset: null });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('setup.title')}</h2>
        <div className="setup-modes">
          {['freeform', 'deckbuilding'].map((m) => (
            <label key={m} className={`setup-mode ${mode === m ? 'on' : ''}`}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              <b>{t(`setup.mode.${m}`)}</b>
              <span className="muted">{t(`setup.mode.${m}.hint`)}</span>
            </label>
          ))}
        </div>
        {mode === 'deckbuilding' && (
          <>
            <div className="row">
              <label>{t('setup.side')}
                <select value={side} onChange={(e) => setSide(e.target.value)}>
                  {SIDE_IDS.map((s) => <option key={s} value={s}>{t(`side.${s}`)}</option>)}
                </select>
              </label>
              <label>{t('setup.length')}
                <select value={length} onChange={(e) => setLength(e.target.value)}>
                  {LENGTH_IDS.map((l) => <option key={l} value={l}>{t(`length.${l}`)}</option>)}
                </select>
              </label>
            </div>
            <label className="row">
              <input type="checkbox" checked={tournament} onChange={(e) => setTournament(e.target.checked)} />
              {t('setup.tournament')}
            </label>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn" onClick={confirm}>{t('common.ok')}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire App**

In `web/src/App.jsx`: import `normalizeDeck` and the dialog; hold `deck` as a normalized record (`useState(() => normalizeDeck({ name: 'Nouveau deck' }))`); add `const [showSetup, setShowSetup] = useState(false)`. `newDeck()` now opens the setup dialog; its `onConfirm` resets state:

```js
function newDeck() { setShowSetup(true); setShowManager(false); }
function applySetup(partial) {
  setDeck((prev) => normalizeDeck({ ...prev, id: prev.id, ...partial }));
  setShowSetup(false);
}
```

For a brand-new deck (from DeckDrawer "New"): reset `quantities`/zones then open setup. `loadDeckIntoState(d)` applies `normalizeDeck(d)` and restores `zones` into state (zone state itself arrives in Phase 3; until then keep `deck.zones` on the record). Add a small "settings" button next to the deck name area (DeckDrawer or DeckManager) that opens `DeckSetupDialog` with `initial={deck}` to change mode/side later.

In `DeckManager.save()`, extend the payload:

```js
const payload = { name, cardIds, quantities, backAssignments: deck.backAssignments || {},
  mode: deck.mode, ruleset: deck.ruleset, zones: deck.zones, notes: deck.notes, order: deck.order };
```

(`deck` prop of DeckManager must now be the full normalized record — adjust the prop passed from App.)

- [ ] **Step 3: i18n keys** (add to `fr`, `en`, `es`)

| key | en | fr | es |
|---|---|---|---|
| setup.title | Deck mode | Mode du deck | Modo del mazo |
| setup.mode.freeform | Freeform printing | Impression libre | Impresión libre |
| setup.mode.freeform.hint | Any card, any count — no rules | Toutes cartes, sans limite — aucune règle | Cualquier carta, sin límite — sin reglas |
| setup.mode.deckbuilding | Deckbuilding | Construction de deck | Construcción de mazo |
| setup.mode.deckbuilding.hint | Assisted, rule warnings | Assistée, avertissements de règles | Asistida, avisos de reglas |
| setup.side | Side | Camp | Bando |
| setup.length | Game length | Longueur de partie | Duración de partida |
| setup.tournament | Tournament (strict severities) | Tournoi (sévérité stricte) | Torneo (severidad estricta) |
| side.wizard | Wizard | Sorcier | Mago |
| side.ringwraith | Ringwraith | Spectre de l'Anneau | Espectro del Anillo |
| side.fallen-wizard | Fallen-wizard | Sorcier déchu | Mago caído |
| side.balrog | Balrog | Balrog | Balrog |
| side.freeform | Freeform | Libre | Libre |
| length.starter | Starter | Starter | Starter |
| length.standard | Standard | Standard | Estándar |
| length.long | Long | Longue | Larga |
| length.campaign | Campaign | Campagne | Campaña |
| common.ok | OK | OK | OK |

(Check `common.cancel` exists; add if missing.)

- [ ] **Step 4: Verify** — `npm test` passes. Manual: New deck → dialog appears; pick Deckbuilding/Balrog/Long/Tournament → save via DeckManager → reload page → load deck → mode and ruleset survive (inspect `localStorage['meccg.decks.v1']`).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DeckSetupDialog.jsx web/src/App.jsx web/src/components/DeckManager.jsx web/src/lib/i18n.js web/src/styles.css
git commit -m "feat: deck setup dialog - per-deck mode, side, length, tournament"
```

**Phase 1 checkpoint:** `npm test` green; freeform decks uncapped; modes persist; legacy decks load untouched.

---

# Phase 2 — Rules engine (stub data + pure validator)

Deliverable: `web/src/lib/rules/` complete with stub values, statuses and sources; `validateDeck` fully tested. No UI yet.

### Task 5: zones.js

**Files:**
- Create: `web/src/lib/rules/zones.js`
- Test: `test/rules.test.js` (create)

**Interfaces:**
- Produces: `zonesFor(card) → { primary: 'deck'|'pool', extra: string[] }` — `'deck'` means the main deck (play vs location derives from type); `extra` lists counters revealed on expand, drawn from `'deck'|'sideboard'|'pool'`. `ZONE_IDS = ['deck','sideboard','pool']`.

- [ ] **Step 1: Failing tests**

```js
// test/rules.test.js
import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { zonesFor } from '../web/src/lib/rules/zones.js';

const { cards, index } = parseCards(raw);

describe('zonesFor', () => {
  it('never throws and always yields a primary over all cards', () => {
    for (const c of cards) {
      const z = zonesFor(c);
      expect(['deck', 'pool']).toContain(z.primary);
      expect(Array.isArray(z.extra)).toBe(true);
    }
  });
  it('sites and regions are location-only (single deck counter, no expander)', () => {
    const site = cards.find((c) => c.type === 'Site');
    const region = cards.find((c) => c.type === 'Region');
    expect(zonesFor(site)).toEqual({ primary: 'deck', extra: [] });
    expect(zonesFor(region)).toEqual({ primary: 'deck', extra: [] });
  });
  it('characters default to pool; resources/hazards default to deck', () => {
    const chr = cards.find((c) => c.type === 'Character');
    expect(zonesFor(chr)).toEqual({ primary: 'pool', extra: ['deck', 'sideboard'] });
    const hz = cards.find((c) => c.type === 'Hazard');
    expect(zonesFor(hz)).toEqual({ primary: 'deck', extra: ['sideboard'] });
  });
  it('starting minor items also offer the pool', () => {
    const item = cards.find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);
    expect(item).toBeTruthy();
    expect(zonesFor(item)).toEqual({ primary: 'deck', extra: ['sideboard', 'pool'] });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules.test.js` — FAIL (module missing).

- [ ] **Step 3: Implement**

```js
// web/src/lib/rules/zones.js
// Which zone counters a card exposes in deckbuilding mode.
// 'deck' = the main deck; play vs location derives from the card type
// (backGroupForType), so it is not a zone of its own here.
export const ZONE_IDS = ['deck', 'sideboard', 'pool'];

export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') return { primary: 'pool', extra: ['deck', 'sideboard'] };
  if (type === 'Resource' && a.playableAsStartingMinorItem === true) {
    return { primary: 'deck', extra: ['sideboard', 'pool'] };
  }
  return { primary: 'deck', extra: ['sideboard'] };
}
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat: zone eligibility per card type`.

### Task 6: sides.js + formats.js (stub values, real shape)

**Files:**
- Create: `web/src/lib/rules/sides.js`, `web/src/lib/rules/formats.js`
- Test: `test/rules.test.js` (extend)

**Interfaces:**
- Produces: `SIDES[sideId] = { id, avatarAlignment, alignments, copies:{default, byAlignment}, pool:{maxCharacters, maxMinorItems, mindCap, mindPerCharacter, forbidRaces, requireRaces}, playDeck:{min,max}|null, specificMode:null|'balrog-exempt'|'avatar-match' }`; `isLegalForSide(card, sideId)`; `LENGTHS[lengthId] = { sideboardMax, fwExtra: 10 }`.

- [ ] **Step 1: Failing tests** (append)

```js
import { SIDES, isLegalForSide } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';

describe('sides data', () => {
  it('exposes the four sides with alignments and copy limits', () => {
    expect(Object.keys(SIDES).sort()).toEqual(['balrog', 'fallen-wizard', 'ringwraith', 'wizard']);
    expect(SIDES['fallen-wizard'].copies.default).toBe(2);
    expect(SIDES['fallen-wizard'].copies.byAlignment.Stage).toBe(3);
    expect(SIDES.wizard.alignments).toContain('Neutral');
  });
  it('legality: hero card illegal for ringwraith, legal for wizard and fallen-wizard', () => {
    const hero = cards.find((c) => c.alignment === 'Hero' && c.type === 'Resource');
    expect(isLegalForSide(hero, 'ringwraith')).toBe(false);
    expect(isLegalForSide(hero, 'wizard')).toBe(true);
    expect(isLegalForSide(hero, 'fallen-wizard')).toBe(true);
  });
  it('avatars are legal for their own side only', () => {
    const gandalfTW = index.get('TW-156') || cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
    expect(isLegalForSide(gandalfTW, 'wizard')).toBe(true);
    expect(isLegalForSide(gandalfTW, 'balrog')).toBe(false);
  });
  it('sideboard caps follow the length', () => {
    expect(LENGTHS.starter.sideboardMax).toBe(30);
    expect(LENGTHS.standard.sideboardMax).toBe(30);
    expect(LENGTHS.long.sideboardMax).toBe(35);
    expect(LENGTHS.campaign.sideboardMax).toBe(40);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**

```js
// web/src/lib/rules/formats.js
// Game lengths → numeric thresholds. STUB values from the local rules KB
// (modes-de-jeu.md); to be confirmed against councilofelrond.org.
export const LENGTHS = {
  starter:  { id: 'starter',  sideboardMax: 30, fwExtra: 10 },
  standard: { id: 'standard', sideboardMax: 30, fwExtra: 10 },
  long:     { id: 'long',     sideboardMax: 35, fwExtra: 10 },
  campaign: { id: 'campaign', sideboardMax: 40, fwExtra: 10 },
};
```

```js
// web/src/lib/rules/sides.js
// Per-side deckbuilding profiles. STUB values seeded from the local rules KB;
// every numeric/list value is to be confirmed against councilofelrond.org.
// `specificMode` says how attributes.specific is read:
//   'balrog-exempt'  — specific:"Balrog" cards escape race/mind restrictions
//   'avatar-match'   — a card naming a fallen wizard is legal only in that wizard's deck
export const SIDES = {
  wizard: {
    id: 'wizard', avatarAlignment: 'Hero',
    alignments: ['Hero', 'Neutral'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 10, maxMinorItems: 2, mindCap: null, mindPerCharacter: null, forbidRaces: [], requireRaces: null },
    playDeck: { min: 25, max: 50 },
    specificMode: null,
  },
  ringwraith: {
    id: 'ringwraith', avatarAlignment: 'Minion',
    alignments: ['Minion', 'Neutral'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 6, maxMinorItems: 2, mindCap: 20, mindPerCharacter: null, forbidRaces: ['Ringwraith', 'Agent'], requireRaces: null },
    playDeck: null, // unverified
    specificMode: null,
  },
  'fallen-wizard': {
    id: 'fallen-wizard', avatarAlignment: 'Fallen-wizard',
    alignments: ['Hero', 'Minion', 'Neutral', 'Stage', 'Fallen-wizard'],
    copies: { default: 2, byAlignment: { Stage: 3 } },
    pool: { maxCharacters: 5, maxMinorItems: 2, mindCap: null, mindPerCharacter: 5, forbidRaces: [], requireRaces: null },
    playDeck: null, // unverified
    specificMode: 'avatar-match',
  },
  balrog: {
    id: 'balrog', avatarAlignment: 'Balrog',
    alignments: ['Minion', 'Neutral', 'Balrog'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 6, maxMinorItems: 2, mindCap: null, mindPerCharacter: 9, forbidRaces: [], requireRaces: ['Orc', 'Troll'] },
    playDeck: null, // unverified
    specificMode: 'balrog-exempt',
  },
};

// Browser-filter legality: is this card even playable in a deck of this side?
// Avatars: legal only when their alignment IS the side's avatar alignment.
// Balrog-specific and wizard-specific cards are handled by the validator with
// finer messages; here they stay visible (legal) so the filter never hides
// what a rule merely restricts per-avatar.
export function isLegalForSide(card, sideId) {
  const side = SIDES[sideId];
  if (!side || !card) return true;
  const a = card.attributes || {};
  if (a.avatar === true) return card.alignment === side.avatarAlignment;
  if (sideId === 'balrog' && a.specific === 'Balrog') return true;
  return side.alignments.includes(card.alignment);
}
```

- [ ] **Step 4: Run** — PASS (adjust the `TW-156` fallback if that id isn't Gandalf; the `cards.find` fallback covers it). **Step 5: Commit** `feat: per-side rule profiles and length thresholds (stub values)`.

### Task 7: banned.js + name resolution

**Files:**
- Create: `web/src/lib/rules/banned.js`
- Test: `test/rules.test.js` (extend)

**Interfaces:**
- Produces: `BANNED = { 'fallen-wizard': {status, source, names[]}, balrog: {...} }`; `resolveBanned(cards) → { bySide: { [sideId]: Set<cardId> }, unresolved: [{side, name}] }`.

- [ ] **Step 1: Failing test**

```js
import { BANNED, resolveBanned } from '../web/src/lib/rules/banned.js';

describe('banned lists', () => {
  it('every banned name resolves to at least one real card', () => {
    const { unresolved, bySide } = resolveBanned(cards);
    expect(unresolved).toEqual([]); // a typo must fail loudly, with the name in the diff
    expect(bySide['fallen-wizard'].size).toBeGreaterThan(0);
    expect(bySide.balrog.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```js
// web/src/lib/rules/banned.js
// STUB lists seeded from the local KB (wh-the-white-hand.md, ba-the-balrog.md);
// names to be re-verified against councilofelrond.org. Matching is by name.en,
// accent/case-insensitive.
export const BANNED = {
  'fallen-wizard': {
    status: 'unverified',
    source: 'https://councilofelrond.org/',
    names: [
      'Bade to Rule', 'Cracks of Doom', 'Favor of the Valar', "Gollum's Fate", 'Hour of Need',
      'Kill All But NOT the Halflings', 'The Lidless Eye', 'The Sun Unveiled',
      'Glamour of Surpassing Excellence', 'Messenger of Mordor', 'News Must Get Through',
      'News of the Shire', 'Old Road', 'The Windlord Found Me', 'Wizard Uncloaked', 'Use Your Legs',
    ],
  },
  balrog: {
    status: 'unverified',
    source: 'https://councilofelrond.org/',
    names: [
      'Above the Abyss', 'Bade to Rule', 'The Black Council', 'Black Horse', 'Black Rider',
      "By the Ringwraith's Word", 'Creature of an Older World', "Durin's Bane", 'The Fiery Blade',
      'Helm of Fear', 'Heralded Lord', 'Kill All But NOT the Halflings', 'The Lidless Eye',
      'Morgul-blade', 'News of the Shire', 'Open to the Summons', 'Orders From Lugbúrz',
      'Padding Feet', 'The Ring Leaves its Mark', 'Sauron', 'They Ride Together',
      'Use Your Legs', 'While the Yellow Face Sleeps',
    ],
  },
};

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function resolveBanned(cards) {
  const byName = new Map();
  for (const c of cards) {
    const k = fold(c.name && c.name.en);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(c.id);
  }
  const bySide = {};
  const unresolved = [];
  for (const [side, entry] of Object.entries(BANNED)) {
    bySide[side] = new Set();
    for (const name of entry.names) {
      const ids = byName.get(fold(name));
      if (!ids) unresolved.push({ side, name });
      else for (const id of ids) bySide[side].add(id);
    }
  }
  return { bySide, unresolved };
}
```

- [ ] **Step 3: Run** `npx vitest run test/rules.test.js`. If `unresolved` is non-empty, the assertion diff lists the exact offending names: fix their spelling against `cards.json` (search `name.en` values with a quick `node -e` grep) or drop the name with a `// not found in remastered set` comment. Iterate until PASS. *(Two names from the KB were pre-emptively dropped: "The Balrog (Ally)" — parenthetical disambiguation is not a card name — and the Balrog list's blanket "cartes Ringwraith", which is the ALIGN/avatar rule, not a ban entry.)*

- [ ] **Step 4: Commit** `feat: banned lists with loud name resolution (stub values)`.

### Task 8: validate.js — registry + checks

**Files:**
- Create: `web/src/lib/rules/validate.js`
- Test: `test/rules.test.js` (extend)

**Interfaces:**
- Produces: `RULES: [{id, severity, status, source, defaultEnabled}]`; `isRuleEnabled(ruleId, ruleOverrides)`; `validateDeck({ side, length, tournament, ruleOverrides, quantities, zones, cardsById }) → [{ ruleId, code, severity, params }]`. Consumes `SIDES`/`LENGTHS`/`resolveBanned`/`zonesFor`/`backGroupForType`/`maxCopies`.

- [ ] **Step 1: Failing tests** (append; build tiny synthetic decks from real cards)

```js
import { RULES, validateDeck, isRuleEnabled } from '../web/src/lib/rules/validate.js';

const byId = (list, ruleId) => list.filter((w) => w.ruleId === ruleId);
const cardsById = index;
function firstWhere(pred) { const c = cards.find(pred); expect(c).toBeTruthy(); return c; }

describe('validateDeck', () => {
  const wizardAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Hero');
  const base = { side: 'wizard', length: 'standard', tournament: true, ruleOverrides: {}, zones: { sideboard: {}, pool: {} }, cardsById };

  it('flags a missing avatar as a warning, never an error', () => {
    const out = validateDeck({ ...base, quantities: {} });
    expect(byId(out, 'AVATAR-PRESENT')).toHaveLength(1);
    expect(byId(out, 'AVATAR-PRESENT')[0].severity).toBe('warning');
  });
  it('flags illegal alignment for the side', () => {
    const minionRes = firstWhere((c) => c.alignment === 'Minion' && c.type === 'Resource');
    const out = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 1, [minionRes.id]: 1 } });
    expect(byId(out, 'ALIGN-LEGAL')).toHaveLength(1);
    expect(byId(out, 'ALIGN-LEGAL')[0].params.name).toBeTruthy();
  });
  it('fallen-wizard: 2 copies max but 3 for Stage resources', () => {
    const fwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard');
    const stage = firstWhere((c) => c.alignment === 'Stage' && !c.attributes.unique);
    const hero = firstWhere((c) => c.alignment === 'Hero' && c.type === 'Resource' && !c.attributes.unique);
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [fwAvatar.id]: 1, [hero.id]: 3, [stage.id]: 3 } });
    const copies = byId(out, 'COPIES-LIMIT');
    expect(copies.some((w) => w.params.id === hero.id)).toBe(true);   // 3 > 2
    expect(copies.some((w) => w.params.id === stage.id)).toBe(false); // 3 <= 3
  });
  it('counts copies across deck + sideboard + pool', () => {
    const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique && c.alignment === 'Neutral');
    const out = validateDeck({ ...base, quantities: { [hz.id]: 3 }, zones: { sideboard: { [hz.id]: 1 }, pool: {} } });
    expect(byId(out, 'COPIES-LIMIT').some((w) => w.params.id === hz.id)).toBe(true);
  });
  it('banned cards are errors; wizard-specific cards must match the avatar', () => {
    const gandalfSpecific = firstWhere((c) => c.attributes.specific === 'Gandalf');
    const saruman = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard' && (c.name.en || '').includes('Saruman'));
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [saruman.id]: 1, [gandalfSpecific.id]: 1 } });
    expect(byId(out, 'SPECIFIC-AVATAR')).toHaveLength(1);
  });
  it('sideboard size follows the length', () => {
    const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique);
    const out = validateDeck({ ...base, length: 'long', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: { [hz.id]: 36 }, pool: {} } });
    expect(byId(out, 'SIDEBOARD-MAX')).toHaveLength(1);
    expect(byId(out, 'SIDEBOARD-MAX')[0].params.max).toBe(35);
  });
  it('casual downgrades severities one notch and never below info', () => {
    const minionRes = firstWhere((c) => c.alignment === 'Minion' && c.type === 'Resource');
    const strict = validateDeck({ ...base, quantities: { [minionRes.id]: 1 } });
    const casual = validateDeck({ ...base, tournament: false, quantities: { [minionRes.id]: 1 } });
    expect(byId(strict, 'ALIGN-LEGAL')[0].severity).toBe('error');
    expect(byId(casual, 'ALIGN-LEGAL')[0].severity).toBe('warning');
  });
  it('disabled and unverified rules emit nothing; overrides can enable them', () => {
    const unverified = RULES.find((r) => r.status === 'unverified');
    expect(unverified.defaultEnabled).toBe(false);
    expect(isRuleEnabled(unverified.id, {})).toBe(false);
    expect(isRuleEnabled(unverified.id, { [unverified.id]: true })).toBe(true);
    expect(isRuleEnabled('ALIGN-LEGAL', { 'ALIGN-LEGAL': false })).toBe(false);
    expect(isRuleEnabled('NO-SUCH-RULE', { 'NO-SUCH-RULE': true })).toBe(false); // unknown ids ignored
  });
  it('every rule has unique id and required metadata', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['verified', 'unverified', 'disputed']).toContain(r.status);
      expect(typeof r.source).toBe('string');
      expect(r.defaultEnabled).toBe(r.status === 'verified');
    }
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**

```js
// web/src/lib/rules/validate.js
// Pure deck validator. Emits translatable descriptors, never sentences.
// A rule that is disabled (per-deck override, or unverified by default)
// is not evaluated at all.
import { SIDES } from './sides.js';
import { LENGTHS } from './formats.js';
import { resolveBanned } from './banned.js';
import { backGroupForType } from '../deck.js';

const SRC = 'https://councilofelrond.org/'; // stub source; refined per rule during sourcing

export const RULES = [
  { id: 'AVATAR-PRESENT',  severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'AVATAR-UNIQUE',   severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'AVATAR-SIDE',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'ALIGN-LEGAL',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'BANNED',          severity: 'error',   status: 'unverified', source: SRC },
  { id: 'COPIES-LIMIT',    severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'UNIQUE-LIMIT',    severity: 'error',   status: 'unverified', source: SRC },
  { id: 'SITE-COPIES',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'SPECIFIC-AVATAR', severity: 'error',   status: 'verified',   source: SRC },
  { id: 'BALROG-RACE',     severity: 'error',   status: 'unverified', source: SRC },
  { id: 'BALROG-MIND',     severity: 'error',   status: 'unverified', source: SRC },
  { id: 'DECKSIZE-PLAY',   severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'DECKSIZE-LOCATION', severity: 'warning', status: 'unverified', source: SRC },
  { id: 'SIDEBOARD-MAX',   severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'POOL-CHARS',      severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'POOL-MIND',       severity: 'warning', status: 'unverified', source: SRC },
  { id: 'POOL-ITEMS',      severity: 'warning', status: 'unverified', source: SRC },
  { id: 'POOL-ELIGIBLE',   severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
].map((r) => ({ ...r, defaultEnabled: r.status === 'verified' }));

const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

export function isRuleEnabled(ruleId, ruleOverrides = {}) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return false; // unknown / retired ids are ignored
  return ruleOverrides[ruleId] ?? rule.defaultEnabled;
}

const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

// resolveBanned walks all 1683 cards; validateDeck runs on every deck edit, so
// cache the resolution against the card index identity (a Map built once in App).
let _banned = { key: null, value: null };
function bannedFor(cardsById, side) {
  if (_banned.key !== cardsById) _banned = { key: cardsById, value: resolveBanned([...cardsById.values()]) };
  return _banned.value.bySide[side] || new Set();
}

export function validateDeck({ side, length, tournament, ruleOverrides = {}, quantities = {}, zones = {}, cardsById }) {
  const profile = SIDES[side];
  if (!profile) return [];
  const caps = LENGTHS[length] || LENGTHS.standard;
  const sb = zones.sideboard || {};
  const pool = zones.pool || {};
  const out = [];
  const emit = (ruleId, params = {}) => {
    if (!isRuleEnabled(ruleId, ruleOverrides)) return;
    let severity = RULE_BY_ID.get(ruleId).severity;
    if (!tournament) severity = severity === 'error' ? 'warning' : 'info'; // casual: one notch down
    out.push({ ruleId, code: ruleId, severity, params });
  };

  // Total copies per card across every zone; missing cards are skipped.
  const totals = new Map();
  for (const zoneMap of [quantities, sb, pool]) {
    for (const [id, n] of Object.entries(zoneMap)) {
      if (!cardsById.get(id)) continue;
      totals.set(id, (totals.get(id) || 0) + n);
    }
  }
  const entries = [...totals.entries()].map(([id, count]) => ({ id, count, card: cardsById.get(id) }));
  const name = (c) => (c.name && (c.name.en || Object.values(c.name)[0])) || c.id;

  // --- avatar ---
  const avatars = entries.filter((e) => e.card.attributes.avatar === true);
  if (avatars.length === 0) emit('AVATAR-PRESENT', { side });
  const avatarCount = avatars.reduce((s, e) => s + e.count, 0);
  if (avatars.length > 1) emit('AVATAR-UNIQUE', { count: avatarCount, names: avatars.map((e) => name(e.card)).join(', ') });
  for (const e of avatars) {
    if (e.card.alignment !== profile.avatarAlignment) emit('AVATAR-SIDE', { name: name(e.card), side });
  }
  const avatarName = avatars.length === 1 ? name(avatars[0].card) : null;

  // --- per-card checks ---
  const bannedSet = bannedFor(cardsById, side);
  for (const e of entries) {
    const c = e.card; const a = c.attributes || {};
    const balrogExempt = profile.specificMode === 'balrog-exempt' && a.specific === 'Balrog';

    if (bannedSet.has(e.id)) emit('BANNED', { id: e.id, name: name(c), side });

    if (!a.avatar && !balrogExempt && !profile.alignments.includes(c.alignment)) {
      emit('ALIGN-LEGAL', { id: e.id, name: name(c), alignment: c.alignment, side });
    }

    if (profile.specificMode === 'avatar-match' && a.specific && a.specific !== 'Balrog' && avatarName && !avatarName.includes(a.specific)) {
      emit('SPECIFIC-AVATAR', { id: e.id, name: name(c), wizard: a.specific, avatar: avatarName });
    }

    if (c.type === 'Site') {
      // 1 copy per site; the side's unlimited havens are exempt (stub: haven attr + legal alignment)
      const unlimited = a.haven === true && profile.alignments.concat(profile.avatarAlignment).includes(c.alignment);
      if (e.count > 1 && !unlimited) emit('SITE-COPIES', { id: e.id, name: name(c), count: e.count });
    } else if (!a.avatar) {
      const limit = profile.copies.byAlignment[c.alignment] ?? profile.copies.default;
      if (!a.unique && e.count > limit) emit('COPIES-LIMIT', { id: e.id, name: name(c), count: e.count, limit, excess: e.count - limit, side });
      if (a.unique && e.count > 1) emit('UNIQUE-LIMIT', { id: e.id, name: name(c), count: e.count });
    }

    if (side === 'balrog' && c.type === 'Character' && !a.avatar && !balrogExempt) {
      const race = String(a.race || '');
      if (profile.pool.requireRaces && !profile.pool.requireRaces.some((r) => race.includes(r))) {
        emit('BALROG-RACE', { id: e.id, name: name(c), race });
      }
      const mind = toInt(a.mind);
      if (mind != null && profile.pool.mindPerCharacter != null && mind >= profile.pool.mindPerCharacter) {
        emit('BALROG-MIND', { id: e.id, name: name(c), mind, limit: profile.pool.mindPerCharacter });
      }
    }
  }

  // --- deck sizes ---
  let playCount = 0, locationCount = 0;
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    if (backGroupForType(c.type) === 'locationdeck') locationCount += n; else playCount += n;
  }
  if (profile.playDeck && (playCount < profile.playDeck.min || playCount > profile.playDeck.max)) {
    emit('DECKSIZE-PLAY', { count: playCount, min: profile.playDeck.min, max: profile.playDeck.max, side });
  }
  if (locationCount === 0 && playCount > 0) emit('DECKSIZE-LOCATION', { count: locationCount, min: 1 });

  // --- sideboard ---
  const sbCount = Object.entries(sb).reduce((s, [id, n]) => s + (cardsById.get(id) ? n : 0), 0);
  if (sbCount > caps.sideboardMax) emit('SIDEBOARD-MAX', { count: sbCount, max: caps.sideboardMax, length });

  // --- pool ---
  let poolChars = 0, poolItems = 0, poolMind = 0;
  for (const [id, n] of Object.entries(pool)) {
    const c = cardsById.get(id); if (!c) continue;
    const a = c.attributes || {};
    if (c.type === 'Character') {
      poolChars += n; poolMind += (toInt(a.mind) || 0) * n;
      if (profile.pool.forbidRaces.some((r) => String(a.race || '').includes(r))) {
        emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'race' });
      }
      if (profile.pool.mindPerCharacter != null && (toInt(a.mind) || 0) > profile.pool.mindPerCharacter) {
        emit('POOL-MIND', { id, name: name(c), mind: toInt(a.mind), limit: profile.pool.mindPerCharacter });
      }
    } else if (c.type === 'Resource' && a.playableAsStartingMinorItem === true) {
      poolItems += n;
    } else {
      emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'type' });
    }
  }
  if (poolChars > profile.pool.maxCharacters) emit('POOL-CHARS', { count: poolChars, max: profile.pool.maxCharacters, side });
  if (profile.pool.mindCap != null && poolMind > profile.pool.mindCap) emit('POOL-MIND', { total: poolMind, max: profile.pool.mindCap });
  if (poolItems > profile.pool.maxMinorItems) emit('POOL-ITEMS', { count: poolItems, max: profile.pool.maxMinorItems, side });

  const rank = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
```

Note: `BANNED` is `unverified` (lists unsourced) so the banned test in Task 7 checks *resolution*, while the validator test for BANNED must enable it via override — adjust the test accordingly: `ruleOverrides: { BANNED: true }`. The `SPECIFIC-AVATAR` test stays as written (rule is `verified` — the data attribute itself is exact). Remove the stray `emitLocation:` label if the linter complains; a plain `if` is fine.

- [ ] **Step 4: Run** `npx vitest run test/rules.test.js` — PASS (iterate on details; keep test intent intact). Then `npm test`.

- [ ] **Step 5: Commit** `feat: pure deck validator with per-rule enablement and casual downgrade`.

**Phase 2 checkpoint:** rules lib complete and green under Vitest; zero UI impact.

---

# Phase 3 — Zone UI (tabs, counters, drag & drop, legality filter)

Deliverable: deckbuilding decks get zone counters in the browser (A2 layout), zone tabs in the deck panel with drop-on-tab moves, and a default-on legality filter.

### Task 9: Extract MiniCard

**Files:**
- Create: `web/src/components/MiniCard.jsx`
- Modify: `web/src/components/DeckPanel.jsx`

- [ ] **Step 1:** Read `DeckPanel.jsx`; move the internal `MiniCard` component verbatim into `web/src/components/MiniCard.jsx` (default export, same props: `card, qty, lang, thumbW, onChangeQty, onToggle, trackPointer, hidePreview, isMobile, onPreview, proxyMode`), import it back into DeckPanel. **No behavior change.**
- [ ] **Step 2:** `npm test` + manual: deck panel renders identically (thumbnails, qty controls, remove-confirm).
- [ ] **Step 3:** Commit `refactor: extract MiniCard from DeckPanel (no behavior change)`.

### Task 10: App zone state + zone-aware changeQty

**Files:**
- Modify: `web/src/App.jsx`

**Interfaces:**
- Produces: App state `zones` (`{sideboard:{}, pool:{}}`), `changeZoneQty(zone, id, delta)` where `zone ∈ 'deck'|'sideboard'|'pool'` ('deck' routes to `quantities`), `moveCopy(id, fromZone, toZone)`; both passed down to CardBrowser/DeckPanel. Save/load/import round-trips `zones` via the deck record.

- [ ] **Step 1: Implement**

```js
const [zones, setZones] = useState({ sideboard: {}, pool: {} });

function bump(map, id, delta) {
  const next = Math.max(0, (map[id] || 0) + delta);
  const out = { ...map };
  if (next <= 0) delete out[id]; else out[id] = next;
  return out;
}
function changeZoneQty(zone, id, delta) {
  if (zone === 'deck') return changeQty(id, delta);
  setZones((prev) => ({ ...prev, [zone]: bump(prev[zone], id, delta) }));
}
function moveCopy(id, fromZone, toZone) {
  if (fromZone === toZone) return;
  changeZoneQty(fromZone, id, -1);
  changeZoneQty(toZone, id, +1);
}
```

`loadDeckIntoState` sets `setZones(normalizeDeck(d).zones)`; `newDeck`/`applySetup` reset zones; DeckManager save payload uses `zones` state (thread it as a prop). The `hasSelection` and `deckEmpty` checks must consider zones too: `const deckEmpty = Object.keys(quantities).length === 0 && Object.keys(zones.sideboard).length === 0 && Object.keys(zones.pool).length === 0;`

- [ ] **Step 2:** `npm test`; manual: nothing visible yet, but saving a deck stores `zones` (inspect localStorage).
- [ ] **Step 3:** Commit `feat: zone state (sideboard/pool) wired through App and persistence`.

### Task 11: DeckPanel zone tabs + Notes placeholder + drop targets

**Files:**
- Modify: `web/src/components/DeckPanel.jsx`, `web/src/components/MiniCard.jsx`, `web/src/styles.css`, `web/src/lib/i18n.js`

**Interfaces:**
- Consumes: `zones`, `changeZoneQty`, `moveCopy`, `deck.mode`, `deck.ruleset`; `LENGTHS` for the sideboard cap; `zonesFor` for drop legality.
- Produces: tab bar order **Play deck / Pool / Sideboard / Location / Notes** (deckbuilding) or **Cards / Notes** (freeform). Notes tab content arrives in Task 15 — until then it renders the four labels with disabled textareas.

- [ ] **Step 1: Implement tabs**

DeckPanel gains `const [tab, setTab] = useState('play')`. Deckbuilding tabs (order fixed by spec): `play`, `pool`, `sideboard`, `location`, `notes`. Freeform: `cards`, `notes`. Content per tab:

- `play`: entries of `quantities` whose `backGroupForType(type) === 'playdeck'`, grouped by type as today; counters edit `quantities`.
- `location`: entries of `quantities` with `locationdeck` group.
- `pool` / `sideboard`: entries of `zones[tab]`; counters call `changeZoneQty(tab, id, ±1)`.
- `cards` (freeform): the current single list, unchanged.

Tab header shows `count` and, where a cap exists, `count / cap` with a `.over` class when exceeded:

```jsx
const sbMax = deck.ruleset ? LENGTHS[deck.ruleset.length].sideboardMax : null;
const poolMax = deck.ruleset ? SIDES[deck.ruleset.side].pool.maxCharacters : null;
// tab label example:
<button className={`ztab ${tab === 'sideboard' ? 'on' : ''} ${sbMax != null && sbCount > sbMax ? 'over' : ''}`}
        onClick={() => setTab('sideboard')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDropOnTab(e, 'sideboard')}>
  {t('zones.sideboard')} <span className="cnt">{sbMax != null ? `${sbCount} / ${sbMax}` : sbCount}</span>
</button>
```

CSS: `.ztab{...} .ztab.on{font-weight:700;border-color:currentColor} .ztab .cnt{opacity:.65} .ztab.over .cnt{color:var(--danger);font-weight:700}`.

- [ ] **Step 2: Drag & drop (desktop)**

In `MiniCard`, add `draggable` + `onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: card.id, from: zone }))}` (new `zone` prop: which zone this instance renders in; `'deck'` for play/location/cards tabs). In DeckPanel:

```js
function onDropOnTab(e, toZone) {
  e.preventDefault();
  let payload; try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
  const card = cardsById.get(payload.id); if (!card) return;
  const z = zonesFor(card);
  const allowed = new Set([z.primary, ...z.extra, 'deck']);
  const target = toZone === 'play' || toZone === 'location' ? 'deck' : toZone;
  if (!allowed.has(target)) return; // e.g. a Site dropped on Pool: ignored
  moveCopy(payload.id, payload.from, target);
}
```

- [ ] **Step 3: i18n keys** — `zones.play` (Play deck / Talon / Mazo de juego), `zones.pool` (Pool / Pool / Reserva), `zones.sideboard` (Sideboard / Réserve / Sideboard), `zones.location` (Location / Sites / Localizaciones), `zones.notes` (Notes / Notes / Notas), `zones.cards` (Cards / Cartes / Cartas).

- [ ] **Step 4: Verify** — manual on `npm run dev:web`: create a deckbuilding deck, add cards, switch tabs, drag a character thumbnail onto Sideboard tab (moves one copy), drag a Site onto Pool (nothing happens), sideboard over cap turns red. Freeform deck shows Cards/Notes only. Mobile sheet (`asSheet`) renders the same tab bar.

- [ ] **Step 5: Commit** `feat: zone tabs with counts, caps and drop-on-tab moves in the deck panel`.

### Task 12: CardBrowser zone counters (A2) + legality filter

**Files:**
- Modify: `web/src/components/CardBrowser.jsx`, `web/src/styles.css`, `web/src/lib/i18n.js`

**Interfaces:**
- Consumes: `deckMode`, `side`, `zones`, `changeZoneQty`, `zonesFor`, `isLegalForSide`.
- Produces: per-thumbnail counters — freeform: today's single counter; deckbuilding: primary-zone counter always visible + expander bar revealing the extra zones (A2 from the spec). A `showAll` toggle for the legality filter; illegal-but-shown cards get an `.illegal` marker class.

- [ ] **Step 1: Implement counters**

In the card cell, replace the single `.qty-ctrl` block when `deckMode === 'deckbuilding'`:

```jsx
const z = zonesFor(card);
const zoneQty = (zone) => zone === 'deck' ? (quantities[card.id] || 0) : (zones[zone][card.id] || 0);
const [expanded, setExpanded] = useState(false); // per-cell, in a small ZoneCtrls subcomponent

// always-visible primary counter (labelled)
<div className="qty-ctrl zoned">
  <span className="zlbl">{t(`zoneShort.${z.primary}`)}</span>
  <button className="qty-btn" onClick={() => changeZoneQty(z.primary, card.id, -1)}>−</button>
  <span className="qty-count">{zoneQty(z.primary)}</span>
  <button className="qty-btn" onClick={() => changeZoneQty(z.primary, card.id, +1)}>+</button>
</div>
{z.extra.length > 0 && !expanded && (
  <button className="zone-expander" onClick={() => setExpanded(true)}>
    {z.extra.map((zn) => `${t(`zoneShort.${zn}`)} ${zoneQty(zn)}`).join(' · ')} ⌃
  </button>
)}
{expanded && z.extra.map((zn) => (
  <div key={zn} className="qty-ctrl zoned muted">
    <span className="zlbl">{t(`zoneShort.${zn}`)}</span>
    <button className="qty-btn" onClick={() => changeZoneQty(zn, card.id, -1)}>−</button>
    <span className="qty-count">{zoneQty(zn)}</span>
    <button className="qty-btn" onClick={() => changeZoneQty(zn, card.id, +1)}>+</button>
  </div>
))}
```

Extract this cluster as an inner `ZoneCtrls` component so the `expanded` state is per cell. i18n: `zoneShort.deck` = Deck/Deck/Mazo, `zoneShort.sideboard` = SB/Rés/SB, `zoneShort.pool` = Pool/Pool/Res.

- [ ] **Step 2: Legality filter**

Props: `side` (null in freeform). At the top of the browser (near the existing select-all control):

```jsx
{side && (
  <label className="legality-toggle">
    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
    {t('browser.showAll')}
  </label>
)}
```

Filtering: `const visible = side && !showAll ? filtered.filter((c) => isLegalForSide(c, side)) : filtered;` and when `showAll`, add `className={isLegalForSide(c, side) ? '' : 'illegal'}` on the cell (`.illegal img { filter: grayscale(.6); } .illegal::after { content: '⚠'; position: absolute; top: 4px; right: 4px; }`). i18n: `browser.showAll` = Show illegal cards / Afficher les cartes illégales / Mostrar cartas ilegales.

- [ ] **Step 3: Verify** — manual: Balrog deck → browser lists only Minion/Neutral/Balrog(+specific) cards; toggle shows the rest greyed with ⚠, still addable. Characters show a Pool counter first; a starting minor item expands to SB + Pool; sites keep one plain counter. Freeform deck: browser identical to before.

- [ ] **Step 4: Commit** `feat: A2 zone counters and default-on legality filter in the card browser`.

**Phase 3 checkpoint:** full zone workflow usable end-to-end; `npm test` green; freeform visually unchanged.

---

# Phase 4 — Warnings UI

Deliverable: live validation rendered in the deck panel, message quality bar met, per-warning "ignore rule" and "report" actions.

### Task 13: Wire validateDeck into App + render warnings

**Files:**
- Modify: `web/src/App.jsx`, `web/src/components/DeckPanel.jsx`, `web/src/styles.css`

**Interfaces:**
- Produces: App computes `ruleWarnings = deck.mode === 'deckbuilding' && deck.ruleset ? validateDeck({ ...deck.ruleset, quantities, zones, cardsById }) : []` (memoized with `useMemo` on `[deck.ruleset, quantities, zones, cardsById]`) and passes it to DeckPanel with `onToggleRule(ruleId, enabled)`.

- [ ] **Step 1: App side**

```js
const ruleWarnings = useMemo(() => (
  deck.mode === 'deckbuilding' && deck.ruleset
    ? validateDeck({ side: deck.ruleset.side, length: deck.ruleset.length, tournament: deck.ruleset.tournament,
                     ruleOverrides: deck.ruleset.ruleOverrides, quantities, zones, cardsById })
    : []
), [deck.mode, deck.ruleset, quantities, zones, cardsById]);

function onToggleRule(ruleId, enabled) {
  setDeck((prev) => prev.ruleset ? { ...prev, ruleset: { ...prev.ruleset, ruleOverrides: { ...prev.ruleset.ruleOverrides, [ruleId]: enabled } } } : prev);
}
```

- [ ] **Step 2: DeckPanel rendering**

Above the tab content (visible on every tab), render grouped warnings:

```jsx
{ruleWarnings.length > 0 && (
  <div className="rule-warns">
    {ruleWarnings.map((w, i) => (
      <div key={i} className={`rule-warn ${w.severity}`}>
        <span className="msg">{t(`rules.${w.code}`, w.params)}</span>
        <span className="rule-meta">
          <code>{w.ruleId}</code>
          <button className="linklike" onClick={() => onToggleRule(w.ruleId, false)}>{t('rules.disable')}</button>
          <a className="linklike" href={reportUrl(w)} target="_blank" rel="noreferrer">{t('rules.report')}</a>
        </span>
      </div>
    ))}
  </div>
)}
```

CSS: `.rule-warn.error{border-left:3px solid var(--danger)} .rule-warn.warning{border-left:3px solid orange} .rule-warn.info{border-left:3px solid var(--muted,gray)}`.

`reportUrl(w)`: run `git remote get-url origin` once during implementation, derive `https://github.com/<owner>/<repo>/issues/new`, store as `REPORT_ISSUES_URL` in `web/src/lib/constants.js`, and build `?title=[rule] ${w.ruleId}&body=${encodeURIComponent(JSON.stringify(w.params))}`.

- [ ] **Step 3: Rule message strings** — add to `fr`, `en`, `es`. Every message names the cards, the rule threshold, and the action (spec quality bar):

| key | en |
|---|---|
| rules.AVATAR-PRESENT | No avatar yet — add your {side} avatar to the deck. |
| rules.AVATAR-UNIQUE | {count} avatar cards ({names}) — a deck plays exactly one avatar. Remove the extras. |
| rules.AVATAR-SIDE | {name} is not a {side} avatar. Replace it or change the deck's side. |
| rules.ALIGN-LEGAL | {name} ({alignment}) is not playable in a {side} deck. Remove it, or keep it knowingly. |
| rules.BANNED | {name} is banned for {side}. Remove it. |
| rules.COPIES-LIMIT | Too many copies — {name} ×{count}. {side} allows {limit} copies of a non-unique card. Remove {excess}. |
| rules.UNIQUE-LIMIT | {name} is unique — 1 copy allowed, the deck has {count}. |
| rules.SITE-COPIES | {name} ×{count} — sites are limited to 1 copy (this side's havens excepted). |
| rules.SPECIFIC-AVATAR | {name} is specific to {wizard} and cannot be played under {avatar}. |
| rules.BALROG-RACE | {name} ({race}) — Balrog characters must be Orc or Troll unless Balrog-specific. |
| rules.BALROG-MIND | {name} (mind {mind}) — Balrog characters need mind below {limit} unless Balrog-specific. |
| rules.DECKSIZE-PLAY | Play deck has {count} cards; {side} requires {min}–{max}. |
| rules.DECKSIZE-LOCATION | Location deck is empty — add your sites and regions. |
| rules.SIDEBOARD-MAX | Sideboard has {count} cards; the {length} limit is {max}. Move {count} − {max} cards out. |
| rules.POOL-CHARS | Starting pool has {count} characters; {side} allows {max}. |
| rules.POOL-MIND | Starting pool mind exceeds the limit ({total}/{max}) — or {name} exceeds mind {limit}. |
| rules.POOL-ITEMS | Starting pool has {count} minor items; {side} allows {max}. |
| rules.POOL-ELIGIBLE | {name} cannot sit in the starting pool (characters and starting minor items only). |
| rules.disable | Ignore this rule for this deck |
| rules.report | Report this rule |

FR and ES translations of each, same params (write them out — e.g. rules.COPIES-LIMIT fr: `Trop d'exemplaires — {name} ×{count}. {side} autorise {limit} exemplaires d'une carte non unique. Retirez-en {excess}.`; es: `Demasiadas copias — {name} ×{count}. {side} permite {limit} copias de una carta no única. Retira {excess}.`). POOL-MIND has two shapes (total vs per-character): split into `rules.POOL-MIND.total` and `rules.POOL-MIND.char`, and have the validator emit `code: 'POOL-MIND.total'` / `'POOL-MIND.char'` while `ruleId` stays `POOL-MIND` — adjust the Phase 2 test's `code` expectations accordingly.

- [ ] **Step 4: Verify** — manual: Fallen-wizard tournament deck with 3× a hero resource shows a red COPIES-LIMIT naming the card; clicking *Ignore this rule* silences it (and survives save/reload); casual mode shows it orange instead.

- [ ] **Step 5: Commit** `feat: live rule warnings with per-deck ignore and report actions`.

**Phase 4 checkpoint:** deckbuilding decks show actionable warnings; nothing blocks; freeform silent.

---

# Phase 5 — Notes & deck management

### Task 14: DeckNotes tab

**Files:**
- Create: `web/src/components/DeckNotes.jsx`
- Modify: `web/src/components/DeckPanel.jsx` (render in the notes tab), `web/src/App.jsx` (state + persistence), `web/src/lib/i18n.js`

**Interfaces:**
- Produces: `<DeckNotes notes onChange(field, value) />` with fields `starting|resourceStrategy|hazardStrategy|other`; App keeps `notes` on the deck record and saves them (DeckManager payload already carries `deck.notes` from Task 4).

- [ ] **Step 1: Implement**

```jsx
// web/src/components/DeckNotes.jsx
import React from 'react';
import { useT } from '../i18n.jsx';

const FIELDS = ['starting', 'resourceStrategy', 'hazardStrategy', 'other'];

export default function DeckNotes({ notes = {}, onChange }) {
  const t = useT();
  return (
    <div className="deck-notes">
      {FIELDS.map((f) => (
        <label key={f}>
          <span className="label">{t(`notes.${f}`)}</span>
          <textarea rows={4} value={notes[f] || ''} onChange={(e) => onChange(f, e.target.value)} />
        </label>
      ))}
    </div>
  );
}
```

App: `function changeNote(field, value) { setDeck((prev) => ({ ...prev, notes: { ...prev.notes, [field]: value } })); }` — passed through DeckPanel to the notes tab (both modes).

i18n: `notes.starting` = Starting notes / Notes de départ / Notas iniciales; `notes.resourceStrategy` = Resource strategy / Stratégie ressources / Estrategia de recursos; `notes.hazardStrategy` = Hazard strategy / Stratégie hazards / Estrategia de peligros; `notes.other` = Other notes / Autres notes / Otras notas.

- [ ] **Step 2: Verify** — manual: type notes, save deck, reload, load deck → notes back in both modes.
- [ ] **Step 3: Commit** `feat: four-field deck notes tab, saved with the deck`.

### Task 15: DeckManager — inline rename, reorder, side badge

**Files:**
- Modify: `web/src/components/DeckManager.jsx`, `web/src/styles.css`, `web/src/lib/i18n.js`
- Test: `test/deckModel.test.js` (extend — reorder persistence)

- [ ] **Step 1: Failing test** (append)

```js
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
```

- [ ] **Step 2:** Run — PASS immediately. **Characterization test, not TDD RED**: the `order` sort landed in Task 1, so this pins the reorder/rename semantics the UI in Step 3 depends on. The UI work itself is verified manually.

- [ ] **Step 3: Implement in DeckManager**

- **Rename:** clicking the deck name swaps it for an `<input>` (`renamingId` state); Enter → `api.updateDeck(id, { name })` + refresh; Escape cancels.
- **Reorder:** desktop — `draggable` rows, on drop compute the new sequence and persist `order: index + 1` for every row (`await Promise.all(rows.map((r, i) => api.updateDeck(r.id, { order: i + 1 })))`); mobile (`useIsMobile`) — ▲▼ buttons per row swapping with the neighbor. First reorder assigns explicit `order` to all rows (decks created before the field then keep a stable position).
- **Side badge:** next to the name: `<span className={`side-badge ${row.mode === 'deckbuilding' ? row.side : 'freeform'}`}>{t(`side.${row.mode === 'deckbuilding' ? row.side : 'freeform'}`)}</span>`. CSS gives each side a background tint but the **label always renders** (never colour-only): `.side-badge{border-radius:10px;padding:1px 8px;font-size:11px;border:1px solid currentColor}` + per-side classes.

- [ ] **Step 4: Verify** — manual: rename in place (list order unchanged), drag to reorder (survives reload), badges show Camp labels in FR.
- [ ] **Step 5: Commit** `feat: deck list inline rename, manual ordering and labelled side badges`.

**Phase 5 checkpoint:** notes + management complete; `npm test` green.

---

# Phase 6 — Exports (ordering, markdown sections, round-trip)

### Task 16: deckSections.js

**Files:**
- Create: `web/src/lib/export/deckSections.js`
- Test: `test/deckSections.test.js` (create)

**Interfaces:**
- Produces: `deckSections({ quantities, zones, cardsById, lang }) → [{ id, groups: [{ id, entries: [{ card, count }] }] }]` with section order `pool, play, locations, sideboard` and group orders per spec; `flattenSections(sections) → [{ card, count }]` for zip/pdf callers.

- [ ] **Step 1: Failing tests**

```js
// test/deckSections.test.js
import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';

const { cards, index } = parseCards(raw);
const find = (p) => { const c = cards.find(p); expect(c).toBeTruthy(); return c; };

describe('deckSections', () => {
  const avatar = find((c) => c.attributes.avatar && c.alignment === 'Hero');
  const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
  const res = find((c) => c.type === 'Resource');
  const hz = find((c) => c.type === 'Hazard');
  const site = find((c) => c.type === 'Site');
  const region = find((c) => c.type === 'Region');
  const item = find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);

  it('orders sections pool → play → locations → sideboard and groups per spec', () => {
    const sections = deckSections({
      quantities: { [avatar.id]: 1, [chr.id]: 2, [res.id]: 3, [hz.id]: 2, [site.id]: 1, [region.id]: 1 },
      zones: { sideboard: { [hz.id]: 1 }, pool: { [chr.id]: 1, [item.id]: 1 } },
      cardsById: index, lang: 'en',
    });
    expect(sections.map((s) => s.id)).toEqual(['pool', 'play', 'locations', 'sideboard']);
    const play = sections.find((s) => s.id === 'play');
    expect(play.groups.map((g) => g.id)).toEqual(['avatars', 'characters', 'resources', 'hazards']);
    const pool = sections.find((s) => s.id === 'pool');
    expect(pool.groups.map((g) => g.id)).toEqual(['characters', 'resources']);
    const loc = sections.find((s) => s.id === 'locations');
    expect(loc.groups.map((g) => g.id)).toEqual(['sites', 'regions']);
  });
  it('flatten preserves order and repeats counts', () => {
    const sections = deckSections({ quantities: { [res.id]: 2 }, zones: { sideboard: {}, pool: {} }, cardsById: index, lang: 'en' });
    const flat = flattenSections(sections);
    expect(flat).toEqual([{ card: res, count: 2 }]);
  });
  it('drops empty sections and groups', () => {
    const sections = deckSections({ quantities: { [res.id]: 1 }, zones: { sideboard: {}, pool: {} }, cardsById: index, lang: 'en' });
    expect(sections.map((s) => s.id)).toEqual(['play']);
  });
});
```

- [ ] **Step 2: Implement**

```js
// web/src/lib/export/deckSections.js
// The single source of export order. PDF and text both consume this, so they
// cannot disagree. Sections: Pool, Play deck, Locations, Sideboard.
import { cardName } from '../lang.js';
import { backGroupForType } from '../deck.js';

const GROUP_DEFS = {
  pool: [
    { id: 'characters', match: (c) => c.type === 'Character' },
    { id: 'resources', match: (c) => c.type === 'Resource' },
  ],
  play: [
    { id: 'avatars', match: (c) => c.attributes.avatar === true },
    { id: 'characters', match: (c) => c.type === 'Character' && !c.attributes.avatar },
    { id: 'resources', match: (c) => c.type === 'Resource' },
    { id: 'hazards', match: (c) => c.type === 'Hazard' },
  ],
  locations: [
    { id: 'sites', match: (c) => c.type === 'Site' },
    { id: 'regions', match: (c) => c.type === 'Region' },
  ],
  sideboard: [
    { id: 'characters', match: (c) => c.type === 'Character' },
    { id: 'resources', match: (c) => c.type === 'Resource' },
    { id: 'hazards', match: (c) => c.type === 'Hazard' },
  ],
};

function toEntries(map, cardsById) {
  return Object.entries(map)
    .map(([id, count]) => ({ card: cardsById.get(id), count }))
    .filter((e) => e.card && e.count > 0);
}

function grouped(sectionId, entries, lang) {
  const defs = GROUP_DEFS[sectionId];
  const groups = defs.map((d) => ({ id: d.id, entries: [] }));
  const misc = { id: 'other', entries: [] };
  for (const e of entries) {
    const g = defs.findIndex((d) => d.match(e.card));
    (g >= 0 ? groups[g] : misc).entries.push(e);
  }
  if (misc.entries.length) groups.push(misc);
  for (const g of groups) g.entries.sort((a, b) => cardName(a.card, lang).localeCompare(cardName(b.card, lang)));
  return groups.filter((g) => g.entries.length > 0);
}

export function deckSections({ quantities = {}, zones = {}, cardsById, lang = 'en' }) {
  const main = toEntries(quantities, cardsById);
  const play = main.filter((e) => backGroupForType(e.card.type) === 'playdeck');
  const locations = main.filter((e) => backGroupForType(e.card.type) === 'locationdeck');
  const sections = [
    { id: 'pool', entries: toEntries(zones.pool || {}, cardsById) },
    { id: 'play', entries: play },
    { id: 'locations', entries: locations },
    { id: 'sideboard', entries: toEntries(zones.sideboard || {}, cardsById) },
  ];
  return sections
    .map((s) => ({ id: s.id, groups: grouped(s.id, s.entries, lang) }))
    .filter((s) => s.groups.length > 0);
}

export function flattenSections(sections) {
  const out = [];
  for (const s of sections) for (const g of s.groups) for (const e of g.entries) out.push(e);
  return out;
}
```

- [ ] **Step 3: Run** — PASS. **Step 4: Commit** `feat: canonical export ordering (pool, play, locations, sideboard)`.

### Task 17: Markdown deck list with sections + notes first; import round-trip

**Files:**
- Modify: `web/src/lib/deckList.js`, `web/src/lib/importDeck.js`, `web/src/components/ImportDialog.jsx`, `web/src/App.jsx` (`importQuantities` → `importDeckData`)
- Test: `test/deckSections.test.js` (extend)

**Interfaces:**
- Produces: `buildDeckListText(cardsById, quantities, deckName, lang, { zones, notes })` — headings are **canonical English** (stable across UI languages, hence re-importable): `# name`, `## Notes` (first; `### Starting notes|Resource strategy|Hazard strategy|Other notes`), then `## Pool|Play deck|Locations|Sideboard` with `### Avatars|Characters|Resources|Hazards|Sites|Regions (n)`. Import returns `{ quantities, zones, notes, unmatched, ambiguous }` — everything under `## Notes` is prose, never card lines.

- [ ] **Step 1: Failing round-trip test** (append to `test/deckSections.test.js`)

```js
import { buildDeckListText } from '../web/src/lib/deckList.js';
import { parseDeckList } from '../web/src/lib/importDeck.js'; // adjust to the real exported name after reading the file

describe('markdown round-trip', () => {
  const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
  const hz = find((c) => c.type === 'Hazard');
  const site = find((c) => c.type === 'Site');

  it('notes render first and never parse as cards', () => {
    const notes = { starting: '3x Gandalf is the plan', resourceStrategy: '', hazardStrategy: 'drown them', other: '' };
    const text = buildDeckListText(index, { [hz.id]: 2, [site.id]: 1 }, 'RT', 'en', { zones: { sideboard: {}, pool: { [chr.id]: 1 } }, notes });
    expect(text.indexOf('## Notes')).toBeLessThan(text.indexOf('## Pool'));
    const back = parseDeckList(text, cards, 'en');
    expect(back.quantities[hz.id]).toBe(2);
    expect(back.zones.pool[chr.id]).toBe(1);
    expect(back.notes.starting).toContain('3x Gandalf');
    // the note line must NOT have imported Gandalf
    const gandalf = cards.find((c) => (c.name.en || '') === 'Gandalf');
    expect(back.quantities[gandalf.id]).toBeUndefined();
  });
  it('zones restore from section headings', () => {
    const text = buildDeckListText(index, { [hz.id]: 1 }, 'RT2', 'en', { zones: { sideboard: { [hz.id]: 2 }, pool: {} }, notes: {} });
    const back = parseDeckList(text, cards, 'en');
    expect(back.quantities[hz.id]).toBe(1);
    expect(back.zones.sideboard[hz.id]).toBe(2);
  });
});
```

- [ ] **Step 2:** Read `web/src/lib/importDeck.js` and `ImportDialog.jsx` first; align the test import name with the real parser entry point (rename in the test, keep intent).

- [ ] **Step 3: Implement**

`deckList.js`: rebuild on top of `deckSections`:

```js
import { deckSections } from './export/deckSections.js';
import { cardName } from './lang.js';

const SECTION_TITLES = { pool: 'Pool', play: 'Play deck', locations: 'Locations', sideboard: 'Sideboard' };
const GROUP_TITLES = { avatars: 'Avatars', characters: 'Characters', resources: 'Resources', hazards: 'Hazards', sites: 'Sites', regions: 'Regions', other: 'Other' };
const NOTE_TITLES = { starting: 'Starting notes', resourceStrategy: 'Resource strategy', hazardStrategy: 'Hazard strategy', other: 'Other notes' };

export function buildDeckListText(cardsById, quantities = {}, deckName = 'Deck', lang = 'fr', { zones = { sideboard: {}, pool: {} }, notes = {} } = {}) {
  const lines = [`# ${deckName}`, ''];
  const noteEntries = Object.entries(NOTE_TITLES).filter(([f]) => (notes[f] || '').trim());
  if (noteEntries.length) {
    lines.push('## Notes', '');
    for (const [f, title] of noteEntries) lines.push(`### ${title}`, '', notes[f].trim(), '');
  }
  for (const s of deckSections({ quantities, zones, cardsById, lang })) {
    lines.push(`## ${SECTION_TITLES[s.id]}`, '');
    for (const g of s.groups) {
      const total = g.entries.reduce((sum, e) => sum + e.count, 0);
      lines.push(`### ${GROUP_TITLES[g.id]} (${total})`);
      for (const e of g.entries) lines.push(`${e.count}x ${cardName(e.card, lang)}`);
      lines.push('');
    }
  }
  return lines.join('\n').trim() + '\n';
}
```

`importDeck.js`: extend the parser with a section state machine — on `## Notes` set `mode='notes'` (accumulate `### <field>` bodies into `notes` via a reverse `NOTE_TITLES` lookup; unknown note headings go to `other`); on `## Pool`/`## Sideboard` set the target zone; on `## Play deck`/`## Locations`/any other `##` set target `quantities`; `###` lines inside card sections are skipped; **while `mode==='notes'`, never attempt card matching.** Legacy lists (old `## Characters (n)` top-level format) still import: unknown `##` headings default the target to `quantities`. Return `{ quantities, zones, notes, ... }`.

`ImportDialog.jsx` + `App.importQuantities` → accept the richer object: `importDeckData({ quantities, zones, notes })` sets all three states (zones/notes defaulting to empty for legacy pastes).

- [ ] **Step 4: Run** — round-trip tests PASS; `npm test` green (existing import tests must still pass — legacy format compatibility).
- [ ] **Step 5: Commit** `feat: sectioned markdown deck list with notes first and zone-restoring import`.

### Task 18: Export dialog — ordered PDF and zip

**Files:**
- Modify: `web/src/components/ExportDialog.jsx`, `web/src/App.jsx` (pass `zones`)

**Interfaces:**
- Consumes: `flattenSections(deckSections(...))` for the card array fed to `buildSheetPdf` and the zip builder; `buildDeckListText(..., { zones, notes })` for the text export.

- [ ] **Step 1:** Read `ExportDialog.jsx`. Replace its card-list construction (currently from `cardIds`/`quantities`) with:

```js
const sections = deckSections({ quantities, zones, cardsById, lang: uiLang });
const orderedEntries = flattenSections(sections);
const orderedCards = orderedEntries.flatMap((e) => Array(e.count).fill(e.card));
```

Use `orderedCards` for **PDF** (`buildSheetPdf({ cards: orderedCards, ... })` — no page-break logic; sections flow, backs are per-card already) and for **ZIP** (same expansion — naming and back logic untouched). Text export passes `{ zones, notes }`.

- [ ] **Step 2: Verify** — manual: export a deck with pool + sideboard: PDF pages run Pool → Play → Locations → Sideboard with correct per-card backs on duplex pages; zip contains sideboard/pool card images; text shows notes first. A freeform deck (empty zones) exports identically to before.
- [ ] **Step 3: Commit** `feat: exports follow the canonical section order incl. zones`.

**Phase 6 checkpoint:** `npm test` green; exports ordered and round-trippable.

---

# Phase 7 — Documentation page

### Task 19: RulesDoc

**Files:**
- Create: `web/src/components/RulesDoc.jsx`
- Modify: `web/src/App.jsx` (open/close state), `web/src/components/FilterBar.jsx` (a "?" / docs button), `web/src/lib/i18n.js`, `web/src/styles.css`

**Interfaces:**
- Consumes: `RULES`, `SIDES`, `LENGTHS`, `BANNED`, `isRuleEnabled`; current `deck` + `onToggleRule` (checkboxes read-only when `deck.mode !== 'deckbuilding'`).

- [ ] **Step 1: Implement** — a full-screen modal (`.modal.doc`) with:

1. **Prose** (hand-written keys, one paragraph each): `docs.intro`, `docs.freeform`, `docs.deckbuilding`, `docs.zones`, `docs.warnings`, `docs.enforcement` — en/fr/es values written at key-introduction time (short honest paragraphs; e.g. `docs.enforcement` en: "Each rule below has a checkbox: checked means the current deck enforces it. Unverified rules start unchecked until their official source is confirmed. Nothing ever blocks adding a card.").
2. **Generated rules table** — one row per `RULES` entry: checkbox (`checked={isRuleEnabled(r.id, deck.ruleset?.ruleOverrides || {})}`, `disabled={deck.mode !== 'deckbuilding'}`, `onChange={(e) => onToggleRule(r.id, e.target.checked)}`), rule id, localized summary (`t('rules.' + r.id + '.doc')` — add a short doc string per rule id in the three languages, e.g. `rules.COPIES-LIMIT.doc` en: "Copy limits per side (3, or 2 for Fallen-wizard, 3 for Stage)"), severity, status chip (`verified`/`unverified`/`disputed` — localized `status.*` keys), source link, report link (`REPORT_ISSUES_URL`).
3. **Generated side tables** — from `SIDES`: alignments, copy limits, pool constraints per side (localized side names). From `LENGTHS`: sideboard caps. From `BANNED`: the two name lists with their status.
4. A visible **"not checked" list**: rules with `status !== 'verified'` grouped at the bottom of the table — the honest-gaps requirement.

- [ ] **Step 2: Verify** — manual in all three UI languages: docs button opens the page; with a deckbuilding deck open, unchecking COPIES-LIMIT silences the warning live; with a freeform deck the checkboxes are disabled showing defaults; every rule row shows id + status + source.
- [ ] **Step 3: Commit** `feat: rules documentation page - prose plus tables generated from rule data`.

**Phase 7 checkpoint:** docs page cannot drift from the validator (single data source), per-rule toggles live.

---

# Phase 8 — Full trilingual UI

### Task 20: Complete the es dictionary + textLang

**Files:**
- Modify: `web/src/lib/i18n.js`, `web/src/App.jsx:58`
- Test: extend the existing parity test

- [ ] **Step 1: Failing test** — extend the existing key-parity test to three languages:

```js
// in the existing i18n test file — adapt to its dict access pattern
it('fr, en and es have identical key sets', () => {
  const langs = ['fr', 'en', 'es'];
  const keySets = langs.map((l) => Object.keys(DICTS[l]).sort());
  expect(keySets[1]).toEqual(keySets[0]);
  expect(keySets[2]).toEqual(keySets[0]);
});
```

- [ ] **Step 2:** Run — FAIL (es partial). **Step 3:** Translate every remaining `en` key into `es` in `i18n.js` (mechanical; use the existing fr/en pairs as context; keep placeholders `{...}` identical). Then in `App.jsx` replace `const textLang = uiLang === 'es' ? 'en' : uiLang;` with `const textLang = uiLang;`.

- [ ] **Step 4:** Run — PASS. Manual: switch UI to Español — full chrome in Spanish.
- [ ] **Step 5: Commit** `feat: complete Spanish UI translation - textLang follows uiLang`.

### Task 21: Terminology guard test

**Files:**
- Test: extend the i18n test file

- [ ] **Step 1: Write the test**

```js
it('side-related strings never use the word "faction" for a side', () => {
  const OFFENDING = /faction/i;
  const NAMESPACES = ['side.', 'setup.', 'zones.', 'rules.', 'docs.', 'notes.', 'status.', 'length.'];
  for (const lang of ['fr', 'en', 'es']) {
    for (const [key, value] of Object.entries(DICTS[lang])) {
      if (NAMESPACES.some((ns) => key.startsWith(ns))) {
        expect(`${lang}:${key}=${value}`).not.toMatch(OFFENDING);
      }
    }
  }
});
```

(Scoped to the new namespaces: "Faction" may legitimately appear elsewhere as the card category.)

- [ ] **Step 2:** Run — PASS (fix any offending string it catches). **Step 3:** Commit `test: guard - side strings never say faction`.

### Task 22: Final full pass

- [ ] Run `npm test` — everything green.
- [ ] Manual smoke (dev server): legacy deck loads as freeform uncapped · new deckbuilding deck full workflow (setup → browse filtered → zone counters → tabs → warnings → ignore rule → docs checkboxes → notes → save/reload → export PDF/text/zip → re-import text) in FR, EN and ES.
- [ ] Update `README.md`: two modes, zones, notes, docs page, trilingual claim.
- [ ] Commit `docs: README for deck modes` and hand over per `superpowers:finishing-a-development-branch`.

---

## Self-review notes (already applied)

- **BANNED enablement:** banned lists are `unverified` stubs → the validator test enables the rule via `ruleOverrides: { BANNED: true }` (Task 8 note). The Task 7 resolution test is independent of enablement.
- **POOL-MIND dual shape:** split message codes `POOL-MIND.total` / `POOL-MIND.char` under one ruleId (Task 13 note).
- **Legacy import compatibility:** unknown `##` headings target `quantities` (Task 17) so pre-sections lists still import.
- **`counts`/`deckWarnings` legacy path:** the existing `deckWarnings` (backs/images) stays untouched and renders where it does today; `ruleWarnings` are additive (Task 13).
- **Spec coverage check:** modes+record (T1–4) · rules data+validator (T5–8) · zones UI+filter (T9–12) · warnings quality bar+actions (T13) · notes (T14) · deck management (T15) · exports+round-trip (T16–18) · docs page+checkboxes (T19) · trilingual+terminology guard (T20–21). ZIP content judgment call (zones included in print output) recorded in Task 18.
