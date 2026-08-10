# FilterBar redesign — skills cleanup, reorder, unique facet, configurable sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up and extend `FilterBar`: drop "Ally" from the skills menu, reorder the facets, turn "unique" into a two-value facet like the rest, and add a configurable two-key sort (with `card_id` always the implicit final tiebreak) that is independent of the filters and unaffected by "Reset filters".

**Architecture:** All four changes are pure-data + presentational tweaks on top of the existing facet-dropdown mechanism in `FilterBar.jsx` (`FacetDropdown`, shared `openKey` state) and the existing filter/sort pipeline (`lib/filter.js` → `CardBrowser.jsx`). No new dependencies, no new top-level components beyond one `SortPicker` sibling to `FacetDropdown`.

**Tech Stack:** React 18 (JSX, no TypeScript), Vitest for tests, no new runtime dependencies.

## Global Constraints

- French for prose (UI strings, docs, commit messages), English for code identifiers.
- Every new i18n key must be added to **all three** language blocks in `web/src/lib/i18n.js` (fr, en, es) — `test/i18n.test.js` asserts the three dictionaries have identical key sets and identical `{placeholder}` token sets per key.
- No FR string may use a retired term (see `RETIRED_FR` in `test/i18n.test.js`) — none of the new strings need any of those words, but keep it in mind when wording labels.
- `zones.js`, `copies.js`, `roles.js`, `deckSections.js`, `proxy.js`, `tags.js` are the single source of truth for their domains — do not reimplement tag-splitting logic; reuse `cardTags`/`splitTags` from `lib/tags.js`.
- Reset ("Réinitialiser les filtres") must clear `filters` only, never the sort selection.
- Run `npm test` before considering any task done — 0 failing files, not just 0 failing assertions (a JSX syntax error fails a file at esbuild transform time).
- `docs/ARCHITECTURE.md` must be updated (relevant sections + §15 dated journal + header date) in the same commit as the feature work, per the project's `CLAUDE.md` §0 protocol. Task 5 below covers this.

---

## File Structure

| File | Change |
|---|---|
| `web/src/App.jsx` | Filter `"Ally"` out of the skills facet; add a `sortBy` state (separate from `filters`); pass `sortBy`/`setSortBy` down to `FilterBar`, pass `sortBy` down to `CardBrowser`. |
| `web/src/components/FilterBar.jsx` | Reorder the `facet(...)` calls; replace the `unique` toggle button with a `FacetDropdown`; add a new `SortPicker` component and render it first in `filterbar-bottom`. |
| `web/src/lib/filter.js` | `filterCards`: change the `unique` check from boolean to array-membership. Add `sortCards(cards, { primary, secondary }, { lang, labelFor })`. |
| `web/src/components/CardBrowser.jsx` | Apply `sortCards` to the filtered list before slicing to `CAP`; build the `labelFor` callback it passes in. |
| `web/src/lib/i18n.js` | Add `filter.uniqueYes`, `filter.uniqueNo`, `filter.sortBy`, `filter.sortPrimary`, `filter.sortSecondary`, `filter.sortNone`, `filter.name` to all three language blocks. |
| `web/src/styles.css` | Small addition: `.sort-menu` layout (two stacked `<select>`s) reusing `.facet`/`.facet-menu`. |
| `test/filter.test.js` | Tests for the new `unique` array behaviour and for `sortCards`. |
| `test/tags.test.js` or `test/parseCards.test.js` | Not touched — `baseOptions`/`computeFacets` are unaffected; the "Ally" exclusion is a display-only filter in `App.jsx`, not a data-layer change. Verified by a `test/App`-level check is out of scope (no existing App.jsx test file) — covered instead by a small pure-function extraction, see Task 1. |
| `docs/ARCHITECTURE.md` | §5 (App state) and §10 (components/CSS/mobile) updated; §15 journal entry; header date bumped. |

---

## Task 1: Remove "Ally" from the skills facet, reorder filters, and add the FilterBar section to review order

**Files:**
- Modify: `web/src/App.jsx:93-101` (`derivedFacets` memo)
- Modify: `web/src/components/FilterBar.jsx:218-234` (`filterbar-bottom` block)
- Test: `test/parseCards.test.js` (new test for a small extracted pure function, see below)
- Modify: `web/src/lib/parseCards.js`

**Interfaces:**
- Produces: `excludeSkill(skills, value)` — a pure helper in `lib/parseCards.js`, exported, so the "Ally" exclusion is unit-testable without mounting `App.jsx` (which has no test harness today).

- [ ] **Step 1: Write the failing test for the exclusion helper**

Add to `test/parseCards.test.js` (create the `describe` block if the file doesn't already have one for this; check the file first — if it already imports from `'../web/src/lib/parseCards.js'`, add the import to the existing import line instead of duplicating it):

```js
import { excludeSkill } from '../web/src/lib/parseCards.js';

describe('excludeSkill', () => {
  it('drops the given value and keeps the rest', () => {
    expect(excludeSkill(['Ally', 'Warrior', 'Sage'], 'Ally')).toEqual(['Warrior', 'Sage']);
  });

  it('is a no-op when the value is absent', () => {
    expect(excludeSkill(['Warrior', 'Sage'], 'Ally')).toEqual(['Warrior', 'Sage']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/parseCards.test.js`
Expected: FAIL — `excludeSkill is not a function` (or import error).

- [ ] **Step 3: Add `excludeSkill` to `lib/parseCards.js`**

Add near the bottom of `web/src/lib/parseCards.js` (after `collectSetNames`, before `parseCards`):

```js
// "Ally" is a real value in the skills data field (Ally-type cards carry it
// as their "skill"), so it must stay in cardTags/filterCards for matching --
// but it is not a real MECCG skill, so the skills FILTER MENU hides it.
export function excludeSkill(skills, value) {
  return skills.filter((s) => s !== value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/parseCards.test.js`
Expected: PASS

- [ ] **Step 5: Use it in `App.jsx`**

In `web/src/App.jsx`, add the import next to the other `parseCards`-adjacent imports (check the top of the file for where `baseOptions` is imported from `./lib/tags.js` — add a new import line right after it):

```js
import { excludeSkill } from './lib/parseCards.js';
```

Change the `derivedFacets` memo (currently at lines 93-101):

```js
  const derivedFacets = useMemo(() => {
    if (!facets) return facets;
    return {
      ...facets,
      races: baseOptions(cards, 'races'),
      subtypes: baseOptions(cards, 'subtypes'),
      skills: excludeSkill(baseOptions(cards, 'skills'), 'Ally'),
    };
  }, [facets, cards]);
```

- [ ] **Step 6: Reorder the facet calls in `FilterBar.jsx`**

In `web/src/components/FilterBar.jsx`, the `filterbar-bottom` block (currently lines 218-234) reorders from:

```
sets, types, alignments, rarities, artists, races, subtypes, skills, keywords
```

to:

```
sets, alignments, types, subtypes, keywords, races, skills, artists, rarities
```

Replace the block body (only the `facet(...)` call order changes; `unique` and the reset button are handled in Task 2, leave them as-is for now):

```jsx
      <div className="filterbar-bottom" style={isMobile && !filtersOpen ? { display: 'none' } : undefined}>
        {facet('sets', t('filter.set'))}
        {facet('alignments', t('filter.alignment'))}
        {facet('types', t('filter.type'), TYPE_ORDER)}
        {facet('subtypes', t('filter.subtype'))}
        {facet('keywords', t('filter.keywords'))}
        {facet('races', t('filter.race'))}
        {facet('skills', t('filter.skills'))}
        {facet('artists', t('filter.artist'))}
        {facet('rarities', t('filter.rarity'))}
        <button className={`chip-toggle ${filters.unique ? 'on' : ''}`} onClick={() => set('unique', !filters.unique)}>
          {t('filter.unique')}
        </button>
        {anyActive ? (
          <button className="linkbtn" onClick={() => onChange({})}>{t('filter.reset')}</button>
        ) : null}
      </div>
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failing files.

- [ ] **Step 8: Manually verify in the dev preview**

Start the dev server (`npm run dev` via the project's preview tooling), open the app, click "Filtres" on mobile width or check the desktop bar directly, confirm:
- The skills dropdown no longer lists "Ally".
- The facet order reads: Set, Alignement, Type, Sous-type, Mots-clés, Race, Compétences, Artiste, Rareté.

- [ ] **Step 9: Commit**

```bash
git add web/src/App.jsx web/src/lib/parseCards.js web/src/components/FilterBar.jsx test/parseCards.test.js
git commit -m "feat: drop Ally from skills filter menu, reorder facets"
```

---

## Task 2: "Unique" as a two-value facet (multiselect), not a toggle button

**Files:**
- Modify: `web/src/lib/filter.js:14-47` (`filterCards`)
- Modify: `web/src/components/FilterBar.jsx` (`optionLabel`, `anyActive`, `filterbar-bottom`)
- Modify: `web/src/lib/i18n.js` (add `filter.uniqueYes`, `filter.uniqueNo` to all three blocks)
- Test: `test/filter.test.js`

**Interfaces:**
- Consumes: `FacetDropdown` (unchanged signature, from `FilterBar.jsx`), `sortFacetOptions` (unchanged, from `lib/filter.js`).
- Produces: `filters.unique` is now `string[]` (subset of `['true', 'false']`) instead of `boolean`. Every other facet already uses this array shape, so no other file needs to change for this reason alone — only `filterCards`, `FilterBar.jsx`'s `optionLabel`/`anyActive`, and any test/data that set `filters.unique: true` (search the repo for `unique:` in test files besides `test/filter.test.js` before finishing this task, to catch stale boolean usages).

- [ ] **Step 1: Write the failing test for array-based `unique` filtering**

In `test/filter.test.js`, replace the existing test:

```js
  it('filters by unique flag', () => {
    expect(filterCards(cards, { unique: true }).map((c) => c.id)).toEqual(['AS-1']);
  });
```

with:

```js
  it('filters by unique as an array facet', () => {
    // AS-1 is unique: true; AS-44 and BA-1 have no `unique` attribute (falsy).
    expect(filterCards(cards, { unique: ['true'] }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { unique: ['false'] }).map((c) => c.id)).toEqual(['AS-44', 'BA-1']);
    // Both values selected excludes nothing, like any other multi-select facet.
    expect(filterCards(cards, { unique: ['true', 'false'] }).map((c) => c.id)).toEqual(['AS-1', 'AS-44', 'BA-1']);
    // No selection excludes nothing.
    expect(filterCards(cards, { unique: [] })).toHaveLength(3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/filter.test.js`
Expected: FAIL — old boolean semantics don't match the new expectations (`{ unique: ['true'] }` currently filters nothing, since `filters.unique === true` is false for an array).

- [ ] **Step 3: Update `filterCards` in `lib/filter.js`**

Replace this line (currently around line 37):

```js
    if (filters.unique === true && a.unique !== true) return false;
```

with:

```js
    if (has(filters.unique) && !filters.unique.includes(String(a.unique === true))) return false;
```

(`has` is already defined at the top of `filterCards` as `(arr) => Array.isArray(arr) && arr.length > 0`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/filter.test.js`
Expected: PASS

- [ ] **Step 5: Add the two new i18n keys to all three languages**

In `web/src/lib/i18n.js`, in each of the three language blocks, add a line right after the existing `'filter.unique': '...'` entry (do not remove `filter.unique` — it is still used as the facet's button label, same as every other facet's label):

fr block (near line 56):
```js
    'filter.unique': 'Unique',
    'filter.uniqueYes': 'Unique',
    'filter.uniqueNo': 'Non-unique',
```

en block (near line 465):
```js
    'filter.unique': 'Unique',
    'filter.uniqueYes': 'Unique',
    'filter.uniqueNo': 'Non-unique',
```

es block (near line 861):
```js
    'filter.unique': 'Única',
    'filter.uniqueYes': 'Única',
    'filter.uniqueNo': 'No única',
```

- [ ] **Step 6: Run the i18n parity test**

Run: `npm test -- test/i18n.test.js`
Expected: PASS (key sets still match across fr/en/es; no `{placeholder}` tokens involved).

- [ ] **Step 7: Wire the facet into `FilterBar.jsx`**

Add `'true'`/`'false'` label mapping to `optionLabel` (currently around line 128-132):

```js
  const optionLabel = (key) => {
    if (key === 'sets') return (v) => setLabel(setNames, v, lang);
    if (key === 'unique') return (v) => (v === 'true' ? t('filter.uniqueYes') : t('filter.uniqueNo'));
    if (FACET_PREFIX[key]) return (v) => localize(t, FACET_PREFIX[key], v);
    return undefined;
  };
```

Update `anyActive` (currently around line 114-119) to treat `unique` like every other array facet instead of the old boolean check:

```js
  const anyActive =
    (filters.search && filters.search.length) ||
    (filters.cardText && filters.cardText.length) ||
    ['sets', 'types', 'alignments', 'rarities', 'artists', 'races', 'subtypes', 'skills', 'keywords', 'unique']
      .some((k) => (filters[k] || []).length);
```

`facets.unique` needs a value list to drive the dropdown — it isn't in `computeFacets` (that only covers real data-derived facets). Pass it as a constant fixed order directly in the `facet(...)` call rather than adding a fake facet to `computeFacets` (there is no card-derived "unique" facet, it's always exactly `['true', 'false']`):

Replace the toggle button in `filterbar-bottom` (from Task 1's Step 6 output):

```jsx
        <button className={`chip-toggle ${filters.unique ? 'on' : ''}`} onClick={() => set('unique', !filters.unique)}>
          {t('filter.unique')}
        </button>
```

with:

```jsx
        <FacetDropdown
          label={t('filter.unique')}
          options={['true', 'false']}
          selected={filters.unique}
          onChange={(v) => set('unique', v)}
          open={openKey === 'unique'}
          onToggle={() => setOpenKey((k) => (k === 'unique' ? null : 'unique'))}
          optionLabel={optionLabel('unique')}
          order={['true', 'false']}
        />
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failing files.

- [ ] **Step 9: Manually verify in the dev preview**

Open "Unique" in the filter bar: confirm it shows a checkbox menu with "Unique" and "Non-unique" (not "true"/"false"), and that selecting "Unique" filters to unique cards only.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/filter.js web/src/components/FilterBar.jsx web/src/lib/i18n.js test/filter.test.js
git commit -m "feat: make the unique filter a two-value facet instead of a toggle"
```

---

## Task 3: `sortCards` — configurable two-key sort with card_id tiebreak

**Files:**
- Modify: `web/src/lib/filter.js` (add `sortCards` and its helpers)
- Test: `test/filter.test.js`

**Interfaces:**
- Consumes: `TYPE_ORDER` from `./constants.js`, `cardTags` from `./tags.js` (both already used elsewhere in the codebase — `TYPE_ORDER` in `FilterBar.jsx`, `cardTags` in `filterCards` itself).
- Produces:
  ```js
  export const SORT_KEYS = ['sets', 'types', 'subtypes', 'alignments', 'races', 'skills', 'rarities', 'artists', 'name'];
  export function sortCards(cards, { primary, secondary } = {}, { lang = 'en', labelFor = (key, v) => v } = {})
  ```
  Returns a **new sorted array** (does not mutate `cards`). If `primary` is falsy, returns `cards` unchanged (same reference — callers can rely on this for memoization). `labelFor(key, rawValue)` lets the caller localize a raw value (e.g. `"Hazard"` → `"Périls"`) before comparison, matching how the facet menus already sort on what is displayed (`sortFacetOptions`). `key === 'types'` ignores `labelFor` and uses `TYPE_ORDER` rank instead — play order, not alphabetical, exactly like the Type facet menu. `key === 'name'` reads `card.name[lang]` (falling back to `card.name.en`) directly, ignoring `labelFor`. The final tiebreak is always `card.id`, compared with `{ numeric: true }` so `"AS-2"` sorts before `"AS-10"`.

- [ ] **Step 1: Write the failing tests**

Add to `test/filter.test.js`, in a new `describe` block after the existing `sortFacetOptions` block:

```js
describe('sortCards', () => {
  const sortCardsFixture = [
    { id: 'AS-10', setCode: 'AS', type: 'Hazard', name: { en: 'Zed' } },
    { id: 'AS-2', setCode: 'AS', type: 'Character', name: { en: 'Alpha' } },
    { id: 'BA-1', setCode: 'BA', type: 'Character', name: { en: 'Mid' } },
  ];

  it('returns the same array reference when no primary key is given', () => {
    expect(sortCards(sortCardsFixture, {})).toBe(sortCardsFixture);
  });

  it('sorts by a single primary key', () => {
    const result = sortCards(sortCardsFixture, { primary: 'sets' });
    expect(result.map((c) => c.id)).toEqual(['AS-10', 'AS-2', 'BA-1']);
  });

  it('breaks ties on card_id with numeric comparison (AS-2 before AS-10)', () => {
    const result = sortCards(sortCardsFixture, { primary: 'sets' });
    // Both AS-10 and AS-2 share setCode "AS" -- numeric id comparison must
    // place AS-2 first, not "AS-10" < "AS-2" as a plain string compare would.
    expect(result.map((c) => c.id).slice(0, 2)).toEqual(['AS-2', 'AS-10']);
  });

  it('types sorts by TYPE_ORDER (play order), not alphabetically', () => {
    const cards = [
      { id: 'X-1', type: 'Hazard' },
      { id: 'X-2', type: 'Character' },
      { id: 'X-3', type: 'Resource' },
    ];
    // TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region']
    expect(sortCards(cards, { primary: 'types' }).map((c) => c.id)).toEqual(['X-2', 'X-3', 'X-1']);
  });

  it('applies primary then secondary then the id tiebreak', () => {
    const cards = [
      { id: 'A-2', setCode: 'X', alignment: 'Minion' },
      { id: 'A-1', setCode: 'X', alignment: 'Hero' },
      { id: 'A-3', setCode: 'Y', alignment: 'Hero' },
    ];
    const result = sortCards(cards, { primary: 'sets', secondary: 'alignments' });
    expect(result.map((c) => c.id)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('uses labelFor to localize the comparison for non-type/name keys', () => {
    const cards = [
      { id: 'A-1', alignment: 'Minion' },
      { id: 'A-2', alignment: 'Hero' },
    ];
    // Without labelFor, "Hero" < "Minion" alphabetically. With a labelFor that
    // reverses the display order, the sort must follow the label, not the raw value.
    const labelFor = (key, v) => (key === 'alignments' ? { Hero: 'Z', Minion: 'A' }[v] : v);
    expect(sortCards(cards, { primary: 'alignments' }, { labelFor }).map((c) => c.id)).toEqual(['A-2', 'A-1']);
  });

  it('sorts name by the given display language, falling back to en', () => {
    const cards = [
      { id: 'A-1', name: { en: 'Zeta', fr: 'Alpha' } },
      { id: 'A-2', name: { en: 'Alpha', fr: 'Zeta' } },
    ];
    expect(sortCards(cards, { primary: 'name' }, { lang: 'fr' }).map((c) => c.id)).toEqual(['A-1', 'A-2']);
    expect(sortCards(cards, { primary: 'name' }, { lang: 'en' }).map((c) => c.id)).toEqual(['A-2', 'A-1']);
  });
});
```

Add `sortCards` to the import line at the top of `test/filter.test.js`:

```js
import { filterCards, sortFacetOptions, sortCards } from '../web/src/lib/filter.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/filter.test.js`
Expected: FAIL — `sortCards` is not exported yet.

- [ ] **Step 3: Implement `sortCards` in `lib/filter.js`**

Add these imports at the top of `web/src/lib/filter.js` (alongside the existing `import { cardTags } from './tags.js';`):

```js
import { TYPE_ORDER } from './constants.js';
```

Add at the bottom of the file, after `sortFacetOptions`:

```js
// Raw value a sort key reads off a card, before any localization. `types`
// and `name` are handled specially in compareSortKey below (play order and
// display-language string respectively), so they have no entry here.
const SORT_FIELD = {
  sets: (c) => c.setCode,
  subtypes: (c) => cardTags(c, 'subtypes')[0] || '',
  alignments: (c) => c.alignment,
  races: (c) => cardTags(c, 'races')[0] || '',
  skills: (c) => cardTags(c, 'skills')[0] || '',
  rarities: (c) => c.rarity,
  artists: (c) => c.artist,
};

// Sort keys the "Trier par" picker offers, in menu order.
export const SORT_KEYS = ['sets', 'types', 'subtypes', 'alignments', 'races', 'skills', 'rarities', 'artists', 'name'];

const typeRank = (v) => { const i = TYPE_ORDER.indexOf(v); return i === -1 ? Infinity : i; };

// -1/0/1 comparison of two cards on one sort key. `labelFor` mirrors
// sortFacetOptions' principle -- menus (and now sort) order on what the
// player reads, not the raw English data value -- except `types`, which
// follows game play order (TYPE_ORDER), and `name`, which has no dictionary
// entry and reads straight off the card in the current display language.
function compareSortKey(key, a, b, { lang, labelFor }) {
  if (key === 'types') return typeRank(a.type) - typeRank(b.type);
  if (key === 'name') {
    const na = (a.name && (a.name[lang] || a.name.en)) || '';
    const nb = (b.name && (b.name[lang] || b.name.en)) || '';
    return String(na).localeCompare(String(nb));
  }
  const field = SORT_FIELD[key];
  if (!field) return 0;
  const va = labelFor(key, field(a));
  const vb = labelFor(key, field(b));
  return String(va).localeCompare(String(vb));
}

// Sorts a copy of `cards` by `primary`, then `secondary` (if given), then
// always by `card.id` as the final tiebreak -- `id` already encodes
// set+number ("AS-44"), so no explicit setCode tiebreak is needed on top of
// it. Returns `cards` itself, unsorted, when `primary` is falsy, so callers
// memoizing on the result can rely on referential equality in that case.
export function sortCards(cards, { primary, secondary } = {}, { lang = 'en', labelFor = (key, v) => v } = {}) {
  if (!primary) return cards;
  const ctx = { lang, labelFor };
  const copy = [...cards];
  copy.sort((a, b) => {
    const p = compareSortKey(primary, a, b, ctx);
    if (p !== 0) return p;
    if (secondary) {
      const s = compareSortKey(secondary, a, b, ctx);
      if (s !== 0) return s;
    }
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
  return copy;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/filter.test.js`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, 0 failing files.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/filter.js test/filter.test.js
git commit -m "feat: add sortCards with configurable primary/secondary keys and card_id tiebreak"
```

---

## Task 4: Sort picker UI, wired into `App.jsx` / `FilterBar.jsx` / `CardBrowser.jsx`

**Files:**
- Modify: `web/src/App.jsx` (new `sortBy` state, pass-through props)
- Modify: `web/src/components/FilterBar.jsx` (new `SortPicker` component, rendered first in `filterbar-bottom`)
- Modify: `web/src/components/CardBrowser.jsx` (apply `sortCards` before slicing to `CAP`)
- Modify: `web/src/lib/i18n.js` (add `filter.sortBy`, `filter.sortPrimary`, `filter.sortSecondary`, `filter.sortNone`, `filter.name` to all three blocks)
- Modify: `web/src/styles.css` (`.sort-menu` layout)

**Interfaces:**
- Consumes: `SORT_KEYS`, `sortCards` from `lib/filter.js` (Task 3); `TYPE_ORDER`/`FACET_PREFIX`-style localization already in `FilterBar.jsx`; `setLabel` from `lib/lang.js` (already imported in `FilterBar.jsx`); `localize` from `lib/rules/docText.js` (already imported in `FilterBar.jsx`).
- Produces: `App.jsx` owns `const [sortBy, setSortBy] = useState({ primary: 'sets', secondary: null })` and passes `sortBy`/`onSortChange={setSortBy}` to `FilterBar`, and `sortBy` (read-only) to `CardBrowser`.

- [ ] **Step 1: Add the i18n keys**

In `web/src/lib/i18n.js`, add to each of the three blocks, right after the `filter.uniqueNo` line added in Task 2:

fr:
```js
    'filter.uniqueNo': 'Non-unique',
    'filter.sortBy': 'Trier par',
    'filter.sortPrimary': '1er critère',
    'filter.sortSecondary': '2e critère',
    'filter.sortNone': 'Aucun',
    'filter.name': 'Nom',
```

en:
```js
    'filter.uniqueNo': 'Non-unique',
    'filter.sortBy': 'Sort by',
    'filter.sortPrimary': '1st key',
    'filter.sortSecondary': '2nd key',
    'filter.sortNone': 'None',
    'filter.name': 'Name',
```

es:
```js
    'filter.uniqueNo': 'No única',
    'filter.sortBy': 'Ordenar por',
    'filter.sortPrimary': '1er criterio',
    'filter.sortSecondary': '2do criterio',
    'filter.sortNone': 'Ninguno',
    'filter.name': 'Nombre',
```

Run: `npm test -- test/i18n.test.js` — Expected: PASS (key-set parity holds since all three blocks got the same six keys).

- [ ] **Step 2: Add `SortPicker` to `FilterBar.jsx`**

Add this component in `web/src/components/FilterBar.jsx`, right after the `FacetDropdown` function (before `LangPicker`):

```jsx
// The 9 keys the sort picker offers, and the i18n key each one's label
// lives under. Reuses the same keys as filter.* labels (filter.set,
// filter.type, ...) except filter.name, which has no facet counterpart.
const SORT_KEY_LABEL = {
  sets: 'filter.set',
  types: 'filter.type',
  subtypes: 'filter.subtype',
  alignments: 'filter.alignment',
  races: 'filter.race',
  skills: 'filter.skills',
  rarities: 'filter.rarity',
  artists: 'filter.artist',
  name: 'filter.name',
};

// Sort control: two stacked <select>s (primary, secondary) rather than
// side-by-side, so it stays narrow enough for a 320px mobile screen. Reuses
// the facet dropdown's open/close mechanism (single `openKey` in the parent)
// so it participates in the same outside-click/Escape handling as every
// other facet menu, instead of needing its own.
function SortPicker({ sortBy, onChange, open, onToggle, keys, labelFor, t }) {
  const active = Boolean(sortBy.secondary);
  const secondaryOptions = keys.filter((k) => k !== sortBy.primary);
  return (
    <div className="facet">
      <button className={active ? 'active' : ''} onClick={onToggle}>
        {t('filter.sortBy')} ▾
      </button>
      {open && (
        <div className="facet-menu sort-menu">
          <label>
            {t('filter.sortPrimary')}
            <select
              value={sortBy.primary}
              onChange={(e) => {
                const primary = e.target.value;
                // Dropping the secondary if it now collides with the new primary.
                const secondary = sortBy.secondary === primary ? null : sortBy.secondary;
                onChange({ primary, secondary });
              }}
            >
              {keys.map((k) => (
                <option key={k} value={k}>{labelFor(k)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('filter.sortSecondary')}
            <select
              value={sortBy.secondary || ''}
              onChange={(e) => onChange({ ...sortBy, secondary: e.target.value || null })}
            >
              <option value="">{t('filter.sortNone')}</option>
              {secondaryOptions.map((k) => (
                <option key={k} value={k}>{labelFor(k)}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire `SortPicker` into the `FilterBar` component**

Add the import at the top of `web/src/components/FilterBar.jsx`:

```js
import { sortFacetOptions, SORT_KEYS } from '../lib/filter.js';
```

Update the `FilterBar` export's props (currently line 97) to accept `sortBy`/`onSortChange`:

```js
export default function FilterBar({ facets, setNames = {}, filters, onChange, lang, onLangChange, isMobile, proxyMode, onProxyChange, onOpenDocs, sortBy, onSortChange }) {
```

Add a label function for the sort keys, near the existing `optionLabel` function:

```js
  const sortKeyLabel = (key) => t(SORT_KEY_LABEL[key]);
```

Render `SortPicker` first inside `filterbar-bottom` (before `{facet('sets', ...)}`):

```jsx
      <div className="filterbar-bottom" style={isMobile && !filtersOpen ? { display: 'none' } : undefined}>
        <SortPicker
          sortBy={sortBy}
          onChange={onSortChange}
          open={openKey === 'sort'}
          onToggle={() => setOpenKey((k) => (k === 'sort' ? null : 'sort'))}
          keys={SORT_KEYS}
          labelFor={sortKeyLabel}
          t={t}
        />
        {facet('sets', t('filter.set'))}
        ...
```

(keep the rest of the block exactly as Task 1/2 left it).

- [ ] **Step 4: Add `.sort-menu` CSS**

In `web/src/styles.css`, right after the `.facet-menu label:hover` rule (around line 125):

```css
/* Sort picker: two stacked selects rather than the checkbox-list layout the
   other facet menus use -- a sort has exactly one active choice per slot,
   so a <select> is the right control, and stacking (not side-by-side) is
   what keeps the menu inside a 320px viewport. */
.sort-menu { display: flex; flex-direction: column; gap: 8px; min-width: 200px; }
.sort-menu label { display: flex; flex-direction: column; gap: 4px; align-items: stretch; cursor: default; }
.sort-menu select { padding: 6px; border-radius: 4px; border: 1px solid var(--line); background: var(--panel); color: var(--text); }
```

- [ ] **Step 5: Add `sortBy` state to `App.jsx` and pass it through**

In `web/src/App.jsx`, add state near the other filter-adjacent state (right after `const [filters, setFilters] = useState({});` around line 29):

```js
  // Independent from `filters` on purpose: "Reset filters" must not also
  // reset how the grid is sorted -- see design spec 2026-08-09.
  const [sortBy, setSortBy] = useState({ primary: 'sets', secondary: null });
```

Find the `<FilterBar` element and add the two new props:

```jsx
        <FilterBar
          facets={derivedFacets}
          setNames={setNames}
          filters={filters}
          onChange={setFilters}
          lang={uiLang}
          onLangChange={setUiLang}
          isMobile={isMobile}
          proxyMode={proxyMode}
          onProxyChange={setProxyMode}
          onOpenDocs={() => setShowDocs(true)}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
```

(Match this against the actual current prop list on the existing `<FilterBar ...>` call — add `sortBy`/`onSortChange` to whatever is already there rather than retyping props that may have evolved; do not remove any existing prop.)

Add `sortBy={sortBy}` to the existing `<CardBrowser ...>` call (line ~291):

```jsx
        <CardBrowser cards={cards} filters={filters} sortBy={sortBy} quantities={quantities} lang={uiLang} onChangeQty={changeQty} onToggle={toggleCard} onSelectAll={selectAll} isMobile={isMobile} onPreview={openPreview} proxyMode={proxyMode} setNames={setNames} deckMode={deck.mode} side={deck.mode === 'deckbuilding' ? deck.ruleset?.side ?? null : null} zones={zones} changeZoneQty={changeZoneQty} capCtx={capCtx} />
```

- [ ] **Step 6: Apply `sortCards` in `CardBrowser.jsx`**

Add imports at the top of `web/src/components/CardBrowser.jsx`:

```js
import { filterCards, sortCards } from '../lib/filter.js';
import { cardName, cardImageSrc, cardThumbSrc, setLabel } from '../lib/lang.js';
import { localize } from '../lib/rules/docText.js';
```

(`cardName`/`cardImageSrc`/`cardThumbSrc` are already imported from `../lib/lang.js` — add `setLabel` to that same line rather than a new import line. `localize` is new; add it alongside the existing `capTitle` import from `../lib/rules/docText.js`, i.e. change `import { capTitle } from '../lib/rules/docText.js';` to `import { capTitle, localize } from '../lib/rules/docText.js';`.)

Update the `CardBrowser` export's props (currently line 119) to accept `sortBy`:

```js
export default function CardBrowser({ cards, filters, sortBy, quantities, lang, onChangeQty, onToggle, onSelectAll, isMobile, onPreview, proxyMode, setNames, deckMode, side, zones, changeZoneQty, capCtx }) {
```

Right after the existing `filtered` memo (currently line 122), add the sort step and the `labelFor` it needs:

```js
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  // Mirrors FilterBar's own optionLabel: sort on what the facet menu would
  // display for that value, not the raw English data -- consistent with
  // sortFacetOptions. sets/alignments/races have dictionary entries;
  // everything else (subtypes/skills/rarities/artists) has none and shows
  // its raw value, same as those facet menus do today.
  const sortLabelFor = useMemo(() => (key, v) => {
    if (key === 'sets') return setLabel(setNames, v, lang);
    if (key === 'alignments') return localize(t, 'alignment', v);
    if (key === 'races') return localize(t, 'race', v);
    return v;
  }, [setNames, lang, t]);
  const sorted = useMemo(
    () => sortCards(filtered, sortBy, { lang, labelFor: sortLabelFor }),
    [filtered, sortBy, lang, sortLabelFor]
  );
```

Then change every downstream use of `filtered` in this file to `sorted` instead — search the rest of `CardBrowser.jsx` for `filtered` (there is at least the `visible`/`shown` computation a few lines below, currently `const visible = side && !showAll ? filtered.filter(legal) : filtered;`) and replace those occurrences with `sorted`. Do not rename the memo itself if other code in the file (below what was read during planning) references `filtered` for a reason unrelated to display order — read the whole file first with `grep -n "filtered" web/src/components/CardBrowser.jsx` before doing a blind replace, since the plan was written from a partial read of this file.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failing files.

- [ ] **Step 8: Manually verify in the dev preview**

Start the dev server, open "Trier par", confirm:
- Default state shows Set / Aucun and the grid order matches today's (set, then card_id).
- Picking "Type" as 1er critère re-sorts the grid by type in play order (Character, Resource, Hazard, Site, Region), not alphabetically.
- Picking a 2e critère breaks ties within the 1er critère.
- Clicking "Réinitialiser" (with some filters active) clears the filters but leaves the sort picker's selection untouched.
- The two `<select>`s stack vertically and stay readable at a 375px mobile width.

- [ ] **Step 9: Commit**

```bash
git add web/src/App.jsx web/src/components/FilterBar.jsx web/src/components/CardBrowser.jsx web/src/lib/i18n.js web/src/styles.css
git commit -m "feat: add configurable two-key sort picker to FilterBar"
```

---

## Task 5: Update `docs/ARCHITECTURE.md` and `README.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§5 App state, §10 components/CSS, §15 journal, header date)
- Modify: `README.md` (only if it documents the filter bar's behavior — check first)

**Interfaces:** None — documentation only.

- [ ] **Step 1: Read the current §5 and §10 of `docs/ARCHITECTURE.md`**

Run: `grep -n "^## \|^§5\|^§10\|^§15" docs/ARCHITECTURE.md` to find the section boundaries, then read §5 and §10 in full to match their existing style before editing.

- [ ] **Step 2: Add to §5 (App state)**

Document the new `sortBy` state: its shape (`{ primary, secondary }`), that it is deliberately separate from `filters` so "Reset filters" doesn't touch it, and that it is not persisted to `localStorage` (unlike `proxyMode`) — it resets to `{ primary: 'sets', secondary: null }` on reload.

- [ ] **Step 3: Add to §10 (components/CSS/mobile)**

Document: the facet order in `FilterBar`, the "Ally" exclusion from the skills menu (data-layer keeps it via `cardTags`, only the menu hides it — via `excludeSkill` in `parseCards.js`), `unique` now being a two-value facet instead of a toggle, and the new `SortPicker` component (two stacked `<select>`s, reuses the facet dropdown's single-open-menu mechanism).

- [ ] **Step 4: Add a §15 journal entry**

Dated 2026-08-09, summarizing: skills menu cleanup, facet reorder, unique-as-facet, and the new configurable sort with card_id as an always-implicit final tiebreak. Reference the spec at `docs/superpowers/specs/2026-08-09-filterbar-redesign-design.md`.

- [ ] **Step 5: Bump the header date at the top of `docs/ARCHITECTURE.md`**

- [ ] **Step 6: Check `README.md` for filter-bar documentation**

Run: `grep -n -i "filtr\|filter\|unique\|trier\|sort" README.md`. If it describes the old facet order, the unique toggle, or claims no sort exists, update those passages. If it doesn't mention the filter bar's internals at all, leave it untouched.

- [ ] **Step 7: Commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: record FilterBar redesign (skills cleanup, reorder, unique facet, sort picker)"
```

---

## Final Verification

- [ ] Run `npm test` one more time from a clean state — 0 failing files, 0 failing assertions.
- [ ] Re-read the design spec (`docs/superpowers/specs/2026-08-09-filterbar-redesign-design.md`) against the final diff — confirm every numbered requirement (1-4) has a corresponding change.
- [ ] Confirm `git status` is clean (everything committed) before calling the work done.
