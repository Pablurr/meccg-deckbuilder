# Deck modes — freeform printing vs assisted deckbuilding — Design

Date: 2026-07-24
Status: Approved

## Goal

Split the app into **two deck modes**, chosen per deck and stored with it:

- **Freeform card printing** — today's behaviour, with the copy limits **removed**.
  A pure proxy-printing tool: any card, any number of copies.
- **Deckbuilding** — assists the user in building a **legal** deck. Asks for the
  side (Wizard / Ringwraith / Fallen-wizard / Balrog), the game length
  (Starter / Standard / Long / Campaign) and the severity (tournament / casual),
  then continuously reports **warnings** for anything that does not comply with
  the official rules ([meccg.com](https://meccg.com/rules/),
  [councilofelrond.org](https://councilofelrond.org/)): banned cards, illegal
  alignments, copy limits, deck and sideboard sizes, starting pool.

Every rule is **individually switchable** from the documentation page, so the user
decides exactly what is strictly enforced.

A **documentation page** explains both modes and the rules applied, and the whole
UI becomes genuinely trilingual **EN + FR + ES**.

## Terminology

**"Side"** denotes the four player camps: Wizard, Ringwraith, Fallen-wizard,
Balrog. Code uses `side`; the UI says *Camp* (FR), *Side* (EN), *Bando* (ES).

The word **"faction" is reserved** for the game's own concept — the Faction card
category (Orc, Troll, Dragon, Wolf, Animal factions) and its marshalling-point
category. It must never be used for a side, in code, UI or warnings.

**"Alignment"** stays the card attribute (Hero, Minion, Neutral, Balrog,
Fallen-wizard, Dual, Stage). A side allows several alignments.

## Non-goals (YAGNI)

- **No hard blocking, ever.** Even in tournament mode nothing prevents adding a
  card. The app advises; the user decides.
- **No runtime fetching of rules.** The app is a static CDN-first SPA and must
  work offline. Rules are committed as data and versioned.
- **No guessing at unknown rules.** A rule that is not sourced ships disabled and
  emits no warning (see *Rule status and enforcement*).
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
  four sides: 5 Istari (TW, Hero), the 9 Nazgûl — 8 named Ringwraiths plus The
  Witch-king (LE, Minion) —, 5 fallen wizards (WH, Fallen-wizard), and The Balrog
  (BA, Balrog).
- Useful existing attributes: `unique`, `mind`, `race`, `subtype`, `keywords`,
  `marshallingPoints`, `haven`, `homeSite`, `siteType`, `underDeeps`, and
  **`playableAsStartingMinorItem`** — which identifies exactly the resources
  eligible for the starting pool.
- **`attributes.specific`** carves out the side-specific card pools, and is the
  only way several rules become implementable. Verified counts: **46 BA cards**
  with `specific: "Balrog"` (e.g. `BA-2` Azog) — precisely the "Balrog specific"
  cards the rules name as *exceptions* to the Orc/Troll and mind restrictions —
  and **33 WH cards** naming a single fallen wizard (`Alatar` 6, `Gandalf` 7,
  `Pallando` 6, `Radagast` 8, `Saruman` 6). The latter is a **per-avatar**
  constraint finer than the side: a Saruman deck cannot play Gandalf-specific
  cards.
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

## Rules data — stubs first, real values later

The rules engine is built and tested against **stub rule data**: the full shape,
real rule ids, plausible placeholder values, and an explicit `status`. The user
supplies authoritative sources afterwards, and filling them in is **data editing,
not code**. Nothing in the engine, the UI or the documentation page waits on the
sourcing pass.

The local `meccg-rules` skill is a **lead, not an authority**. What it suggests,
to be confirmed against councilofelrond.org:

| | Wizard | Ringwraith | Fallen-wizard | Balrog |
|---|---|---|---|---|
| Card alignments | Hero, Neutral | Minion, Neutral | Hero, Minion, Neutral, Stage | Minion, Neutral, Balrog |
| Copies (non-unique) | 3 | 3 | **2** (3 for Stage Resources) | 3 |
| Starting pool | ≤10 chars, 2 minor items | ≤6 chars (no Ringwraith, no agent), mind ≤20 | ≤5 chars, mind ≤5 | ≤6 chars, Orc/Troll, mind <9 |
| Unlimited sites | Havens | 4 Darkhavens | 4 Wizardhavens | Under-gates, Moria |
| Banned list | — | — | ~17 cards | ~27 cards (incl. all Ringwraith cards) |
| Sideboard by length | 30 / 30 / 35 / 40, +10 vs a Fallen-wizard opponent | | | |

**Known unknowns**, shipped as `unverified` (hence disabled) until sourced:

1. Is `mind ≤ 20` (Ringwraith/Balrog pool) a **total across the company** or a
   **per-character cap**? Is Fallen-wizard `mind ≤ 5` per character? The two
   readings validate very differently.
2. The rule on **unique cards** in deck construction.
3. **Play deck size** for Fallen-wizard and Balrog (only Wizard's 25–50 is known),
   and **location deck size** for Wizard.
4. Whether `Dual` (4 cards) and `Stage` alignments are legal per side.
5. Exact, spelling-accurate banned lists for Fallen-wizard and Balrog.

## Component 1 — Deck record and modes

The deck record gains three optional fields:

```js
{
  mode: 'freeform' | 'deckbuilding',
  ruleset: { side, length, tournament, ruleOverrides: { [ruleId]: boolean } },
  zones: { sideboard: { [id]: n }, pool: { [id]: n } },
  notes: { starting, resourceStrategy, hazardStrategy, other },  // plain text
}
```

- A record **without** `mode` reads as `freeform`. No migration, no data loss.
- `quantities` keeps its current meaning: copies in the **main deck**
  (play or location, derived from the card type). `zones.sideboard` and
  `zones.pool` are **additional** copies, so a card can sit in both.
- **Freeform** removes the clamp: `maxCopies()` returns `Infinity` in that mode —
  no 3-max, no 1-per-unique, no 1-per-Site. `changeQty` clamps only at 0.
- `ruleOverrides` is **per deck**: two decks can be validated differently, and the
  settings travel with the deck.
- `notes` holds four free-text fields (see *Notes*). They are **not** validated
  and exist in freeform mode too.

## Component 2 — Rules data (`web/src/lib/rules/`)

Declarative, hand-curated data — no logic:

- **`sides.js`** — one profile per side: allowed alignments, copy limits (per
  alignment where they differ), avatar identification, starting-pool constraints,
  site rules, and how `attributes.specific` is read — as an **exemption** for
  Balrog (`specific: "Balrog"` cards escape the Orc/Troll and mind restrictions)
  and as a **restriction** for Fallen-wizard (a card naming a fallen wizard is
  legal only in that wizard's deck).
- **`formats.js`** — game lengths → numeric thresholds (sideboard 30/30/35/40,
  the +10 Fallen-wizard allowance, deck size ranges).
- **`banned.js`** — banned lists per side, expressed by English card name and
  **resolved to ids at load time**.
- **`zones.js`** — which zones a card may occupy, from its type:

  | Card type | Default counter | Revealed on expand |
  |---|---|---|
  | Site / Region | **Location** (only) | — none |
  | Character | **Pool** | Deck + Sideboard |
  | Resource / Hazard | **Deck** | Sideboard |
  | Resource with `playableAsStartingMinorItem` | **Deck** | Sideboard + Pool |

### Rule status and enforcement

**Every rule entry carries `{ id, status, source, defaultEnabled }`** where
`status` is `verified` | `unverified` | `disputed` and `source` is the reference
URL. The stable `id` is what the documentation page displays, what a per-rule
checkbox targets, and what a community report refers to.

Enforcement resolves as: `ruleOverrides[id] ?? defaultEnabled`, where
`defaultEnabled` is true only for `verified` rules. **A disabled rule is not
evaluated and emits nothing.**

This is a single mechanism serving two purposes: unsourced rules simply start
disabled, and the user can enable them if they know the real rule — or disable a
verified one they disagree with. Correcting a rule stays a one-line data edit
plus a test, never a code change.

## Component 3 — Validator (`web/src/lib/rules/validate.js`)

One pure function, no React dependency:

```js
validateDeck({ side, length, tournament, ruleOverrides, quantities, zones, cardsById })
  → [{ ruleId, code, severity, params }]
```

It returns **translatable descriptors**, never sentences — extending the existing
`deckWarnings` convention. Severities:

- **`error`** — outright illegality: banned card, alignment not allowed for the
  side, copy limit exceeded, missing or duplicate avatar.
- **`warning`** — out of bounds: play deck, location deck, sideboard or pool size.
- **`info`** — advice, or a rule the user enabled that is still `unverified`.

**Tournament** surfaces `error`s prominently; **casual** downgrades everything one
notch so nothing reads as fatal. Neither ever blocks an action.

Checks covered: avatar present, unique, and matching the side · per-card alignment
legality · banned list · copy limits (per side and alignment, uniques, sites) ·
play and location deck sizes · sideboard size for the length (plus the +10
Fallen-wizard allowance) · starting pool (character count, mind, minor items) ·
one copy per site except the side's unlimited havens · **`specific` handling** —
Balrog-specific cards exempted from the Orc/Troll and mind limits, and
wizard-specific cards rejected when they name a different fallen wizard than the
deck's avatar.

### Warning message quality bar

Message clarity is an acceptance criterion, not a detail. Every warning states:

1. **what** is wrong, 2. **which cards** (named), 3. **the rule and its
threshold**, 4. **the corrective action**.

> **Too many copies — *Orc-warband* ×3.** A Fallen-wizard deck allows 2 copies of
> a non-unique card (3 for Stage Resources). Remove 1 copy.
> `FW-COPIES-2` · *disable this rule* · *report this rule*

*Disable this rule* flips the same per-deck checkbox exposed on the documentation
page, so a rule can be silenced where it is met rather than hunted down.

## Component 4 — UI

### Deck setup (`DeckSetupDialog.jsx`)

On deck creation: mode choice; if deckbuilding, side + length + tournament
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
side are listed, with a *show all* toggle to override. An illegal card shown this
way stays addable but carries a visible marker.

### Deck panel

**Zone tabs** become the navigation axis, in this order — **Play deck / Pool /
Sideboard / Location / Notes** — each zone tab showing its count against its
threshold, turning red on breach (`Sideboard 32 / 30`), so an overflow is visible
without opening the tab. The existing grouping **by type** is preserved inside
each tab. The Notes tab carries no count.

**Drag and drop**: since zones live in separate tabs, the drop target is the
**tab itself**. This works even when the destination zone is empty, and avoids
the tactile drag-between-visible-sections problem on mobile.

`DeckPanel.jsx` is already 9.3 KB and holds `MiniCard` internally; adding tabs
and drag-and-drop would push it well past a workable size. `MiniCard` is
extracted to its own file — housekeeping directly motivated by this work, not
opportunistic refactoring.

### Notes (`DeckNotes.jsx`)

The last tab holds four free-text areas, labelled in the UI language:

1. **Starting notes** — opening hand, starting company, mulligan plan.
2. **Resource strategy**
3. **Hazard strategy**
4. **Other notes**

Plain text, no formatting toolbar. Saved with the deck (debounced) into
`deck.notes`, and available in **both modes** — a freeform printing deck can
carry notes just as well. Empty fields are omitted from exports.

## Component 5 — Documentation page (`RulesDoc.jsx`)

Reachable from the header, rendered in the current UI language. Content is
**hybrid**:

- **Hand-written, hand-translated prose** — what each mode is for, what a
  sideboard and a starting pool are, how to read a warning.
- **Generated tables** — rules, thresholds, banned lists and each rule's `status`
  and `source`, rendered from `web/src/lib/rules/`.

The generated half means the documentation **cannot drift** from the validator:
changing a limit in the data changes the page with it.

**Each rule row carries a checkbox** toggling strict enforcement of that rule for
the current deck, alongside its id, status and source link, plus a *report this
rule* link that pre-fills a GitHub issue. Unverified rules render unchecked, and
visibly so — the page doubles as the honest list of what is and is not enforced.

The page is reachable with **no deck open**, in which case the checkboxes render
read-only, showing defaults.

## Component 6 — Trilingual UI (EN + FR + ES)

`web/src/lib/i18n.js` gains a **complete `es` dictionary** covering the existing
chrome as well as the new deckbuilding and documentation strings, and
[App.jsx](web/src/App.jsx:58) stops collapsing `uiLang === 'es'` to English:
`textLang` becomes `uiLang`. Card names already render in Spanish.

Warning descriptors carry `params` (card names, numbers), and card names inside a
warning follow the selected display language.

## Component 7 — Exports

A single ordering helper, `deckSections({ quantities, zones, cardsById })`, returns
the canonical section list and is the **only** source of export order, so the PDF
and the text list can never disagree:

| Section | Subsections, in order |
|---|---|
| **Pool** | Characters, Resources |
| **Play deck** | Avatar(s), Characters, Resources, Hazards |
| **Locations** | Sites, Regions |
| **Sideboard** | Characters, Resources, Hazards |

Within a subsection, cards keep the current alphabetical sort by display name.

### PDF — sheets in that order

`buildSheetPdf` already consumes a pre-ordered array
([pdf.js](web/src/lib/export/pdf.js:54)), so ordering is applied by the caller; the
PDF engine is untouched.

**One forced page break, and only one kind**: wherever the **back group changes**
(`backGroupForType`). The duplex path prints a mirrored backs page per sheet, so a
page straddling the play → location boundary would need two different backs on one
sheet and could not be printed duplex. No other section starts a new page —
breaking on every section would waste paper for no printing benefit.

*Consequence of the requested order*: Locations sit between Play deck and
Sideboard, which both use the play-deck back, so the back group changes **twice**
and up to two sheets end partially filled. This is a deliberate trade of a little
paper for the requested reading order.

### Text — the same structure in Markdown

[deckList.js](web/src/lib/deckList.js) currently emits one flat `## Type (n)` level.
It gains the section level: `## Section` / `### Subtype (n)`, keeping the existing
`Nx Card name` lines untouched so the list stays **re-importable**.

Notes are appended as a final `## Notes` section with one `###` per non-empty
field. *(Judgment call: notes were not listed in the export order, but a Markdown
deck list is their natural home. Easily dropped if unwanted.)*

**Round-trip fidelity matters here**: [importDeck.js](web/src/lib/importDeck.js) must
ignore heading lines and, when they match known section names, **restore the zone**
a card belongs to — otherwise exporting and re-importing a deckbuilding deck
silently collapses its pool and sideboard into the main deck.

### ZIP — unchanged

The MPC ZIP is for professional printing and keeps its current behaviour and
naming exactly.

## Data flow

```
deck.mode ─ freeform ────────> maxCopies = Infinity, no validation
          └ deckbuilding ──> zonesFor(card) ──> browser counters + deck tabs
                                  │
      quantities + zones ─────────┴─> validateDeck(side, length, tournament,
                                                   ruleOverrides)
                                          │  skips disabled rules
                                          ▼
                       [{ ruleId, code, severity, params }]
                                          │
                            t(code, params) ──> warnings UI (en|fr|es)
                                          │
                 rules data ──────────────┴──> RulesDoc tables + checkboxes
```

## Error handling / edge cases

- **Unresolved banned name** — a misspelling would silently ban nothing. Names
  resolve to ids at load; a test asserts every banned name matches at least one
  real card, so a typo fails the suite loudly.
- **Mode switched on an existing deck** — freeform → deckbuilding keeps every
  card and simply starts reporting warnings (possibly many). Nothing is
  auto-removed. Copies above a limit are reported, not truncated.
- **Deckbuilding → freeform** — validation stops; `zones` and `ruleOverrides` are
  retained so switching back is lossless.
- **No avatar chosen yet** — reported as a `warning`, not an `error`, on an
  otherwise empty deck; an empty deck should not read as broken.
- **Unknown side/length in a stored deck** (hand-edited storage) — falls back to
  freeform rather than throwing.
- **`ruleOverrides` referencing a rule id that no longer exists** — ignored, not
  an error; rule ids may be retired as rules are corrected.
- **Card missing from `cardsById`** — skipped in validation, as `deckCounts`
  already does.

## Testing

Vitest, extending the existing ~59-test suite:

- **Translation key parity across three languages** (extends the current fr/en
  parity test).
- **Rule metadata completeness**: every rule has an `id`, a `status`, and a
  message key in all three languages; ids are unique.
- **Banned-name resolution**: every entry in `banned.js` resolves to ≥1 real card.
- **Zone eligibility**: `zonesFor` over all 1683 cards never throws and always
  returns at least one zone; sites yield exactly `location`.
- **Enforcement toggles**: a disabled rule emits nothing; an `unverified` rule is
  silent by default and fires once enabled via `ruleOverrides`; an unknown rule id
  in `ruleOverrides` is ignored.
- **Per-side validation cases** against the stub data, including the traps:
  Fallen-wizard 2 copies but 3 for Stage Resources; Ringwraith cards illegal for
  Balrog; a Ringwraith pool rejecting a Ringwraith or an agent; sideboard
  thresholds per length and the +10 Fallen-wizard allowance.
- **`specific` handling**: a `specific: "Balrog"` card escapes the Orc/Troll and
  mind limits; a `specific: "Gandalf"` card is rejected in a Saruman deck and
  accepted in a Gandalf one.
- **Export ordering**: `deckSections` yields Pool → Play deck → Locations →
  Sideboard with the right subsection order; the PDF page-break rule fires
  exactly at back-group changes and nowhere else.
- **Text round-trip**: exporting a deckbuilding deck with a pool, a sideboard and
  notes, then re-importing it, restores the same zones and quantities.
- **Severity mapping**: the same deck yields `error`s in tournament and softened
  severities in casual.
- **Freeform non-regression**: no copy cap, including Sites and uniques; existing
  export/import/proxy tests keep passing.
- **Backward compatibility**: a stored deck without `mode` loads as freeform.
- **Terminology guard**: no user-facing string uses "faction" for a side.

## Files

- **New**: `web/src/lib/rules/{sides,formats,banned,zones,validate}.js`,
  `web/src/lib/export/deckSections.js`, `web/src/components/DeckSetupDialog.jsx`,
  `web/src/components/RulesDoc.jsx`, `web/src/components/DeckNotes.jsx`,
  `web/src/components/MiniCard.jsx` (extracted), `test/rules.test.js`,
  `test/deckSections.test.js`.
- **Edited**: [deck.js](web/src/lib/deck.js) (`maxCopies` mode-aware),
  [App.jsx](web/src/App.jsx) (mode state, `textLang` = `uiLang`, zone actions),
  [DeckPanel.jsx](web/src/components/DeckPanel.jsx) (zone tabs, drop targets,
  notes tab), [CardBrowser.jsx](web/src/components/CardBrowser.jsx) (zone counters,
  legality filter), [DeckManager.jsx](web/src/components/DeckManager.jsx) (persist
  mode, ruleset, notes), [deckStore.js](web/src/lib/deckStore.js) (new fields),
  [deckList.js](web/src/lib/deckList.js) (sections + subsections + notes),
  [importDeck.js](web/src/lib/importDeck.js) (skip headings, restore zones),
  [ExportDialog.jsx](web/src/components/ExportDialog.jsx) (ordered card list,
  page-break rule), [i18n.js](web/src/lib/i18n.js) (full `es` dictionary + new
  keys), [FilterBar.jsx](web/src/components/FilterBar.jsx) (docs link),
  `styles.css`.
