# Filter improvements — design

Date: 2026-07-08

Three enhancements to the card-browser filter bar.

## 1. Two-row filter bar layout

`web/src/components/FilterBar.jsx` moves from a single wrapping flex row to a
column container with two rows:

- **Row 1** (`.filterbar-top`): MECCG logo (image) + language toggle (FR/EN) +
  name search field + new card-text search field.
- **Row 2** (`.filterbar-bottom`): facet dropdowns (Set, Type, Alignment,
  Rarity, Race, Subtype, Skills, Keywords) + Unique toggle + reset link.

The logo replaces the previous `MECCG` text `<span class="brand">`. The image
lives at `web/public/meccg-logo.png` (Vite `publicDir`, served at `/` in dev and
copied into `web/dist` for the Fastify prod server). Rendered as
`<img class="brand-logo" src="/meccg-logo.png" alt="MECCG">`.

CSS (`web/src/styles.css`): `.filterbar` becomes `flex-direction: column;
align-items: stretch`. Two child rows (`.filterbar-top`, `.filterbar-bottom`)
are `display: flex; flex-wrap: wrap; align-items: center; gap: 8px`. The name
and card-text inputs share the top row; the language toggle is pushed to the
right (`margin-left: auto`).

## 2. Card-text filter

A new search box that scans the printed game text of each card.

- **Backend** (`src/cards.js`): `flattenCards` keeps a new `text` field — a
  single plain-text string built from `card.text.en`, `.fr`, `.es`, with HTML
  tags stripped and joined by spaces. One compact string, not the raw 3-language
  HTML. A `stripHtml` helper removes `<...>` tags and collapses whitespace.
- **Frontend** (`web/src/lib/filter.js`): new filter key `cardText`. Matching is
  accent-insensitive substring (reuses `normalizeText`, same as the name filter)
  against `card.text`.
- **i18n** (`web/src/lib/i18n.js`): new key `filter.searchText`
  (fr: « Rechercher dans le texte… », en: "Search card text…").

## 3. Deduplicated race / subtype / skills filters

These three fields hold compound values. The filters must present only base
options and match cumulatively any card carrying the tag.

All tag logic lives in one new client module `web/src/lib/tags.js` (single
source of truth):

- Per-facet config: `skills` → attribute `skills`, delimiter `/`; `subtypes` →
  attribute `subtype`, delimiter `/`; `races` → attribute `race`, delimiter `,`
  plus a singular/plural alias map.
- `RACE_ALIASES` folds plural/variant forms onto the singular base:
  `Animals→Animal, Dwarves→Dwarf, Elves→Elf, Men→Man, Orcs→Orc, Trolls→Troll,
  Wolves→Wolf, Dúnedain→Dúnadan`. Giants / Spiders / Bears keep their form (no
  singular partner in the data).
- `splitTags(value, key)` → array of trimmed base tokens (delimiter split +
  alias canonicalization).
- `cardTags(card, key)` → base tokens for a card's field.
- `baseOptions(cards, key)` → sorted unique base tokens across all cards (used
  to build the facet option lists).

**Facets**: `web/src/App.jsx` derives `derivedFacets` — the backend facets with
`races`, `subtypes`, `skills` replaced by `baseOptions(cards, key)`. The backend
`computeFacets` is left unchanged (its compound lists for these three are simply
overridden client-side). `derivedFacets` is passed to `FilterBar`.

**Matching** (`filter.js`): for `races`/`subtypes`/`skills`, a card passes if at
least one selected base token is among the card's tokens (OR within the facet,
matching current behaviour). Example: card race `Orcs,Men` → tokens
`[Orc, Man]`; selecting `Man` matches. Card skills `Warrior/Diplomat/Sage` →
selecting `Sage` matches.

**Backward compatible**: a plain single value (`Troll`, `Short-event`) yields a
one-element token list, so existing single-value filter behaviour and tests
still pass.

## Testing (TDD)

- `test/tags.test.js` (new): `splitTags` delimiters, race aliases, `baseOptions`
  dedup + sort.
- `test/filter.test.js`: add compound-race match, skills/subtype token match,
  and `cardText` substring cases.
- `test/cards.test.js`: assert `flattenCards` produces a stripped, concatenated
  `text` string.

## Out of scope

No unrelated refactoring. Backend matching/facet logic for these fields is not
introduced (all tag handling stays client-side, where filtering already runs).
