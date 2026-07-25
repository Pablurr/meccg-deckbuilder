# Deck modes — freeform printing vs assisted deckbuilding — Design

Date: 2026-07-24
Status: Approved

## Goal

Split the app into **two deck modes**, chosen per deck and stored with it:

- **Freeform card printing** — today's behaviour, with the copy limits **removed**.
  A pure proxy-printing tool: any card, any number of copies.
- **Deckbuilding** — assists the user in building a **legal** deck. Asks for the
  faction (Wizard / Ringwraith / Fallen-wizard / Balrog), the game length
  (Starter / Standard / Long / Campaign) and the severity (tournament / casual),
  then continuously reports **warnings** for anything that does not comply with
  the official rules ([meccg.com](https://meccg.com/rules/),
  [councilofelrond.org](https://councilofelrond.org/)): banned cards, illegal
  alignments, copy limits, deck and sideboard sizes, starting pool.

A **documentation page** explains both modes and the rules applied, and the whole
UI becomes genuinely trilingual **EN + FR + ES**.

## Non-goals (YAGNI)

- **No hard blocking, ever.** Even in tournament mode nothing prevents adding a
  card. The app advises; the user decides.
- **No runtime fetching of rules.** The app is a static CDN-first SPA and must
  work offline. Rules are sourced once, committed as data, and versioned.
- **No guessing at unknown rules.** A rule that cannot be sourced emits no
  warning and is listed as unverified (see *Handling rule gaps*).
- **No in-game rules** (hazard limit, corruption checks, MP scoring at the
  council). This is deck *construction* only.
- **No deck-strength advice or suggestions.** Legality only, not strategy.
- **No separate app for each mode.** Card browser, filters, proxies, exports and
  import stay shared; deckbuilding adds a validation layer and two zone markings.

## Background (verified facts)

Verified against the repo and `cards/remastered-all/cards.json` (1683 cards):

- **Alignments present**: `Hero` 547, `Minion` 534, `Neutral` 502, `Stage` 64,
  `Balrog` 23, `Fallen-wizard` 9, `Dual` 4.
- **Types present**: `Resource` 767, `Hazard` 450, `Site` 220, `Character` 194,
  `Region` 52.
- **20 avatars** carry `attributes.avatar === true`, and they map cleanly onto the
  four factions: 5 Istari (TW, Hero), the 9 Nazgûl — 8 named Ringwraiths plus The
  Witch-king (LE, Minion) —, 5 fallen wizards (WH, Fallen-wizard), and The Balrog
  (BA, Balrog).
- Useful existing attributes: `unique`, `mind`, `race`, `subtype`, `keywords`,
  `marshallingPoints`, `haven`, `homeSite`, `siteType`, `underDeeps`, and
  **`playableAsStartingMinorItem`** — which identifies exactly the resources
  eligible for the starting pool.
- Decks are stored **client-side** in `localStorage` under `meccg.decks.v1`
  ([deckStore.js](web/src/lib/deckStore.js)). Adding fields to a deck record is
  backward compatible.
- Copy limits currently live in `maxCopies(card)`
  ([deck.js](web/src/lib/deck.js:21)): 3 by default, 1 for `Site`, 1 for unique,
  3 for avatars. `App.changeQty` clamps to it ([App.jsx](web/src/App.jsx:74)).
- Warnings already follow a **translation-ready descriptor** convention:
  `deckWarnings` returns `{ code, ... }` objects, never sentences
  ([deck.js](web/src/lib/deck.js:67)).
- `backGroupForType` already performs the play-deck / location-deck split
  (Site + Region → `locationdeck`, everything else → `playdeck`)
  ([deck.js](web/src/lib/deck.js:11)).
- **UI structure**: both the browser and the deck panel are grids of thumbnails
  (`.grid` / `.deck-mini-grid`) with an always-visible `.qty-ctrl` (`−  n  +`)
  overlaid on the image. The deck panel groups by **type** (`TYPE_ORDER`:
  Character, Resource, Hazard, Site, Region) and has **no tabs** today.
- UI chrome is translated **fr/en only**; `uiLang === 'es'` falls back to English
  text (`textLang` in [App.jsx](web/src/App.jsx:58)), while card *names* do render
  in Spanish.

## Prerequisite — rules sourcing pass

The local `meccg-rules` skill is treated as a **lead, not an authority**. Before
implementation, the rules are sourced from **councilofelrond.org** (and
meccg.com), and every rule entry records its source URL.

What the local knowledge base already suggests, to be confirmed:

| | Wizard | Ringwraith | Fallen-wizard | Balrog |
|---|---|---|---|---|
| Card alignments | Hero, Neutral | Minion, Neutral | Hero, Minion, Neutral, Stage | Minion, Neutral, Balrog |
| Copies (non-unique) | 3 | 3 | **2** (3 for Stage Resources) | 3 |
| Starting pool | ≤10 chars, 2 minor items | ≤6 chars (no Ringwraith, no agent), mind ≤20 | ≤5 chars, mind ≤5 | ≤6 chars, Orc/Troll, mind <9 |
| Unlimited sites | Havens | 4 Darkhavens | 4 Wizardhavens | Under-gates, Moria |
| Banned list | — | — | ~17 cards | ~27 cards (incl. all Ringwraith cards) |
| Sideboard by length | 30 / 30 / 35 / 40, +10 vs a Fallen-wizard opponent | | | |

**Open questions the sourcing pass must resolve** (deliberately not guessed):

1. Is `mind ≤ 20` (Ringwraith/Balrog pool) a **total across the company** or a
   **per-character cap**? Is Fallen-wizard `mind ≤ 5` per character? The two
   readings validate very differently.
2. The rule on **unique cards** in deck construction (the local base is silent).
3. **Play deck size** for Fallen-wizard and Balrog (only Wizard's 25–50 is known),
   and **location deck size** for Wizard.
4. Whether `Dual` (4 cards) and `Stage` alignments are legal per faction.
5. Exact, spelling-accurate banned lists for Fallen-wizard and Balrog.

Anything still unresolved after the pass ships as `unverified` and emits no
warning.

## Component 1 — Deck record and modes

The deck record gains three optional fields:

```js
{
  mode: 'freeform' | 'deckbuilding',
  ruleset: { faction, length, tournament },   // deckbuilding only
  zones: { sideboard: { [id]: n }, pool: { [id]: n } },
}
```

- A record **without** `mode` reads as `freeform`. No migration, no data loss.
- `quantities` keeps its current meaning: copies in the **main deck**
  (play or location, derived from the card type). `zones.sideboard` and
  `zones.pool` are **additional** copies, so a card can sit in both.
- **Freeform** removes the clamp: `maxCopies()` returns `Infinity` in that mode —
  no 3-max, no 1-per-unique, no 1-per-Site. `changeQty` clamps only at 0.

## Component 2 — Rules data (`web/src/lib/rules/`)

Declarative, hand-curated, sourced data — no logic:

- **`factions.js`** — one profile per faction: allowed alignments, copy limits
  (per alignment where they differ), avatar identification, starting-pool
  constraints, site rules.
- **`formats.js`** — game lengths → numeric thresholds (sideboard 30/30/35/40,
  the +10 Fallen-wizard allowance, deck size ranges).
- **`banned.js`** — banned lists per faction, expressed by English card name and
  **resolved to ids at load time**.
- **`zones.js`** — which zones a card may occupy, from its type:

  | Card type | Default counter | Revealed on expand |
  |---|---|---|
  | Site / Region | **Location** (only) | — none |
  | Character | **Pool** | Deck + Sideboard |
  | Resource / Hazard | **Deck** | Sideboard |
  | Resource with `playableAsStartingMinorItem` | **Deck** | Sideboard + Pool |

**Every rule entry carries `{ id, status, source }`** where `status` is
`verified` | `unverified` | `disputed` and `source` is the CoE URL. The stable
`id` is what the documentation page displays and what a community report refers
to, so correcting a rule is a one-line data edit plus a test — never a code
change.

### Handling rule gaps

A rule that cannot be sourced is recorded with `status: 'unverified'` and
**emits no warning**. It is listed explicitly on the documentation page under
"what is not checked". A validator that invents a threshold is worse than one
that admits a gap: it would fail legal decks.

## Component 3 — Validator (`web/src/lib/rules/validate.js`)

One pure function, no React dependency:

```js
validateDeck({ faction, length, tournament, quantities, zones, cardsById })
  → [{ ruleId, code, severity, params }]
```

It returns **translatable descriptors**, never sentences — extending the existing
`deckWarnings` convention. Severities:

- **`error`** — outright illegality: banned card, alignment not allowed for the
  faction, copy limit exceeded, missing or duplicate avatar.
- **`warning`** — out of bounds: play deck, location deck, sideboard or pool size.
- **`info`** — a known but `unverified` rule, or advice.

**Tournament** surfaces `error`s prominently; **casual** downgrades everything one
notch so nothing reads as fatal. Neither ever blocks an action.

Checks covered: avatar present, unique, and matching the faction · per-card
alignment legality · banned list · copy limits (per faction and alignment,
uniques, sites) · play and location deck sizes · sideboard size for the length
(plus the +10 Fallen-wizard allowance) · starting pool (character count, mind,
minor items) · one copy per site except the faction's unlimited havens.

### Warning message quality bar

Message clarity is an acceptance criterion, not a detail. Every warning states:

1. **what** is wrong, 2. **which cards** (named), 3. **the rule and its
threshold**, 4. **the corrective action**.

> **Too many copies — *Orc-warband* ×3.** A Fallen-wizard deck allows 2 copies of
> a non-unique card (3 for Stage Resources). Remove 1 copy.
> `FW-COPIES-2` · *report this rule*

## Component 4 — UI

### Deck setup (`DeckSetupDialog.jsx`)

On deck creation: mode choice; if deckbuilding, faction + length + tournament
toggle. Editable afterwards from the deck settings.

### Card browser

Counters follow the `zones.js` table above: the **default zone counter** is
always visible over the thumbnail, and a compact summary bar expands the
remaining zones on click. Sites and Regions show a single counter and no
expander. Rationale: the thumbnail is the heart of this app (proxies, frame
luminance, hover preview) and sideboard/pool concern a minority of cards —
stacking three control bars on every catalogue card costs more than it returns,
and breaks the mobile grid.

**Legality filter** is on by default in deckbuilding: only cards legal for the
faction are listed, with a *show all* toggle to override. An illegal card shown
this way stays addable but carries a visible marker.

### Deck panel

**Zone tabs** become the navigation axis — Play deck / Location / Sideboard /
Pool — each showing its count against its threshold, turning red on breach
(`Sideboard 32 / 30`), so an overflow is visible without opening the tab. The
existing grouping **by type** is preserved inside each tab.

**Drag and drop**: since zones live in separate tabs, the drop target is the
**tab itself**. This works even when the destination zone is empty, and avoids
the tactile drag-between-visible-sections problem on mobile.

`DeckPanel.jsx` is already 9.3 KB and holds `MiniCard` internally; adding tabs
and drag-and-drop would push it well past a workable size. `MiniCard` is
extracted to its own file — housekeeping directly motivated by this work, not
opportunistic refactoring.

## Component 5 — Documentation page (`RulesDoc.jsx`)

Reachable from the header, rendered in the current UI language. Content is
**hybrid**:

- **Hand-written, hand-translated prose** — what each mode is for, what a
  sideboard and a starting pool are, how to read a warning.
- **Generated tables** — rules, thresholds, banned lists and each rule's
  `status` and `source`, rendered from `web/src/lib/rules/`.

The generated half means the documentation **cannot drift** from the validator:
changing a limit in the data changes the page with it. Each rule is shown with
its stable id and a *report this rule* link that pre-fills a GitHub issue,
which is the community-feedback loop.

## Component 6 — Trilingual UI (EN + FR + ES)

`web/src/lib/i18n.js` gains a **complete `es` dictionary** covering the existing
chrome as well as the new deckbuilding and documentation strings, and
[App.jsx](web/src/App.jsx:58) stops collapsing `uiLang === 'es'` to English:
`textLang` becomes `uiLang`. Card names already render in Spanish.

Warning descriptors carry `params` (card names, numbers), and card names inside a
warning follow the selected display language.

## Data flow

```
deck.mode ─ freeform ────────> maxCopies = Infinity, no validation
          └ deckbuilding ──> zonesFor(card) ──> browser counters + deck tabs
                                  │
              quantities + zones ─┴─> validateDeck(faction, length, tournament)
                                          │
                                          ▼
                       [{ ruleId, code, severity, params }]
                                          │
                            t(code, params) ──> warnings UI (en|fr|es)
                                          │
                       rules data ────────┴──> RulesDoc generated tables
```

## Error handling / edge cases

- **Unresolved banned name** — a misspelling would silently ban nothing. Names
  resolve to ids at load; a test asserts every banned name matches at least one
  real card, so a typo fails the suite loudly.
- **Mode switched on an existing deck** — freeform → deckbuilding keeps every
  card and simply starts reporting warnings (possibly many). Nothing is
  auto-removed. Copies above a limit are reported, not truncated.
- **Deckbuilding → freeform** — validation stops; `zones` are retained so
  switching back is lossless.
- **No avatar chosen yet** — reported as a `warning`, not an `error`, on an
  otherwise empty deck; an empty deck should not read as broken.
- **Unknown faction/length in a stored deck** (hand-edited storage) — falls back
  to freeform rather than throwing.
- **Card missing from `cardsById`** — skipped in validation, as `deckCounts`
  already does.

## Testing

Vitest, extending the existing ~59-test suite:

- **Translation key parity across three languages** (extends the current fr/en
  parity test).
- **Banned-name resolution**: every entry in `banned.js` resolves to ≥1 real card.
- **Zone eligibility**: `zonesFor` over all 1683 cards never throws and always
  returns at least one zone; sites yield exactly `location`.
- **Per-faction validation cases**, including the traps: Fallen-wizard 2 copies
  but 3 for Stage Resources; Ringwraith cards illegal for Balrog; a Ringwraith
  pool rejecting a Ringwraith or an agent; sideboard thresholds per length and
  the +10 Fallen-wizard allowance.
- **Severity mapping**: the same deck yields `error`s in tournament and softened
  severities in casual.
- **Freeform non-regression**: no copy cap, including Sites and uniques; existing
  export/import/proxy tests keep passing.
- **Backward compatibility**: a stored deck without `mode` loads as freeform.

## Files

- **New**: `web/src/lib/rules/{factions,formats,banned,zones,validate}.js`,
  `web/src/components/DeckSetupDialog.jsx`, `web/src/components/RulesDoc.jsx`,
  `web/src/components/MiniCard.jsx` (extracted), `test/rules.test.js`.
- **Edited**: [deck.js](web/src/lib/deck.js) (`maxCopies` mode-aware),
  [App.jsx](web/src/App.jsx) (mode state, `textLang` = `uiLang`, zone actions),
  [DeckPanel.jsx](web/src/components/DeckPanel.jsx) (zone tabs, drop targets),
  [CardBrowser.jsx](web/src/components/CardBrowser.jsx) (zone counters, legality
  filter), [DeckManager.jsx](web/src/components/DeckManager.jsx) (persist mode and
  ruleset), [deckStore.js](web/src/lib/deckStore.js) (new fields),
  [i18n.js](web/src/lib/i18n.js) (full `es` dictionary + new keys),
  [FilterBar.jsx](web/src/components/FilterBar.jsx) (docs link), `styles.css`.
