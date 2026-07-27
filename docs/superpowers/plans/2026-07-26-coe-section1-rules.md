# CoE Section 1 Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub deckbuilding rule data with the authoritative Council of Elrond Section 1 rules, give every warning a traceable `CoE §x.y` citation, and make per-card copy caps hard limits in deckbuilding mode.

**Architecture:** All rule knowledge stays declarative data in `web/src/lib/rules/`. Three new pure modules join the existing ones — `catalog.js` (rule metadata, extracted to break an import cycle), `races.js` (race normalisation), `copies.js` (copy caps) — plus `roles.js` in lot 2 (per-side card role derivation). `validate.js` reports; `copies.js` is the single source of truth for caps and is consumed by both `validate.js` and the `+` buttons, so the counter and the warnings can never disagree.

**Tech Stack:** Vanilla ES modules, React 18, Vite 5, Vitest 2. No new dependencies.

## Global Constraints

- Source of record for every rule: `https://www.councilofelrond.org/rules/#Section1`. Store it once as `COE` in `catalog.js`.
- Test command is `npm test` (vitest run). Single file: `npx vitest run test/rules.test.js`.
- **Never** use the word "faction" for a player camp. `side` in code; *Camp* (FR) / *Side* (EN) / *Bando* (ES) in UI. "Faction" is reserved for the game's Faction card category.
- Validators emit **translatable descriptors** (`{ ruleId, code, severity, params }`), never sentences.
- The app **advises**; the only hard blocking allowed is per-card copy caps in deckbuilding mode (lot 1b). Freeform mode has no rules at all.
- Existing counts are **never** silently reduced. Caps gate increments only; `−` is never disabled.
- Every i18n key must be added to all three language blocks in `web/src/lib/i18n.js` (`fr` ≈ line 180, `en` ≈ line 464, `es` ≈ line 758). A missing key renders as the raw key.
- Accented/typographic characters in source code use explicit `\u` escapes so copy/paste cannot corrupt them.
- Commit after every task with a `feat:`/`fix:`/`refactor:`/`test:` prefix.

## Lot reassignment vs the spec

The spec places the four avatar rules in lot 2. **They move to lots 1a/1b**: avatar detection is `attributes.avatar === true` and needs no `roleFor()`. This avoids an interim state where `AVATAR-UNIQUE` is disabled (it is wrong) but nothing replaces it. Lot 2 therefore covers only `roleFor`, the play-deck buckets and the creature minimum.

## File Structure

| File | Responsibility | Lot |
|---|---|---|
| `web/src/lib/rules/catalog.js` | **new** — `COE`, `RULES` metadata, `isRuleEnabled`, `ruleRefs` | 1a |
| `web/src/lib/rules/races.js` | **new** — `racesOf`, `singularize`, `matchesRace` | 1a |
| `web/src/lib/rules/banned.js` | ban lists; apostrophe-safe `fold`; id-qualified + family entries | 1a |
| `web/src/lib/rules/sides.js` | per-side profiles + `GENERAL` + `SPECIFIC_TO_SIDES` | 1a |
| `web/src/lib/rules/zones.js` | which zones a card may occupy | 1a |
| `web/src/lib/rules/validate.js` | the validator; re-exports `RULES`/`isRuleEnabled` | 1a, 1b |
| `web/src/lib/rules/docText.js` | doc-page text composition | 1a |
| `web/src/lib/rules/copies.js` | **new** — `copyCaps`, `remainingCopies` | 1b |
| `web/src/lib/rules/roles.js` | **new** — `roleFor`, `DRAGON_MANIFESTATIONS` | 2 |
| `web/src/App.jsx` | mutator guards | 1b |
| `web/src/components/{CardBrowser,MiniCard,CardPreviewModal,DeckPanel}.jsx` | disabled `+` and citations | 1a, 1b |
| `web/src/lib/i18n.js` | fr/en/es strings | every task that adds a rule |
| `test/rules.test.js` | all rule tests | every task |

---

# LOT 1a — corrections, data-only rules, traceability

### Task 1: Apostrophe-safe name folding

**Files:**
- Modify: `web/src/lib/rules/banned.js:34`
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `fold` behaviour — `resolveBanned` matches names written with either `'` or `’`.

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('banned lists', ...)` block in `test/rules.test.js`:

```js
  it('folds typographic apostrophes so a name pasted from the CoE page resolves', () => {
    // The card data spells exactly one name with an ASCII apostrophe
    // (DM-107 "Durin's Bane"); every other name uses U+2019. A ban list
    // pasted from councilofelrond.org uses U+2019 throughout.
    const { bySide } = resolveBanned(cards, {
      balrog: { names: ['Durin’s Bane'] },
    });
    expect([...bySide.balrog]).toContain('DM-107');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js -t "folds typographic apostrophes"`
Expected: FAIL — `resolveBanned` takes one argument, so the override is ignored and `bySide.balrog` comes from the real list; or the set does not contain `DM-107`.

- [ ] **Step 3: Implement**

In `web/src/lib/rules/banned.js`, replace the `fold` definition (line 34):

```js
// NOTE: explicit \u escapes (not the literal combining-diacritics characters)
// so this survives copy/paste intact -- see task-7 known traps.
// Apostrophes are folded too: the card data spells one name with ASCII "'"
// (DM-107 "Durin's Bane") and 82 with U+2019, while names pasted from the CoE
// page always use U+2019. Without this, such an entry resolves to nothing and
// fails silently.
const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’ʼ´]/g, "'")
  .toLowerCase()
  .trim();
```

And make the lists injectable so tests can drive the resolver — change the signature:

```js
export function resolveBanned(cards, lists = BANNED) {
```

then replace the two uses of `BANNED` inside the function body with `lists`:

```js
  for (const [side, entry] of Object.entries(lists)) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules.test.js -t "folds typographic apostrophes"`
Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — no other test passes a second argument, so the default keeps current behaviour.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/banned.js test/rules.test.js
git commit -m "fix: fold apostrophes when resolving banned card names"
```

---

### Task 2: Ban list additions with id-qualified and family entries

**Files:**
- Modify: `web/src/lib/rules/banned.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `fold` from Task 1.
- Produces: a `BANNED[side].names` entry may be `string` | `{ name, id }` | `{ label, ids }`. `resolveBanned(cards, lists?)` returns `{ bySide, unresolved }` where `unresolved` items are `{ side, name, id? }`.

- [ ] **Step 1: Write the failing tests**

```js
  it('an id-qualified entry bans exactly that card, not its namesake', () => {
    // Two cards are named "The Balrog": AS-71 (Resource/Minion, Ally) and
    // BA-3 (Character/Balrog) -- the Balrog player's own avatar. Banning by
    // name alone would ban the avatar inside its own deck.
    const { bySide } = resolveBanned(cards);
    expect(bySide.balrog.has('AS-71')).toBe(true);
    expect(bySide.balrog.has('BA-3')).toBe(false);
  });

  it('a family entry bans every listed id', () => {
    const { bySide } = resolveBanned(cards);
    for (const id of ['LE-161', 'LE-162', 'LE-182', 'LE-193', 'LE-198', 'LE-200', 'LE-222', 'LE-248', 'LE-257']) {
      expect(bySide.balrog.has(id)).toBe(true);
    }
  });

  it('the new Balrog entries resolve', () => {
    const { bySide } = resolveBanned(cards);
    expect(bySide.balrog.has('TW-12')).toBe(true);  // Balrog of Moria
    expect(bySide.balrog.has('LE-183')).toBe(true); // Fell Rider
  });

  it('the Fallen-wizard list bans The Balrog (Ally) but not the avatar', () => {
    const { bySide } = resolveBanned(cards);
    expect(bySide['fallen-wizard'].has('AS-71')).toBe(true);
    expect(bySide['fallen-wizard'].has('BA-3')).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "id-qualified"`
Expected: FAIL — `AS-71` is not in the lists yet.

- [ ] **Step 3: Implement**

Replace the whole `BANNED` object and `resolveBanned` body in `web/src/lib/rules/banned.js` (keep the `fold` from Task 1 as-is):

```js
// Ban lists sourced from councilofelrond.org Section 1: the Fallen-wizard list
// is printed as 1.5.F6 (a numbering typo for 1.3.F6) and the Balrog list as
// 1.3.B5.
//
// An entry is one of:
//   'Card Name'            -- matched by name.en, accent/case/apostrophe-insensitive
//   { name, id }           -- id-qualified: use when two cards share a name
//   { label, ids: [...] }  -- a family the rules name collectively
export const BANNED = {
  'fallen-wizard': {
    status: 'verified',
    source: 'https://www.councilofelrond.org/rules/#Section1',
    ref: '1.3.F6',
    printedAs: '1.5.F6',
    names: [
      'Bade to Rule',
      // "The Balrog (Ally)": the "(Ally)" disambiguates AS-71 from BA-3, the
      // Balrog player's avatar, which shares the name and must not be banned.
      { name: 'The Balrog (Ally)', id: 'AS-71' },
      'Cracks of Doom', 'Favor of the Valar', 'Gollum’s Fate', 'Hour of Need',
      'Kill All But NOT the Halflings', 'The Lidless Eye',
      // remastered card data itself spells this "Excellance" (not "Excellence")
      'Glamour of Surpassing Excellance', 'Messenger of Mordor',
      // remastered card data itself spells this "Trough" (not "Through")
      'News Must Get Trough',
      'News of the Shire', 'Old Road', 'The Sun Unveiled', 'Use Your Legs',
      'The Windlord Found Me', 'Wizard Uncloaked',
    ],
  },
  balrog: {
    status: 'verified',
    source: 'https://www.councilofelrond.org/rules/#Section1',
    ref: '1.3.B5',
    names: [
      'Above the Abyss', 'Bade to Rule',
      { name: 'The Balrog (Ally)', id: 'AS-71' },
      'Balrog of Moria', 'The Black Council', 'Black Horse', 'Black Rider',
      'By the Ringwraith’s Word', 'Creature of an Older World', 'Durin’s Bane',
      'Fell Rider', 'The Fiery Blade', 'Helm of Fear', 'Heralded Lord',
      'Kill All But NOT the Halflings', 'The Lidless Eye', 'Morgul-blade',
      'News of the Shire', 'Open to the Summons', 'Orders From Lugbúrz',
      'Padding Feet', 'The Ring Leaves its Mark',
      {
        label: 'Ringwraith Unleashed cards',
        ids: ['LE-161', 'LE-162', 'LE-182', 'LE-193', 'LE-198', 'LE-200', 'LE-222', 'LE-248', 'LE-257'],
      },
      'Sauron', 'They Ride Together', 'Use Your Legs', 'While the Yellow Face Sleeps',
    ],
  },
};
```

Then the resolver:

```js
export function resolveBanned(cards, lists = BANNED) {
  const byName = new Map();
  const knownIds = new Set();
  for (const c of cards) {
    knownIds.add(c.id);
    const k = fold(c.name && c.name.en);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(c.id);
  }
  const bySide = {};
  const unresolved = [];
  for (const [side, entry] of Object.entries(lists)) {
    bySide[side] = new Set();
    for (const item of entry.names) {
      if (typeof item === 'string') {
        const ids = byName.get(fold(item));
        if (!ids) unresolved.push({ side, name: item });
        else for (const id of ids) bySide[side].add(id);
        continue;
      }
      // id-qualified or family: trust the ids, but report any that no longer
      // exist so a card-data update cannot silently drop a ban.
      const ids = item.ids || [item.id];
      for (const id of ids) {
        if (knownIds.has(id)) bySide[side].add(id);
        else unresolved.push({ side, name: item.label || item.name, id });
      }
    }
  }
  return { bySide, unresolved };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/rules.test.js -t "banned"`
Expected: PASS, including the pre-existing "every banned name resolves to at least one real card" test.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/banned.js test/rules.test.js
git commit -m "feat: complete the CoE ban lists with id-qualified and family entries"
```

---

### Task 3: Race normalisation helper

**Files:**
- Create: `web/src/lib/rules/races.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `racesOf(value) -> string[]`, `singularize(race) -> string` (folded, lowercase), `matchesRace(value, wanted) -> boolean`.

- [ ] **Step 1: Write the failing test**

Add a new top-level `describe` block in `test/rules.test.js`, and add the import at the top of the file next to the other rules imports:

```js
import { racesOf, singularize, matchesRace } from '../web/src/lib/rules/races.js';
```

```js
describe('races', () => {
  it('splits comma-joined race values', () => {
    expect(racesOf('Animals,Men,Bears')).toEqual(['Animals', 'Men', 'Bears']);
    expect(racesOf('Orcs, Men')).toEqual(['Orcs', 'Men']);
    expect(racesOf('')).toEqual([]);
    expect(racesOf(undefined)).toEqual([]);
  });

  it('singularises the plural forms the card data actually uses', () => {
    // Regular -s
    expect(singularize('Orcs')).toBe('orc');
    expect(singularize('Trolls')).toBe('troll');
    expect(singularize('Animals')).toBe('animal');
    expect(singularize('Spiders')).toBe('spider');
    // -ves, the case a substring match gets wrong
    expect(singularize('Wolves')).toBe('wolf');
    expect(singularize('Elves')).toBe('elf');
    expect(singularize('Dwarves')).toBe('dwarf');
    // Irregular
    expect(singularize('Men')).toBe('man');
    expect(singularize('Dúnedain')).toBe('dunadan');
    // Already singular, and accent folding
    expect(singularize('Orc')).toBe('orc');
    expect(singularize('Dúnadan')).toBe('dunadan');
  });

  it('matches a wanted race against any of a compound value', () => {
    expect(matchesRace('Wolves', 'Wolf')).toBe(true);
    expect(matchesRace('Orcs,Men', 'Orc')).toBe(true);
    expect(matchesRace('Orcs,Men', 'Man')).toBe(true);
    expect(matchesRace('Balrog,Spawn', 'Balrog')).toBe(true);
    expect(matchesRace('Man', 'Orc')).toBe(false);
    expect(matchesRace('', 'Orc')).toBe(false);
    // "Wose" must not be swallowed by a naive plural rule
    expect(matchesRace('Wose', 'Wose')).toBe(true);
  });

  it('every race value in the card data singularises without throwing', () => {
    for (const c of cards) {
      const v = (c.attributes || {}).race;
      if (v === undefined) continue;
      for (const r of racesOf(v)) expect(typeof singularize(r)).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js -t "races"`
Expected: FAIL — cannot resolve `../web/src/lib/rules/races.js`.

- [ ] **Step 3: Implement**

Create `web/src/lib/rules/races.js`:

```js
// Race normalisation. The card data mixes singular and plural forms for the
// same race ("Orc"/"Orcs", "Wolf"/"Wolves", "Animal"/"Animals") and joins
// several races with commas ("Orcs,Men", "Animals,Men,Bears", "Balrog,Spawn").
// A substring test survives "Orcs" contains "Orc" but fails on "Wolves" vs
// "Wolf" -- exactly the case CoE 1.3.B4's faction list (Orc, Troll, Wolf,
// Animal, Dragon) needs. So compare on a singularised, accent-folded form.

// NOTE: explicit \u escapes rather than literal accents so this survives
// copy/paste intact.
const IRREGULAR = {
  men: 'man',
  dunedain: 'dunadan', // Dúnedain / Dúnadan both appear in the data
};

const PLURALS = [[/ves$/, 'f'], [/ies$/, 'y'], [/([^s])s$/, '$1']];

const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

// One race value may name several races, comma-separated.
export function racesOf(value) {
  return String(value === undefined || value === null ? '' : value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Folded, lowercase, singular. Comparison form only -- never displayed.
export function singularize(race) {
  const f = fold(race);
  if (!f) return '';
  if (IRREGULAR[f]) return IRREGULAR[f];
  for (const [re, rep] of PLURALS) if (re.test(f)) return f.replace(re, rep);
  return f;
}

export function matchesRace(value, wanted) {
  const w = singularize(wanted);
  if (!w) return false;
  return racesOf(value).some((r) => singularize(r) === w);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules.test.js -t "races"`
Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/races.js test/rules.test.js
git commit -m "feat: race normalisation helper for singular/plural card data"
```

**Note for the implementer:** `/([^s])s$/` rather than `/s$/` so a value already ending in `ss` is left alone and a bare `s` is not stripped to nothing. `Wose` has no trailing `s` and is untouched.

---

### Task 4: Rule catalogue with CoE citations

Extract the rule metadata into its own module. Two reasons: `copies.js` (lot 1b) needs `isRuleEnabled` while `validate.js` will import `copies.js` — importing `isRuleEnabled` from `validate.js` would be a cycle. And the metadata grows a citation field that both the doc page and the deck panel read.

**Files:**
- Create: `web/src/lib/rules/catalog.js`
- Modify: `web/src/lib/rules/validate.js:10-39` (drop `SRC`, `RULES`, `RULE_BY_ID`, `isRuleEnabled`; import and re-export them)
- Test: `test/rules.test.js:609` (replace the existing metadata test)

**Interfaces:**
- Produces: `COE` (the section URL), `RULES` (array), `RULE_BY_ID` (Map), `isRuleEnabled(ruleId, ruleOverrides)`, `ruleRefs(rule) -> string[]`.
- A rule is `{ id, severity, status, source, ref?, refs?, printedAs?, house?, hard? }`. `house: true` marks an advisory that is **ours, not CoE's** and must never show a citation. `hard: true` marks a per-card copy cap that lot 1b enforces on the `+` button.
- `validate.js` keeps re-exporting `RULES` and `isRuleEnabled`, so no importer changes.

- [ ] **Step 1: Write the failing tests**

Add to the imports at the top of `test/rules.test.js`:

```js
import { COE, ruleRefs } from '../web/src/lib/rules/catalog.js';
```

Replace the existing `it('every rule has unique id and required metadata', ...)` with:

```js
  it('every rule has a unique id and required metadata', () => {
    const seen = new Set();
    for (const r of RULES) {
      expect(seen.has(r.id)).toBe(false);
      seen.add(r.id);
      expect(typeof r.id).toBe('string');
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['verified', 'unverified']).toContain(r.status);
      expect(typeof r.source).toBe('string');
    }
  });

  it('every rule either cites CoE section 1 or is explicitly a house rule', () => {
    for (const r of RULES) {
      if (r.house) {
        // A house advisory must not pretend to come from the source.
        expect(r.ref).toBeUndefined();
        expect(r.refs).toBeUndefined();
        continue;
      }
      const refs = ruleRefs(r);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(ref).toMatch(/^1\.[0-9]+(\.[A-Z]?[0-9]+)?$/);
      expect(r.source).toBe(COE);
    }
  });

  it('ruleRefs normalises single- and multi-clause rules', () => {
    expect(ruleRefs({ ref: '1.3.2' })).toEqual(['1.3.2']);
    expect(ruleRefs({ refs: ['1.4', '1.4.F1'] })).toEqual(['1.4', '1.4.F1']);
    expect(ruleRefs({ house: true })).toEqual([]);
    expect(ruleRefs(null)).toEqual([]);
  });

  it('the two rules that contradict section 1 ship disabled until lot 2 replaces them', () => {
    // AVATAR-UNIQUE fires on any total > 1, but 1.5 allows up to three
    // avatars. DECKSIZE-PLAY applies one 25-50 range to every play-deck card,
    // but 1.5 is four separate budgets. Both report legal decks as illegal.
    expect(isRuleEnabled('AVATAR-UNIQUE', {})).toBe(false);
    expect(isRuleEnabled('DECKSIZE-PLAY', {})).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "cites CoE"`

Expected: FAIL — cannot resolve `../web/src/lib/rules/catalog.js`.

- [ ] **Step 3: Create the catalogue**

Create `web/src/lib/rules/catalog.js`:

```js
// Rule metadata, separate from the validator so copies.js can read
// isRuleEnabled without importing validate.js (which imports copies.js --
// that would be a cycle).
//
// Every rule cites the clause it comes from: `ref` for one clause, `refs` for
// a rule covering several, and `house: true` for the advisories that are ours
// rather than the source's -- those must never display a citation.
// `hard: true` marks a per-card copy cap the + button enforces (lot 1b).
export const COE = 'https://www.councilofelrond.org/rules/#Section1';

export const RULES = [
  // -- avatars --
  { id: 'AVATAR-PRESENT', severity: 'warning', status: 'verified', house: true, source: COE },
  // Contradicts 1.5 (up to three avatars, any combination but three different).
  // Disabled here, retired in lot 2 in favour of AVATAR-COUNT / AVATAR-COPIES.
  { id: 'AVATAR-UNIQUE', severity: 'error', status: 'unverified', house: true, source: COE },
  { id: 'AVATAR-SIDE', severity: 'error', status: 'verified', refs: ['1.3.W1', '1.3.R1', '1.3.F3', '1.3.B1'], source: COE },

  // -- card legality --
  { id: 'ALIGN-LEGAL', severity: 'error', status: 'verified', refs: ['1.3.W3', '1.3.R3', '1.3.F4', '1.3.B3'], source: COE },
  // The Fallen-wizard list is printed as 1.5.F6, a numbering typo for 1.3.F6.
  { id: 'BANNED', severity: 'error', status: 'verified', refs: ['1.3.F6', '1.3.B5'], printedAs: { '1.3.F6': '1.5.F6' }, source: COE },
  { id: 'SPECIFIC-AVATAR', severity: 'error', status: 'verified', ref: '1.3.4', source: COE },

  // -- copy caps, hard-enforced from lot 1b --
  { id: 'COPIES-LIMIT', severity: 'error', status: 'verified', refs: ['1.3.1', '1.3.F1'], hard: true, source: COE },
  { id: 'UNIQUE-LIMIT', severity: 'error', status: 'verified', ref: '1.3.1', hard: true, source: COE },
  { id: 'SITE-COPIES', severity: 'error', status: 'verified', refs: ['1.4', '1.4.F1'], hard: true, source: COE },

  // -- Balrog-specific --
  { id: 'BALROG-RACE', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },
  { id: 'BALROG-MIND', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },

  // -- deck sizes --
  // Contradicts 1.5. Disabled here, retired in lot 2.
  { id: 'DECKSIZE-PLAY', severity: 'warning', status: 'unverified', house: true, source: COE },
  { id: 'DECKSIZE-LOCATION', severity: 'warning', status: 'verified', house: true, source: COE },
  { id: 'SIDEBOARD-MAX', severity: 'error', status: 'verified', ref: '1.6.1', source: COE },

  // -- starting pool --
  { id: 'POOL-CHARS', severity: 'error', status: 'verified', ref: '1.7', source: COE },
  { id: 'POOL-MIND', severity: 'warning', status: 'unverified', house: true, source: COE },
  { id: 'POOL-ITEMS', severity: 'error', status: 'verified', ref: '1.7', source: COE },
  { id: 'POOL-ELIGIBLE', severity: 'error', status: 'verified', ref: '1.7', source: COE },
].map((r) => ({ ...r, defaultEnabled: r.status === 'verified' }));

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// The clauses a rule cites, normalised to an array. Empty for house rules.
export function ruleRefs(rule) {
  if (!rule || rule.house) return [];
  if (rule.refs) return rule.refs;
  return rule.ref ? [rule.ref] : [];
}

export function isRuleEnabled(ruleId, ruleOverrides = {}) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return false; // unknown / retired ids are ignored
  return ruleOverrides[ruleId] ?? rule.defaultEnabled;
}
```

- [ ] **Step 4: Point the validator at the catalogue**

In `web/src/lib/rules/validate.js`, delete the `SRC` constant, the whole `RULES` array, the `RULE_BY_ID` line and the `isRuleEnabled` function (lines 10-39). In their place, add this next to the other imports at the top:

```js
import { RULES, RULE_BY_ID, isRuleEnabled } from './catalog.js';

// Re-exported so importers keep one entry point into the rules layer.
export { RULES, isRuleEnabled };
```

Everything else in the file stays as-is: `emit` already reads `RULE_BY_ID.get(ruleId).severity`, which now resolves through the import.

- [ ] **Step 5: Delete the three tests that assert retired behaviour**

These assert rules that contradict section 1 and are now disabled, so they fail. Delete them outright — Task 9 and lot 2 Task 16 replace their coverage:

- `it('AVATAR-UNIQUE: fires on 3 copies of a single avatar (copy count, not distinct-card count)', ...)`
- `it('AVATAR-UNIQUE: fires on two different avatar cards', ...)`
- `it('DECKSIZE-PLAY: play-deck count below the side minimum fires', ...)`

- [ ] **Step 5b: Rewrite the six tests that assert the pre-sourcing `unverified` state**

**Plan gap, found during execution.** The Traceability section says the status flip to
`verified` turns these rules on by default — but this step was missing, so six
tests written in the stub era still assert they are *off*. They now fail.

**Rewrite, do not delete.** Each one covers real rule behaviour; only the
"enable it via `ruleOverrides` first" harness is obsolete. Drop the override and
assert the rule fires by default, keeping every other assertion:

- `it('BANNED is disabled by default (unverified) and emits nothing without an override', ...)`
  → becomes: BANNED is enabled by default and a banned card emits an error.
- `it('BALROG-MIND: a non-exempt Balrog-side character at/above the per-character mind limit fires once the unverified rule is enabled', ...)`
- `it('BALROG-RACE: a non-Orc/Troll, non-exempt Balrog-side character fires once the unverified rule is enabled', ...)`
- `it('POOL-ITEMS: starting minor items above the per-side max fire once the unverified rule is enabled', ...)`
- `it('UNIQUE-LIMIT: exactly 2+ copies of a unique non-avatar card fire once the unverified rule is enabled; 1 copy never does', ...)`
- `it('DECKSIZE-LOCATION: play-deck cards with zero location-deck cards fire once the unverified rule is enabled', ...)`

Rename each to drop "once the unverified rule is enabled". Keep the
`ruleOverrides: { X: false }` direction covered somewhere — a rule the user
switches off must still emit nothing — so that the override mechanism itself
stays under test after the flip.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/rules/catalog.js web/src/lib/rules/validate.js test/rules.test.js
git commit -m "refactor: extract rule catalogue with CoE section 1 citations"
```

---

### Task 5: Correct the four wrong rules

`POOL-CHARS` caps the pool at 6/5/6 where 1.7 says 10 for every side. `POOL-MIND` and `POOL-ELIGIBLE.race` enforce values that appear nowhere in section 1. Alignment `Dual` is in no side's list, so `ALIGN-LEGAL` — an enabled-by-default error — reports four legal cards as illegal for every side.

**Files:**
- Modify: `web/src/lib/rules/sides.js` (whole file)
- Modify: `web/src/lib/rules/validate.js` (pool block; Balrog race check; import line)
- Modify: `web/src/lib/rules/catalog.js` (remove the `POOL-MIND` entry)
- Modify: `web/src/lib/rules/docText.js:37-52` (`poolText`)
- Modify: `web/src/lib/i18n.js` (remove 6 keys × 3 languages)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `matchesRace` (Task 3), `RULES`/`isRuleEnabled` (Task 4).
- Produces: `GENERAL = { agentMindMax: 36, copiesDefault: 3, uniqueMax: 1, siteMax: 1 }` and `SPECIFIC_TO_SIDES` and `raceAllowed(card, sideId)`, all from `sides.js`. `SIDES[side].pool` becomes `{ maxCharacters, maxMinorItems, balrogMindPerCharacterLimit, requireRaces }` — `mindCap`, `mindPerCharacterMax` and `forbidRaces` are gone.

- [ ] **Step 1: Write the failing tests**

Change the `sides.js` import at the top of `test/rules.test.js` to:

```js
import { SIDES, GENERAL, SPECIFIC_TO_SIDES, isLegalForSide, raceAllowed } from '../web/src/lib/rules/sides.js';
```

Add these tests to the `describe('sides data', ...)` block:

```js
  it('every side allows Dual-alignment cards (1.3.W3/R3/F4/B3)', () => {
    // LE-245, LE-419, WH-38, WH-40 are alignment "Dual" -- playable by both
    // hero and minion sides. Section 1 never restricts them.
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      const out = validateDeck({
        side, length: 'standard', tournament: true,
        quantities: { 'LE-419': 1 }, cardsById: index,
      });
      expect(out.filter((w) => w.ruleId === 'ALIGN-LEGAL')).toEqual([]);
      expect(isLegalForSide(index.get('LE-419'), side)).toBe(true);
    }
  });

  it('the starting pool holds ten characters on every side (1.7)', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(SIDES[side].pool.maxCharacters).toBe(10);
      expect(SIDES[side].pool.maxMinorItems).toBe(2);
    }
  });

  it('POOL-MIND is gone: section 1 states no pool mind cap', () => {
    expect(RULES.find((r) => r.id === 'POOL-MIND')).toBeUndefined();
    // An override for a retired id must be ignored, not resurrect the rule.
    expect(isRuleEnabled('POOL-MIND', { 'POOL-MIND': true })).toBe(false);
    for (const side of Object.values(SIDES)) {
      expect(side.pool.mindCap).toBeUndefined();
      expect(side.pool.mindPerCharacterMax).toBeUndefined();
      expect(side.pool.forbidRaces).toBeUndefined();
    }
  });

  it('GENERAL carries the side-independent limits', () => {
    expect(GENERAL).toEqual({ agentMindMax: 36, copiesDefault: 3, uniqueMax: 1, siteMax: 1 });
  });

  it('raceAllowed uses race normalisation, not substring matching (1.3.B4)', () => {
    // Only the Balrog side requires races; every other side accepts anyone.
    expect(raceAllowed({ attributes: { race: 'Orcs' } }, 'balrog')).toBe(true);
    expect(raceAllowed({ attributes: { race: 'Trolls' } }, 'balrog')).toBe(true);
    expect(raceAllowed({ attributes: { race: 'Man' } }, 'balrog')).toBe(false);
    expect(raceAllowed({ attributes: { race: 'Man' } }, 'wizard')).toBe(true);
  });

  it('SPECIFIC_TO_SIDES covers every specific value in the card data', () => {
    const seen = new Set(cards.map((c) => (c.attributes || {}).specific).filter(Boolean));
    for (const s of seen) expect(SPECIFIC_TO_SIDES[s]).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "Dual-alignment"`

Expected: FAIL — `ALIGN-LEGAL` fires for LE-419, and `GENERAL` is not exported.

- [ ] **Step 3: Rewrite `web/src/lib/rules/sides.js`**

Replace the whole file:

```js
// Per-side deckbuilding profiles, sourced from councilofelrond.org section 1.
// specificMode says how attributes.specific is read:
//   'balrog-exempt'  -- specific:"Balrog" cards escape race/mind restrictions
//   'avatar-match'   -- a card naming an avatar is legal only in that avatar's deck
import { matchesRace } from './races.js';

// Side-independent limits (1.3.1, 1.3.2, 1.4).
export const GENERAL = {
  agentMindMax: 36, // 1.3.2 -- total mind of all agent cards in the whole deck
  copiesDefault: 3, // 1.3.1 -- copies of a non-unique card
  uniqueMax: 1,     // 1.3.1 -- copies of a unique non-avatar card
  siteMax: 1,       // 1.4   -- copies of a non-haven site
};

// 1.3.4 -- which sides may declare the avatar a "specific" card names. Each of
// the five wizard names exists as both a Wizard avatar (TW, Hero alignment) and
// a Fallen-wizard avatar (WH), so both sides can declare them.
export const SPECIFIC_TO_SIDES = {
  Balrog: ['balrog'],
  Alatar: ['wizard', 'fallen-wizard'],
  Gandalf: ['wizard', 'fallen-wizard'],
  Pallando: ['wizard', 'fallen-wizard'],
  Radagast: ['wizard', 'fallen-wizard'],
  Saruman: ['wizard', 'fallen-wizard'],
};

// 'Dual' is on every side's list: the four Dual cards (LE-245 Tidings of Death,
// LE-419 Deadly Dart, WH-38 Beasts of the Wood, WH-40 Wild Hounds) are playable
// by both hero and minion sides and section 1 never restricts them.
export const SIDES = {
  wizard: {
    id: 'wizard', avatarAlignment: 'Hero',
    alignments: ['Hero', 'Neutral', 'Dual'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null },
    playDeck: null, // 1.5 lands in lot 2 as four separate budgets
    specificMode: 'avatar-match',
  },
  ringwraith: {
    id: 'ringwraith', avatarAlignment: 'Minion',
    alignments: ['Minion', 'Neutral', 'Dual'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null },
    playDeck: null,
    specificMode: 'avatar-match',
  },
  'fallen-wizard': {
    id: 'fallen-wizard', avatarAlignment: 'Fallen-wizard',
    alignments: ['Hero', 'Minion', 'Neutral', 'Dual', 'Stage', 'Fallen-wizard'],
    // 1.3.F1 -- rekeyed onto (bucket, alignment) in lot 3 Task 20.
    copies: { default: 2, byAlignment: { Stage: 3 } },
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null },
    playDeck: null,
    specificMode: 'avatar-match',
  },
  balrog: {
    id: 'balrog', avatarAlignment: 'Balrog',
    alignments: ['Minion', 'Neutral', 'Dual', 'Balrog'],
    copies: { default: 3, byAlignment: {} },
    // 1.3.B4 -- non-avatar characters must be Orc or Troll with mind < 9,
    // unless they are Balrog-specific.
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: 9, requireRaces: ['Orc', 'Troll'] },
    playDeck: null,
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

// 1.3.B4 -- does this character's race satisfy the side's requirement?
// Uses matchesRace rather than a substring test: the data writes "Wolves"
// where the rule says "Wolf", and joins several races with commas.
export function raceAllowed(card, sideId) {
  const side = SIDES[sideId];
  if (!side || !side.pool.requireRaces) return true;
  return side.pool.requireRaces.some((r) => matchesRace((card.attributes || {}).race, r));
}
```

- [ ] **Step 4: Strip the unsourced pool checks from the validator**

In `web/src/lib/rules/validate.js`, change the `sides.js` import to:

```js
import { SIDES, raceAllowed } from './sides.js';
```

Replace the Balrog race condition inside the per-card loop:

```js
      if (profile.pool.requireRaces && !raceAllowed(c, side)) {
```

(keep the `const race = String(a.race || '');` line above it — the message params still use it, and keep the `emit('BALROG-RACE', ...)` call unchanged).

Replace the whole `// --- pool ---` block with:

```js
  // --- pool ---
  let poolChars = 0, poolItems = 0;
  for (const [id, n] of Object.entries(pool)) {
    const c = cardsById.get(id); if (!c) continue;
    // zonesFor (zones.js) is the single source of truth for what may sit in
    // the pool -- the same function drag-and-drop consults -- so eligibility
    // is derived from it rather than re-decided here.
    const z = zonesFor(c);
    const poolEligible = z.primary === 'pool' || z.extra.includes('pool');
    if (!poolEligible) {
      emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'type' }, 'POOL-ELIGIBLE.type');
      continue;
    }
    if (c.type === 'Character') poolChars += n;
    else if (c.type === 'Resource') poolItems += n;
  }
  if (poolChars > profile.pool.maxCharacters) emit('POOL-CHARS', { count: poolChars, max: profile.pool.maxCharacters, side });
  if (poolItems > profile.pool.maxMinorItems) emit('POOL-ITEMS', { count: poolItems, max: profile.pool.maxMinorItems }, 'POOL-ITEMS.count');
```

The `toInt` helper is still used by `BALROG-MIND`, so leave it defined.

- [ ] **Step 5: Retire the rule and its strings**

In `web/src/lib/rules/catalog.js`, delete the `POOL-MIND` line.

In `web/src/lib/rules/docText.js`, replace `poolText` with:

```js
// Compose the starting-pool constraints as short localized fragments rather
// than one sentence template, since several fields are null for any given side
// (see SIDES.*.pool) and one template can't gracefully drop clauses per
// language.
export function poolText(t, pool) {
  const parts = [
    t('docs.pool.maxCharacters', { n: pool.maxCharacters }),
    t('docs.pool.maxMinorItems', { n: pool.maxMinorItems }),
  ];
  if (pool.balrogMindPerCharacterLimit != null) parts.push(t('docs.pool.balrogMindBelow', { n: pool.balrogMindPerCharacterLimit }));
  if (pool.requireRaces && pool.requireRaces.length) {
    parts.push(t('docs.pool.requireRaces', { races: pool.requireRaces.map((r) => localize(t, 'race', r)).join(', ') }));
  }
  return parts.join(' · ');
}
```

In `web/src/lib/i18n.js`, delete these six keys from **all three** language blocks:

```
'rules.POOL-MIND.total'
'rules.POOL-MIND.char'
'rules.POOL-MIND.doc'
'docs.pool.mindCap'
'docs.pool.mindPerCharacter'
'docs.pool.forbidRaces'
```

Then change `'rules.POOL-ITEMS'` to `'rules.POOL-ITEMS.count'` in all three blocks (the code now emits a dotted code; Task 10 adds the two other codes).

- [ ] **Step 6: Delete the three tests that assert retired behaviour**

- `it('POOL-MIND: per-character mind limit over the cap uses the .char code', ...)`
- `it('POOL-MIND: pool total over the cap uses the .total code', ...)`
- `it('POOL-ELIGIBLE.race: a pool character whose race the side forbids fires with reason "race" (verified, on by default)', ...)`

Also fix `it('exposes the four sides with alignments and copy limits', ...)` and `it('POOL-CHARS: pool character count above the side max fires', ...)` — both assert the old pool numbers. Update the expected `maxCharacters` to 10 and pick a pool of 11 characters for the POOL-CHARS case.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "fix: pool holds ten characters, Dual is legal, retire unsourced POOL-MIND"
```

---

### Task 6: Fix which cards may occupy the starting pool

Two bugs in `zonesFor`. Avatars default to the **pool**, but 1.7 defines the pool as up to ten *non-avatar* characters. And pool item eligibility is keyed on `playableAsStartingMinorItem` — 6 permanent-events whose own text says they may be played with a starting company *"in lieu of a minor item"*. They **consume** an item slot; they are not the list of eligible cards. 1.7's actual subject is minor items, `subtype === 'Minor Item'`, of which there are 42 — currently unreachable from the pool at all.

**Files:**
- Modify: `web/src/lib/rules/zones.js` (whole file)
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `zonesFor(card) -> { primary, extra }`, unchanged signature. Avatars no longer offer `'pool'`; `Resource` cards with `subtype === 'Minor Item'` now do. `dropTargets.js` picks both changes up for free — it derives from `zonesFor`.

- [ ] **Step 1: Write the failing tests**

Add to `describe('zonesFor', ...)`:

```js
  it('avatars belong to the play deck and sideboard, never the pool (1.7)', () => {
    // 1.7: "a pool is a set of up to 10 NON-avatar characters".
    for (const c of cards.filter((x) => (x.attributes || {}).avatar === true)) {
      const z = zonesFor(c);
      expect(z.primary).toBe('deck');
      expect(z.extra).toEqual(['sideboard']);
      expect(isDropAllowed(c, 'pool')).toBe(false);
    }
  });

  it('minor items may sit in the pool (1.7)', () => {
    // BA-34 Elven Rope: Resource/Hero, subtype "Minor Item", non-unique.
    const z = zonesFor(index.get('BA-34'));
    expect(z.extra).toContain('pool');
    expect(isDropAllowed(index.get('BA-34'), 'pool')).toBe(true);
    // A non-item resource still may not.
    expect(isDropAllowed(index.get('TW-205'), 'pool')).toBe(false);
  });

  it('the six "in lieu of a minor item" permanent-events keep their pool slot', () => {
    for (const id of ['AS-94', 'BA-31', 'BA-44', 'BA-60', 'BA-70', 'WH-46']) {
      expect(zonesFor(index.get(id)).extra).toContain('pool');
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "never the pool"`

Expected: FAIL — avatars currently return `primary: 'pool'`.

- [ ] **Step 3: Implement**

Replace `web/src/lib/rules/zones.js`:

```js
// Which zone counters a card exposes in deckbuilding mode.
// 'deck' = the main deck; play vs location derives from the card type
// (backGroupForType), so it is not a zone of its own here.
export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') {
    // 1.7 -- the pool holds up to ten NON-avatar characters, so an avatar's
    // zones are the play deck and the sideboard only.
    if (a.avatar === true) return { primary: 'deck', extra: ['sideboard'] };
    return { primary: 'pool', extra: ['deck', 'sideboard'] };
  }
  // 1.7 -- the pool may also hold up to two minor items. Two families qualify:
  // actual Minor Item cards, and the six permanent-events whose own text says
  // they may be played with a starting company "in lieu of a minor item"
  // (AS-94, BA-31, BA-44, BA-60, BA-70, WH-46), which consume an item slot.
  if (type === 'Resource' && (a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true)) {
    return { primary: 'deck', extra: ['sideboard', 'pool'] };
  }
  return { primary: 'deck', extra: ['sideboard'] };
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`

Expected: PASS. If `it('characters default to pool; resources/hazards default to deck', ...)` picks an avatar as its sample character, change its sample to a non-avatar (e.g. `AS-1` Bûrat).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rules/zones.js test/rules.test.js
git commit -m "fix: avatars are not pool-eligible, minor items are (CoE 1.7)"
```

---

### Task 7: AGENT-MIND — total agent mind ≤ 36 (1.3.2)

**Files:**
- Modify: `web/src/lib/rules/catalog.js` (add the rule)
- Modify: `web/src/lib/rules/validate.js` (import `GENERAL`; new block)
- Modify: `web/src/lib/i18n.js` (2 keys × 3 languages)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `GENERAL.agentMindMax` (Task 5).
- Produces: rule id `AGENT-MIND`, params `{ total, max }`, code `AGENT-MIND`.

- [ ] **Step 1: Write the failing test**

```js
  it('AGENT-MIND: total mind of all agent cards over 36 fires (1.3.2)', () => {
    // Golodhros 9 + Baduila 8 + Elerina 8 + The Grimburgoth 8 = 33, plus
    // Dror 4 = 37, one over the limit.
    const over = { 'DM-14': 1, 'DM-2': 1, 'DM-7': 1, 'DM-15': 1, 'DM-6': 1 };
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: over, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'AGENT-MIND');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ total: 37, max: 36 });
    expect(hit[0].severity).toBe('error');

    // Bill Ferny (mind 3) instead of Dror (4) lands exactly on 36 -- legal.
    const exact = { 'DM-14': 1, 'DM-2': 1, 'DM-7': 1, 'DM-15': 1, 'DM-3': 1 };
    const ok = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: exact, cardsById: index,
    });
    expect(ok.filter((w) => w.ruleId === 'AGENT-MIND')).toEqual([]);
  });

  it('AGENT-MIND counts agents in the sideboard and pool too (1.3.2)', () => {
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: { 'DM-14': 1, 'DM-2': 1 },
      zones: { sideboard: { 'DM-7': 1, 'DM-15': 1 }, pool: { 'DM-6': 1 } },
      cardsById: index,
    });
    expect(out.find((w) => w.ruleId === 'AGENT-MIND').params.total).toBe(37);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js -t "AGENT-MIND"`

Expected: FAIL — no `AGENT-MIND` warning is emitted, so `hit` is empty.

- [ ] **Step 3: Add the rule to the catalogue**

In `web/src/lib/rules/catalog.js`, add after the `SPECIFIC-AVATAR` line:

```js
  { id: 'AGENT-MIND', severity: 'error', status: 'verified', ref: '1.3.2', source: COE },
```

- [ ] **Step 4: Implement the check**

In `web/src/lib/rules/validate.js`, change the `sides.js` import to:

```js
import { SIDES, GENERAL, raceAllowed } from './sides.js';
```

and add this block immediately after the per-card `for (const e of entries)` loop closes, before `// --- deck sizes ---`:

```js
  // --- agents (1.3.2) ---
  // "The total mind of all agent cards in the entirety of a player's deck
  // (i.e. their play deck, sideboard, and pool combined) cannot exceed 36."
  // Counts agent cards however a side later classifies them (character for
  // Ringwraith/Fallen-wizard, hazard for Wizard/Balrog), so it needs no role
  // derivation -- attributes.agent is enough.
  let agentMind = 0;
  for (const e of entries) {
    const a = e.card.attributes || {};
    if (a.agent === true) agentMind += (toInt(a.mind) || 0) * e.count;
  }
  if (agentMind > GENERAL.agentMindMax) emit('AGENT-MIND', { total: agentMind, max: GENERAL.agentMindMax });
```

- [ ] **Step 5: Add the strings**

In `web/src/lib/i18n.js`, add to each language block (place next to the other `rules.*` keys):

```js
// fr
    'rules.AGENT-MIND': "L'esprit total des cartes agent du deck est de {total}, au-delà du maximum de {max}. Retire des agents ou choisis-en à esprit plus faible.",
    'rules.AGENT-MIND.doc': "L'esprit total de toutes les cartes agent du deck entier (deck de jeu, réserve et pool) ne peut dépasser 36.",
// en
    'rules.AGENT-MIND': 'The deck’s agent cards total {total} mind, over the maximum of {max}. Remove agents or pick lower-mind ones.',
    'rules.AGENT-MIND.doc': 'The total mind of every agent card in the whole deck (play deck, sideboard and pool) cannot exceed 36.',
// es
    'rules.AGENT-MIND': 'Las cartas de agente del mazo suman {total} de mente, por encima del máximo de {max}. Retira agentes o elige otros de menor mente.',
    'rules.AGENT-MIND.doc': 'La mente total de todas las cartas de agente del mazo completo (mazo de juego, reserva y reserva inicial) no puede superar 36.',
```

- [ ] **Step 6: Run the suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: AGENT-MIND caps total agent mind at 36 (CoE 1.3.2)"
```

---

### Task 8: SPECIFIC-SIDE and REGION-EXCLUDED

1.3.4 restricts avatar-specific cards to players who can declare that avatar. Today the 38 `Resource/Minion` cards carrying `specific: "Balrog"` pass silently in a Ringwraith deck. 1.4 says a location deck contains no Region cards.

**Files:**
- Modify: `web/src/lib/rules/catalog.js` (2 rules)
- Modify: `web/src/lib/rules/validate.js` (per-card loop)
- Modify: `web/src/lib/i18n.js` (4 keys × 3 languages)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `SPECIFIC_TO_SIDES` (Task 5).
- Produces: `SPECIFIC-SIDE` with params `{ id, name, specific, side }`; `REGION-EXCLUDED` with params `{ id, name }`.

- [ ] **Step 1: Write the failing tests**

```js
  it('SPECIFIC-SIDE: a Balrog-specific card is illegal in a Ringwraith deck (1.3.4)', () => {
    // BA-4 Bolg: Character/Minion, specific "Balrog". Its alignment is legal
    // for a Ringwraith, so only 1.3.4 catches it.
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: { 'BA-4': 1 }, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'SPECIFIC-SIDE');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.specific).toBe('Balrog');
  });

  it('SPECIFIC-SIDE: the same card is fine in a Balrog deck', () => {
    const out = validateDeck({
      side: 'balrog', length: 'standard', tournament: true,
      quantities: { 'BA-4': 1 }, cardsById: index,
    });
    expect(out.filter((w) => w.ruleId === 'SPECIFIC-SIDE')).toEqual([]);
  });

  it('SPECIFIC-SIDE: a wizard-specific Stage card is fine for a Fallen-wizard', () => {
    // WH-90-style Stage resources naming a wizard are Fallen-wizard territory;
    // pick any Stage card carrying `specific`.
    const stage = cards.find((c) => c.alignment === 'Stage' && (c.attributes || {}).specific);
    const out = validateDeck({
      side: 'fallen-wizard', length: 'standard', tournament: true,
      quantities: { [stage.id]: 1 }, cardsById: index,
    });
    expect(out.filter((w) => w.ruleId === 'SPECIFIC-SIDE')).toEqual([]);
  });

  it('REGION-EXCLUDED: a Region card in the deck fires (1.4)', () => {
    const region = cards.find((c) => c.type === 'Region');
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      quantities: { [region.id]: 1 }, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'REGION-EXCLUDED');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.id).toBe(region.id);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "SPECIFIC-SIDE"`

Expected: FAIL — no such warnings exist.

- [ ] **Step 3: Add the rules to the catalogue**

In `web/src/lib/rules/catalog.js`, add after the `SPECIFIC-AVATAR` line:

```js
  { id: 'SPECIFIC-SIDE', severity: 'error', status: 'verified', ref: '1.3.4', source: COE },
```

and after the `SITE-COPIES` line:

```js
  { id: 'REGION-EXCLUDED', severity: 'error', status: 'verified', ref: '1.4', source: COE },
```

- [ ] **Step 4: Implement both checks**

In `web/src/lib/rules/validate.js`, add `SPECIFIC_TO_SIDES` to the `sides.js` import:

```js
import { SIDES, GENERAL, SPECIFIC_TO_SIDES, raceAllowed } from './sides.js';
```

Inside the per-card `for (const e of entries)` loop, add these two checks immediately **before** the existing `if (profile.specificMode === 'avatar-match' ...)` block:

```js
    // 1.3.4 -- a card specific to an avatar this side cannot declare at all.
    // Distinct from SPECIFIC-AVATAR, which is the finer per-avatar check for a
    // side that *can* declare the named avatar.
    if (a.specific && !(SPECIFIC_TO_SIDES[a.specific] || []).includes(side)) {
      emit('SPECIFIC-SIDE', { id: e.id, name: name(c), specific: a.specific, side });
    }

    // 1.4 -- "no region cards, which are generally replaced with a map for
    // tournament play".
    if (c.type === 'Region') emit('REGION-EXCLUDED', { id: e.id, name: name(c) });
```

- [ ] **Step 5: Add the strings**

```js
// fr
    'rules.SPECIFIC-SIDE': '{name} est spécifique à {specific} — un deck {side} ne peut pas déclarer cet avatar, donc la carte n’y est pas jouable.',
    'rules.SPECIFIC-SIDE.doc': 'Une carte spécifique à un avatar donné n’est autorisée que dans un deck qui déclare cet avatar.',
    'rules.REGION-EXCLUDED': '{name} est une carte Région — un deck de lieux n’en contient pas (elles sont remplacées par une carte du monde en tournoi).',
    'rules.REGION-EXCLUDED.doc': 'Un deck de lieux ne contient aucune carte Région.',
// en
    'rules.SPECIFIC-SIDE': '{name} is specific to {specific} — a {side} deck cannot declare that avatar, so the card is not playable in it.',
    'rules.SPECIFIC-SIDE.doc': 'A card specific to a given avatar is only allowed in a deck that declares that avatar.',
    'rules.REGION-EXCLUDED': '{name} is a Region card — a location deck holds none (they are replaced by a map for tournament play).',
    'rules.REGION-EXCLUDED.doc': 'A location deck contains no Region cards.',
// es
    'rules.SPECIFIC-SIDE': '{name} es específica de {specific} — un mazo {side} no puede declarar ese avatar, así que la carta no es jugable en él.',
    'rules.SPECIFIC-SIDE.doc': 'Una carta específica de un avatar solo se permite en un mazo que declare ese avatar.',
    'rules.REGION-EXCLUDED': '{name} es una carta de Región — un mazo de lugares no contiene ninguna (se sustituyen por un mapa en torneo).',
    'rules.REGION-EXCLUDED.doc': 'Un mazo de lugares no contiene cartas de Región.',
```

- [ ] **Step 6: Run the suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: SPECIFIC-SIDE and REGION-EXCLUDED (CoE 1.3.4, 1.4)"
```

**Note for the implementer:** all 33 wizard-specific cards are `Resource/Stage`, an alignment only Fallen-wizard allows, so `SPECIFIC-SIDE` fires in practice only for the 45 `specific: "Balrog"` cards in non-Balrog decks. Extending `specificMode: 'avatar-match'` to the Wizard side (Task 5) is therefore correct-but-inert against today's card data; it is there because 1.3.4 is a general rule, not a Fallen-wizard one.

---

### Task 9: The four avatar rules replace AVATAR-UNIQUE

`AVATAR-UNIQUE` fires on any avatar total above 1 across all zones, which rejects legal decks: 1.5 allows **three** avatars in the play deck, any combination except three different ones, and 1.6.2 allows avatars in the sideboard. Copy caps are cumulative across zones (1.6: *"the allowed maximum number of each specific card across the whole deck"*; 1.7 carves out only the *character count*, not copy caps).

This task lands the two **reporting** rules. Lot 1b Task 13 hard-enforces the two **cap** rules from the same numbers.

**Files:**
- Modify: `web/src/lib/rules/sides.js` (`GENERAL` gains the avatar numbers)
- Modify: `web/src/lib/rules/catalog.js` (remove `AVATAR-UNIQUE`, add 4 rules)
- Modify: `web/src/lib/rules/validate.js` (avatar block)
- Modify: `web/src/lib/i18n.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Produces on `GENERAL`: `avatarMaxCopies: 3`, `avatarMaxDistinct: 2`, `avatarMaxInSideboard: 1`, `avatarMaxWithMultiples: 1`.
- Rule ids and codes: `AVATAR-COPIES` (params `{ id, name, count, max }`), `AVATAR-SIDEBOARD` (`{ id, name, count, max }`), `AVATAR-COUNT` with codes `AVATAR-COUNT.total` (`{ count, max, names, ids }`) and `AVATAR-COUNT.distinct` (`{ distinct, max, names, ids }`), `AVATAR-MULTIPLES` (`{ count, max, names, ids }`).

- [ ] **Step 1: Write the failing tests**

```js
describe('avatar rules (1.5, 1.6, 1.6.2)', () => {
  const V = (quantities, zones = {}) => validateDeck({
    side: 'wizard', length: 'standard', tournament: true,
    quantities, zones, cardsById: index,
  });
  const ids = (out, ruleId) => out.filter((w) => w.ruleId === ruleId);

  it('three copies of one avatar in the play deck is legal', () => {
    const out = V({ 'TW-156': 3 }); // Gandalf
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]);
    expect(ids(out, 'AVATAR-COPIES')).toEqual([]);
    expect(ids(out, 'AVATAR-MULTIPLES')).toEqual([]);
  });

  it('two different avatars, one duplicated, is legal', () => {
    const out = V({ 'TW-156': 2, 'TW-181': 1 }); // 2 Gandalf + 1 Saruman
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]);
  });

  it('AVATAR-COUNT.distinct: three different avatars in the play deck fires', () => {
    const out = V({ 'TW-156': 1, 'TW-181': 1, 'TW-178': 1 });
    const hit = ids(out, 'AVATAR-COUNT');
    expect(hit).toHaveLength(1);
    expect(hit[0].code).toBe('AVATAR-COUNT.distinct');
    expect(hit[0].params.distinct).toBe(3);
  });

  it('AVATAR-COUNT.total: four avatar copies in the play deck fires', () => {
    const out = V({ 'TW-156': 3, 'TW-181': 1 });
    const codes = ids(out, 'AVATAR-COUNT').map((w) => w.code);
    expect(codes).toContain('AVATAR-COUNT.total');
  });

  it('AVATAR-COPIES: a fourth copy across play deck and sideboard fires (1.6)', () => {
    // Caps are cumulative: 3 in the play deck leaves nothing for the sideboard.
    const out = V({ 'TW-156': 3 }, { sideboard: { 'TW-156': 1 }, pool: {} });
    const hit = ids(out, 'AVATAR-COPIES');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toMatchObject({ id: 'TW-156', count: 4, max: 3 });
  });

  it('AVATAR-SIDEBOARD: two copies of one avatar in the sideboard fires (1.6.2)', () => {
    const out = V({}, { sideboard: { 'TW-156': 2 }, pool: {} });
    const hit = ids(out, 'AVATAR-SIDEBOARD');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toMatchObject({ id: 'TW-156', count: 2, max: 1 });
  });

  it('AVATAR-SIDEBOARD: any number of distinct avatars in the sideboard is legal', () => {
    const out = V({}, { sideboard: { 'TW-156': 1, 'TW-181': 1, 'TW-178': 1, 'TW-117': 1 }, pool: {} });
    expect(ids(out, 'AVATAR-SIDEBOARD')).toEqual([]);
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]); // 1.5 is play-deck-scoped
  });

  it('AVATAR-MULTIPLES: two avatars each split across play deck and sideboard fires', () => {
    // Gandalf 1+1 = multiples; Saruman 1+1 = multiples. Only one is allowed.
    const out = V(
      { 'TW-156': 1, 'TW-181': 1 },
      { sideboard: { 'TW-156': 1, 'TW-181': 1 }, pool: {} },
    );
    const hit = ids(out, 'AVATAR-MULTIPLES');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.count).toBe(2);
  });

  it('AVATAR-MULTIPLES: one avatar with multiples is legal', () => {
    const out = V({ 'TW-156': 2, 'TW-181': 1 }, { sideboard: { 'TW-181': 0 }, pool: {} });
    expect(ids(out, 'AVATAR-MULTIPLES')).toEqual([]);
  });

  it('AVATAR-UNIQUE is retired', () => {
    expect(RULES.find((r) => r.id === 'AVATAR-UNIQUE')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "avatar rules"`

Expected: FAIL — none of the four rules exist.

- [ ] **Step 3: Add the numbers to `GENERAL`**

In `web/src/lib/rules/sides.js`, extend `GENERAL`:

```js
export const GENERAL = {
  agentMindMax: 36, // 1.3.2 -- total mind of all agent cards in the whole deck
  copiesDefault: 3, // 1.3.1 -- copies of a non-unique card
  uniqueMax: 1,     // 1.3.1 -- copies of a unique non-avatar card
  siteMax: 1,       // 1.4   -- copies of a non-haven site
  // Avatars are exempt from the unique rule (1.3.1 says "each unique
  // NON-avatar card"). 1.5 allows three in the play deck; 1.6's "across the
  // whole deck" clause makes three the whole-deck maximum per avatar.
  avatarMaxCopies: 3,        // 1.5 + 1.6, cumulative across every zone
  avatarMaxDistinct: 2,      // 1.5 -- "except for three different avatars"
  avatarMaxInSideboard: 1,   // 1.6.2 -- one copy of each avatar, any number of avatars
  avatarMaxWithMultiples: 1, // 1.6.2 -- at most one avatar with multiple copies
};
```

Update the Task 5 test `it('GENERAL carries the side-independent limits', ...)`: replace the `toEqual` with individual `expect(GENERAL.x).toBe(y)` assertions so later additions don't break it.

- [ ] **Step 4: Swap the rules in the catalogue**

In `web/src/lib/rules/catalog.js`, delete the `AVATAR-UNIQUE` line and put in its place:

```js
  // 1.5 + 1.6 -- per-avatar copy cap, cumulative across every zone. Hard.
  { id: 'AVATAR-COPIES', severity: 'error', status: 'verified', refs: ['1.5', '1.6'], hard: true, source: COE },
  // 1.6.2 -- one copy of each avatar in the sideboard, on top of the total
  // cap above. Owner's reading (2026-07-26); stricter than the printed
  // sentence, which permits two copies of one avatar there.
  { id: 'AVATAR-SIDEBOARD', severity: 'error', status: 'verified', ref: '1.6.2', hard: true, interpretation: true, source: COE },
  // 1.5 -- play-deck composition: a sum over different cards, not a copy cap.
  { id: 'AVATAR-COUNT', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'AVATAR-MULTIPLES', severity: 'error', status: 'verified', ref: '1.6.2', source: COE },
```

- [ ] **Step 5: Rewrite the validator's avatar block**

In `web/src/lib/rules/validate.js`, replace the whole `// --- avatar ---` block with:

```js
  // --- avatars ---
  const avatarEntries = entries.filter((e) => (e.card.attributes || {}).avatar === true);
  if (avatarEntries.length === 0) emit('AVATAR-PRESENT', { side });
  for (const e of avatarEntries) {
    if (e.card.alignment !== profile.avatarAlignment) emit('AVATAR-SIDE', { id: e.id, name: name(e.card), side });
  }

  // 1.5 + 1.6 -- three copies of one avatar across the whole deck. Cumulative:
  // `entries` already sums deck + sideboard + pool.
  for (const e of avatarEntries) {
    if (e.count > GENERAL.avatarMaxCopies) {
      emit('AVATAR-COPIES', { id: e.id, name: name(e.card), count: e.count, max: GENERAL.avatarMaxCopies });
    }
    // 1.6.2 -- and at most one of those copies may sit in the sideboard.
    const inSb = sb[e.id] || 0;
    if (inSb > GENERAL.avatarMaxInSideboard) {
      emit('AVATAR-SIDEBOARD', { id: e.id, name: name(e.card), count: inSb, max: GENERAL.avatarMaxInSideboard });
    }
  }

  // 1.5 -- the PLAY DECK holds up to three avatars, "any combination allowed
  // except for three different avatars". Scoped to `quantities`; the sideboard
  // has its own allowance (1.6.2).
  const playAvatars = avatarEntries
    .map((e) => ({ e, count: quantities[e.id] || 0 }))
    .filter((x) => x.count > 0);
  const playNames = playAvatars.map((x) => name(x.e.card));
  const playIds = playAvatars.map((x) => x.e.id);
  const playTotal = playAvatars.reduce((s, x) => s + x.count, 0);
  if (playTotal > GENERAL.avatarMaxInPlayDeck) {
    emit('AVATAR-COUNT', { count: playTotal, max: GENERAL.avatarMaxInPlayDeck, names: playNames, ids: playIds }, 'AVATAR-COUNT.total');
  }
  if (playAvatars.length > GENERAL.avatarMaxDistinct) {
    emit('AVATAR-COUNT', { distinct: playAvatars.length, max: GENERAL.avatarMaxDistinct, names: playNames, ids: playIds }, 'AVATAR-COUNT.distinct');
  }

  // 1.6.2 -- at most one avatar may have multiple copies across the play deck
  // and the sideboard combined. With the sideboard capped at one copy, the
  // allowance is spent either by an avatar held 2-3x in the play deck or by the
  // same avatar appearing once in each zone.
  const multiples = avatarEntries.filter((e) => (quantities[e.id] || 0) + (sb[e.id] || 0) >= 2);
  if (multiples.length > GENERAL.avatarMaxWithMultiples) {
    emit('AVATAR-MULTIPLES', {
      count: multiples.length, max: GENERAL.avatarMaxWithMultiples,
      names: multiples.map((e) => name(e.card)), ids: multiples.map((e) => e.id),
    });
  }

  // SPECIFIC-AVATAR needs "the" declared avatar, which is only unambiguous
  // when the deck names exactly one distinct avatar card.
  const avatarName = avatarEntries.length === 1 ? name(avatarEntries[0].card) : null;
  const avatarId = avatarEntries.length === 1 ? avatarEntries[0].id : null;
```

Add `avatarMaxInPlayDeck: 3, // 1.5` to `GENERAL` alongside the others (used above).

- [ ] **Step 6: Swap the strings**

In `web/src/lib/i18n.js`, delete `'rules.AVATAR-UNIQUE'` and `'rules.AVATAR-UNIQUE.doc'` from all three blocks and add:

```js
// fr
    'rules.AVATAR-COPIES': '{name} — {count} exemplaires dans le deck entier, au-delà du maximum de {max}. Les plafonds se cumulent sur le deck de jeu, la réserve et le pool.',
    'rules.AVATAR-COPIES.doc': 'Un avatar est limité à 3 exemplaires sur l’ensemble du deck (deck de jeu + réserve + pool).',
    'rules.AVATAR-SIDEBOARD': '{name} — {count} exemplaires en réserve, alors qu’un seul exemplaire de chaque avatar y est autorisé.',
    'rules.AVATAR-SIDEBOARD.doc': 'La réserve accepte autant d’avatars différents que voulu, mais un seul exemplaire de chacun.',
    'rules.AVATAR-COUNT.total': 'Le deck de jeu contient {count} exemplaires d’avatar, au-delà du maximum de {max}.',
    'rules.AVATAR-COUNT.distinct': 'Le deck de jeu contient {distinct} avatars différents — deux au maximum (trois avatars différents sont interdits).',
    'rules.AVATAR-COUNT.doc': 'Le deck de jeu accepte jusqu’à 3 exemplaires d’avatar, en toute combinaison sauf trois avatars différents.',
    'rules.AVATAR-MULTIPLES': '{count} avatars sont présents en plusieurs exemplaires entre le deck de jeu et la réserve — un seul avatar peut l’être.',
    'rules.AVATAR-MULTIPLES.doc': 'Un seul avatar peut apparaître en plusieurs exemplaires sur le total deck de jeu + réserve.',
// en
    'rules.AVATAR-COPIES': '{name} — {count} copies in the whole deck, over the maximum of {max}. Copy caps add up across play deck, sideboard and pool.',
    'rules.AVATAR-COPIES.doc': 'An avatar is limited to 3 copies across the whole deck (play deck + sideboard + pool).',
    'rules.AVATAR-SIDEBOARD': '{name} — {count} copies in the sideboard, where only one copy of each avatar is allowed.',
    'rules.AVATAR-SIDEBOARD.doc': 'The sideboard takes any number of different avatars, but only one copy of each.',
    'rules.AVATAR-COUNT.total': 'The play deck holds {count} avatar copies, over the maximum of {max}.',
    'rules.AVATAR-COUNT.distinct': 'The play deck holds {distinct} different avatars — two at most (three different avatars are not allowed).',
    'rules.AVATAR-COUNT.doc': 'A play deck takes up to 3 avatar copies, in any combination except three different avatars.',
    'rules.AVATAR-MULTIPLES': '{count} avatars have multiple copies across the play deck and sideboard — only one avatar may.',
    'rules.AVATAR-MULTIPLES.doc': 'Only one avatar may have multiple copies across the play deck and sideboard combined.',
// es
    'rules.AVATAR-COPIES': '{name} — {count} copias en el mazo completo, por encima del máximo de {max}. Los límites de copias se suman entre mazo de juego, reserva y reserva inicial.',
    'rules.AVATAR-COPIES.doc': 'Un avatar se limita a 3 copias en el mazo completo (mazo de juego + reserva + reserva inicial).',
    'rules.AVATAR-SIDEBOARD': '{name} — {count} copias en la reserva, donde solo se permite una copia de cada avatar.',
    'rules.AVATAR-SIDEBOARD.doc': 'La reserva admite cualquier número de avatares distintos, pero solo una copia de cada uno.',
    'rules.AVATAR-COUNT.total': 'El mazo de juego contiene {count} copias de avatar, por encima del máximo de {max}.',
    'rules.AVATAR-COUNT.distinct': 'El mazo de juego contiene {distinct} avatares distintos — dos como máximo (tres avatares distintos no se permiten).',
    'rules.AVATAR-COUNT.doc': 'Un mazo de juego admite hasta 3 copias de avatar, en cualquier combinación salvo tres avatares distintos.',
    'rules.AVATAR-MULTIPLES': '{count} avatares tienen varias copias entre el mazo de juego y la reserva — solo uno puede tenerlas.',
    'rules.AVATAR-MULTIPLES.doc': 'Solo un avatar puede tener varias copias en el total de mazo de juego + reserva.',
```

- [ ] **Step 7: Run the suite**

Run: `npm test`

Expected: PASS. The pre-existing `it('flags a missing avatar as a warning, never an error', ...)` and `it('AVATAR-SIDE: ...', ...)` must still pass unchanged.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: four avatar rules replace AVATAR-UNIQUE (CoE 1.5, 1.6, 1.6.2)"
```

---

### Task 10: POOL-ITEMS gains its ineligibility codes

1.7 allows *"up to two **non-unique, non-hoard** minor items"*. Task 6 made minor items reachable; this adds the qualifier. The six *"in lieu of a minor item"* permanent-events enter on their own card text — a card-level permission, not a 1.7 allowance — so the qualifier applies only to `subtype === 'Minor Item'` cards.

**Files:**
- Modify: `web/src/lib/rules/validate.js` (pool block)
- Modify: `web/src/lib/i18n.js` (2 keys × 3 languages)
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: codes `POOL-ITEMS.count` (`{ count, max }`), `POOL-ITEMS.unique` (`{ id, name }`), `POOL-ITEMS.hoard` (`{ id, name }`), all under rule id `POOL-ITEMS`.

- [ ] **Step 1: Write the failing tests**

```js
  it('POOL-ITEMS.unique: a unique minor item in the pool fires (1.7)', () => {
    const uniq = cards.find((c) => (c.attributes || {}).subtype === 'Minor Item' && (c.attributes || {}).unique);
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool: { [uniq.id]: 1 } }, cardsById: index,
    });
    const hit = out.filter((w) => w.code === 'POOL-ITEMS.unique');
    expect(hit).toHaveLength(1);
    expect(hit[0].ruleId).toBe('POOL-ITEMS');
  });

  it('POOL-ITEMS.hoard: a hoard minor item in the pool fires (1.7)', () => {
    // AS-70 Jewel of Beleriand is a Minor Item keyworded "Hoard Item".
    const hoard = cards.find((c) => (c.attributes || {}).subtype === 'Minor Item'
      && ((c.attributes || {}).keywords || []).includes('Hoard Item')
      && !(c.attributes || {}).unique);
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool: { [hoard.id]: 1 } }, cardsById: index,
    });
    expect(out.filter((w) => w.code === 'POOL-ITEMS.hoard')).toHaveLength(1);
  });

  it('POOL-ITEMS.count: three pool items fire, two do not (1.7)', () => {
    const ok = cards.filter((c) => (c.attributes || {}).subtype === 'Minor Item'
      && !(c.attributes || {}).unique
      && !((c.attributes || {}).keywords || []).includes('Hoard Item')
      && c.alignment === 'Hero').slice(0, 3);
    expect(ok.length).toBe(3); // guard: the data must actually offer three
    const pool = Object.fromEntries(ok.map((c) => [c.id, 1]));
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool }, cardsById: index,
    });
    const hit = out.filter((w) => w.code === 'POOL-ITEMS.count');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ count: 3, max: 2 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "POOL-ITEMS"`

Expected: FAIL — only `POOL-ITEMS.count` exists.

- [ ] **Step 3: Implement**

In `web/src/lib/rules/validate.js`, replace the `else if (c.type === 'Resource') poolItems += n;` line inside the pool loop with:

```js
    else if (c.type === 'Resource') {
      poolItems += n;
      // 1.7 -- "up to two non-unique, non-hoard minor items". The qualifier is
      // about minor items; the six permanent-events playable "in lieu of a
      // minor item" enter on their own card text, so it does not apply to them.
      const a = c.attributes || {};
      if (a.subtype === 'Minor Item') {
        if (a.unique) emit('POOL-ITEMS', { id, name: name(c) }, 'POOL-ITEMS.unique');
        if ((a.keywords || []).includes('Hoard Item')) emit('POOL-ITEMS', { id, name: name(c) }, 'POOL-ITEMS.hoard');
      }
    }
```

- [ ] **Step 4: Add the strings**

```js
// fr
    'rules.POOL-ITEMS.unique': '{name} est unique — le pool de départ n’accepte que des objets mineurs non uniques.',
    'rules.POOL-ITEMS.hoard': '{name} est un objet de trésor — le pool de départ n’accepte pas les objets de trésor.',
// en
    'rules.POOL-ITEMS.unique': '{name} is unique — the starting pool only takes non-unique minor items.',
    'rules.POOL-ITEMS.hoard': '{name} is a hoard item — the starting pool takes no hoard items.',
// es
    'rules.POOL-ITEMS.unique': '{name} es única — la reserva inicial solo admite objetos menores no únicos.',
    'rules.POOL-ITEMS.hoard': '{name} es un objeto de tesoro — la reserva inicial no admite objetos de tesoro.',
```

Update `'rules.POOL-ITEMS.doc'` in all three blocks to mention the qualifier, e.g. EN: `'The starting pool takes up to two non-unique, non-hoard minor items.'`

- [ ] **Step 5: Run the suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/validate.js web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: pool minor items must be non-unique and non-hoard (CoE 1.7)"
```

---

### Task 11: Show the CoE citation in the panel and the doc page

**Files:**
- Modify: `web/src/components/DeckPanel.jsx` (imports; the `rule-meta` span ≈ line 313)
- Modify: `web/src/components/RulesDoc.jsx` (rule rows)
- Modify: `web/src/lib/i18n.js` (1 key × 3 languages)
- Test: `test/docText.test.js`

**Interfaces:**
- Consumes: `COE`, `RULE_BY_ID`, `ruleRefs` from `catalog.js`.
- Produces: `refText(t, rule) -> string` in `docText.js`, so the citation string is composed in one tested place rather than twice in JSX.

- [ ] **Step 1: Write the failing test**

In `test/docText.test.js`:

```js
import { refText } from '../web/src/lib/rules/docText.js';
import { RULES } from '../web/src/lib/rules/catalog.js';

describe('refText', () => {
  const t = (k, p = {}) => k.replace(/\.(\w+)$/, '') + ':' + JSON.stringify(p);

  it('renders one citation per cited clause', () => {
    expect(refText(t, { ref: '1.3.2' })).toBe('CoE §1.3.2');
    expect(refText(t, { refs: ['1.4', '1.4.F1'] })).toBe('CoE §1.4, CoE §1.4.F1');
  });

  it('renders nothing for a house rule', () => {
    expect(refText(t, { house: true })).toBe('');
  });

  it('notes the printed clause number when the source has a typo', () => {
    const r = { refs: ['1.3.F6'], printedAs: { '1.3.F6': '1.5.F6' } };
    expect(refText(t, r)).toContain('1.5.F6');
  });

  it('every non-house rule produces a non-empty citation', () => {
    for (const r of RULES) {
      if (r.house) continue;
      expect(refText(t, r).length).toBeGreaterThan(0);
    }
  });
});
```

Note: the fake `t` above returns the key; use the real `makeT('en')` instead if the existing file already imports it — match whatever `test/docText.test.js` does for its other cases.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/docText.test.js -t "refText"`

Expected: FAIL — `refText` is not exported.

- [ ] **Step 3: Implement `refText`**

Append to `web/src/lib/rules/docText.js`:

```js
import { ruleRefs } from './catalog.js';

// "CoE §1.3.2" per cited clause. House advisories cite nothing -- they are ours,
// not the source's. When the printed page numbers a clause wrongly (the
// Fallen-wizard ban list is printed 1.5.F6 for 1.3.F6) both are shown, so a
// player searching the page still finds it.
export function refText(t, rule) {
  const refs = ruleRefs(rule);
  if (refs.length === 0) return '';
  return refs
    .map((ref) => {
      const printed = rule.printedAs && rule.printedAs[ref];
      const base = t('rules.coeRef', { ref });
      return printed ? `${base} (${t('rules.coeRefPrinted', { ref: printed })})` : base;
    })
    .join(', ');
}
```

- [ ] **Step 4: Add the strings**

```js
// fr
    'rules.coeRef': 'CoE §{ref}',
    'rules.coeRefPrinted': 'numérotée {ref} sur la page',
// en
    'rules.coeRef': 'CoE §{ref}',
    'rules.coeRefPrinted': 'printed as {ref} on the page',
// es
    'rules.coeRef': 'CoE §{ref}',
    'rules.coeRefPrinted': 'numerada {ref} en la página',
```

- [ ] **Step 5: Render it in the panel**

In `web/src/components/DeckPanel.jsx`, add to the imports:

```js
import { COE, RULE_BY_ID } from '../lib/rules/catalog.js';
import { refText } from '../lib/rules/docText.js';
```

and inside the `rule-meta` span, immediately after `<code>{w.ruleId}</code>`:

```jsx
                  {refText(t, RULE_BY_ID.get(w.ruleId) || {}) && (
                    <a className="linklike" href={COE} target="_blank" rel="noreferrer">
                      {refText(t, RULE_BY_ID.get(w.ruleId) || {})}
                    </a>
                  )}
```

- [ ] **Step 6: Render it in the doc page**

In `web/src/components/RulesDoc.jsx`, find the loop that renders one row per entry of `RULES` and add a cell (or a trailing `<span>` inside the existing description cell) showing `refText(t, rule)` linked to `COE`, matching the existing markup style of that component. Import `refText` and `COE` the same way as above.

- [ ] **Step 7: Verify in the browser**

Start the preview (`.claude/launch.json` entry, `npm run dev` on port 5173), open a deckbuilding deck with a rule violation, and confirm each warning row shows `CoE §x.y` linking to the section anchor, and that `AVATAR-PRESENT` / `DECKSIZE-LOCATION` show **no** citation.

- [ ] **Step 8: Run the suite and commit**

```bash
npm test
git add web/src/lib/rules/docText.js web/src/components/ web/src/lib/i18n.js test/docText.test.js
git commit -m "feat: every rule warning cites its CoE section 1 clause"
```

---

# LOT 1b — copy caps become hard limits

Scope reminder: the deck-modes design's *"no hard blocking, ever"* is reversed **for per-card copy caps only**, by owner decision. Deck sizes, creature minimum, pool composition, bans and alignments stay advisory — blocking those would make a deck unbuildable while it is still being assembled. Freeform mode keeps no rules at all.

### Task 12: `copies.js` — the single source of truth for caps

**Files:**
- Create: `web/src/lib/rules/copies.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `SIDES`, `GENERAL` (Task 5, Task 9), `isRuleEnabled` (Task 4).
- Produces:
  - `copyCaps(card, { side, ruleOverrides }) -> Array<{ limit, scope, ruleId }>` where `scope` is `'total'` or `{ zone: 'sideboard' }`.
  - `remainingCopies(card, zone, { quantities, zones }, ctx) -> { remaining, ruleId }`. `remaining` is `Infinity` when nothing caps the card; `ruleId` names the binding cap so the UI can explain a refusal.

- [ ] **Step 1: Write the failing tests**

Add the import at the top of `test/rules.test.js`:

```js
import { copyCaps, remainingCopies } from '../web/src/lib/rules/copies.js';
```

```js
describe('copyCaps / remainingCopies', () => {
  const ctx = (side) => ({ side, ruleOverrides: {} });
  const state = (quantities = {}, sideboard = {}, pool = {}) => ({ quantities, zones: { sideboard, pool } });

  it('a non-unique card is capped at three, cumulative across zones (1.3.1, 1.6)', () => {
    const c = index.get('TW-104'); // Tookish Blood, non-unique hazard
    const caps = copyCaps(c, ctx('wizard'));
    expect(caps).toEqual([{ limit: 3, scope: 'total', ruleId: 'COPIES-LIMIT' }]);
    // 2 in the deck + 1 in the sideboard leaves nothing anywhere.
    const s = state({ 'TW-104': 2 }, { 'TW-104': 1 });
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'sideboard', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'pool', s, ctx('wizard')).remaining).toBe(0);
  });

  it('a unique card is capped at one across every zone (1.3.1)', () => {
    const c = cards.find((x) => (x.attributes || {}).unique && x.type === 'Resource' && x.alignment === 'Hero');
    expect(copyCaps(c, ctx('wizard'))[0]).toMatchObject({ limit: 1, scope: 'total', ruleId: 'UNIQUE-LIMIT' });
    // Held in the pool -> the deck cannot take one.
    const s = state({}, {}, { [c.id]: 1 });
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).ruleId).toBe('UNIQUE-LIMIT');
  });

  it('a non-haven site is capped at one; a haven of the side is uncapped (1.4)', () => {
    const site = index.get('TW-374'); // Barad-dur, Site/Hero, {D}
    expect(copyCaps(site, ctx('wizard'))[0]).toMatchObject({ limit: 1, ruleId: 'SITE-COPIES' });
    const haven = index.get('TW-421'); // Rivendell, Site/Hero, {H}
    expect(copyCaps(haven, ctx('wizard'))).toEqual([]);
    expect(remainingCopies(haven, 'deck', state({ 'TW-421': 9 }), ctx('wizard')).remaining).toBe(Infinity);
    // The same haven is not unlimited for a side whose location deck cannot
    // hold Hero sites.
    expect(copyCaps(haven, ctx('ringwraith'))[0]).toMatchObject({ limit: 1, ruleId: 'SITE-COPIES' });
  });

  it('an avatar carries two caps: three in total, one in the sideboard (1.5, 1.6, 1.6.2)', () => {
    const g = index.get('TW-156'); // Gandalf
    const caps = copyCaps(g, ctx('wizard'));
    expect(caps).toEqual([
      { limit: 3, scope: 'total', ruleId: 'AVATAR-COPIES' },
      { limit: 1, scope: { zone: 'sideboard' }, ruleId: 'AVATAR-SIDEBOARD' },
    ]);
    // 3 in the play deck spends the whole allowance.
    const full = state({ 'TW-156': 3 });
    expect(remainingCopies(g, 'deck', full, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(g, 'sideboard', full, ctx('wizard')).remaining).toBe(0);
    // 2 in the play deck: one more may go to either zone, but the sideboard
    // sub-cap stops a second one there.
    const two = state({ 'TW-156': 2 });
    expect(remainingCopies(g, 'sideboard', two, ctx('wizard')).remaining).toBe(1);
    const split = state({ 'TW-156': 1 }, { 'TW-156': 1 });
    expect(remainingCopies(g, 'sideboard', split, ctx('wizard'))).toEqual({ remaining: 0, ruleId: 'AVATAR-SIDEBOARD' });
    expect(remainingCopies(g, 'deck', split, ctx('wizard')).remaining).toBe(1);
  });

  it('a zone cap does not constrain a different zone', () => {
    const g = index.get('TW-156');
    // One in the sideboard: the sideboard is full, the deck still has room.
    const s = state({}, { 'TW-156': 1 });
    expect(remainingCopies(g, 'sideboard', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(g, 'deck', s, ctx('wizard')).remaining).toBe(2);
  });

  it('disabling a rule removes its cap', () => {
    const c = index.get('TW-104');
    const off = { side: 'wizard', ruleOverrides: { 'COPIES-LIMIT': false } };
    expect(copyCaps(c, off)).toEqual([]);
    expect(remainingCopies(c, 'deck', state({ 'TW-104': 9 }), off).remaining).toBe(Infinity);
  });

  it('Fallen-wizard copy limits follow the side profile', () => {
    const heroRes = cards.find((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique);
    expect(copyCaps(heroRes, ctx('fallen-wizard'))[0].limit).toBe(2);
    const stage = cards.find((c) => c.alignment === 'Stage' && !(c.attributes || {}).unique);
    expect(copyCaps(stage, ctx('fallen-wizard'))[0].limit).toBe(3);
  });

  it('an unknown side or a missing card yields no cap rather than throwing', () => {
    expect(copyCaps(index.get('TW-104'), ctx('constructor'))).toEqual([]);
    expect(copyCaps(null, ctx('wizard'))).toEqual([]);
    expect(remainingCopies(null, 'deck', state(), ctx('wizard')).remaining).toBe(Infinity);
  });

  it('never throws over every card and side', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      for (const c of cards) {
        const caps = copyCaps(c, ctx(side));
        expect(Array.isArray(caps)).toBe(true);
        for (const cap of caps) {
          expect(cap.limit).toBeGreaterThan(0);
          expect(typeof cap.ruleId).toBe('string');
        }
        expect(remainingCopies(c, 'deck', state(), ctx(side)).remaining).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rules.test.js -t "copyCaps"`

Expected: FAIL — cannot resolve `../web/src/lib/rules/copies.js`.

- [ ] **Step 3: Implement**

Create `web/src/lib/rules/copies.js`:

```js
// Per-card copy caps -- the single source of truth, read by both the validator
// (which reports) and the + buttons (which refuse). Keeping one function means
// the counter and the warning can never drift apart; the agreement test in
// test/rules.test.js is what holds that guarantee.
//
// Caps are CUMULATIVE across zones. 1.6 says a sideboard must not exceed "the
// allowed maximum number of each specific card across the whole deck", and 1.7
// says the same for the pool while carving out only the character COUNT, never
// a copy cap. So scope 'total' is the default: a unique card in the sideboard
// cannot also be in the play deck.
//
// A { zone } scope is an ADDITIONAL restriction layered on top of a total cap,
// never a replacement for it. Only 1.6.2 needs one: one copy of each avatar in
// the sideboard, out of the three that avatar may have in the whole deck.
import { SIDES, GENERAL } from './sides.js';
import { isRuleEnabled } from './catalog.js';

export function copyCaps(card, { side, ruleOverrides = {} } = {}) {
  // Reject inherited keys ('constructor', 'toString', ...): SIDES is a plain
  // object literal, so SIDES['constructor'] would resolve to Object().
  const profile = Object.prototype.hasOwnProperty.call(SIDES, side) ? SIDES[side] : undefined;
  if (!profile || !card) return [];
  const a = card.attributes || {};
  const on = (id) => isRuleEnabled(id, ruleOverrides);
  const caps = [];

  // 1.3.1 exempts avatars from the unique rule ("each unique NON-avatar card"),
  // so they have their own pair of caps.
  if (a.avatar === true) {
    if (on('AVATAR-COPIES')) {
      caps.push({ limit: GENERAL.avatarMaxCopies, scope: 'total', ruleId: 'AVATAR-COPIES' });
    }
    if (on('AVATAR-SIDEBOARD')) {
      caps.push({ limit: GENERAL.avatarMaxInSideboard, scope: { zone: 'sideboard' }, ruleId: 'AVATAR-SIDEBOARD' });
    }
    return caps;
  }

  // 1.4 -- one copy of each non-haven site. A haven ({H}) is unlimited, but
  // only for a side whose location deck may hold that alignment: a Minion
  // Darkhaven is unlimited for a Ringwraith, not for a Wizard.
  if (card.type === 'Site') {
    const unlimited = a.siteType === '{H}'
      && profile.alignments.concat(profile.avatarAlignment).includes(card.alignment);
    if (!unlimited && on('SITE-COPIES')) {
      caps.push({ limit: GENERAL.siteMax, scope: 'total', ruleId: 'SITE-COPIES' });
    }
    return caps;
  }

  if (a.unique) {
    if (on('UNIQUE-LIMIT')) {
      caps.push({ limit: GENERAL.uniqueMax, scope: 'total', ruleId: 'UNIQUE-LIMIT' });
    }
    return caps;
  }

  if (on('COPIES-LIMIT')) {
    const limit = profile.copies.byAlignment[card.alignment] ?? profile.copies.default;
    caps.push({ limit, scope: 'total', ruleId: 'COPIES-LIMIT' });
  }
  return caps;
}

// How many more copies of `card` may be added to `zone`, and which rule stops
// it. `remaining` is Infinity when nothing caps the card at all.
export function remainingCopies(card, zone, { quantities = {}, zones = {} } = {}, ctx = {}) {
  if (!card) return { remaining: Infinity, ruleId: null };
  const caps = copyCaps(card, ctx);
  if (caps.length === 0) return { remaining: Infinity, ruleId: null };
  const countIn = (z) => ((z === 'deck' ? quantities : (zones[z] || {}))[card.id] || 0);
  const total = countIn('deck') + countIn('sideboard') + countIn('pool');
  let remaining = Infinity;
  let ruleId = null;
  for (const cap of caps) {
    let used;
    if (cap.scope === 'total') used = total;
    else if (cap.scope.zone === zone) used = countIn(zone);
    else continue; // a zone cap on another zone does not constrain this one
    const left = cap.limit - used;
    if (left < remaining) { remaining = left; ruleId = cap.ruleId; }
  }
  return { remaining: remaining === Infinity ? Infinity : Math.max(0, remaining), ruleId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/rules.test.js -t "copyCaps"`

Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `npm test`

Expected: PASS — nothing imports `copies.js` yet.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/copies.js test/rules.test.js
git commit -m "feat: copies.js as the single source of truth for copy caps"
```

---

### Task 13: The validator reports from `copyCaps`

Four separate copy checks currently read `profile.copies` and the site/avatar rules by hand. Route them all through `copyCaps` so the report and the `+` button cannot disagree.

**Files:**
- Modify: `web/src/lib/rules/validate.js` (per-card loop; avatar block)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `copyCaps` (Task 12).
- Produces: no signature change. `COPIES-LIMIT`, `UNIQUE-LIMIT`, `SITE-COPIES`, `AVATAR-COPIES` and `AVATAR-SIDEBOARD` are all emitted from one loop with the params bag `{ id, name, count, limit, max, excess, side }` — each message template names only the keys it uses.

- [ ] **Step 1: Write the agreement test**

This is the test that keeps the button honest as lots 2 and 3 change the numbers.

```js
  it('the cap and the warning agree: the count that blocks is the count that reports', () => {
    // Every 7th card keeps the runtime sane while still covering all types,
    // alignments and both cap scopes.
    const sample = cards.filter((_, i) => i % 7 === 0);
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      const ctx = { side, ruleOverrides: {} };
      for (const c of sample) {
        const totalCaps = copyCaps(c, ctx).filter((cap) => cap.scope === 'total');
        if (totalCaps.length === 0) continue;
        const limit = Math.min(...totalCaps.map((cap) => cap.limit));
        const at = validateDeck({
          side, length: 'standard', tournament: true,
          quantities: { [c.id]: limit }, cardsById: index,
        });
        const over = validateDeck({
          side, length: 'standard', tournament: true,
          quantities: { [c.id]: limit + 1 }, cardsById: index,
        });
        const capIds = new Set(['COPIES-LIMIT', 'UNIQUE-LIMIT', 'SITE-COPIES', 'AVATAR-COPIES']);
        const capWarns = (out) => out.filter((w) => capIds.has(w.ruleId));
        // At the limit: no copy warning, and the counter says zero left.
        expect(capWarns(at)).toEqual([]);
        expect(remainingCopies(c, 'deck', { quantities: { [c.id]: limit }, zones: {} }, ctx).remaining).toBe(0);
        // One over: exactly the rule that produced the cap reports.
        expect(capWarns(over).length).toBeGreaterThan(0);
      }
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/rules.test.js -t "the cap and the warning agree"`

Expected: FAIL — `AVATAR-COPIES` is emitted from the avatar block with a different `count` basis, and site/unique caps are computed twice with no guarantee of agreement.

- [ ] **Step 3: Replace the per-card copy checks**

In `web/src/lib/rules/validate.js`, add the import:

```js
import { copyCaps } from './copies.js';
```

Inside the per-card `for (const e of entries)` loop, **delete** the whole block from `if (c.type === 'Site') {` through the closing brace of its `else if (!a.avatar) { ... }` and replace it with:

```js
    // Copy caps all come from copies.js -- the same function the + buttons
    // consult -- so a card the counter refuses is exactly a card this reports.
    // `e.count` is already the deck + sideboard + pool total.
    for (const cap of copyCaps(c, { side, ruleOverrides })) {
      const used = cap.scope === 'total' ? e.count : ((cap.scope.zone === 'sideboard' ? sb : pool)[e.id] || 0);
      if (used <= cap.limit) continue;
      emit(cap.ruleId, {
        id: e.id, name: name(c), count: used,
        limit: cap.limit, max: cap.limit, excess: used - cap.limit, side,
      });
    }
```

- [ ] **Step 4: Drop the now-duplicated avatar emissions**

In the `// --- avatars ---` block added by Task 9, delete the whole `for (const e of avatarEntries) { ... AVATAR-COPIES ... AVATAR-SIDEBOARD ... }` loop — the unified loop above now emits both. Keep `AVATAR-PRESENT`, the `AVATAR-SIDE` loop, `AVATAR-COUNT` and `AVATAR-MULTIPLES` exactly as they are.

- [ ] **Step 5: Run the suite**

Run: `npm test`

Expected: PASS. The avatar tests from Task 9 must still pass unchanged — they assert warnings, not where they are emitted from.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/validate.js test/rules.test.js
git commit -m "refactor: validator reports copy caps from copies.js"
```

---

### Task 14: Pure mutator cores with the cap guard

Seven code paths can add a copy, so the guard cannot live in a button. It belongs in the state mutators — but `App.jsx` cannot be unit-tested (there is no DOM test setup in devDependencies). So extract the pure cores into `lib/deckMutations.js` and have `App.jsx` compose them, exactly the reason `dropTargets.js` was extracted from `DeckPanel`.

**Files:**
- Create: `web/src/lib/deckMutations.js`
- Modify: `web/src/App.jsx:79-129` (the four mutators, `moveCopy`)
- Test: `test/deckModel.test.js`

**Interfaces:**
- Consumes: `remainingCopies` (Task 12).
- Produces:
  - `bumpCount(map, id, delta) -> map` — floors at 0 and deletes the key, the existing semantics.
  - `applyDelta(map, id, delta, room) -> map` — returns `map` **unchanged** when `delta > 0 && room <= 0`.
  - `applyToggle(map, id, room) -> map` — removes when present; adds one copy only if `room > 0`.
  - `applySelectAll(map, ids, roomFor) -> map` — `roomFor(id, workingMap)` is consulted per id against the accumulating map.

- [ ] **Step 1: Write the failing tests**

In `test/deckModel.test.js`:

```js
import { bumpCount, applyDelta, applyToggle, applySelectAll } from '../web/src/lib/deckMutations.js';

describe('deck mutation cores', () => {
  it('bumpCount floors at zero and deletes the key', () => {
    expect(bumpCount({}, 'a', +1)).toEqual({ a: 1 });
    expect(bumpCount({ a: 2 }, 'a', -1)).toEqual({ a: 1 });
    expect(bumpCount({ a: 1 }, 'a', -1)).toEqual({});
    expect(bumpCount({ a: 1 }, 'a', -5)).toEqual({});
    // never mutates the input
    const src = { a: 1 };
    bumpCount(src, 'a', +1);
    expect(src).toEqual({ a: 1 });
  });

  it('applyDelta refuses an increment with no room, and always allows a decrement', () => {
    expect(applyDelta({ a: 3 }, 'a', +1, 0)).toEqual({ a: 3 });   // blocked
    expect(applyDelta({ a: 3 }, 'a', +1, 1)).toEqual({ a: 4 });   // room
    expect(applyDelta({ a: 3 }, 'a', +1, Infinity)).toEqual({ a: 4 });
    // A count already over its cap is never reduced: room is 0 but -1 works.
    expect(applyDelta({ a: 5 }, 'a', -1, 0)).toEqual({ a: 4 });
  });

  it('applyToggle honours the cap when adding but never when removing', () => {
    expect(applyToggle({}, 'a', 1)).toEqual({ a: 1 });
    expect(applyToggle({}, 'a', 0)).toEqual({});        // no room -> no copy
    expect(applyToggle({ a: 2 }, 'a', 0)).toEqual({});  // removal always works
  });

  it('applySelectAll skips cards with no room and consults the accumulating map', () => {
    const roomFor = (id, map) => (Object.keys(map).length >= 2 ? 0 : 1);
    expect(applySelectAll({}, ['a', 'b', 'c'], roomFor)).toEqual({ a: 1, b: 1 });
    // Already-present cards are left alone, not incremented.
    expect(applySelectAll({ a: 4 }, ['a'], () => 1)).toEqual({ a: 4 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/deckModel.test.js -t "deck mutation cores"`

Expected: FAIL — cannot resolve `deckMutations.js`.

- [ ] **Step 3: Implement**

Create `web/src/lib/deckMutations.js`:

```js
// Pure cores of App's quantity mutators, extracted so the copy-cap guard can be
// unit-tested without a DOM -- the same reason dropTargets.js was extracted
// from DeckPanel.
//
// `room` is how many more copies may be added (Infinity when uncapped). The cap
// gates INCREMENTS ONLY: a count already over its cap -- from a freeform deck
// switched to deckbuilding, an import, or a side change -- is never reduced,
// and a decrement always goes through.

// Floor at 0 and delete the key, so an absent card and a zero count are the
// same thing everywhere downstream.
export function bumpCount(map, id, delta) {
  const next = Math.max(0, (map[id] || 0) + delta);
  const out = { ...map };
  if (next <= 0) delete out[id];
  else out[id] = next;
  return out;
}

export function applyDelta(map, id, delta, room) {
  if (delta > 0 && !(room > 0)) return map; // blocked: hand back the same map
  return bumpCount(map, id, delta);
}

// First click selects one copy, second deselects. Adding one copy can still
// breach a cumulative cap -- a unique card held in the pool leaves no room in
// the deck -- so the guard applies here too.
export function applyToggle(map, id, room) {
  const out = { ...map };
  if (out[id]) { delete out[id]; return out; }
  if (!(room > 0)) return map;
  out[id] = 1;
  return out;
}

// Add one copy of every id that isn't selected yet. roomFor is consulted
// against the ACCUMULATING map so a cap reached partway through is respected.
export function applySelectAll(map, ids, roomFor) {
  const out = { ...map };
  for (const id of ids) {
    if (out[id]) continue;
    if (!(roomFor(id, out) > 0)) continue;
    out[id] = 1;
  }
  return out;
}
```

- [ ] **Step 4: Compose them in `App.jsx`**

Add the imports:

```js
import { remainingCopies } from './lib/rules/copies.js';
import { bumpCount, applyDelta, applyToggle, applySelectAll } from './lib/deckMutations.js';
```

Replace `changeQty`, `bump`, `changeZoneQty`, `moveCopy`, `toggleCard` and `selectAll` (lines 79-129) with:

```js
  // Copy caps are hard limits in deckbuilding mode and absent in freeform.
  // Computed inside each updater from `prev`, never from a captured render
  // value, so rapid clicks cannot race past a cap.
  const capCtx = deck.mode === 'deckbuilding' && deck.ruleset
    ? { side: deck.ruleset.side, ruleOverrides: deck.ruleset.ruleOverrides || {} }
    : null;

  // How many more copies of `id` may enter `zone`. Infinity in freeform, and
  // for an id we have no card for.
  function roomFor(id, zone, quantitiesMap, zonesMap) {
    if (!capCtx) return Infinity;
    const card = cardsById.get(id);
    if (!card) return Infinity;
    return remainingCopies(card, zone, { quantities: quantitiesMap, zones: zonesMap }, capCtx).remaining;
  }

  // delta is +1 / -1. `enforce: false` is used only by moveCopy, which cannot
  // raise a total.
  function changeQty(id, delta, { enforce = true } = {}) {
    setQuantities((prev) => applyDelta(prev, id, delta, enforce ? roomFor(id, 'deck', prev, zones) : Infinity));
  }

  // zone is 'deck' | 'sideboard' | 'pool'; 'deck' routes to the existing
  // quantities map rather than being a zone of its own.
  function changeZoneQty(zone, id, delta, { enforce = true } = {}) {
    if (zone === 'deck') return changeQty(id, delta, { enforce });
    setZones((prev) => {
      const room = enforce ? roomFor(id, zone, quantities, prev) : Infinity;
      if (delta > 0 && !(room > 0)) return prev;
      return { ...prev, [zone]: bumpCount(prev[zone], id, delta) };
    });
  }

  // Move one copy between zones (including 'deck'); no-op if fromZone === toZone.
  // The destination increment is NOT cap-checked: -1 then +1 leaves the total
  // untouched, and gating it would break dragging a card that sits at its cap --
  // exactly when a player most wants to move one. A zone sub-cap (1.6.2's one
  // avatar copy in the sideboard) can therefore be exceeded by a drag, and is
  // reported by AVATAR-SIDEBOARD instead: a drag that silently does nothing has
  // nowhere to explain itself, while the + button does.
  function moveCopy(id, fromZone, toZone) {
    if (fromZone === toZone) return;
    changeZoneQty(fromZone, id, -1);
    changeZoneQty(toZone, id, +1, { enforce: false });
  }

  function toggleCard(id) {
    setQuantities((prev) => applyToggle(prev, id, roomFor(id, 'deck', prev, zones)));
  }

  function selectAll(ids) {
    setQuantities((prev) => applySelectAll(prev, ids, (id, working) => roomFor(id, 'deck', working, zones)));
  }
```

`importDeckData` is left exactly as it is: silently dropping copies from a deck the user pasted would corrupt it. The excess is reported instead.

- [ ] **Step 5: Run the suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 6: Verify in the browser**

Start the preview. In a **deckbuilding** deck: add a non-unique card three times, confirm the fourth `+` does nothing; put a unique card in the pool, confirm `+` in the deck does nothing; drag a card sitting at its cap from the deck to the sideboard and confirm the move succeeds. Switch the deck to **freeform** and confirm `+` is unlimited again.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/deckMutations.js web/src/App.jsx test/deckModel.test.js
git commit -m "feat: copy caps hard-block increments in deckbuilding mode"
```

---

### Task 15: Disable the `+` button and say why

A `+` that silently does nothing is worse than no change. Disable it and give the reason, with the citation.

**Files:**
- Modify: `web/src/components/CardBrowser.jsx` (`ZoneCtrls`, and the component signature)
- Modify: `web/src/components/MiniCard.jsx` (accept `room`/`capRuleId`)
- Modify: `web/src/components/DeckPanel.jsx` (compute per-card room, pass it down)
- Modify: `web/src/components/CardPreviewModal.jsx` (mobile `+`)
- Modify: `web/src/App.jsx` (pass `capCtx` down)
- Modify: `web/src/lib/i18n.js`
- Modify: `web/src/styles.css` (disabled `.qty-btn`)

**Interfaces:**
- Consumes: `remainingCopies` (Task 12).
- Produces: a shared helper `capTitle(t, ruleId, remaining)` in `docText.js` returning the tooltip text, so the wording lives in one tested place.

- [ ] **Step 1: Write the failing test**

In `test/docText.test.js`:

```js
import { capTitle } from '../web/src/lib/rules/docText.js';

describe('capTitle', () => {
  const t = makeT('en');
  it('names the rule that blocks and cites it', () => {
    const s = capTitle(t, 'COPIES-LIMIT', 0);
    expect(s).toContain('CoE');
    expect(s.length).toBeGreaterThan(0);
  });
  it('is empty when there is room', () => {
    expect(capTitle(t, 'COPIES-LIMIT', 2)).toBe('');
    expect(capTitle(t, null, Infinity)).toBe('');
  });
});
```

Match the file's existing way of building `t` (it already imports `makeT` for the other cases).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/docText.test.js -t "capTitle"`

Expected: FAIL — `capTitle` is not exported.

- [ ] **Step 3: Implement `capTitle`**

Append to `web/src/lib/rules/docText.js`:

```js
import { RULE_BY_ID } from './catalog.js';

// Tooltip for a disabled + button: what stops it, and which clause says so.
// Empty when there is room, so the caller can spread it straight into JSX.
export function capTitle(t, ruleId, remaining) {
  if (remaining > 0 || !ruleId) return '';
  const rule = RULE_BY_ID.get(ruleId);
  const ref = rule ? refText(t, rule) : '';
  const reason = t(`cap.${ruleId}`);
  return ref ? `${reason} (${ref})` : reason;
}
```

- [ ] **Step 4: Add the strings**

```js
// fr
    'cap.COPIES-LIMIT': 'Nombre maximum d’exemplaires atteint, toutes zones confondues.',
    'cap.UNIQUE-LIMIT': 'Carte unique — un seul exemplaire dans tout le deck.',
    'cap.SITE-COPIES': 'Un seul exemplaire de ce lieu.',
    'cap.AVATAR-COPIES': 'Maximum de 3 exemplaires de cet avatar dans tout le deck.',
    'cap.AVATAR-SIDEBOARD': 'Un seul exemplaire de chaque avatar en réserve.',
// en
    'cap.COPIES-LIMIT': 'Maximum copies reached, counting every zone.',
    'cap.UNIQUE-LIMIT': 'Unique card — one copy in the whole deck.',
    'cap.SITE-COPIES': 'One copy of this site.',
    'cap.AVATAR-COPIES': 'Maximum 3 copies of this avatar in the whole deck.',
    'cap.AVATAR-SIDEBOARD': 'One copy of each avatar in the sideboard.',
// es
    'cap.COPIES-LIMIT': 'Máximo de copias alcanzado, contando todas las zonas.',
    'cap.UNIQUE-LIMIT': 'Carta única — una copia en el mazo completo.',
    'cap.SITE-COPIES': 'Una copia de este lugar.',
    'cap.AVATAR-COPIES': 'Máximo de 3 copias de este avatar en el mazo completo.',
    'cap.AVATAR-SIDEBOARD': 'Una copia de cada avatar en la reserva.',
```

- [ ] **Step 5: Wire `CardBrowser`**

Pass `capCtx` from `App.jsx` into `<CardBrowser ... capCtx={capCtx} />`, then in `CardBrowser.jsx`:

```js
import { remainingCopies } from '../lib/rules/copies.js';
import { capTitle } from '../lib/rules/docText.js';
```

Add `capCtx` to both the `ZoneCtrls` and `CardBrowser` parameter lists, and inside `ZoneCtrls` add:

```js
  const room = (zone) => (capCtx
    ? remainingCopies(card, zone, { quantities, zones }, capCtx)
    : { remaining: Infinity, ruleId: null });
```

Then for the primary control replace the `+` button with:

```jsx
        {(() => {
          const r = room(z.primary);
          return (
            <button
              className="qty-btn"
              disabled={r.remaining <= 0}
              title={capTitle(t, r.ruleId, r.remaining)}
              onClick={() => changeZoneQty(z.primary, card.id, +1)}
              aria-label={t('browser.addCopy')}
            >+</button>
          );
        })()}
```

and apply the identical pattern to each `z.extra` control, using `room(zn)`.

- [ ] **Step 6: Wire `MiniCard` and `DeckPanel`**

`MiniCard.jsx`: add `room = { remaining: Infinity, ruleId: null }` to the props and change the `+` button to:

```jsx
          <button
            className="qty-btn"
            disabled={room.remaining <= 0}
            title={capTitle(t, room.ruleId, room.remaining)}
            onClick={() => onChangeQty(card.id, +1)}
            aria-label={t('browser.addCopy')}
          >+</button>
```

with `import { capTitle } from '../lib/rules/docText.js';`.

`DeckPanel.jsx`: accept `capCtx`, and where each `<MiniCard ... />` is rendered pass:

```jsx
                      room={capCtx
                        ? remainingCopies(it.card, activeZone, { quantities, zones }, capCtx)
                        : { remaining: Infinity, ruleId: null }}
```

`activeZone` already exists in that scope. Import `remainingCopies` from `../lib/rules/copies.js`.

- [ ] **Step 7: Wire the mobile modal**

`CardPreviewModal.jsx`: accept `room = { remaining: Infinity, ruleId: null }`, and set `disabled={room.remaining <= 0}` plus `title={capTitle(t, room.ruleId, room.remaining)}` on the `+` button — mirroring the `disabled={qty <= 0}` already on `−`. In `App.jsx`, pass `room={previewCard && capCtx ? remainingCopies(previewCard, 'deck', { quantities, zones }, capCtx) : { remaining: Infinity, ruleId: null }}`.

- [ ] **Step 8: Style the disabled state**

In `web/src/styles.css`, next to the existing `.qty-btn` rule:

```css
.qty-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

- [ ] **Step 9: Verify in the browser**

Deckbuilding: a card at three copies shows a dimmed `+` whose tooltip reads "Maximum copies reached, counting every zone. (CoE §1.3.1)". A unique card held in the pool shows a dimmed `+` in the deck tab too. Freeform: no `+` is ever dimmed.

- [ ] **Step 10: Run the suite and commit**

```bash
npm test
git add web/src/lib/rules/docText.js web/src/components/ web/src/App.jsx web/src/lib/i18n.js web/src/styles.css test/docText.test.js
git commit -m "feat: disabled + button explains which copy cap blocks it"
```

---

# LOT 2 — `roleFor()` and play-deck composition

**Granularity note:** lots 2 and 3 group their test-writing into a single step per task rather than one step per assertion. The code is complete; only the step decomposition is coarser, because these tasks build on interfaces lots 1a/1b already proved.

### Task 16: `roles.js` — a card's role depends on the side

**Files:**
- Create: `web/src/lib/rules/roles.js`
- Modify: `web/src/lib/rules/sides.js` (per-side `agents`, `flexMaxAsResource`, `heroTreatment`; `GENERAL.playDeck`)
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `roleFor(card, sideId) -> { bucket, flexible, creatureWeight, effectiveAlignment }` where `bucket` is one of `'avatar' | 'character' | 'resource' | 'hazard' | 'site' | 'region'`, `flexible` is `null` or `{ alt, maxAsAlt }`, `creatureWeight` is `0 | 0.5 | 1`. Also `DRAGON_MANIFESTATIONS` (a `Set` of 18 ids).
- Produces on `GENERAL`: `playDeck: { resourcesMin: 30, resourcesMax: 50, maxCharacters: 10, minCreatures: 12 }` — 1.5 and 1.5.1 are side-independent, so these live once in `GENERAL`, not four times in `SIDES`.

- [ ] **Step 1: Write the failing tests**

```js
import { roleFor, DRAGON_MANIFESTATIONS } from '../web/src/lib/rules/roles.js';

describe('roleFor (1.3.W2/R2/B2, 1.3.F2, 1.3.F5, 1.5.1)', () => {
  it('an agent character is a hazard for Wizard and Balrog, a character for the others', () => {
    const agent = index.get('DM-3'); // Bill Ferny, Character/Minion, agent
    expect(roleFor(agent, 'wizard').bucket).toBe('hazard');
    expect(roleFor(agent, 'balrog').bucket).toBe('hazard');
    expect(roleFor(agent, 'ringwraith').bucket).toBe('character');
    expect(roleFor(agent, 'fallen-wizard').bucket).toBe('character');
  });

  it('an agent counting as a hazard is worth half a creature (1.5.1)', () => {
    const agent = index.get('DM-3');
    expect(roleFor(agent, 'wizard').creatureWeight).toBe(0.5);
    expect(roleFor(agent, 'ringwraith').creatureWeight).toBe(0);
  });

  it('the two Hazard-type agents stay hazards on every side', () => {
    // 1.3.R2 speaks of agent CHARACTER cards; DM-28 and DM-29 are hazards.
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(roleFor(index.get('DM-28'), side).bucket).toBe('hazard');
    }
  });

  it('creature weights follow 1.5.1 without double counting', () => {
    const w = (id, side = 'wizard') => roleFor(index.get(id), side).creatureWeight;
    expect(w('DM-107')).toBe(1);    // Durin's Bane, subtype "Creature"
    expect(w('TW-86')).toBe(0.5);   // Shelob, Creature/Permanent-event
    expect(w('DM-110')).toBe(0.5);  // Spider of the Morlat, Creature/Permanent-event + spawn
    expect(w('TW-12')).toBe(0.5);   // Balrog of Moria, Permanent-event + spawn
    expect(w('TD-1')).toBe(0.5);    // Agburanar Ahunt
    expect(w('TD-2')).toBe(0.5);    // Agburanar at Home
    expect(w('TD-143')).toBe(0);    // "Not at Home" -- not a manifestation
    expect(w('AS-71')).toBe(0);     // The Balrog, an Ally RESOURCE with Spawn
  });

  it('DRAGON_MANIFESTATIONS holds the 18 curated ids and excludes TD-143', () => {
    expect(DRAGON_MANIFESTATIONS.size).toBe(18);
    expect(DRAGON_MANIFESTATIONS.has('TD-143')).toBe(false);
    for (const id of DRAGON_MANIFESTATIONS) expect(index.get(id)).toBeDefined();
  });

  it('a hazard playable as a resource is flexible, capped at two for Fallen-wizard (1.3.3, 1.3.F2)', () => {
    const c = index.get('TW-104'); // Tookish Blood
    expect(roleFor(c, 'wizard').flexible).toEqual({ alt: 'resource', maxAsAlt: null });
    expect(roleFor(c, 'fallen-wizard').flexible).toEqual({ alt: 'resource', maxAsAlt: 2 });
  });

  it('a resource playable as a hazard is flexible with no Fallen-wizard cap', () => {
    // 1.3.F2 constrains only hazards playable as resources.
    expect(roleFor(index.get('LE-235'), 'fallen-wizard').flexible).toEqual({ alt: 'hazard', maxAsAlt: null });
  });

  it('Fallen-wizard non-Orc, non-Troll characters read as Hero (1.3.F5)', () => {
    const troll = index.get('AS-1');  // Burat, race Troll, Minion
    const other = cards.find((c) => c.type === 'Character' && c.alignment === 'Minion'
      && !(c.attributes || {}).avatar
      && !['Orc', 'Troll'].some((r) => matchesRace((c.attributes || {}).race, r)));
    expect(roleFor(troll, 'fallen-wizard').effectiveAlignment).toBe('Minion');
    expect(roleFor(other, 'fallen-wizard').effectiveAlignment).toBe('Hero');
    expect(roleFor(other, 'ringwraith').effectiveAlignment).toBe('Minion');
  });

  it('sites, regions and avatars get their own buckets', () => {
    expect(roleFor(index.get('TW-421'), 'wizard').bucket).toBe('site');
    expect(roleFor(cards.find((c) => c.type === 'Region'), 'wizard').bucket).toBe('region');
    expect(roleFor(index.get('TW-156'), 'wizard').bucket).toBe('avatar');
  });

  it('never throws and always yields a bucket over every card and side', () => {
    const buckets = new Set(['avatar', 'character', 'resource', 'hazard', 'site', 'region']);
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      for (const c of cards) {
        const r = roleFor(c, side);
        expect(buckets.has(r.bucket)).toBe(true);
        expect([0, 0.5, 1]).toContain(r.creatureWeight);
        expect(typeof r.effectiveAlignment).toBe('string');
      }
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run test/rules.test.js -t "roleFor"` → FAIL, module not found.

- [ ] **Step 3: Extend `sides.js`**

Add to `GENERAL`:

```js
  // 1.5 / 1.5.1 -- play-deck composition. Not side-specific, so it lives here
  // once rather than four times in SIDES.
  playDeck: { resourcesMin: 30, resourcesMax: 50, maxCharacters: 10, minCreatures: 12 },
```

Delete the `playDeck: null,` line from all four side profiles and add to each, in place of it:

```js
    // wizard
    agents: { role: 'hazard' },   // 1.3.W2
    flexMaxAsResource: null,      // 1.3.3 -- free choice
    heroTreatment: false,
    // ringwraith
    agents: { role: 'character' }, // 1.3.R2 (for deck-building requirements)
    flexMaxAsResource: null,
    heroTreatment: false,
    // fallen-wizard
    agents: { role: 'character' }, // 1.3.F4
    flexMaxAsResource: 2,          // 1.3.F2 -- the third copy counts as a hazard
    heroTreatment: true,           // 1.3.F5
    // balrog
    agents: { role: 'hazard' },   // 1.3.B2
    flexMaxAsResource: null,
    heroTreatment: false,
```

- [ ] **Step 4: Create `web/src/lib/rules/roles.js`**

```js
// A card's ROLE depends on the side that plays it (1.3.W2, 1.3.R2, 1.3.B2,
// 1.3.F2, 1.3.F5): the same agent is a hazard for a Wizard and a character for
// a Ringwraith, and a hazard playable as a resource may be counted either way.
// Everything downstream -- the play-deck budgets, the creature count, the copy
// table -- reads this instead of card.type, the same way zonesFor is the single
// source of truth for zones.
import { SIDES } from './sides.js';
import { matchesRace } from './races.js';

// 1.5.1 -- "Ahunt" / "at Home" Dragon manifestations count as half a creature.
// A curated id list, NOT a name pattern: /at Home/ also matches TD-143 "Not at
// Home", a Hero short-event that is no manifestation at all. The set is TD-only
// and closed, so a list is stable.
export const DRAGON_MANIFESTATIONS = new Set([
  'TD-1', 'TD-2', 'TD-4', 'TD-5', 'TD-10', 'TD-11', 'TD-21', 'TD-22', 'TD-37',
  'TD-38', 'TD-43', 'TD-44', 'TD-61', 'TD-62', 'TD-64', 'TD-65', 'TD-70', 'TD-71',
]);

const BALROG_TROLL_ORC = ['Orc', 'Troll'];

// 1.5.1, evaluated in this order so nothing is counted twice.
function creatureWeight(card, bucket) {
  const a = card.attributes || {};
  const sub = String(a.subtype || '');
  if (sub === 'Creature') return 1;
  // "A creature that is also playable as an event" -- Creature/Short-event and
  // Creature/Permanent-event.
  if (sub.includes('Creature')) return 0.5;
  if (DRAGON_MANIFESTATIONS.has(card.id)) return 0.5;
  if (bucket !== 'hazard') return 0; // an Ally resource with Spawn is no creature
  if (a.agent === true) return 0.5;  // "an agent that counts as a hazard"
  // "A Spawn permanent-event". The data disagrees with itself -- `spawn` is on
  // 9 cards, keywords ["Spawn"] on 12 -- so take either signal but only for a
  // hazard permanent-event that is not already a creature (handled above).
  if (sub.includes('Permanent-event') && (a.spawn === true || (a.keywords || []).includes('Spawn'))) return 0.5;
  return 0;
}

export function roleFor(card, sideId) {
  const side = Object.prototype.hasOwnProperty.call(SIDES, sideId) ? SIDES[sideId] : undefined;
  const a = (card && card.attributes) || {};
  const none = { bucket: 'resource', flexible: null, creatureWeight: 0, effectiveAlignment: '' };
  if (!card || !side) return { ...none, effectiveAlignment: (card && card.alignment) || '' };

  let bucket;
  let flexible = null;

  if (card.type === 'Site') bucket = 'site';
  else if (card.type === 'Region') bucket = 'region';
  else if (a.avatar === true) bucket = 'avatar';
  else if (a.agent === true) {
    // 1.3.R2 speaks of agent CHARACTER cards, so the two Hazard-type agents
    // (DM-28, DM-29) stay hazards on every side.
    bucket = card.type === 'Character' ? side.agents.role : 'hazard';
  } else if (card.type === 'Character') bucket = 'character';
  else if (card.type === 'Hazard') {
    bucket = 'hazard';
    // 1.3.3 -- may be counted as a resource instead. 1.3.F2 caps a
    // Fallen-wizard at two copies counted as resources; the third is a hazard.
    if (a.playableAsResource === true) flexible = { alt: 'resource', maxAsAlt: side.flexMaxAsResource };
  } else {
    bucket = 'resource';
    // The other direction: 1.3.F2 constrains only hazards playable as
    // resources, so this carries no Fallen-wizard cap.
    if (a.playableAsHazard === true) flexible = { alt: 'hazard', maxAsAlt: null };
  }

  // 1.3.F5 -- a Fallen-wizard player's non-Orc, non-Troll characters are
  // treated as hero characters. No deck-construction rule turns on this by
  // itself (1.3.F1 caps non-unique characters at 2 whatever their alignment),
  // but lot 3's copy table keys on effectiveAlignment.
  let effectiveAlignment = card.alignment;
  if (side.heroTreatment && bucket === 'character'
      && !BALROG_TROLL_ORC.some((r) => matchesRace(a.race, r))) {
    effectiveAlignment = 'Hero';
  }

  return { bucket, flexible, creatureWeight: creatureWeight(card, bucket), effectiveAlignment };
}
```

- [ ] **Step 5: Run the suite**

Run: `npm test` → PASS. Add `matchesRace` to the test file's imports if the F5 test needs it.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/roles.js web/src/lib/rules/sides.js test/rules.test.js
git commit -m "feat: roleFor derives a card's per-side role, bucket and creature weight"
```

---

### Task 17: Play-deck budgets replace DECKSIZE-PLAY

**Files:**
- Modify: `web/src/lib/rules/catalog.js` (remove `DECKSIZE-PLAY`, add 3 rules)
- Modify: `web/src/lib/rules/validate.js` (deck-sizes block)
- Modify: `web/src/lib/i18n.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `roleFor` (Task 16), `GENERAL.playDeck`.
- Produces: `bucketCounts(quantities, cardsById, side) -> { resources, hazards, characters, avatars, flexAssignedToResource }` exported from `validate.js` for testability; rules `DECKSIZE-RESOURCES` (`{ count, min, max }`), `DECKSIZE-HAZARDS` (`{ hazards, resources }`), `DECKSIZE-CHARS` (`{ count, max }`).

- [ ] **Step 1: Write the failing tests**

```js
describe('play-deck budgets (1.5)', () => {
  // 30 distinct non-unique Hero resources, one copy each, is the smallest legal
  // resource block; matching hazards make the deck legal.
  const pick = (fn, n) => cards.filter(fn).slice(0, n);
  const heroRes = pick((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique, 30);
  const haz = pick((c) => c.type === 'Hazard' && !(c.attributes || {}).unique && (c.attributes || {}).subtype === 'Creature', 30);
  const q = (list) => Object.fromEntries(list.map((c) => [c.id, 1]));
  const V = (quantities) => validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
  const of = (out, id) => out.filter((w) => w.ruleId === id);

  it('DECKSIZE-RESOURCES: 29 resources fires, 30 does not', () => {
    expect(of(V({ ...q(heroRes.slice(0, 29)), ...q(haz.slice(0, 29)) }), 'DECKSIZE-RESOURCES')).toHaveLength(1);
    expect(of(V({ ...q(heroRes), ...q(haz) }), 'DECKSIZE-RESOURCES')).toEqual([]);
  });

  it('DECKSIZE-HAZARDS: hazards must exactly equal resources', () => {
    const out = V({ ...q(heroRes), ...q(haz.slice(0, 29)) });
    const hit = of(out, 'DECKSIZE-HAZARDS');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ hazards: 29, resources: 30 });
    expect(of(V({ ...q(heroRes), ...q(haz) }), 'DECKSIZE-HAZARDS')).toEqual([]);
  });

  it('DECKSIZE-CHARS: eleven non-avatar characters fire, ten do not', () => {
    const chars = pick((c) => c.type === 'Character' && c.alignment === 'Hero' && !(c.attributes || {}).avatar, 11);
    expect(of(V({ ...q(heroRes), ...q(haz), ...q(chars) }), 'DECKSIZE-CHARS')).toHaveLength(1);
    expect(of(V({ ...q(heroRes), ...q(haz), ...q(chars.slice(0, 10)) }), 'DECKSIZE-CHARS')).toEqual([]);
  });

  it('a flexible hazard is counted whichever way keeps the deck legal (1.3.3)', () => {
    // 29 plain resources + 1 hazard-playable-as-resource + 30 hazards: counting
    // the flexible card as a resource satisfies both 30 resources and equality.
    const quantities = { ...q(heroRes.slice(0, 29)), 'TW-104': 1, ...q(haz) };
    const out = V(quantities);
    expect(of(out, 'DECKSIZE-RESOURCES')).toEqual([]);
    expect(of(out, 'DECKSIZE-HAZARDS')).toEqual([]);
  });

  it('a Wizard\'s agents count as hazards, not characters (1.3.W2)', () => {
    const { characters, hazards } = bucketCounts({ 'DM-3': 1 }, index, 'wizard');
    expect(characters).toBe(0);
    expect(hazards).toBe(1);
    const rw = bucketCounts({ 'DM-3': 1 }, index, 'ringwraith');
    expect(rw.characters).toBe(1);
    expect(rw.hazards).toBe(0);
  });

  it('DECKSIZE-PLAY is retired', () => {
    expect(RULES.find((r) => r.id === 'DECKSIZE-PLAY')).toBeUndefined();
  });
});
```

Import `bucketCounts` from `validate.js`.

- [ ] **Step 2: Run to confirm failure** — `npx vitest run test/rules.test.js -t "play-deck budgets"` → FAIL.

- [ ] **Step 3: Catalogue**

Delete the `DECKSIZE-PLAY` line; add:

```js
  { id: 'DECKSIZE-RESOURCES', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'DECKSIZE-HAZARDS', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'DECKSIZE-CHARS', severity: 'error', status: 'verified', ref: '1.5', source: COE },
```

- [ ] **Step 4: Implement the buckets and the flexible assignment**

In `web/src/lib/rules/validate.js`, add `import { roleFor } from './roles.js';` and export:

```js
// 1.5 -- the play deck's four budgets, over disjoint buckets derived from
// roleFor (so a Wizard's agents land in `hazards`, not `characters`).
//
// Flexible cards (1.3.3: playable as resource or hazard) are assigned the way
// that keeps the deck legal, rather than asking the user to declare each one.
// Only 6 cards carry the flags, so a linear scan over the possible splits is
// ample. 1.3.F2 caps how many copies of each may count as a resource.
export function bucketCounts(quantities, cardsById, side) {
  const counts = { resources: 0, hazards: 0, characters: 0, avatars: 0, flexAssignedToResource: 0 };
  const flex = []; // { count, maxAsResource, maxAsHazard }
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    const r = roleFor(c, side);
    if (r.bucket === 'site' || r.bucket === 'region') continue;
    if (r.bucket === 'avatar') { counts.avatars += n; continue; }
    if (r.bucket === 'character') { counts.characters += n; continue; }
    if (r.flexible) {
      const cap = r.flexible.maxAsAlt == null ? n : Math.min(n, r.flexible.maxAsAlt);
      // `alt` is the bucket the card may move TO; the rest stay in `bucket`.
      if (r.flexible.alt === 'resource') flex.push({ count: n, maxAsResource: cap, minAsResource: 0 });
      else flex.push({ count: n, maxAsResource: n, minAsResource: n - cap });
      continue;
    }
    if (r.bucket === 'resource') counts.resources += n;
    else counts.hazards += n;
  }
  const flexTotal = flex.reduce((s, f) => s + f.count, 0);
  const minR = flex.reduce((s, f) => s + f.minAsResource, 0);
  const maxR = flex.reduce((s, f) => s + f.maxAsResource, 0);
  const { resourcesMin, resourcesMax } = GENERAL.playDeck;
  let best = null;
  for (let r = minR; r <= maxR; r++) {
    const resources = counts.resources + r;
    const hazards = counts.hazards + (flexTotal - r);
    const violation = (resources < resourcesMin ? resourcesMin - resources : 0)
      + (resources > resourcesMax ? resources - resourcesMax : 0)
      + Math.abs(hazards - resources);
    if (best === null || violation < best.violation) best = { r, resources, hazards, violation };
    if (violation === 0) break;
  }
  if (best) {
    counts.resources = best.resources;
    counts.hazards = best.hazards;
    counts.flexAssignedToResource = best.r;
  }
  return counts;
}
```

Then replace the `// --- deck sizes ---` block's play-deck part:

```js
  // --- deck sizes ---
  let locationCount = 0;
  let playCount = 0;
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    if (backGroupForType(c.type) === 'locationdeck') locationCount += n; else playCount += n;
  }
  const b = bucketCounts(quantities, cardsById, side);
  const pd = GENERAL.playDeck;
  if (playCount > 0) {
    if (b.resources < pd.resourcesMin || b.resources > pd.resourcesMax) {
      emit('DECKSIZE-RESOURCES', { count: b.resources, min: pd.resourcesMin, max: pd.resourcesMax });
    }
    if (b.hazards !== b.resources) emit('DECKSIZE-HAZARDS', { hazards: b.hazards, resources: b.resources });
    if (b.characters > pd.maxCharacters) emit('DECKSIZE-CHARS', { count: b.characters, max: pd.maxCharacters });
  }
  if (locationCount === 0 && playCount > 0) emit('DECKSIZE-LOCATION', { count: locationCount, min: 1 });
```

- [ ] **Step 5: Strings**

```js
// fr
    'rules.DECKSIZE-RESOURCES': 'Le deck de jeu contient {count} ressources — il en faut entre {min} et {max}.',
    'rules.DECKSIZE-RESOURCES.doc': 'Un deck de jeu contient entre 30 et 50 ressources.',
    'rules.DECKSIZE-HAZARDS': '{hazards} dangers pour {resources} ressources — il en faut autant que de ressources.',
    'rules.DECKSIZE-HAZARDS.doc': 'Le nombre de dangers doit être exactement égal au nombre de ressources.',
    'rules.DECKSIZE-CHARS': 'Le deck de jeu contient {count} personnages non-avatar — {max} au maximum.',
    'rules.DECKSIZE-CHARS.doc': 'Un deck de jeu contient au maximum 10 personnages non-avatar.',
// en
    'rules.DECKSIZE-RESOURCES': 'The play deck holds {count} resources — it needs between {min} and {max}.',
    'rules.DECKSIZE-RESOURCES.doc': 'A play deck holds between 30 and 50 resources.',
    'rules.DECKSIZE-HAZARDS': '{hazards} hazards for {resources} resources — it needs as many hazards as resources.',
    'rules.DECKSIZE-HAZARDS.doc': 'The number of hazards must exactly equal the number of resources.',
    'rules.DECKSIZE-CHARS': 'The play deck holds {count} non-avatar characters — {max} at most.',
    'rules.DECKSIZE-CHARS.doc': 'A play deck holds at most 10 non-avatar characters.',
// es
    'rules.DECKSIZE-RESOURCES': 'El mazo de juego tiene {count} recursos — necesita entre {min} y {max}.',
    'rules.DECKSIZE-RESOURCES.doc': 'Un mazo de juego contiene entre 30 y 50 recursos.',
    'rules.DECKSIZE-HAZARDS': '{hazards} peligros para {resources} recursos — hacen falta tantos peligros como recursos.',
    'rules.DECKSIZE-HAZARDS.doc': 'El número de peligros debe ser exactamente igual al de recursos.',
    'rules.DECKSIZE-CHARS': 'El mazo de juego tiene {count} personajes que no son avatar — {max} como máximo.',
    'rules.DECKSIZE-CHARS.doc': 'Un mazo de juego contiene como máximo 10 personajes que no sean avatar.',
```

Delete `'rules.DECKSIZE-PLAY'` and `'rules.DECKSIZE-PLAY.doc'` from all three blocks.

- [ ] **Step 6: Run the suite and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: play-deck budgets replace DECKSIZE-PLAY (CoE 1.5)"
```

---

### Task 18: CREATURE-MIN — at least 12 creatures (1.5.1)

**Files:** modify `catalog.js`, `validate.js`, `i18n.js`; test `test/rules.test.js`.

**Interfaces:** consumes `roleFor().creatureWeight`; produces `CREATURE-MIN` with params `{ count, min }`, where `count` is the floored weight sum.

- [ ] **Step 1: Write the failing tests**

```js
  it('CREATURE-MIN: twelve full creatures pass, eleven fire (1.5.1)', () => {
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 12);
    const q = (n) => Object.fromEntries(cre.slice(0, n).map((c) => [c.id, 1]));
    const V = (quantities) => validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(V(q(12)).filter((w) => w.ruleId === 'CREATURE-MIN')).toEqual([]);
    const hit = V(q(11)).filter((w) => w.ruleId === 'CREATURE-MIN');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ count: 11, min: 12 });
  });

  it('CREATURE-MIN: halves are summed then rounded down (1.5.1)', () => {
    // 11 full creatures + one half = 11.5 -> 11, still short.
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 11);
    const quantities = { ...Object.fromEntries(cre.map((c) => [c.id, 1])), 'TW-86': 1 };
    const out = validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(out.find((w) => w.ruleId === 'CREATURE-MIN').params.count).toBe(11);
  });
```

- [ ] **Step 2: Confirm failure** — `npx vitest run test/rules.test.js -t "CREATURE-MIN"` → FAIL.

- [ ] **Step 3: Catalogue** — add:

```js
  { id: 'CREATURE-MIN', severity: 'error', status: 'verified', ref: '1.5.1', source: COE },
```

- [ ] **Step 4: Implement** — in `validate.js`, right after the `DECKSIZE-CHARS` emit:

```js
    // 1.5.1 -- "The hazard portion of a play deck must include at least 12
    // creatures", with the listed hazards worth half a creature each. The
    // rounding applies to the summed halves, not to each card.
    let creatureWeightSum = 0;
    for (const [id, n] of Object.entries(quantities)) {
      const c = cardsById.get(id); if (!c) continue;
      creatureWeightSum += roleFor(c, side).creatureWeight * n;
    }
    const creatures = Math.floor(creatureWeightSum);
    if (creatures < pd.minCreatures) emit('CREATURE-MIN', { count: creatures, min: pd.minCreatures });
```

- [ ] **Step 5: Strings**

```js
// fr
    'rules.CREATURE-MIN': 'La partie danger du deck compte {count} créatures — il en faut au moins {min}. Un agent comptant comme danger, une manifestation de dragon Ahunt/at Home, une créature aussi jouable en événement et un permanent-event Spawn comptent pour une demi-créature.',
    'rules.CREATURE-MIN.doc': 'La partie danger d’un deck de jeu compte au moins 12 créatures ; certaines cartes ne comptent que pour une demi-créature (total arrondi à l’inférieur).',
// en
    'rules.CREATURE-MIN': 'The hazard portion holds {count} creatures — at least {min} are needed. An agent counting as a hazard, an Ahunt/at Home Dragon manifestation, a creature also playable as an event, and a Spawn permanent-event each count as half a creature.',
    'rules.CREATURE-MIN.doc': 'The hazard portion of a play deck holds at least 12 creatures; some cards count as half a creature (the total is rounded down).',
// es
    'rules.CREATURE-MIN': 'La parte de peligros tiene {count} criaturas — hacen falta al menos {min}. Un agente que cuenta como peligro, una manifestación de dragón Ahunt/at Home, una criatura jugable también como evento y un permanent-event Spawn cuentan como media criatura.',
    'rules.CREATURE-MIN.doc': 'La parte de peligros de un mazo de juego tiene al menos 12 criaturas; algunas cartas cuentan como media criatura (el total se redondea hacia abajo).',
```

- [ ] **Step 6: Run and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: CREATURE-MIN with half-creature weights (CoE 1.5.1)"
```

---

### Task 19: The doc page reports the four budgets

**Files:** modify `web/src/lib/rules/docText.js` (`playDeckText`), `web/src/components/RulesDoc.jsx`, `web/src/lib/i18n.js`; test `test/docText.test.js`.

**Interfaces:** `playDeckText(t)` now takes no profile — 1.5 is side-independent and read from `GENERAL.playDeck`.

- [ ] **Step 1: Write the failing test**

```js
  it('playDeckText states all four budgets', () => {
    const s = playDeckText(makeT('en'));
    expect(s).toContain('30');
    expect(s).toContain('50');
    expect(s).toContain('10');
    expect(s).toContain('12');
  });
```

- [ ] **Step 2: Confirm failure** — the current `playDeckText(t, playDeck)` returns the unverified placeholder.

- [ ] **Step 3: Implement**

```js
import { GENERAL } from './sides.js';

// 1.5 / 1.5.1 -- four budgets, not a range. Side-independent, so no profile
// argument: every side reads the same numbers from GENERAL.
export function playDeckText(t) {
  const pd = GENERAL.playDeck;
  return [
    t('docs.playDeck.resources', { min: pd.resourcesMin, max: pd.resourcesMax }),
    t('docs.playDeck.hazards'),
    t('docs.playDeck.characters', { n: pd.maxCharacters }),
    t('docs.playDeck.avatars', { n: GENERAL.avatarMaxInPlayDeck, d: GENERAL.avatarMaxDistinct }),
    t('docs.playDeck.creatures', { n: pd.minCreatures }),
  ].join(' · ');
}
```

- [ ] **Step 4: Strings**

```js
// fr
    'docs.playDeck.resources': '{min}–{max} ressources',
    'docs.playDeck.hazards': 'autant de dangers que de ressources',
    'docs.playDeck.characters': '{n} personnages non-avatar max',
    'docs.playDeck.avatars': '{n} exemplaires d’avatar max, {d} avatars différents max',
    'docs.playDeck.creatures': 'au moins {n} créatures',
// en
    'docs.playDeck.resources': '{min}–{max} resources',
    'docs.playDeck.hazards': 'as many hazards as resources',
    'docs.playDeck.characters': '{n} non-avatar characters max',
    'docs.playDeck.avatars': '{n} avatar copies max, {d} different avatars max',
    'docs.playDeck.creatures': 'at least {n} creatures',
// es
    'docs.playDeck.resources': '{min}–{max} recursos',
    'docs.playDeck.hazards': 'tantos peligros como recursos',
    'docs.playDeck.characters': '{n} personajes no avatar máx.',
    'docs.playDeck.avatars': '{n} copias de avatar máx., {d} avatares distintos máx.',
    'docs.playDeck.creatures': 'al menos {n} criaturas',
```

Delete `'docs.playDeck.range'` from all three blocks.

- [ ] **Step 5: Update the caller**

In `RulesDoc.jsx`, change `playDeckText(t, profile.playDeck)` to `playDeckText(t)`.

- [ ] **Step 6: Run, eyeball the doc page, commit**

```bash
npm test
git add web/src/lib/rules/docText.js web/src/components/RulesDoc.jsx web/src/lib/i18n.js test/docText.test.js
git commit -m "feat: doc page states the four play-deck budgets"
```

---

# LOT 3 — declarative, once lot 2 has landed

### Task 20: Copy limits rekeyed on (bucket, alignment) — 1.3.F1

`copies.byAlignment` is keyed on alignment alone, so Fallen-wizard's `default: 2` **wrongly caps hazards at 2**: 1.3.F1 lists four categories and says nothing about hazards, which therefore keep 1.3.1's general 3.

**Files:**
- Modify: `web/src/lib/rules/sides.js` (`copies` becomes an ordered table)
- Modify: `web/src/lib/rules/copies.js` (`copyCaps` consults `roleFor`)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `roleFor` (Task 16).
- Produces: `SIDES[side].copies` is `Array<{ bucket?, alignment?, limit }>`, first match wins. `copyLimitFor(profile, role) -> number` exported from `copies.js`.

- [ ] **Step 1: Write the failing tests**

```js
  it('Fallen-wizard copy limits follow 1.3.F1 per category', () => {
    const ctx = { side: 'fallen-wizard', ruleOverrides: {} };
    const lim = (id) => copyCaps(index.get(id), ctx)[0].limit;
    const find = (fn) => cards.find(fn);
    // Non-unique Stage resource: 3
    expect(lim(find((c) => c.alignment === 'Stage' && c.type === 'Resource' && !(c.attributes || {}).unique).id)).toBe(3);
    // Non-unique character: 2
    expect(lim(find((c) => c.type === 'Character' && !(c.attributes || {}).unique && !(c.attributes || {}).avatar && !(c.attributes || {}).agent).id)).toBe(2);
    // Non-unique hero resource: 2
    expect(lim(find((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique).id)).toBe(2);
    // Non-unique minion resource: 2
    expect(lim(find((c) => c.type === 'Resource' && c.alignment === 'Minion' && !(c.attributes || {}).unique).id)).toBe(2);
    // Non-unique HAZARD: 3 -- 1.3.F1 says nothing about hazards, so 1.3.1's
    // general limit applies. The old `default: 2` capped these at 2.
    expect(lim(find((c) => c.type === 'Hazard' && !(c.attributes || {}).unique && !(c.attributes || {}).agent && !(c.attributes || {}).playableAsResource).id)).toBe(3);
  });

  it('a Fallen-wizard non-Orc, non-Troll character still caps at 2 via 1.3.F5 aliasing', () => {
    // 1.3.F5 reads such a character as Hero; the character rule matches first,
    // so the limit is 2 either way -- the alias must not raise it to 3.
    const c = cards.find((x) => x.type === 'Character' && x.alignment === 'Minion'
      && !(x.attributes || {}).avatar && !(x.attributes || {}).agent && !(x.attributes || {}).unique
      && !['Orc', 'Troll'].some((r) => matchesRace((x.attributes || {}).race, r)));
    expect(copyCaps(c, { side: 'fallen-wizard', ruleOverrides: {} })[0].limit).toBe(2);
  });

  it('the other three sides cap every non-unique card at 3', () => {
    for (const side of ['wizard', 'ringwraith', 'balrog']) {
      const c = cards.find((x) => x.type === 'Hazard' && !(x.attributes || {}).unique);
      expect(copyCaps(c, { side, ruleOverrides: {} })[0].limit).toBe(3);
    }
  });
```

- [ ] **Step 2: Confirm failure** — `npx vitest run test/rules.test.js -t "1.3.F1"` → FAIL (hazard caps at 2).

- [ ] **Step 3: Rewrite the `copies` field**

In `sides.js`, replace each side's `copies` with an ordered table. Wizard, Ringwraith and Balrog:

```js
    // 1.3.1 -- three copies of any non-unique card.
    copies: [{ limit: 3 }],
```

Fallen-wizard:

```js
    // 1.3.F1 -- four categories, checked in order, first match wins. Hazards
    // match none of them and fall through to 1.3.1's general 3.
    copies: [
      { bucket: 'resource', alignment: 'Stage', limit: 3 },
      { bucket: 'character', limit: 2 },
      { bucket: 'resource', alignment: 'Hero', limit: 2 },
      { bucket: 'resource', alignment: 'Minion', limit: 2 },
      { limit: 3 },
    ],
```

- [ ] **Step 4: Teach `copyCaps` to read the table**

In `web/src/lib/rules/copies.js`, add `import { roleFor } from './roles.js';` and:

```js
// 1.3.1 / 1.3.F1 -- the first entry whose bucket and alignment both match.
// An entry with neither is the catch-all.
export function copyLimitFor(profile, role) {
  for (const rule of profile.copies) {
    if (rule.bucket && rule.bucket !== role.bucket) continue;
    if (rule.alignment && rule.alignment !== role.effectiveAlignment) continue;
    return rule.limit;
  }
  return GENERAL.copiesDefault;
}
```

and replace the final `COPIES-LIMIT` block with:

```js
  if (on('COPIES-LIMIT')) {
    const limit = copyLimitFor(profile, roleFor(card, side));
    caps.push({ limit, scope: 'total', ruleId: 'COPIES-LIMIT' });
  }
```

- [ ] **Step 5: Run the suite**

Run: `npm test` — the Task 12 test `it('Fallen-wizard copy limits follow the side profile', ...)` still asserts 2 for a hero resource and 3 for Stage, both of which hold. The agreement test from Task 13 is what proves the button follows.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/rules/sides.js web/src/lib/rules/copies.js test/rules.test.js
git commit -m "fix: Fallen-wizard copy limits keyed on category, not alignment (CoE 1.3.F1)"
```

---

### Task 21: Location deck per side — SITE-SIDE and the site-copy exemptions

**Files:**
- Create: `web/src/lib/rules/sites.js`
- Modify: `web/src/lib/rules/sides.js` (`locationDeck` block)
- Modify: `web/src/lib/rules/copies.js` (`SITE-COPIES` uses `locationDeck.alignments` + the Fallen-wizard exemption)
- Modify: `web/src/lib/rules/catalog.js`, `validate.js`, `i18n.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `siteIndex(cards) -> { openBalrog: Set<string>, hasBalrogVersion(card): boolean, needsBalrogVersion(card): boolean }`, memoised on the cards array identity the way `bannedFor` already is. `SIDES[side].locationDeck = { alignments, unlimitedFwSites, requireBalrogVersion }`. Rule `SITE-SIDE` with params `{ id, name, alignment, side }`.

- [ ] **Step 1: Write the failing tests**

```js
describe('location deck (1.4, 1.4.1, 1.4.W1/R1/F1/B1)', () => {
  const V = (side, quantities) => validateDeck({ side, length: 'standard', tournament: true, quantities, cardsById: index });
  const of = (out, id) => out.filter((w) => w.ruleId === id);

  it('the five open Balrog sites derive exactly as 1.4.1 names them', () => {
    const { openBalrog } = siteIndex(cards);
    expect([...openBalrog].sort()).toEqual(['BA-104', 'BA-83', 'BA-89', 'BA-95', 'BA-96']);
  });

  it('SITE-SIDE: a Minion site is illegal in a Wizard location deck (1.4.W1)', () => {
    expect(of(V('wizard', { 'LE-352': 1 }), 'SITE-SIDE')).toHaveLength(1);
    expect(of(V('ringwraith', { 'LE-352': 1 }), 'SITE-SIDE')).toEqual([]);
  });

  it('SITE-SIDE: the five open Balrog sites are legal for every side (1.4.1)', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(of(V(side, { 'BA-83': 1 }), 'SITE-SIDE')).toEqual([]);
    }
  });

  it('SITE-SIDE: a Fallen-wizard location deck takes hero AND minion sites (1.4.F1)', () => {
    expect(of(V('fallen-wizard', { 'TW-374': 1, 'LE-352': 1 }), 'SITE-SIDE')).toEqual([]);
  });

  it('SITE-COPIES: Fallen-wizard sites may be repeated (1.4.F1)', () => {
    // WH-55 Deep Mines is {R}, not a haven, so the haven exemption misses it.
    expect(of(V('fallen-wizard', { 'WH-55': 3 }), 'SITE-COPIES')).toEqual([]);
    expect(copyCaps(index.get('WH-55'), { side: 'fallen-wizard', ruleOverrides: {} })).toEqual([]);
  });

  it('SITE-COPIES: a haven is unlimited only for a side that may hold its alignment', () => {
    expect(of(V('wizard', { 'TW-421': 4 }), 'SITE-COPIES')).toEqual([]);      // Rivendell, Hero
    expect(of(V('ringwraith', { 'LE-359': 4 }), 'SITE-COPIES')).toEqual([]);  // Carn Dum, Minion
  });
});
```

- [ ] **Step 2: Confirm failure** — `npx vitest run test/rules.test.js -t "location deck"` → FAIL, `siteIndex` missing.

- [ ] **Step 3: Create `web/src/lib/rules/sites.js`**

```js
// Site derivations for the location-deck rules. Built once per card array and
// memoised on its identity -- validateDeck runs on every deck edit, the same
// reason bannedFor caches.
const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’ʼ]/g, "'")
  .toLowerCase()
  .trim();

// 1.4.B1 -- a Balrog player needs the Balrog version of Moria, Carn Dum, Dol
// Guldur, Minas Morgul, any Under-deeps site and any Dark-hold.
const B1_NAMES = new Set(['moria', "carn dum", 'dol guldur', 'minas morgul']);

let _cache = { key: null, value: null };

export function siteIndex(cards) {
  if (_cache.key === cards) return _cache.value;
  const sites = cards.filter((c) => c.type === 'Site');
  const namesBy = (alignment) => new Set(sites.filter((c) => c.alignment === alignment).map((c) => fold(c.name && c.name.en)));
  const hero = namesBy('Hero');
  const minion = namesBy('Minion');
  const balrog = namesBy('Balrog');

  // 1.4.1 -- "one copy of each Balrog site for which there is no corresponding
  // hero or minion site". Derived rather than hardcoded; a test asserts it
  // yields exactly the five sites the rule names.
  const openBalrog = new Set(
    sites
      .filter((c) => c.alignment === 'Balrog')
      .filter((c) => { const k = fold(c.name && c.name.en); return !hero.has(k) && !minion.has(k); })
      .map((c) => c.id),
  );

  const needsBalrogVersion = (card) => {
    if (!card || card.type !== 'Site' || card.alignment === 'Balrog') return false;
    const a = card.attributes || {};
    return a.underDeeps === true || a.siteType === '{D}' || B1_NAMES.has(fold(card.name && card.name.en));
  };
  const hasBalrogVersion = (card) => balrog.has(fold(card && card.name && card.name.en));

  const value = { openBalrog, needsBalrogVersion, hasBalrogVersion };
  _cache = { key: cards, value };
  return value;
}
```

- [ ] **Step 4: Add the `locationDeck` block**

In `sides.js`, add to each profile:

```js
    // wizard -- 1.4.W1
    locationDeck: { alignments: ['Hero'], unlimitedFwSites: false, requireBalrogVersion: false },
    // ringwraith -- 1.4.R1
    locationDeck: { alignments: ['Minion'], unlimitedFwSites: false, requireBalrogVersion: false },
    // fallen-wizard -- 1.4.F1
    locationDeck: { alignments: ['Hero', 'Minion', 'Fallen-wizard'], unlimitedFwSites: true, requireBalrogVersion: false },
    // balrog -- 1.4.B1
    locationDeck: { alignments: ['Minion', 'Balrog'], unlimitedFwSites: false, requireBalrogVersion: true },
```

- [ ] **Step 5: Rework the site cap in `copies.js`**

Replace the `card.type === 'Site'` branch of `copyCaps` with:

```js
  if (card.type === 'Site') {
    const ld = profile.locationDeck;
    // 1.4.F1 -- a Fallen-wizard may include multiple copies of each
    // Fallen-wizard site. WH-55 Deep Mines is {R}, so the haven test misses it.
    if (ld.unlimitedFwSites && card.alignment === 'Fallen-wizard') return caps;
    // 1.4 -- any number of haven sites, but only for a side whose location deck
    // may hold that alignment: a Minion Darkhaven is unlimited for a Ringwraith,
    // not for a Wizard.
    if (a.siteType === '{H}' && ld.alignments.includes(card.alignment)) return caps;
    if (on('SITE-COPIES')) caps.push({ limit: GENERAL.siteMax, scope: 'total', ruleId: 'SITE-COPIES' });
    return caps;
  }
```

- [ ] **Step 6: Add SITE-SIDE**

Catalogue:

```js
  { id: 'SITE-SIDE', severity: 'error', status: 'verified', refs: ['1.4.W1', '1.4.R1', '1.4.F1', '1.4.B1', '1.4.1'], source: COE },
```

In `validate.js`, add `import { siteIndex } from './sites.js';`, take the index once near the top of `validateDeck`:

```js
  const siteInfo = siteIndex([...cardsById.values()]);
```

and inside the per-card loop:

```js
    // 1.4.W1/R1/F1/B1 -- a location deck holds only the side's own sites, plus
    // the five Balrog sites 1.4.1 opens to everyone.
    if (c.type === 'Site'
        && !profile.locationDeck.alignments.includes(c.alignment)
        && !siteInfo.openBalrog.has(e.id)) {
      emit('SITE-SIDE', { id: e.id, name: name(c), alignment: c.alignment, side });
    }
```

Note: `[...cardsById.values()]` allocates a new array each call, which would defeat `siteIndex`'s memo. Build it once with the same trick `bannedFor` uses — key the cache on `cardsById` itself:

```js
let _siteInfo = { key: null, value: null };
function siteInfoFor(cardsById) {
  if (_siteInfo.key !== cardsById) _siteInfo = { key: cardsById, value: siteIndex([...cardsById.values()]) };
  return _siteInfo.value;
}
```

and call `const siteInfo = siteInfoFor(cardsById);`.

- [ ] **Step 7: Strings**

```js
// fr
    'rules.SITE-SIDE': '{name} est un lieu {alignment} — un deck de lieux {side} ne peut pas le contenir.',
    'rules.SITE-SIDE.doc': 'Un deck de lieux ne contient que les lieux du camp du joueur, plus les cinq lieux Balrog sans équivalent héros ou serviteur.',
// en
    'rules.SITE-SIDE': '{name} is a {alignment} site — a {side} location deck cannot hold it.',
    'rules.SITE-SIDE.doc': 'A location deck holds only the player’s own sites, plus the five Balrog sites with no hero or minion counterpart.',
// es
    'rules.SITE-SIDE': '{name} es un lugar {alignment} — un mazo de lugares {side} no puede contenerlo.',
    'rules.SITE-SIDE.doc': 'Un mazo de lugares solo contiene los lugares del bando del jugador, más los cinco lugares Balrog sin equivalente héroe o sirviente.',
```

- [ ] **Step 8: Run and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: per-side location decks with the 1.4.1 open Balrog sites"
```

---

### Task 22: SITE-BALROG-VERSION — 1.4.B1

18 Minion sites require the Balrog version. 17 have one; **LE-409 Urlurtsu Nurn has none**, so for a Balrog player that site is simply unavailable — a different message, not the same "use the Balrog version" one.

**Files:** modify `catalog.js`, `validate.js`, `i18n.js`; test `test/rules.test.js`.

**Interfaces:** consumes `siteIndex` (Task 21). Rule `SITE-BALROG-VERSION`, codes `SITE-BALROG-VERSION.swap` (`{ id, name }`) and `SITE-BALROG-VERSION.none` (`{ id, name }`).

- [ ] **Step 1: Write the failing tests**

```js
  it('SITE-BALROG-VERSION: 18 Minion sites need the Balrog version, 17 have one', () => {
    const info = siteIndex(cards);
    const flagged = cards.filter((c) => c.type === 'Site' && c.alignment === 'Minion' && info.needsBalrogVersion(c));
    expect(flagged).toHaveLength(18);
    const orphans = flagged.filter((c) => !info.hasBalrogVersion(c));
    expect(orphans.map((c) => c.id)).toEqual(['LE-409']);
  });

  it('SITE-BALROG-VERSION.swap: the Minion Under-deeps needs its Balrog twin', () => {
    const out = validateDeck({ side: 'balrog', length: 'standard', tournament: true, quantities: { 'AS-152': 1 }, cardsById: index });
    expect(out.filter((w) => w.code === 'SITE-BALROG-VERSION.swap')).toHaveLength(1);
  });

  it('SITE-BALROG-VERSION.none: Urlurtsu Nurn has no Balrog version at all', () => {
    const out = validateDeck({ side: 'balrog', length: 'standard', tournament: true, quantities: { 'LE-409': 1 }, cardsById: index });
    expect(out.filter((w) => w.code === 'SITE-BALROG-VERSION.none')).toHaveLength(1);
  });

  it('SITE-BALROG-VERSION: the Balrog versions themselves pass, and other sides are unaffected', () => {
    const ok = validateDeck({ side: 'balrog', length: 'standard', tournament: true, quantities: { 'BA-91': 1 }, cardsById: index });
    expect(ok.filter((w) => w.ruleId === 'SITE-BALROG-VERSION')).toEqual([]);
    const rw = validateDeck({ side: 'ringwraith', length: 'standard', tournament: true, quantities: { 'AS-152': 1 }, cardsById: index });
    expect(rw.filter((w) => w.ruleId === 'SITE-BALROG-VERSION')).toEqual([]);
  });
```

- [ ] **Step 2: Confirm failure** — → FAIL, no such rule.

- [ ] **Step 3: Catalogue**

```js
  { id: 'SITE-BALROG-VERSION', severity: 'error', status: 'verified', ref: '1.4.B1', source: COE },
```

- [ ] **Step 4: Implement** — in the per-card loop, after the `SITE-SIDE` check:

```js
    // 1.4.B1 -- a Balrog player must use the Balrog version of Moria, Carn Dum,
    // Dol Guldur, Minas Morgul, every Under-deeps site and every Dark-hold.
    // Urlurtsu Nurn (LE-409) has no Balrog version, so it is unavailable rather
    // than swappable -- two different messages.
    if (profile.locationDeck.requireBalrogVersion && siteInfo.needsBalrogVersion(c)) {
      const code = siteInfo.hasBalrogVersion(c) ? 'SITE-BALROG-VERSION.swap' : 'SITE-BALROG-VERSION.none';
      emit('SITE-BALROG-VERSION', { id: e.id, name: name(c) }, code);
    }
```

- [ ] **Step 5: Strings**

```js
// fr
    'rules.SITE-BALROG-VERSION.swap': '{name} — un joueur Balrog doit utiliser la version Balrog de ce lieu.',
    'rules.SITE-BALROG-VERSION.none': '{name} n’existe pas en version Balrog — ce lieu est indisponible pour un joueur Balrog.',
    'rules.SITE-BALROG-VERSION.doc': 'Un joueur Balrog doit utiliser la version Balrog de Moria, Carn Dûm, Dol Guldur, Minas Morgul, de tous les Abîmes et de tous les Antres sombres.',
// en
    'rules.SITE-BALROG-VERSION.swap': '{name} — a Balrog player must use the Balrog version of this site.',
    'rules.SITE-BALROG-VERSION.none': '{name} has no Balrog version — the site is unavailable to a Balrog player.',
    'rules.SITE-BALROG-VERSION.doc': 'A Balrog player must use the Balrog version of Moria, Carn Dûm, Dol Guldur, Minas Morgul, every Under-deeps site and every Dark-hold.',
// es
    'rules.SITE-BALROG-VERSION.swap': '{name} — un jugador Balrog debe usar la versión Balrog de este lugar.',
    'rules.SITE-BALROG-VERSION.none': '{name} no tiene versión Balrog — el lugar no está disponible para un jugador Balrog.',
    'rules.SITE-BALROG-VERSION.doc': 'Un jugador Balrog debe usar la versión Balrog de Moria, Carn Dûm, Dol Guldur, Minas Morgul, todos los Abismos y todos los Antros oscuros.',
```

- [ ] **Step 6: Run and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: SITE-BALROG-VERSION, with a distinct message for Urlurtsu Nurn (CoE 1.4.B1)"
```

---

### Task 23: POOL-STAGE — the Fallen-wizard stage pool (1.7.F1)

**Files:** modify `catalog.js`, `sides.js`, `validate.js`, `i18n.js`; test `test/rules.test.js`.

**Interfaces:** `SIDES['fallen-wizard'].pool.stagePoints = { total: 3, maxCards: 3, minNonUnique: 1 }`; `null` on the other three sides. Rule `POOL-STAGE`, codes `POOL-STAGE.points` (`{ total, required }`), `POOL-STAGE.count` (`{ count, max }`), `POOL-STAGE.nonUnique` (`{ min }`).

Two data traps: `stagePoints` also appears on Fallen-wizard **sites** (WH-55 = 3, WH-57 = 1), which are not stage resources — filter on `alignment === 'Stage' && type === 'Resource'`; and WH-22 carries `stagePoints: "2(3)"`, so parse the leading integer.

- [ ] **Step 1: Write the failing tests**

```js
describe('POOL-STAGE (1.7.F1)', () => {
  const stages = () => cards.filter((c) => c.alignment === 'Stage' && c.type === 'Resource');
  const byPoints = (n, unique) => stages().find((c) => parseInt((c.attributes || {}).stagePoints, 10) === n
    && !!(c.attributes || {}).unique === unique);
  const V = (pool) => validateDeck({ side: 'fallen-wizard', length: 'standard', tournament: true, zones: { sideboard: {}, pool }, cardsById: index });
  const of = (out, code) => out.filter((w) => w.code === code);

  it('exactly three stage points with a non-unique card passes', () => {
    const three = byPoints(3, false);
    expect(of(V({ [three.id]: 1 }), 'POOL-STAGE.points')).toEqual([]);
    expect(of(V({ [three.id]: 1 }), 'POOL-STAGE.nonUnique')).toEqual([]);
  });

  it('POOL-STAGE.points: two points fires', () => {
    const two = byPoints(2, false);
    const hit = of(V({ [two.id]: 1 }), 'POOL-STAGE.points');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ total: 2, required: 3 });
  });

  it('POOL-STAGE.nonUnique: three points from a unique card alone fires', () => {
    const uniq3 = byPoints(3, true);
    expect(of(V({ [uniq3.id]: 1 }), 'POOL-STAGE.nonUnique')).toHaveLength(1);
  });

  it('POOL-STAGE.count: four stage cards fire', () => {
    const ones = stages().filter((c) => parseInt((c.attributes || {}).stagePoints, 10) === 1).slice(0, 4);
    expect(ones).toHaveLength(4);
    expect(of(V(Object.fromEntries(ones.map((c) => [c.id, 1]))), 'POOL-STAGE.count')).toHaveLength(1);
  });

  it('a Fallen-wizard SITE with stagePoints is not a stage resource', () => {
    // WH-55 Deep Mines carries stagePoints 3 but is a Site.
    const out = V({ 'WH-55': 1 });
    expect(of(out, 'POOL-STAGE.points')).toHaveLength(1); // still 0 stage points
  });

  it('the other sides have no stage-pool requirement', () => {
    for (const side of ['wizard', 'ringwraith', 'balrog']) {
      const out = validateDeck({ side, length: 'standard', tournament: true, zones: { sideboard: {}, pool: {} }, cardsById: index });
      expect(out.filter((w) => w.ruleId === 'POOL-STAGE')).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Confirm failure** — → FAIL.

- [ ] **Step 3: Data and catalogue**

`sides.js` — add to each `pool`: `stagePoints: null` for wizard/ringwraith/balrog, and for fallen-wizard:

```js
      // 1.7.F1 -- up to three Stage resource permanent-events totalling
      // exactly three stage points, at least one of them non-unique.
      stagePoints: { total: 3, maxCards: 3, minNonUnique: 1 },
```

Catalogue:

```js
  { id: 'POOL-STAGE', severity: 'error', status: 'verified', ref: '1.7.F1', source: COE },
```

- [ ] **Step 4: Implement** — in `validate.js`, after the pool loop's emits:

```js
  // 1.7.F1 -- the Fallen-wizard stage pool.
  const stageReq = profile.pool.stagePoints;
  if (stageReq) {
    let points = 0, count = 0, nonUnique = 0;
    for (const [id, n] of Object.entries(pool)) {
      const c = cardsById.get(id); if (!c) continue;
      // stagePoints also appears on Fallen-wizard SITES (WH-55 Deep Mines = 3,
      // WH-57 Rhosgobel = 1), which are not stage resources.
      if (c.alignment !== 'Stage' || c.type !== 'Resource') continue;
      const a = c.attributes || {};
      // WH-22 spells its value "2(3)" -- take the leading integer.
      points += (toInt(a.stagePoints) || 0) * n;
      count += n;
      if (!a.unique) nonUnique += n;
    }
    if (points !== stageReq.total) emit('POOL-STAGE', { total: points, required: stageReq.total }, 'POOL-STAGE.points');
    if (count > stageReq.maxCards) emit('POOL-STAGE', { count, max: stageReq.maxCards }, 'POOL-STAGE.count');
    if (count > 0 && nonUnique < stageReq.minNonUnique) emit('POOL-STAGE', { min: stageReq.minNonUnique }, 'POOL-STAGE.nonUnique');
  }
```

`toInt` uses `parseInt`, which stops at the `(` in `"2(3)"` — exactly the wanted behaviour.

Also make stage resources pool-eligible in `zones.js`: add to the `Resource` branch condition `|| card.alignment === 'Stage'`, i.e.

```js
  if (type === 'Resource' && (a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true || card.alignment === 'Stage')) {
```

(Watch the parameter name: inside `zonesFor` the argument is `card`, so use `card.alignment`.)

- [ ] **Step 5: Strings**

```js
// fr
    'rules.POOL-STAGE.points': 'Le pool contient {total} points de mise en scène — il en faut exactement {required}.',
    'rules.POOL-STAGE.count': '{count} ressources de mise en scène dans le pool — {max} au maximum.',
    'rules.POOL-STAGE.nonUnique': 'Le pool doit contenir au moins {min} ressource de mise en scène non unique.',
    'rules.POOL-STAGE.doc': 'Un Sorcier déchu place jusqu’à trois ressources de mise en scène dans son pool, totalisant exactement trois points, dont au moins une non unique.',
// en
    'rules.POOL-STAGE.points': 'The pool holds {total} stage points — exactly {required} are needed.',
    'rules.POOL-STAGE.count': '{count} stage resources in the pool — {max} at most.',
    'rules.POOL-STAGE.nonUnique': 'The pool needs at least {min} non-unique stage resource.',
    'rules.POOL-STAGE.doc': 'A Fallen-wizard puts up to three stage resources in the pool, totalling exactly three stage points, at least one of them non-unique.',
// es
    'rules.POOL-STAGE.points': 'La reserva inicial tiene {total} puntos de puesta en escena — hacen falta exactamente {required}.',
    'rules.POOL-STAGE.count': '{count} recursos de puesta en escena en la reserva inicial — {max} como máximo.',
    'rules.POOL-STAGE.nonUnique': 'La reserva inicial necesita al menos {min} recurso de puesta en escena no único.',
    'rules.POOL-STAGE.doc': 'Un Mago caído pone hasta tres recursos de puesta en escena en su reserva inicial, sumando exactamente tres puntos, con al menos uno no único.',
```

- [ ] **Step 6: Run and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: POOL-STAGE for the Fallen-wizard stage pool (CoE 1.7.F1)"
```

---

### Task 24: FACTION-RACE — 1.3.B4

A Balrog player's factions may only be Orc, Troll, Wolf, Animal or Dragon. Factions are `marshallingPointsType === 'faction'` (98 cards) with a `race`. This is where substring matching breaks: `LE-272 Misty Mountain Wargs` is `race: "Wolf"` but plural forms elsewhere would not match.

**Files:** modify `catalog.js`, `sides.js`, `validate.js`, `i18n.js`; test `test/rules.test.js`.

**Interfaces:** `SIDES.balrog.factionRaces = ['Orc', 'Troll', 'Wolf', 'Animal', 'Dragon']`, `null` elsewhere. Rule `FACTION-RACE`, params `{ id, name, race }`.

- [ ] **Step 1: Write the failing tests**

```js
  it('FACTION-RACE: a Man faction is illegal for a Balrog, an Orc faction is not (1.3.B4)', () => {
    const V = (id) => validateDeck({ side: 'balrog', length: 'standard', tournament: true, quantities: { [id]: 1 }, cardsById: index });
    expect(V('LE-260').filter((w) => w.ruleId === 'FACTION-RACE')).toHaveLength(1); // Balchoth, Man
    expect(V('LE-274').filter((w) => w.ruleId === 'FACTION-RACE')).toEqual([]);     // Orcs of Angmar, Orc
    expect(V('LE-262').filter((w) => w.ruleId === 'FACTION-RACE')).toEqual([]);     // Black Trolls, Troll
    expect(V('LE-272').filter((w) => w.ruleId === 'FACTION-RACE')).toEqual([]);     // Misty Mountain Wargs, Wolf
    expect(V('AS-112').filter((w) => w.ruleId === 'FACTION-RACE')).toEqual([]);     // Bairanax Roused, Dragon
  });

  it('FACTION-RACE: other sides are unaffected', () => {
    const out = validateDeck({ side: 'ringwraith', length: 'standard', tournament: true, quantities: { 'LE-260': 1 }, cardsById: index });
    expect(out.filter((w) => w.ruleId === 'FACTION-RACE')).toEqual([]);
  });

  it('FACTION-RACE: plural race spellings still match', () => {
    // Guard against a regression to substring matching.
    for (const c of cards.filter((x) => (x.attributes || {}).marshallingPointsType === 'faction')) {
      const race = (c.attributes || {}).race;
      const legal = ['Orc', 'Troll', 'Wolf', 'Animal', 'Dragon'].some((r) => matchesRace(race, r));
      const out = validateDeck({ side: 'balrog', length: 'standard', tournament: true, quantities: { [c.id]: 1 }, cardsById: index });
      const fired = out.some((w) => w.ruleId === 'FACTION-RACE');
      expect(fired).toBe(!legal);
    }
  });
```

- [ ] **Step 2: Confirm failure** — → FAIL.

- [ ] **Step 3: Data and catalogue**

`sides.js` — add `factionRaces: null` to wizard/ringwraith/fallen-wizard and to balrog:

```js
    // 1.3.B4 -- "Factions can only be Orc, Troll, Wolf, Animal, or Dragon".
    factionRaces: ['Orc', 'Troll', 'Wolf', 'Animal', 'Dragon'],
```

Catalogue:

```js
  { id: 'FACTION-RACE', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },
```

- [ ] **Step 4: Implement** — in the per-card loop, next to the other Balrog checks:

```js
    // 1.3.B4 -- faction races. "Faction" here is the game's card category
    // (marshallingPointsType 'faction'), never a player camp.
    if (profile.factionRaces && a.marshallingPointsType === 'faction'
        && !profile.factionRaces.some((r) => matchesRace(a.race, r))) {
      emit('FACTION-RACE', { id: e.id, name: name(c), race: String(a.race || '') });
    }
```

Add `import { matchesRace } from './races.js';` to `validate.js`.

- [ ] **Step 5: Strings**

```js
// fr
    'rules.FACTION-RACE': '{name} est une faction {race} — un deck Balrog n’accepte que les factions Orque, Troll, Loup, Animal ou Dragon.',
    'rules.FACTION-RACE.doc': 'Les factions d’un joueur Balrog ne peuvent être que Orque, Troll, Loup, Animal ou Dragon.',
// en
    'rules.FACTION-RACE': '{name} is a {race} faction — a Balrog deck only takes Orc, Troll, Wolf, Animal or Dragon factions.',
    'rules.FACTION-RACE.doc': 'A Balrog player’s factions can only be Orc, Troll, Wolf, Animal or Dragon.',
// es
    'rules.FACTION-RACE': '{name} es una facción {race} — un mazo Balrog solo admite facciones Orco, Troll, Lobo, Animal o Dragón.',
    'rules.FACTION-RACE.doc': 'Las facciones de un jugador Balrog solo pueden ser Orco, Troll, Lobo, Animal o Dragón.',
```

- [ ] **Step 6: Run and commit**

```bash
npm test
git add web/src/lib/rules/ web/src/lib/i18n.js test/rules.test.js
git commit -m "feat: FACTION-RACE restricts Balrog factions (CoE 1.3.B4)"
```

---

## Known gap, carried deliberately

**1.3.1, last sentence** — *"Manifestations of the same unique resource are treated as the same unique card"* — is **not implemented in any lot**. There is no grouping field, and a partial detection would produce silent false negatives, which is worse than an absent rule because the player would trust it. It is documented as a gap on the RulesDoc page.

A viable path exists, to be scoped separately: **79 cards** state their base identity in `text.en` in a regular form (`<i>Manifestation of “Bert”.</i>`, `<i>Maia. Manifestation of Gandalf.</i>`, `<i>Manifestation of minion Angmarim.</i>`, `<i>Manifestation of Balrog of Moria.</i>`). Extracting a `manifestationOf` attribute into the card data would turn the clause into a plain group-by. Four wrinkles seen in the sample: curly quotes around some names, a leading alignment word (`of minion Angmarim`), line-break artefacts inside names (`Wain- easterlings`, `Petty- dwarves`), and a base that is sometimes another card (`Balrog of Moria`) and sometimes an abstract entity (`Bairanax`). Coverage of the Ahunt/at Home cards themselves needs checking before committing to it.

## Self-review

**Spec coverage.** Every clause in the design doc maps to a task: 1.1/1.2 (already correct, Task 4 adds refs), 1.3.1 (Tasks 4, 12, 20), 1.3.2 (Task 7), 1.3.3 (Tasks 16, 17), 1.3.4 (Task 8), 1.3.W1-W3/R1-R3/F3/F4/B1/B3 (Task 5), 1.3.W2/R2/B2/F2/F5 (Task 16), 1.3.F1 (Task 20), 1.3.F6/1.3.B5 (Task 2), 1.3.B4 (Tasks 5, 24), 1.4 (Tasks 8, 21), 1.4.1 (Task 21), 1.4.W1/R1/F1/B1 (Tasks 21, 22), 1.4.B2 (documented only, no validation effect), 1.5 (Tasks 9, 17), 1.5.1 (Tasks 16, 18), 1.6/1.6.1 (Tasks 4, 9), 1.6.2 (Tasks 9, 12), 1.7 (Tasks 5, 6, 10), 1.7.F1 (Task 23). The hard-enforcement scope change is Tasks 12-15. The one gap is 1.3.1's manifestation sentence, above.

**Type consistency.** `copyCaps`/`remainingCopies` keep the same signatures from Task 12 through Task 21, which is what lets lots 2-3 add no UI work. `roleFor` returns the same four fields wherever it is consumed (Tasks 17, 18, 20). `GENERAL` grows monotonically (Tasks 5, 9, 16) — hence Task 9's instruction to loosen Task 5's `toEqual` assertion into per-key checks.

**Ordering constraint.** Task 4 must precede Task 12 (the catalogue breaks the `validate.js` ↔ `copies.js` cycle). Task 16 must precede Tasks 17, 18 and 20. Task 21 must precede Task 22 (`siteIndex`). Everything else within a lot is independent.
