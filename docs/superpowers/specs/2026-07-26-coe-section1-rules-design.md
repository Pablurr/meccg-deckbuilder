# CoE §1 — real deckbuilding rules replace the stubs — Design

Date: 2026-07-26
Status: Draft

## Goal

Replace the stub rule data shipped with the deck-modes branch by the
**authoritative Council of Elrond rules, Section 1 (Deck Construction)**, and
give every warning a **traceable rule reference** the player can look up.

Source of record: <https://www.councilofelrond.org/rules/#Section1>

The work splits into three lots, deliberately ordered so that the only lot
requiring new architecture sits in the middle, with declarative lots on either
side:

| Lot | Content | Nature |
|---|---|---|
| **1** | Corrections, data-only rules, traceability, data-quality fixes | Data + small edits |
| **1b** | Copy caps become **hard limits** in deckbuilding mode | State layer + UI |
| **2** | `roleFor()` + play-deck composition (§1.5, §1.5.1) | **New engine capability** |
| **3** | Location deck (§1.4.x), FW stage pool (§1.7.F1), copy limits (§1.3.F1) | Data, once lot 2 lands |

The previous design's promise — *"filling in the values is data editing, not
code"* — holds for **21 of 47 clauses outright, and for 12 more after a change of
table shape**. The remaining 14 need lot 2. This document says exactly which,
and why.

## Scope change — copy caps become hard limits

The deck-modes design's non-goal *"No hard blocking, ever"* is **reversed for
per-card copy caps**, by owner decision (2026-07-26):

> In deckbuilding mode, `+` is impossible once a card is at its maximum number of
> copies. Freeform keeps no rules at all.

The reversal is **narrow and deliberate**: it covers *per-card copy caps only*
(§1.3.1, §1.3.F1, §1.4, §1.5's avatar cap). Every other rule — deck sizes,
creature minimum, pool composition, bans, alignments, sideboard size — stays
advisory, because those are properties of the deck as a whole and blocking them
would make a deck unbuildable while it is still being assembled. See
*Lot 1b* for the mechanism.

## Non-goals

- **No hard blocking beyond copy caps.** See the scope change above.
- **No opponent model.** §1.6.1's "+10 sideboard cards preselected for
  Fallen-wizard opponents" stays out: it depends on the *opponent's* side. The
  existing note in [formats.js](web/src/lib/rules/formats.js) was right and stays.
- **No in-game rules.** §1 is deck construction only.
- **No new persisted deck fields.** Everything below is derived from the cards
  plus the existing `{ side, length, tournament, ruleOverrides }` ruleset.
- **No destructive clamping.** A count already over its cap is never silently
  reduced (see *Lot 1b*, over-limit decks).

## Background — verified facts

All counts below were measured against `web/public/cards.json` (1683 cards) for
this spec, not assumed.

- **Fields that make §1 implementable**: `agent` (32), `spawn` (9), `stagePoints`
  (67), `underDeeps` (36 — all `true`), `siteType`, `subtype`, `unique`,
  `specific` (79), `keywords`, `playableAsResource` (4), `playableAsHazard` (2),
  `playableAsStartingMinorItem` (6), `race`, `mind`.
- **Agents**: 30 `Character/Minion` + 2 `Hazard/Neutral` (DM-28 Lobelia
  Sackville-Baggins, DM-29 My Precious, both `race: "Hazard Agent"`). Total mind
  across all 32 = **157**, so §1.3.2's 36-point budget genuinely bites.
- **Flexible cards**: `playableAsResource` = DM-63, LE-145, TW-104, TW-106;
  `playableAsHazard` = LE-235 Sudden Call, WH-71 Gnawed Ways (the latter also a
  Stage resource worth 1 stage point).
- **§1.4.1 is derivable.** The five Balrog sites with no Hero *and* no Minion
  counterpart are exactly BA-83 Ancient Deep-hold, BA-89 The Drowning-deeps,
  BA-95 Remains of Thangorodrim, BA-96 The Rusted-deeps, BA-104 The Wind-deeps —
  precisely the five the rule names. The derivation and the rule text agree, so
  the list is computed and a test asserts the five.
- **§1.4.B1 is derivable, with one dead end.** `underDeeps === true` OR
  `siteType === '{D}'` OR name ∈ {Moria, Carn Dûm, Dol Guldur, Minas Morgul}
  flags **18** Minion sites. 17 have a Balrog counterpart; **LE-409 Urlurtsu Nurn
  has none**, so for a Balrog player that site is simply unavailable — a
  different message, not the same "use the Balrog version" one.
- **BA-93 Moria** is the only Balrog site that is neither Under-deeps nor `{D}`,
  consistent with §1.4.B1 naming Moria explicitly.
- **`{D}` = Dark-hold, `{H}` = Haven** (13 `{H}` cards: 4 Hero havens, 4 Minion
  Darkhavens, 3 Fallen-wizard Wizardhavens, 2 Balrog).
- **Dragon manifestations carry no field.** The 18 `Ahunt`/`at Home` cards
  (TD-1…TD-71) are identifiable only by name — and a name regex is *unsafe*: it
  also matches **TD-143 "Not at Home"**, a Hero short-event that is not a
  manifestation at all. Hence a curated id list, not a pattern.
- **`spawn` and `keywords: ["Spawn"]` disagree**: 9 vs 12 cards. The union
  includes AS-71/LE-153 (Ally *resources*, not hazards) and DM-107 Durin's Bane
  (`subtype: "Creature"`, a full creature). Only the intersection with
  "hazard + permanent-event + not already a creature" is what §1.5.1 means.
- **Race values are inconsistent**: `Orc`/`Orcs`, `Troll`/`Trolls`,
  `Wolf`/`Wolves`, `Animal`/`Animals`, plus comma-joined values
  (`"Orcs,Men"`, `"Animals,Men,Bears"`, `"Balrog,Spawn"`). Substring matching
  survives `Orcs ⊃ Orc` but **fails on `Wolves` vs `Wolf`**.
- **Exactly one card name uses an ASCII apostrophe** (DM-107 `Durin's Bane`)
  against 82 using the typographic `’`. `fold()` normalises diacritics but not
  apostrophes, so a ban name pasted from the CoE site fails silently.
- **Two cards share the name "The Balrog"**: AS-71 (`Resource/Minion`, Ally) and
  **BA-3 (`Character/Balrog`, the Balrog player's own avatar)**.
- **Alignment `Dual`** exists on 4 cards (LE-245, LE-419, WH-38, WH-40) and is in
  no side's `alignments`, so `ALIGN-LEGAL` — an enabled-by-default error — flags
  them for every side.
- **`zonesFor` sends avatars to the pool.** Every `Character` gets
  `primary: 'pool'`, avatars included, but §1.7 defines the pool as up to ten
  **non-avatar** characters.

## Traceability (applies to all three lots)

Every rule gains a `ref` (or `refs`) naming its CoE clause, and the source URL
becomes the section anchor:

```js
{ id: 'AGENT-MIND', ref: '1.3.2', severity: 'error', status: 'verified',
  source: 'https://www.councilofelrond.org/rules/#Section1' }
```

- `refs: ['1.3.W2', '1.3.R2', '1.3.B2']` when one rule covers several clauses.
- `ref: null, house: true` for the two advisories that are **ours, not CoE's**:
  `AVATAR-PRESENT` and `DECKSIZE-LOCATION`. They must not claim a citation.
- Rendered as `CoE §1.3.2` in the DeckPanel warning row and in the RulesDoc
  table, linking to the anchor.
- The printed source has a numbering typo: the Fallen-wizard ban list is labelled
  **1.5.F6** where the sequence requires **1.3.F6**. We cite `1.3.F6` and record
  `printedAs: '1.5.F6'` so a player searching the page still finds it.

Because every rule below is now sourced, `status` becomes `'verified'`
throughout, which flips `defaultEnabled` on. **That is only safe after lot 1's
corrections land** — enabling today's `POOL-MIND` or `DECKSIZE-PLAY` by default
would emit warnings against legal decks.

Severities: §1 is hard legality, so `DECKSIZE-*`, `SIDEBOARD-MAX` and `POOL-*`
move from `warning` to `error`. The existing casual downgrade (one notch, never
below `info`) already provides the soft mode, so no new mechanism is needed.

---

# Lot 1 — corrections, data-only rules, traceability

No architectural change. Fixes what is wrong today and lands every clause that
needs no notion of card *role*.

## 1.1 Four rules are currently wrong

| Rule | Now | §1 says | Action |
|---|---|---|---|
| `POOL-CHARS` | `maxCharacters` 6 / 5 / 6 per side | **10 for every side** (§1.7) | data |
| `POOL-MIND` | `mindCap: 20` (RW), `mindPerCharacterMax: 5` (FW) / 9 (Balrog) | §1 states **no pool mind cap** at all. The 9 is §1.3.B4, which is deck-wide and already `BALROG-MIND` | **retire** the rule and all four fields |
| `POOL-ELIGIBLE.race` | `forbidRaces: ['Ringwraith','Agent']` (RW) | no basis in §1 | **retire** the code and the field |
| `DECKSIZE-PLAY`, `AVATAR-UNIQUE` | see lot 2 | — | retired in lot 2 |

Retiring is safe: `isRuleEnabled` already returns `false` for unknown ids, so
stored `ruleOverrides` mentioning a retired rule are ignored, not crashed on.

## 1.2 Data-quality fixes

1. **`fold()` normalises apostrophes** — add
   `.replace(/[’ʼ]/g, "'")` beside the existing diacritic strip, using
   explicit escapes per the module's existing note. Without it, every name
   pasted from the CoE page that contains `’` resolves to nothing, silently.
2. **`Dual` joins every side's `alignments`** — otherwise `ALIGN-LEGAL` reports
   4 legal cards as illegal for all four sides.
3. **Race matching becomes `matchesRace(value, wanted)`** — split on `,`, trim,
   and compare on a singularised form so `Wolves`→`Wolf`, `Animals`→`Animal`,
   `Elves`→`Elf`, `Dwarves`→`Dwarf`. Substring matching is replaced, not
   extended: §1.3.B4's faction list (Orc, Troll, Wolf, Animal, Dragon) is exactly
   where the current `includes` breaks.
4. **`zonesFor` excludes avatars from the pool** —
   `Character && attributes.avatar` returns `{ primary: 'deck', extra: ['sideboard'] }`.
   This flows into `dropTargets` for free (an avatar can no longer be dropped on
   Pool) because both read `zonesFor`.

## 1.3 Ban lists (§1.3.F6 printed 1.5.F6, §1.3.B5)

Five additions: Fallen-wizard gains `The Balrog (Ally)`; Balrog gains
`The Balrog (Ally)`, `Balrog of Moria` (TW-12), `Fell Rider` (LE-183) and the
`Ringwraith Unleashed` family.

Two shape changes are required, both forced by the data:

- **Entries may be id-qualified.** `"The Balrog (Ally)"` must ban AS-71 and *not*
  BA-3 — name-only matching would ban the Balrog player's own avatar inside his
  own deck. `BANNED` entries become `string | { name, id }`, and `resolveBanned`
  honours the id when present.
- **Entries may name a family.** `"Ringwraith Unleashed cards"` is 9 cards
  (LE-161, LE-162, LE-182, LE-193, LE-198, LE-200, LE-222, LE-248, LE-257), not a
  name. Supported as an explicit id list with a `label` for display, so the
  warning still reads as one concept.

The two data misspellings already absorbed and commented (`Excellance`,
`Trough`) stay as they are. The existing test *"every banned name resolves to at
least one real card"* is what keeps all of this honest, and now also asserts
that id-qualified entries resolve to exactly one card.

## 1.4 Clauses that land as pure data

| Clause | Content | Where |
|---|---|---|
| §1.1 | four lengths | already correct; only the `standard` **label** becomes "Short" (the official name; the id stays, it is persisted in deck records) |
| §1.2 | four sides | already correct |
| §1.3.1 | ≤3 non-unique, ≤1 unique, avatars exempt, havens exempt | `COPIES-LIMIT` / `UNIQUE-LIMIT` / `SITE-COPIES` — status flip only |
| §1.3.3 | a card playable as resource *or* hazard counts as either | see lot 2's flexible assignment |
| §1.3.W1/R1/F3/B1 | avatar alignment per side | already correct, verified against all 20 avatars |
| §1.3.W3/R3/F4/B3 | allowed card alignments | `alignments` lists + `Dual` |
| §1.3.B4 | mind < 9 for non-Balrog-specific characters | already correct (`>=` comparator on `balrogMindPerCharacterLimit: 9`) |
| §1.4.1 | five open Balrog sites | derived list (see lot 3) |
| §1.6.1 | sideboard 30/30/35/40 | already exact |
| §1.7 | pool ≤10 characters, ≤2 minor items | `maxCharacters: 10`; items below |

## 1.5 New rules in lot 1

**`AGENT-MIND` — §1.3.2.** Total mind of all `agent === true` cards across play
deck + sideboard + pool ≤ **36**. Side-independent, so it lives in a new
`GENERAL` export rather than per side. No `roleFor` needed: the rule counts
*agent cards*, however they are later classified.

**`SPECIFIC-AVATAR` extended — §1.3.4.** `specificMode: 'avatar-match'` also
applies to `wizard`: the five Wizard avatars are named Gandalf/Saruman/… and 33
cards carry `specific: <wizard name>`, so the constraint is per-avatar for
Wizard exactly as it is for Fallen-wizard.

**`SPECIFIC-SIDE` (new) — §1.3.4.** A card specific to an avatar the player
cannot declare is illegal. Concretely: the 38 `Resource/Minion specific:"Balrog"`
cards pass silently for a Ringwraith today. Rule: if `specific` names an avatar
whose alignment is not this side's `avatarAlignment`, emit.

**`REGION-EXCLUDED` (new) — §1.4.** A location deck includes no `Region` cards.
The 52 Region cards are already routed away from the pool by `zonesFor`; this
adds the missing warning.

**`POOL-ITEMS` corrected and qualified — §1.7.** Today the pool's item slots are
keyed on `playableAsStartingMinorItem`, which is the wrong attribute: those **6
cards are permanent-events** whose own text says they may be played *"with a
starting company **in lieu of a minor item**"* (AS-94, BA-31, BA-44, BA-60, BA-70,
WH-46). They **consume** an item slot; they are not the list of cards eligible for
one. §1.7's actual subject is minor items — `subtype === 'Minor Item'`, of which
there are **42**, currently unreachable from the pool at all.

- `zonesFor`: a `Resource` is pool-eligible when `subtype === 'Minor Item'` **or**
  `playableAsStartingMinorItem === true`.
- `POOL-ITEMS` counts both families against the cap of 2, with codes
  `POOL-ITEMS.count` (over the cap), `POOL-ITEMS.unique` and `POOL-ITEMS.hoard`
  (an ineligible item), following the existing one-id-several-codes precedent.
- The **non-unique / non-hoard** qualifier applies to `Minor Item` cards, which is
  what §1.7 speaks of. The six substitutes enter on their own card text — a
  card-level permission, not a §1.7 allowance — so the qualifier is not applied to
  them. 22 of the 42 Minor Items are `Hoard Item`-keyworded.

---

# Lot 1b — hard enforcement of copy caps

## 1b.1 One cap function, two consumers

The cap must be **derived from the same data as the warnings**, never a second
hardcoded copy of the limits — otherwise the button and the validator drift apart.
This is the mistake `zonesFor` was created to avoid, and the same pattern applies:

### Caps are cumulative across zones

**A copy limit counts the whole deck — play deck + sideboard + pool combined —
never one zone at a time.** The rules say so explicitly, twice:

- §1.6: a sideboard *"must adhere to any other deck restrictions when considered
  in conjunction with the play deck (e.g. **not exceeding the allowed maximum
  number of each specific card across the whole deck**)"*.
- §1.7: a pool *"adhere[s] to any deck restrictions when considered in conjunction
  with the play deck and the sideboard **other than total number of
  characters**"*.

§1.7's carve-out is the exact shape of the distinction: what is *per zone* is the
**count budget** (ten characters in the pool do not consume the play deck's ten);
what is *cumulative* is every **copy cap**. A unique card in the sideboard cannot
also be in the play deck. Nothing in §1 grants a zone a fresh allowance, and
§1.6.2 itself counts *"across their combined play deck and sideboard"*.

### Shape

A card can be subject to **several** caps at once, so the function returns all
applicable ones and the caller takes the tightest:

```js
// web/src/lib/rules/copies.js
copyCaps(card, { side, ruleOverrides })
//   -> [{ limit: number | Infinity, scope: 'total' | { zone }, ruleId }, ...]

remainingCopies(card, zone, { quantities, zones }, ctx)
//   -> min over caps of (limit - countIn(cap.scope));  0 means `+` is disabled
```

- `scope: 'total'` is the default and covers `COPIES-LIMIT`, `UNIQUE-LIMIT`,
  `SITE-COPIES` and the avatar total.
- `scope: { zone: 'sideboard' }` is an **additional** restriction layered on top of
  a total cap, never a replacement for it. Only one rule needs it: §1.6.2's one
  copy of each avatar in the sideboard.
- `ruleId` names the rule that produced the binding cap, so the UI can show the
  reason and the caller can honour `ruleOverrides`.

Avatars are the only card with two caps: **3 copies across the whole deck**, of
which **at most 1 may sit in the sideboard**. So 3 in the play deck leaves nothing
for the sideboard, and 2 in the play deck plus 1 in the sideboard is the other way
to spend the same three. (The avatar total of 3 is not printed as a number: §1.5
allows three in the play deck and §1.6's "across the whole deck" clause makes that
the whole-deck maximum.)

`validateDeck`'s three copy checks are refactored to call `copyCaps` instead of
reading `profile.copies` directly. A test asserts the two agree over all 1683
cards × 4 sides: **a card the counter blocks must be a card the validator would
have flagged, and vice versa.**

Caps in lot 1: 3 by default, 1 for a unique non-avatar, 1 for a site,
`Infinity` for a haven the side may repeat. Lot 2 adds the avatar caps; lot 3
rekeys the numbers on `(bucket, effectiveAlignment)`. **No UI work in lots 2–3** —
they change what `copyCaps` returns, nothing else.

## 1b.2 Enforcement lives in the state layer, not the button

There are **seven** paths that can add a copy today, so gating the `+` element
alone would leave most of them open:

| Path | Call site | Gate needed |
|---|---|---|
| Freeform browser `+` | [CardBrowser.jsx:111](web/src/components/CardBrowser.jsx:111) | **no** — freeform has no rules |
| Deckbuilding primary zone `+` | [CardBrowser.jsx:25](web/src/components/CardBrowser.jsx:25) | yes |
| Deckbuilding extra zones `+` | [CardBrowser.jsx:37](web/src/components/CardBrowser.jsx:37) | yes |
| Deck panel mini-card `+` (play / location / cards / sideboard / pool tabs) | [MiniCard.jsx:54](web/src/components/MiniCard.jsx:54) via `activeOnChangeQty` | yes |
| Mobile preview modal `+` | [CardPreviewModal.jsx:43](web/src/components/CardPreviewModal.jsx:43) | yes |
| Click card image (sets 1 copy) | `toggleCard` [App.jsx:113](web/src/App.jsx:113) | yes — see below |
| "Select all" (sets 1 copy each) | `selectAll` [App.jsx:123](web/src/App.jsx:123) | yes — see below |

`toggleCard` and `selectAll` look safe because they only ever set a count to 1,
but they write into the **deck** zone while a card may already sit at its cap in
another zone: one unique card in the pool, then a click on its image, gives a
total of 2 against a cap of 1. Both need the same guard.

So the guard goes in `App.jsx`'s mutators — `changeQty`, `changeZoneQty`,
`toggleCard`, `selectAll` — computed inside the `setQuantities`/`setZones`
updater from `prev`, never from a captured render value, so rapid clicks cannot
race past the cap.

`moveCopy` is **deliberately exempt**: it is `-1` then `+1` on the same card, so
the *total* cannot rise. Gating it would break drag-and-drop between zones for any
card sitting at its cap — which is exactly when a player most wants to move one.

The exemption is exact for every `scope: 'total'` cap, which is all of them but
one. The single exception is §1.6.2's sideboard sub-cap: dragging a second copy of
an avatar *into* the sideboard leaves the total untouched while breaking a zone
restriction, so it succeeds and `AVATAR-SIDEBOARD` reports it. Blocking the
gesture instead would mean a drag that silently does nothing, which the drop
handler has no way to explain — the mini-card is not where a rule citation can be
shown. Consistent with the rest of lot 1b, the refusal lives where the reason can
be displayed: the `+` button.

## 1b.3 Over-limit decks are never truncated

Counts above a cap arise legitimately: switching a freeform deck to
deckbuilding, importing a paste, changing side, or lot 3 lowering a limit
(Fallen-wizard's 2-copy categories). The cap therefore gates **increments only**:

- existing counts are left exactly as they are;
- `−` is never disabled;
- the validator keeps reporting `COPIES-LIMIT` / `UNIQUE-LIMIT` / `SITE-COPIES`
  so the player can see and fix the excess;
- `importDeckData` keeps its full-replace semantics unchanged — silently dropping
  imported copies would corrupt a deck the user pasted.

A test covers the mode switch: a freeform deck holding 5 copies of a non-unique
card, switched to deckbuilding, still holds 5, reports the excess, and refuses a
6th.

## 1b.4 The `ruleOverrides` escape hatch

If the player disables `COPIES-LIMIT` (or `UNIQUE-LIMIT`, `SITE-COPIES`) for a
deck from the documentation page, `copyCaps` omits that rule's cap and `+` works
again. Without this the "ignore this rule" checkbox would be a lie for the one
family of rules that is now enforced.

**Tournament vs casual does not affect the cap.** Casual downgrades the *severity
of reports*; the owner's instruction names freeform as the only exception, and
the per-deck override is the escape hatch. Recorded as decision 4 below.

## 1b.5 UI affordance

A `+` that silently does nothing is worse than no change at all:

- `disabled` on the `+` button when `remaining <= 0` — `CardPreviewModal` already
  sets `disabled={qty <= 0}` on `−`, so the styling precedent exists;
- `title` / `aria-label` giving the reason and the citation, e.g.
  *"Maximum 3 copies (CoE §1.3.1)"* or *"Unique card — 1 copy (CoE §1.3.1)"*,
  translated in the three languages;
- when the cap is reached because of copies **in another zone**, the message says
  so — otherwise a disabled `+` next to a count of `1` is baffling.

`remaining` is computed once per card cell from the same `copyCaps` call, so the
disabled state and the mutator guard can never disagree.

---

# Lot 2 — `roleFor()` and play-deck composition

The only lot that adds a capability. Everything here is impossible to express as
a table over the current shape.

## 2.1 The problem

A card's *role* depends on the side (§1.3.W2, §1.3.R2, §1.3.B2, §1.3.F2,
§1.3.F5):

| Card | Wizard | Ringwraith | Fallen-wizard | Balrog |
|---|---|---|---|---|
| Agent (character card) | **hazard** | character | character | **hazard**, ½ creature |
| Hazard playable as resource | either (§1.3.3) | either | **≤2 copies as resource, 3rd as hazard** | either |
| Non-Orc/non-Troll character | — | — | treated as **Hero** | forbidden |

`validate.js` reads `c.type` and `c.alignment` directly in nine places. Without a
derived role, each of those clauses becomes a special case sprinkled through the
validator, and the play-deck budgets below cannot be computed at all.

## 2.2 `web/src/lib/rules/roles.js`

Modelled on `zonesFor` — the repo's existing precedent for a single pure source
of truth consulted by both the validator and the UI.

```js
// roleFor(card, sideId) -> {
//   bucket: 'avatar'|'character'|'resource'|'hazard'|'site'|'region',
//   flexible: null | { alt: 'resource'|'hazard', maxAsAlt: number|null },
//   creatureWeight: 0 | 0.5 | 1,
//   effectiveAlignment: string,
// }
```

Resolution order (first match wins):

1. `type === 'Site'` → `site`; `type === 'Region'` → `region`.
2. `attributes.avatar === true` → `avatar`.
3. `attributes.agent === true`:
   - `type === 'Character'` → `SIDES[side].agents.role`
     (`hazard` for wizard and balrog, `character` for ringwraith and
     fallen-wizard);
   - `type === 'Hazard'` (DM-28, DM-29) → `hazard` for every side — §1.3.R2 speaks
     of *agent character cards*, and these are not character cards.
4. `type === 'Character'` → `character`.
5. `type === 'Hazard'` → `hazard`, plus
   `flexible: { alt: 'resource', maxAsAlt }` when `playableAsResource` —
   `maxAsAlt` is `2` for fallen-wizard (§1.3.F2) and `null` (unbounded) elsewhere
   (§1.3.3).
6. `type === 'Resource'` → `resource`, plus `flexible: { alt: 'hazard', maxAsAlt: null }`
   when `playableAsHazard`. §1.3.F2 constrains only *hazards playable as
   resources*, so this direction carries no Fallen-wizard cap.

`creatureWeight`, evaluated in this order so nothing is counted twice:

| Condition | Weight | Cards |
|---|---|---|
| `subtype === 'Creature'` | **1** | 134 |
| `subtype` contains `Creature` **and** an event | **0.5** | 24 (`Creature/Permanent-event` 19, `Creature/Short-event` 5) |
| id ∈ `DRAGON_MANIFESTATIONS` | **0.5** | 18 curated ids |
| `bucket === 'hazard'` and `agent === true` | **0.5** | side-dependent |
| `bucket === 'hazard'`, `subtype` contains `Permanent-event`, and (`spawn === true` or `keywords` contains `Spawn`) | **0.5** | BA-21, BA-24, BA-27, BA-28, TW-12 |
| otherwise | 0 | |

`effectiveAlignment` returns `'Hero'` for a Fallen-wizard side's non-Orc,
non-Troll character (§1.3.F5), else `card.alignment`. **Honest note:** F5 drives
no deck-construction rule by itself — Fallen-wizard already allows Hero and
Minion, and §1.3.F1 caps non-unique characters at 2 regardless of alignment. It
is implemented for completeness and because lot 3's copy table keys on
`effectiveAlignment`, not because a warning depends on it.

`DRAGON_MANIFESTATIONS` is a curated 18-id constant living in the rules data:
TD-1, TD-2, TD-4, TD-5, TD-10, TD-11, TD-21, TD-22, TD-37, TD-38, TD-43, TD-44,
TD-61, TD-62, TD-64, TD-65, TD-70, TD-71. **Not a name pattern** — `/at Home/`
also matches TD-143 "Not at Home", which is not a manifestation.

## 2.3 §1.5 — play-deck composition replaces `DECKSIZE-PLAY`

`DECKSIZE-PLAY` (one min/max over every play-deck card, 25–50, marked
`verified`) is retired. §1.5 is four independent budgets over disjoint buckets,
all scoped to `quantities` only:

| New rule | Constraint |
|---|---|
| `DECKSIZE-RESOURCES` | 30 ≤ resources ≤ 50 |
| `DECKSIZE-HAZARDS` | hazards **exactly equal** resources |
| `DECKSIZE-CHARS` | non-avatar characters ≤ 10 |
| `AVATAR-COUNT` | avatars ≤ 3 **and** distinct avatars ≤ 2 |

`AVATAR-UNIQUE`, which fires today on any total > 1 across all zones, is retired:
it **rejects legal decks**. §1.5 permits "any combination except three different
avatars" — 3×Gandalf legal, 2×Gandalf + 1×Saruman legal, one each of three
avatars illegal.

Avatars end up with **four** rules, because §1.5 and §1.6.2 each state one copy
cap and one composition constraint, and only the copy caps are hard-enforced. They
stay four separate ids rather than one id with four codes precisely because the
"ignore this rule" checkbox must be able to unblock the `+` for a cap without also
silencing a composition warning:

| Rule | Constraint | Enforcement |
|---|---|---|
| `AVATAR-COPIES` | 3 copies of one avatar **across the whole deck** | **hard**, `scope: 'total'` |
| `AVATAR-SIDEBOARD` | of those, at most **1 may sit in the sideboard** | **hard**, `scope: { zone: 'sideboard' }` |
| `AVATAR-COUNT` | play deck: ≤3 avatars total **and** ≤2 distinct | warning |
| `AVATAR-MULTIPLES` | ≤1 avatar with multiple copies across play deck + sideboard | warning |

`AVATAR-COPIES` and `AVATAR-COUNT` both derive from §1.5 but are different
shapes: the first is per card (3 copies of Gandalf), the second is a sum over
different cards (2 Gandalf + 1 Saruman = 3 avatars). Only the first is a copy cap.

`AVATAR-MULTIPLES`' allowance is consumed either by an avatar held 2–3× in the
play deck, or by the same avatar appearing once in the play deck *and* once in the
sideboard — so two different avatars cannot each be split across the two zones.

**Interpretation note.** Owner's reading (2026-07-26): the sideboard is one copy
of each avatar, and only the play deck may hold a single avatar more than once.
This is **stricter than the printed sentence** in exactly one configuration — two
copies of the same avatar inside the sideboard, which the literal text permits
because only one avatar would then "have multiple copies". The RulesDoc entry
cites §1.6.2 and carries `interpretation: true` so a player comparing our warning
against the CoE page sees why they differ.

`AVATAR-PRESENT` stays a `warning` and is marked `house: true` — §1 nowhere
requires an avatar; it is our advice.

`AVATAR-SIDE` keeps its all-zones scope: an avatar of the wrong side is illegal
wherever it sits.

## 2.4 Flexible resource/hazard assignment (§1.3.3, §1.3.F2)

Six cards can count either way. Rather than persist a per-card declaration, the
validator **chooses the assignment most favourable to the deck** — consistent
with "the app advises, the user decides", and requiring no schema change.

```
fixedResources = Σ copies with bucket 'resource' and no flexible
fixedHazards   = Σ copies with bucket 'hazard'   and no flexible
F              = flexible copies, with per-card caps from roleFor().flexible

for r in [minR .. maxR]:            # r = flexible copies counted as resources
    resources = fixedResources + r
    hazards   = fixedHazards + (F - r)
    if resourcesMin <= resources <= resourcesMax and hazards == resources: legal
report against the r with the smallest total violation when none is legal
```

`minR`/`maxR` come from the per-card caps (Fallen-wizard: at most 2 copies of
each `playableAsResource` card may be counted as a resource, the rest are
hazards). The search is a linear scan over at most ~18 copies.

When the chosen assignment differs from the card's printed type, the DeckPanel
annotates it — otherwise a player cannot reconcile the counter with the cards on
screen.

## 2.5 §1.5.1 — `CREATURE-MIN`

`Math.floor(Σ creatureWeight over the hazard portion) >= 12`. The rule's
"rounded down" applies to the summed halves, not to each card.

---

# Lot 3 — declarative once lot 2 lands

## 3.1 `COPIES-LIMIT` rekeyed (§1.3.1, §1.3.F1)

`copies.byAlignment` is keyed on alignment alone, so `default: 2` **wrongly caps
Fallen-wizard hazards at 2** — §1.3.F1 lists four categories and says nothing
about hazards, which therefore keep §1.3.1's general 3. The table becomes ordered
rules matched on `(bucket, effectiveAlignment)` from `roleFor`, first match wins:

```js
copies: [                            // fallen-wizard
  { bucket: 'resource', alignment: 'Stage',  limit: 3 },
  { bucket: 'character',                     limit: 2 },
  { bucket: 'resource', alignment: 'Hero',   limit: 2 },
  { bucket: 'resource', alignment: 'Minion', limit: 2 },
  {                                          limit: 3 },  // hazards, everything else
]
```

Other sides collapse to a single `{ limit: 3 }` entry.

## 3.2 Location deck (§1.4, §1.4.W1/R1/F1/B1, §1.4.1)

New per-side block:

```js
locationDeck: { alignments: [...], unlimitedFwSites: bool, requireBalrogVersion: bool }
```

- wizard `['Hero']`, ringwraith `['Minion']`, fallen-wizard
  `['Hero','Minion','Fallen-wizard']`, balrog `['Minion','Balrog']`.
- **`SITE-SIDE` (new)** — a site outside the side's list is illegal, *except* the
  five open Balrog sites of §1.4.1, which are derived (Balrog sites with neither
  a Hero nor a Minion counterpart) and asserted by test to be exactly BA-83,
  BA-89, BA-95, BA-96, BA-104.
- **`SITE-BALROG-VERSION` (new)** — for the Balrog side, a Minion site that is
  `underDeeps`, or `{D}`, or named Moria / Carn Dûm / Dol Guldur / Minas Morgul
  requires its Balrog version. **Two messages**: 17 of the 18 have a counterpart
  ("use the Balrog version"); **LE-409 Urlurtsu Nurn has none** ("no Balrog
  version exists — unavailable to the Balrog").
- **`SITE-COPIES` reworked** — one copy of each non-haven site; unlimited for
  `{H}` whose alignment the side's `locationDeck.alignments` admits, and
  unlimited for the four Fallen-wizard sites when the side is fallen-wizard
  (§1.4.F1 — WH-55 Deep Mines is `{R}`, so the haven test alone misses it). The
  check reads `locationDeck.alignments` instead of the card `alignments` list it
  uses today.
- §1.4.B2 (Geann a-Lisch treated as Ruins & Lairs) has **no deck-construction
  effect** and is documented on the RulesDoc page only.

## 3.3 `POOL-STAGE` (§1.7.F1)

Fallen-wizard only: up to three Stage resource permanent-events in the pool,
**exactly 3 stage points total**, at least one **non-unique**.

Two data traps: `stagePoints` also appears on Fallen-wizard **sites** (WH-55 = 3,
WH-57 = 1) which are not stage resources — filter on
`alignment === 'Stage' && type === 'Resource'`; and WH-22 carries
`stagePoints: "2(3)"`, so parsing takes the leading integer.

Stage resources naming the declared avatar are allowed, which `SPECIFIC-AVATAR`
already handles.

## 3.4 `FACTION-RACE` (§1.3.B4)

Balrog factions may only be Orc, Troll, Wolf, Animal or Dragon. Factions are
`marshallingPointsType === 'faction'` (98 cards) with a `race`. Depends on lot
1's `matchesRace` — `LE-272 Misty Mountain Wargs` is `race: "Wolf"` but plural
forms elsewhere would break substring matching.

---

# Rule catalogue after all three lots

30 rules: 15 kept (11 re-referenced, 4 corrected), **3 retired**, **15 new**.
The five marked **hard** are the copy caps lot 1b enforces on the `+` button; every
other rule reports only.

| Rule | CoE ref | Lot | Change |
|---|---|---|---|
| `AVATAR-PRESENT` | *house* | 1 | marked `house` |
| `AVATAR-SIDE` | 1.3.W1/R1/F3/B1 | 1 | ref only |
| `ALIGN-LEGAL` | 1.3.W3/R3/F4/B3 | 1 | `Dual` added |
| `BANNED` | 1.3.F6, 1.3.B5 | 1 | 5 additions, id-qualified + family entries |
| `UNIQUE-LIMIT` | 1.3.1 | 1 | → verified, **hard** |
| `SPECIFIC-AVATAR` | 1.3.4 | 1 | extended to wizard |
| `SPECIFIC-SIDE` | 1.3.4 | 1 | **new** |
| `AGENT-MIND` | 1.3.2 | 1 | **new** |
| `REGION-EXCLUDED` | 1.4 | 1 | **new** |
| `SIDEBOARD-MAX` | 1.6.1 | 1 | → error |
| `POOL-CHARS` | 1.7 | 1 | max 10 all sides |
| `POOL-ITEMS` | 1.7 | 1 | non-unique, non-hoard |
| `POOL-ELIGIBLE` | 1.7 | 1 | `.race` code retired |
| `BALROG-MIND` | 1.3.B4 | 1 | → verified |
| `BALROG-RACE` | 1.3.B4 | 1 | uses `matchesRace` |
| `DECKSIZE-LOCATION` | *house* | 1 | marked `house` |
| ~~`POOL-MIND`~~ | — | 1 | **retired** (no basis in §1) |
| ~~`AVATAR-UNIQUE`~~ | — | 2 | **retired** → the four avatar rules below |
| ~~`DECKSIZE-PLAY`~~ | — | 2 | **retired** → 3 budget rules |
| `AVATAR-COPIES` | 1.5, 1.6 | 2 | **new**, **hard** — 3 copies per avatar across the whole deck |
| `AVATAR-SIDEBOARD` | 1.6.2 | 2 | **new**, **hard** — of those, ≤1 in the sideboard |
| `AVATAR-COUNT` | 1.5 | 2 | **new** — play deck ≤3 avatars, ≤2 distinct |
| `AVATAR-MULTIPLES` | 1.6.2 | 2 | **new** — ≤1 avatar with multiple copies (play + sideboard) |
| `DECKSIZE-RESOURCES` | 1.5 | 2 | **new** |
| `DECKSIZE-HAZARDS` | 1.5 | 2 | **new** |
| `DECKSIZE-CHARS` | 1.5 | 2 | **new** |
| `CREATURE-MIN` | 1.5.1 | 2 | **new** |
| `COPIES-LIMIT` | 1.3.1, 1.3.F1 | 3 | rekeyed on bucket × alignment, **hard** |
| `SITE-SIDE` | 1.4.W1/R1/F1/B1, 1.4.1 | 3 | **new** |
| `SITE-BALROG-VERSION` | 1.4.B1 | 3 | **new** |
| `SITE-COPIES` | 1.4, 1.4.F1 | 3 | haven + FW-site exemptions, **hard** |
| `POOL-STAGE` | 1.7.F1 | 3 | **new** |
| `FACTION-RACE` | 1.3.B4 | 3 | **new** |

## Test plan

`test/rules.test.js` (~60 cases) is extended, but two groups encode **retired**
rules and must be rewritten, not adapted:

- the two `AVATAR-UNIQUE` cases (3 copies of one avatar, two different avatars)
  assert behaviour §1.5 explicitly permits;
- the `DECKSIZE-PLAY` case asserts the single-range semantics.

New coverage, one case per new rule plus these data-derived assertions, which are
the ones that would catch a silent regression in `cards.json`:

- `fold()` matches `Durin's Bane` from both apostrophe forms.
- every ban entry resolves; id-qualified entries resolve to exactly one card;
  `The Balrog (Ally)` resolves to AS-71 and **not** BA-3.
- the §1.4.1 derivation yields exactly the five named sites.
- §1.4.B1 flags 18 Minion sites, and exactly one (LE-409) has no counterpart.
- `DRAGON_MANIFESTATIONS` has 18 entries and excludes TD-143.
- `roleFor` never throws over all 1683 cards × 4 sides and always returns a
  bucket (mirroring the existing `zonesFor` total-coverage test).
- agent mind over all 32 agents is 157 (guards the §1.3.2 threshold's relevance).
- `matchesRace('Wolves','Wolf')` and `matchesRace('Orcs,Men','Orc')` hold.

Lot 1b adds, as pure-function tests over `copyCaps` plus mutator tests:

- **cap and warning agree** over all 1683 cards × 4 sides: for every card, the
  count at which `copyCaps` blocks is the count at which the validator emits. This
  is the test that keeps the button honest as lots 2–3 change the numbers.
- cross-zone accounting: 2 in deck + 1 in sideboard of a 3-copy card blocks `+`
  in all three zones.
- a unique card held in the sideboard blocks `+` in the play deck and in the pool,
  and vice versa — the cumulative cap is the point of the whole design.
- avatars: 3 across the whole deck, of which at most 1 in the sideboard. A second
  copy in the sideboard is refused even when the play deck is empty; an avatar
  already held 3× in the play deck cannot be added to the sideboard at all.
- havens return `Infinity` for the side that may repeat them, `1` for the others.
- `toggleCard` on a unique card already held in the pool does not create a 2nd copy.
- `selectAll` never pushes any card over its cap.
- `moveCopy` succeeds for a card sitting exactly at its cap.
- freeform: every mutator stays uncapped, whatever the card.
- disabling `COPIES-LIMIT` via `ruleOverrides` restores an uncapped `+`.
- over-limit survival: 5 copies imported into a 3-copy deckbuilding deck stay 5,
  report the excess, and refuse a 6th.

## i18n impact

13 new rule ids × {en, fr, es} messages, plus RulesDoc rows. `POOL-MIND`'s two
message shapes (`.char`, `.total`) and `POOL-ELIGIBLE.race` are removed.
`docText.js`'s `poolText` loses three branches (`mindCap`,
`mindPerCharacterMax`, `forbidRaces`) and gains `stagePoints`; `copiesText` must
render the ordered copy table instead of an alignment map; a new `playDeckText`
renders four budgets instead of a range. The `standard` length's label becomes
"Short" in all three languages while the id stays `standard`.

## Decisions to confirm

1. **Flexible cards: automatic assignment (recommended) vs explicit
   declaration.** Automatic needs no schema change and no UI; explicit would add
   a per-card "count as" field to the deck record and a control in the panel. Six
   cards are affected. Spec'd as automatic.
2. **`DECKSIZE-HAZARDS` as strict equality.** §1.5 says "a number of hazards
   equal to the number of resources". Spec'd as an exact-equality error, softened
   to a warning in casual mode by the existing downgrade. The alternative — a
   tolerance — would be us inventing a rule.
3. **`POOL-MIND` retired outright vs kept disabled.** Spec'd as retired: keeping
   an unsourced rule behind a checkbox invites re-enabling a value §1 does not
   contain. Retiring is override-safe.
4. **Does the hard cap apply in casual mode too?** Spec'd as **yes** — the
   instruction named freeform as the only exception, and casual governs the
   severity of *reports*, not what may be added. If casual should instead stay
   permissive, the change is one condition in `copyCaps`. The per-deck rule
   override remains the escape hatch either way.
5. **Should the third *distinct* avatar be blocked?** Spec'd as **no**. §1.5's
   "not three different avatars" is a composition rule, not a copy cap, and
   blocking it would prevent swapping avatars mid-build (you could not add the
   replacement before removing the outgoing one). It stays an `AVATAR-COUNT`
   warning.

## Known gap — unique manifestations (§1.3.1, last sentence)

> *Manifestations of the same unique resource are treated as the same unique card
> for the purpose of determining how many copies may be included.*

Not implemented in any lot, and documented as a gap on the RulesDoc page. There
is no grouping field, and a partial detection would produce **silent false
negatives** — worse than an absent rule, because the player would trust it.

**A viable path exists** (to be discussed separately). 79 cards state their base
identity in `text.en` in a regular form:

```
<i>Manifestation of “Bert”.</i>            AS-1  Bûrat
<i>Maia. Manifestation of Gandalf.</i>     AS-11 Gandalf the White Rider
<i>Manifestation of minion Angmarim.</i>   AS-58 Angmarim
<i>Manifestation of Balrog of Moria.</i>   AS-71 The Balrog
```

Extracting a `manifestationOf` attribute into the card data would turn §1.3.1's
last sentence into a plain group-by. Four wrinkles seen in the sample: curly
quotes around some names (`“Bert”`), a leading alignment word
(`Manifestation of minion Angmarim`), line-break artefacts inside names
(`Wain- easterlings`, `Petty- dwarves`), and the fact that the base name is
sometimes another card (`Balrog of Moria`) and sometimes an abstract entity
(`Bairanax`). Coverage of the Ahunt/at Home cards themselves needs checking
before committing to the approach.
