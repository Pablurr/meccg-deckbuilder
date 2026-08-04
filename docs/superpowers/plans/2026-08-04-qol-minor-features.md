# Six améliorations de confort — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer six changements de confort indépendants — page d'aide réécrite, correction d'un terme FR, pilule « talon » vide en mode invitation, bouton Enregistrer dans le header du deck, lien « suggérer une amélioration », et export massif de listes texte depuis « Mes decks ».

**Architecture :** aucun changement de format de stockage, aucune nouvelle dépendance runtime. La logique nouvelle est poussée dans des modules purs testables (`deckSignature`/`deckPayload` dans `lib/deck.js`, `buildDeckListZip` dans `lib/export/deckListZip.js`, `tabPresentation` dans `ZoneTabs.jsx`) ; les composants ne font que câbler. La page d'aide est scindée : `FeaturesDoc.jsx` produit les rubriques « utiliser l'application », `RulesDoc.jsx` garde la modale et les tables de règles.

**Tech Stack :** Vite 5 + React 18 (JSX, pas de TypeScript), Vitest 2, JSZip 3, `localStorage`. Pas de jsdom, pas de `@testing-library` — **les composants ne sont pas montés dans les tests** ; on teste les fonctions pures qu'ils exportent, comme le fait déjà `test/i18n-rules-contract.test.js` avec `DeckPanel.jsx`.

## Global Constraints

Ces contraintes s'appliquent à **toutes** les tâches.

- **Prose en français, code en anglais.** Identifiants, commentaires, ids de règles et messages de commit en anglais.
- **Vocabulaire FR imposé** : pioche / talon / réserve / péril / séide / progression. Aucune chaîne française ne doit contenir, mot entier, insensible à la casse : `deck de jeu`, `magicien(s)`, `sbire(s)`, `mise en scène`, `danger(s)`, `pool(s)`, `sideboard(s)`, `play deck(s)`, `minion(s)`, `hazard(s)`, `stage(s)`. Après la tâche 4, ce garde-fou n'a **plus aucune exemption** — `test/i18n.test.js` échoue sinon.
- **« Faction » ne désigne jamais un camp.** Le mot est `camp` / `side` / `bando`.
- **Toute nouvelle clé i18n existe en `fr`, `en` et `es`.** Deux tests l'imposent : parité des ensembles de clés et parité des jetons `{placeholder}`.
- **Pas de nouvelle dépendance runtime.** Il y en a deux, `jszip` et `pdf-lib`, et elles suffisent.
- **Une source unique de vérité par domaine.** Réimplémenter ailleurs la logique de `zones.js`, `copies.js`, `roles.js`, `deckSections.js`, `proxy.js`, `deck.js` est une régression.
- **Commentaires : le pourquoi et les pièges, jamais le quoi.** C'est le niveau du code voisin, tiens-le.
- `npm test` doit finir à **0 échec**. Lis le compte de **fichiers**, pas seulement celui des tests : une erreur de syntaxe JSX fait échouer un fichier à la compilation esbuild, pas à l'assertion.
- Ne mets pas à jour `docs/ARCHITECTURE.md` tâche par tâche : la **tâche 9** s'en charge en un passage cohérent.

## Ordre et parallélisme

| tâche | dépend de | peut tourner en parallèle avec |
|---|---|---|
| 1 — `deckSignature` / `deckPayload` | — | 2, 3, 4 |
| 2 — `buildDeckListZip` | — | 1, 3, 4 |
| 3 — pilule « talon » vide | — | 1, 2, 4 |
| 4 — i18n (glossaire, terme FR, nouvelles clés) | — | 1, 2, 3 |
| 5 — bouton Enregistrer | 1 | 6, 7, 8 |
| 6 — lien de suggestion | 4 | 5, 7, 8 |
| 7 — page d'aide | 4 | 5, 6, 8 |
| 8 — export massif | 2, 4 | 5, 6, 7 |
| 9 — documentation | 1–8 | — |

---

### Task 1: `deckSignature` et `deckPayload`

Construit la notion de « deck modifié », qui n'existe pas aujourd'hui, et supprime la
duplication du payload de sauvegarde avant qu'elle n'apparaisse.

**Files:**
- Modify: `web/src/lib/deck.js` (ajout en fin de fichier, après `normalizeDeck`)
- Modify: `web/src/components/DeckManager.jsx:79-95` (`save()` consomme `deckPayload`)
- Test: `test/deck.test.js` (ajout à la fin)

**Interfaces:**
- Consumes: `emptyZones()` et `normalizeDeck()`, déjà dans `web/src/lib/deck.js`.
- Produces:
  - `deckSignature({ deck, quantities, zones }) -> string`
  - `deckPayload({ deck, cardIds, quantities, zones, name }) -> object`
  La tâche 5 appelle les deux.

- [ ] **Step 1: Write the failing tests**

Ajoute à la fin de `test/deck.test.js`, et complète l'import de la ligne 2 avec
`deckSignature, deckPayload` :

```js
describe('deckSignature', () => {
  const base = {
    deck: { name: 'A', mode: 'freeform', ruleset: null, notes: { starting: 'x' }, backAssignments: {} },
    quantities: { 'AS-7': 2 },
    zones: { pool: {}, sideboard: { 'AS-1': 1 }, sideboardFw: {} },
  };

  // The trap this function exists to avoid: JSON.stringify walks keys in
  // insertion order, so two identical decks built by different click orders
  // would hash differently and the Save button would light up on its own.
  it('ignores key insertion order', () => {
    const shuffled = {
      ...base,
      quantities: { 'AS-7': 2 },
      zones: { sideboardFw: {}, sideboard: { 'AS-1': 1 }, pool: {} },
      deck: { backAssignments: {}, notes: { starting: 'x' }, ruleset: null, mode: 'freeform', name: 'A' },
    };
    expect(deckSignature(shuffled)).toBe(deckSignature(base));
  });

  it('changes when any persisted field changes', () => {
    const sig = deckSignature(base);
    expect(deckSignature({ ...base, deck: { ...base.deck, name: 'B' } })).not.toBe(sig);
    expect(deckSignature({ ...base, quantities: { 'AS-7': 3 } })).not.toBe(sig);
    expect(deckSignature({ ...base, zones: { ...base.zones, pool: { 'BA-1': 1 } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, notes: { starting: 'y' } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, backAssignments: { playdeck: 'b.png' } } })).not.toBe(sig);
    expect(deckSignature({ ...base, deck: { ...base.deck, mode: 'deckbuilding', ruleset: { side: 'wizard', length: 'standard', tournament: false, ruleOverrides: {} } } })).not.toBe(sig);
  });

  // A deck saved a second ago must not read as modified because storage
  // handed back an id and a position.
  it('ignores id, order and updatedAt', () => {
    const sig = deckSignature(base);
    expect(deckSignature({ ...base, deck: { ...base.deck, id: 'd1', order: 3, updatedAt: 12345 } })).toBe(sig);
  });
});

describe('deckPayload', () => {
  it('carries every field a saved deck needs, and takes its name from the argument', () => {
    const p = deckPayload({
      deck: { id: 'd1', name: 'Old', mode: 'freeform', ruleset: null, notes: { starting: 's' }, backAssignments: { playdeck: 'b.png' }, order: 2 },
      cardIds: ['AS-7', 'AS-7'],
      quantities: { 'AS-7': 2 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      name: 'New',
    });
    expect(p).toEqual({
      name: 'New',
      cardIds: ['AS-7', 'AS-7'],
      quantities: { 'AS-7': 2 },
      backAssignments: { playdeck: 'b.png' },
      mode: 'freeform',
      ruleset: null,
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      notes: { starting: 's' },
      order: 2,
    });
  });

  it('falls back to the deck name when no name is given', () => {
    const p = deckPayload({
      deck: { name: 'Kept', backAssignments: {} },
      cardIds: [], quantities: {}, zones: {},
    });
    expect(p.name).toBe('Kept');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/deck.test.js`
Expected: FAIL — `deckSignature is not a function` / `deckPayload is not a function`.

- [ ] **Step 3: Implement both functions**

Ajoute à la fin de `web/src/lib/deck.js` :

```js
// Deterministic stringify: object keys are emitted sorted, at every depth.
// JSON.stringify follows INSERTION order, so two decks holding the same cards
// added in a different order would produce different text -- and the Save
// button, which compares this against the last saved value, would light up
// with nothing to save.
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
}

// Everything a save persists, and nothing else. `id`, `order` and `updatedAt`
// are deliberately absent: none is editable from the deck screen, and folding
// them in would make a deck read as modified the instant storage handed back
// the id it just assigned.
export function deckSignature({ deck = {}, quantities = {}, zones = {} } = {}) {
  return stable({
    name: deck.name || '',
    mode: deck.mode || 'freeform',
    ruleset: deck.ruleset || null,
    notes: deck.notes || {},
    backAssignments: deck.backAssignments || {},
    quantities,
    zones,
  });
}

// The one place that decides what a saved deck contains. Both save paths (the
// deck panel's button and the deck manager's form) go through it, so a field
// added here reaches storage from either -- which is exactly what the two
// hand-built payloads it replaced could not promise.
export function deckPayload({ deck = {}, cardIds = [], quantities = {}, zones = {}, name } = {}) {
  return {
    name: name ?? deck.name,
    cardIds,
    quantities,
    backAssignments: deck.backAssignments || {},
    mode: deck.mode,
    ruleset: deck.ruleset,
    zones,
    notes: deck.notes,
    order: deck.order,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/deck.test.js`
Expected: PASS.

- [ ] **Step 5: Route `DeckManager.save()` through `deckPayload`**

Dans `web/src/components/DeckManager.jsx`, ajoute l'import :

```js
import { deckPayload } from '../lib/deck.js';
```

et remplace le corps de `save()` (lignes 79-95) — seule la construction du payload change :

```js
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = deckPayload({ deck, cardIds, quantities, zones, name });
      const saved = deck.id ? await api.updateDeck(deck.id, payload) : await api.createDeck(payload);
      onSaved(saved);
      await refresh();
    } catch (e) {
      setError(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 0 échec, et le **nombre de fichiers de test inchangé** (33).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/deck.js web/src/components/DeckManager.jsx test/deck.test.js
git commit -m "feat: a deck can now say whether it differs from what was saved

deckSignature hashes exactly what a save persists, with object keys
sorted at every depth -- insertion order is what would otherwise make an
untouched deck read as modified. deckPayload gives both save paths one
definition of a stored deck.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `buildDeckListZip`

Le module pur qui empaquette N listes texte en une archive, avec la seule vraie
subtilité de la fonctionnalité : deux decks de même nom.

**Files:**
- Create: `web/src/lib/export/deckListZip.js`
- Test: `test/deckListZip.test.js`

**Interfaces:**
- Consumes: `jszip` (déjà une dépendance).
- Produces: `buildDeckListZip(entries) -> Promise<Uint8Array>` où `entries` est
  `[{ name: string, text: string }]`. La tâche 8 l'appelle.

- [ ] **Step 1: Write the failing test**

Crée `test/deckListZip.test.js` :

```js
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDeckListZip, safeFileName } from '../web/src/lib/export/deckListZip.js';

async function namesIn(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  return Object.keys(zip.files).sort();
}

describe('safeFileName', () => {
  it('keeps the sanitising the single-deck export already applies', () => {
    expect(safeFileName('Mon deck #1')).toBe('Mon_deck_1');
    expect(safeFileName('')).toBe('deck');
    expect(safeFileName('***')).toBe('_');
  });
});

describe('buildDeckListZip', () => {
  it('writes one .txt per entry', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Alpha', text: 'a' },
      { name: 'Beta', text: 'b' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Alpha.txt', 'Beta.txt']);
  });

  it('preserves each entry text', async () => {
    const bytes = await buildDeckListZip([{ name: 'Alpha', text: 'ligne 1\nligne 2' }]);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file('Alpha.txt').async('string')).toBe('ligne 1\nligne 2');
  });

  // JSZip silently OVERWRITES a duplicate path, so without this two decks
  // called "Draft" would ship as one file and the user would never be told
  // which one survived.
  it('suffixes colliding names instead of losing a deck', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Draft', text: '1' },
      { name: 'Draft', text: '2' },
      { name: 'Draft', text: '3' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Draft-2.txt', 'Draft-3.txt', 'Draft.txt']);
  });

  // Sanitising is what CREATES most collisions: "Deck #1" and "Deck (1)" are
  // one filename once punctuation is stripped.
  it('detects collisions after sanitising, not before', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Deck #1', text: '1' },
      { name: 'Deck (1)', text: '2' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Deck_1-2.txt', 'Deck_1.txt']);
  });

  it('produces a readable archive for an empty selection', async () => {
    const bytes = await buildDeckListZip([]);
    expect(await namesIn(bytes)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/deckListZip.test.js`
Expected: FAIL — le module n'existe pas.

- [ ] **Step 3: Implement the module**

Crée `web/src/lib/export/deckListZip.js` :

```js
import JSZip from 'jszip';

// Same sanitising as the single-deck text export (ExportDialog.runExport), so
// a deck exported alone and the same deck exported in a batch land on the same
// filename.
export function safeFileName(name) {
  return String(name || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'deck';
}

// One .txt per deck. The dedup pass is the whole point of this module:
// zip.file() on an existing path OVERWRITES it without a word, so two decks
// named "Draft" -- or "Deck #1" and "Deck (1)", which sanitise to one name --
// would ship as a single file and the user would have no way to know. Numbering
// starts at -2 because the first holder keeps the bare name.
export async function buildDeckListZip(entries = []) {
  const zip = new JSZip();
  const used = new Map(); // sanitised base -> how many entries have claimed it
  for (const { name, text } of entries) {
    const base = safeFileName(name);
    const seen = (used.get(base) || 0) + 1;
    used.set(base, seen);
    zip.file(`${base}${seen > 1 ? `-${seen}` : ''}.txt`, text ?? '');
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/deckListZip.test.js`
Expected: PASS (5 tests dans `buildDeckListZip`, 1 dans `safeFileName`).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 0 échec, 34 fichiers.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/export/deckListZip.js test/deckListZip.test.js
git commit -m "feat: pack several deck lists into one archive

The dedup pass is the reason this is a module and not three lines in a
component: JSZip overwrites a duplicate path silently, and sanitising is
what creates most duplicates in the first place.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: la pilule « talon » vide devient une invitation

`ZoneTabs` sait déjà rendre une pilule « invitation » (pointillés, `+`, aucun compteur) ;
seul `sideboardFw` y avait droit. Le rendu est extrait dans une fonction pure pour être
testable — le dépôt n'a ni jsdom ni `@testing-library`, donc c'est la seule façon de
couvrir le comportement, et c'est l'idiome déjà employé par
`test/i18n-rules-contract.test.js`.

**Files:**
- Modify: `web/src/components/ZoneTabs.jsx:20-71`
- Modify: `web/src/components/DeckPanel.jsx:314`
- Test: `test/zoneTabs.test.js` (nouveau)

**Interfaces:**
- Produces: `tabPresentation({ count, cap, optional }) -> { inviting: boolean, over: boolean, showCount: boolean }`
  et `OPTIONAL_TABS: Set<string>` exporté par `DeckPanel.jsx`.

- [ ] **Step 1: Write the failing test**

Crée `test/zoneTabs.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { tabPresentation } from '../web/src/components/ZoneTabs.jsx';
import { OPTIONAL_TABS } from '../web/src/components/DeckPanel.jsx';

describe('tabPresentation', () => {
  // "0 / 10" claims a budget the player never opted into. An optional zone
  // stays an invitation until a card lands in it.
  it('makes an empty optional zone an invitation with no count', () => {
    expect(tabPresentation({ count: 0, cap: 10, optional: true }))
      .toEqual({ inviting: true, over: false, showCount: false });
  });

  it('turns it into an ordinary tab, count included, on the first card', () => {
    expect(tabPresentation({ count: 1, cap: 10, optional: true }))
      .toEqual({ inviting: false, over: false, showCount: true });
  });

  it('never invites a zone that is not optional, even empty', () => {
    expect(tabPresentation({ count: 0, cap: null, optional: false }))
      .toEqual({ inviting: false, over: false, showCount: true });
  });

  it('flags a count past its cap', () => {
    expect(tabPresentation({ count: 11, cap: 10, optional: true }).over).toBe(true);
    expect(tabPresentation({ count: 11, cap: null, optional: false }).over).toBe(false);
  });

  // The Notes tab carries no count at all: count === null, which must not be
  // read as "empty".
  it('shows no count for a countless tab', () => {
    expect(tabPresentation({ count: null, cap: null, optional: false }))
      .toEqual({ inviting: false, over: false, showCount: false });
  });
});

describe('OPTIONAL_TABS', () => {
  it('covers both sideboards and nothing else', () => {
    expect([...OPTIONAL_TABS].sort()).toEqual(['sideboard', 'sideboardFw']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/zoneTabs.test.js`
Expected: FAIL — `tabPresentation` et `OPTIONAL_TABS` ne sont pas exportés.

- [ ] **Step 3: Extract the pure presentation rule in `ZoneTabs.jsx`**

Ajoute au-dessus du `export default function ZoneTabs` (après le bloc de commentaire
existant, ligne 19) :

```js
// How one pill reads, from its numbers alone. Pulled out of the render because
// it is the only behaviour in this file worth pinning, and the project has no
// DOM test environment: a component is covered by testing the pure function it
// renders from.
//
// `count === null` means "this tab carries no count" (Notes) and must not be
// read as an empty zone -- an empty optional zone shows the invitation, a
// countless one shows nothing at all.
export function tabPresentation({ count, cap, optional }) {
  const inviting = !!optional && count === 0;
  return {
    inviting,
    over: cap != null && count != null && count > cap,
    showCount: !inviting && count != null,
  };
}
```

Puis remplace, dans le corps du `.map`, les lignes 25-28 :

```js
        const cap = caps[id];
        const count = counts[id];
        const { inviting, over, showCount } = tabPresentation({ count, cap, optional: optional && optional.has(id) });
```

et la ligne 66 (`{!inviting && count != null && (`) devient :

```js
            {showCount && (
```

L'`aria-label` de la ligne 56-58 garde sa condition `!inviting && count != null`, qui est
maintenant exactement `showCount` — utilise `showCount` :

```js
            aria-label={titles && titles[id]
              ? `${labels[id]}${showCount ? ` ${cap != null ? `${count} / ${cap}` : count}` : ''} — ${titles[id]}`
              : undefined}
```

- [ ] **Step 4: Add the plain sideboard to the optional set in `DeckPanel.jsx`**

Remplace la ligne 314 :

```js
  const optionalTabs = new Set(['sideboardFw']);
```

par un export nommé, placé au niveau module (à côté des autres constantes de haut de
fichier, pas dans le composant) :

```js
// Both sideboards are zones a deck may simply never use, so both stay an
// invitation while empty rather than advertising "0 / 10" -- a budget nobody
// opted into. The play deck, the location deck and the pool are not here: the
// first two are what a deck IS, and the pool is dictated by the side.
export const OPTIONAL_TABS = new Set(['sideboard', 'sideboardFw']);
```

et, dans le composant, remplace l'usage par `OPTIONAL_TABS` :

```js
  const tabTitles = { sideboardFw: t('zones.sideboardFwFull') };
```

(la ligne `const optionalTabs = ...` disparaît ; le passage de prop devient
`optional={OPTIONAL_TABS}`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/zoneTabs.test.js`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 0 échec, 35 fichiers. `test/i18n-rules-contract.test.js` importe
`DeckPanel.jsx` : s'il casse, c'est une erreur de syntaxe dans l'étape 4, pas un
faux positif.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ZoneTabs.jsx web/src/components/DeckPanel.jsx test/zoneTabs.test.js
git commit -m "feat: an empty sideboard reads as an invitation, not a budget

The pill already existed for the Fallen-wizard sideboard; the plain one
had the same claim to it. Extracting the rule into tabPresentation is
what makes it testable at all -- there is no DOM test environment here.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: i18n — glossaire retiré, terme corrigé, clés de l'aide et de la suggestion

La tâche la plus longue en volume et la plus mécanique. Elle prépare les tâches 6 et 7.

**Files:**
- Modify: `web/src/lib/i18n.js` (bloc `fr` ~282-317, `en` ~644-679, `es` ~1014-1049)
- Modify: `test/i18n.test.js:168-214`
- Test: `test/i18n.test.js` (les tests existants suffisent : parité des clés, parité des
  placeholders, garde-fou de vocabulaire)

**Interfaces:**
- Produces: les clés `docs.part.featuresTitle`, `docs.part.rulesTitle`,
  `docs.feat.searchTitle`, `docs.feat.search`, `docs.feat.decksTitle`, `docs.feat.decks`,
  `docs.feat.importTitle`, `docs.feat.import`, `docs.feat.exportTitle`, `docs.feat.export`,
  `docs.feat.proxyTitle`, `docs.feat.proxy`, `docs.feat.langTitle`, `docs.feat.lang`,
  `suggest.label`, `suggest.issueTitle`, `suggest.bodyTemplate`, `decks.saved`,
  `decks.selectAll`, `decks.selectDeck`, `decks.exportSelection`, `decks.exportDone`.
  Les tâches 6, 7 et 8 les consomment.

- [ ] **Step 1: Delete the eight glossary keys, in all three languages**

Supprime dans le bloc `fr` les lignes 309-316 (`docs.glossaryTitle`, `docs.glossaryIntro`,
`docs.glossary.play`, `docs.glossary.sideboard`, `docs.glossary.pool`,
`docs.glossary.hazard`, `docs.glossary.minion`, `docs.glossary.stage`), puis les huit clés
homologues dans `en` (~671-678) et dans `es` (~1041-1048).

- [ ] **Step 2: Fix the FR term and the two rewritten strings**

Dans le bloc `fr` :

```js
    'docs.title': 'Aide',
```

```js
    'docs.intro': "Cette page explique d'abord comment se sert l'application, puis les deux modes de deck et les règles vérifiées — que tu peux activer ou désactiver deck par deck.",
```

```js
    'docs.zones': "Un deck se répartit en cinq zones, une par onglet : la pioche (personnages, ressources, périls), le deck de sites (sites et régions), la réserve de départ pour les camps qui en utilisent une, le talon, et le talon contre un adversaire Sorcier déchu. Le bouton + ajoute à la zone active ; pour déplacer une copie d'une zone à l'autre, fais-la glisser sur l'onglet visé. Un onglet en pointillés préfixé d'un + est une zone que ce deck n'utilise pas encore.",
```

```js
    'docs.gap.geann': "Geann a-Lisch compte comme Ruines & Antres. Sans effet sur la construction du deck, uniquement en cours de partie.",
```

Dans `en` : `'docs.title': 'Help',` et
`'docs.intro': 'This page covers how the application is used, then the two deck modes and the rules it checks — which you can enable or disable per deck.',`
et `'docs.zones': "A deck spreads over five zones, one per tab: the play deck (characters, resources, hazards), the location deck (sites and regions), the starting pool for the sides that use one, the sideboard, and the sideboard against a Fallen-wizard opponent. The + button adds to the active zone; to move a copy between zones, drag it onto the target tab. A dashed tab prefixed with + is a zone this deck does not use yet.",`

Dans `es` : `'docs.title': 'Ayuda',` et
`'docs.intro': 'Esta página explica primero cómo se usa la aplicación, y después los dos modos de mazo y las reglas que comprueba — que puedes activar o desactivar mazo por mazo.',`
et `'docs.zones': 'Un mazo se reparte en cinco zonas, una por pestaña: el mazo de juego (personajes, recursos, peligros), el mazo de localizaciones (sitios y regiones), la reserva inicial para los bandos que la usan, el sideboard, y el sideboard contra un rival Mago caído. El botón + añade a la zona activa; para mover una copia entre zonas, arrástrala sobre la pestaña de destino. Una pestaña con borde discontinuo y prefijo + es una zona que este mazo aún no usa.',`

> `docs.zonesTitle` ne change pas.

- [ ] **Step 3: Add the help-page keys, in all three languages**

Insère dans le bloc `fr`, juste après `docs.enforcement` (ligne ~291) :

```js

    'docs.part.featuresTitle': "Utiliser l'application",
    'docs.part.rulesTitle': 'Règles',
    'docs.feat.searchTitle': 'Chercher et filtrer',
    'docs.feat.search': "La barre du haut cherche par nom et par texte de carte. Les menus filtrent par set, type, alignement, rareté, artiste, race, sous-type et compétence, et se combinent entre eux. Le sélecteur de langue change à la fois la langue de l'interface et celle des noms de cartes.",
    'docs.feat.decksTitle': 'Enregistrer et gérer ses decks',
    'docs.feat.decks': "Le bouton Enregistrer du panneau de deck s'active dès qu'une modification n'a pas encore été écrite ; s'il n'existe pas encore de deck enregistré, il ouvre l'écran « Mes decks » pour le créer. Cet écran permet aussi de charger, renommer d'un clic sur le nom, dupliquer, réordonner par glisser-déposer et supprimer. Les decks vivent dans le stockage local de ce navigateur — pas de compte, pas de synchronisation : exporte-les pour les conserver ailleurs.",
    'docs.feat.importTitle': 'Importer une liste',
    'docs.feat.import': "Colle une liste de cartes et l'application la lit : elle reconnaît les intitulés de section en français, en anglais et en espagnol, les quantités en tête de ligne, et les notes. Tu choisis si l'import crée un nouveau deck ou remplace le deck ouvert, et les lignes non reconnues te sont montrées avant validation.",
    'docs.feat.exportTitle': 'Exporter',
    'docs.feat.export': "Trois formats : une archive ZIP prête pour MakePlayingCards, des planches PDF en US Letter, A4 ou A3, et une liste texte. La liste texte se recolle telle quelle dans l'import, ce qui en fait aussi une sauvegarde. Un dos personnalisé peut être fourni pour la pioche et pour le deck de sites. Depuis « Mes decks », plusieurs decks cochés s'exportent d'un coup en listes texte, réunies dans une seule archive.",
    'docs.feat.proxyTitle': 'Mode proxy',
    'docs.feat.proxy': "Le mode proxy recouvre la mention de copyright d'un tampon « Proxy », à l'écran comme à l'export. Il est actif par défaut et ton choix est retenu d'une visite à l'autre.",
    'docs.feat.langTitle': 'Langues',
    'docs.feat.lang': "L'interface et les noms de cartes existent en français, en anglais et en espagnol. Les images de cartes sont disponibles dans ces trois langues ; à l'export, une image absente dans la langue choisie retombe sur l'anglais.",
```

Le même bloc en `en` :

```js

    'docs.part.featuresTitle': 'Using the application',
    'docs.part.rulesTitle': 'Rules',
    'docs.feat.searchTitle': 'Searching and filtering',
    'docs.feat.search': 'The top bar searches by card name and by card text. The menus filter by set, type, alignment, rarity, artist, race, subtype and skill, and combine with each other. The language picker changes both the interface language and the card names.',
    'docs.feat.decksTitle': 'Saving and managing decks',
    'docs.feat.decks': 'The deck panel\'s Save button lights up as soon as a change has not been written yet; with no saved deck yet, it opens "My decks" to create one. That screen also loads, renames (click the name), duplicates, reorders by drag and drop, and deletes. Decks live in this browser\'s local storage — no account, no sync: export them to keep them anywhere else.',
    'docs.feat.importTitle': 'Importing a list',
    'docs.feat.import': 'Paste a card list and the application reads it: it recognises section headings in French, English and Spanish, leading quantities, and notes. You choose whether the import creates a new deck or replaces the open one, and unrecognised lines are shown to you before you confirm.',
    'docs.feat.exportTitle': 'Exporting',
    'docs.feat.export': 'Three formats: a ZIP ready for MakePlayingCards, PDF sheets in US Letter, A4 or A3, and a text list. The text list pastes straight back into the importer, which makes it a backup too. A custom back can be supplied for the play deck and for the location deck. From "My decks", several ticked decks export at once as text lists, gathered in a single archive.',
    'docs.feat.proxyTitle': 'Proxy mode',
    'docs.feat.proxy': 'Proxy mode covers the copyright line with a "Proxy" stamp, on screen and in exports alike. It is on by default and your choice is remembered between visits.',
    'docs.feat.langTitle': 'Languages',
    'docs.feat.lang': 'The interface and the card names exist in French, English and Spanish. Card images are available in those three languages; on export, an image missing in the chosen language falls back to English.',
```

Le même bloc en `es` :

```js

    'docs.part.featuresTitle': 'Usar la aplicación',
    'docs.part.rulesTitle': 'Reglas',
    'docs.feat.searchTitle': 'Buscar y filtrar',
    'docs.feat.search': 'La barra superior busca por nombre y por texto de carta. Los menús filtran por set, tipo, alineamiento, rareza, artista, raza, subtipo y habilidad, y se combinan entre sí. El selector de idioma cambia a la vez el idioma de la interfaz y el de los nombres de carta.',
    'docs.feat.decksTitle': 'Guardar y gestionar mazos',
    'docs.feat.decks': 'El botón Guardar del panel de mazo se activa en cuanto hay un cambio sin escribir; si aún no hay ningún mazo guardado, abre la pantalla «Mis mazos» para crearlo. Esa pantalla también carga, renombra (haz clic en el nombre), duplica, reordena arrastrando y borra. Los mazos viven en el almacenamiento local de este navegador — sin cuenta y sin sincronización: expórtalos para conservarlos en otro sitio.',
    'docs.feat.importTitle': 'Importar una lista',
    'docs.feat.import': 'Pega una lista de cartas y la aplicación la lee: reconoce los títulos de sección en francés, inglés y español, las cantidades al principio de línea, y las notas. Tú eliges si la importación crea un mazo nuevo o reemplaza el abierto, y las líneas no reconocidas se te muestran antes de confirmar.',
    'docs.feat.exportTitle': 'Exportar',
    'docs.feat.export': 'Tres formatos: un ZIP listo para MakePlayingCards, planchas PDF en US Letter, A4 o A3, y una lista de texto. La lista de texto se vuelve a pegar tal cual en la importación, lo que la convierte también en una copia de seguridad. Se puede aportar un dorso propio para el mazo de juego y para el de localizaciones. Desde «Mis mazos», varios mazos marcados se exportan de una vez como listas de texto, reunidas en un solo archivo.',
    'docs.feat.proxyTitle': 'Modo proxy',
    'docs.feat.proxy': 'El modo proxy cubre la línea de copyright con un sello «Proxy», tanto en pantalla como en la exportación. Está activo por defecto y tu elección se recuerda entre visitas.',
    'docs.feat.langTitle': 'Idiomas',
    'docs.feat.lang': 'La interfaz y los nombres de carta existen en francés, inglés y español. Las imágenes de carta están disponibles en esos tres idiomas; al exportar, una imagen que falte en el idioma elegido recurre al inglés.',
```

- [ ] **Step 4: Add the suggestion and deck-manager keys, in all three languages**

`fr`, à ajouter près des autres clés `decks.*` :

```js
    'suggest.label': 'Suggérer une amélioration',
    'suggest.issueTitle': '[suggestion] ',
    'suggest.bodyTemplate': "### Ce que je voudrais faire\n\n\n### Ce que l'application fait aujourd'hui\n\n\n### Où (écran, onglet)\n\n",
    'decks.saved': 'Enregistré',
    'decks.selectAll': 'Tout sélectionner',
    'decks.selectDeck': 'Sélectionner ce deck',
    'decks.exportSelection': 'Exporter la sélection',
    'decks.exportDone': 'Archive téléchargée.',
```

`en` :

```js
    'suggest.label': 'Suggest an improvement',
    'suggest.issueTitle': '[suggestion] ',
    'suggest.bodyTemplate': '### What I would like to do\n\n\n### What the application does today\n\n\n### Where (screen, tab)\n\n',
    'decks.saved': 'Saved',
    'decks.selectAll': 'Select all',
    'decks.selectDeck': 'Select this deck',
    'decks.exportSelection': 'Export selection',
    'decks.exportDone': 'Archive downloaded.',
```

`es` :

```js
    'suggest.label': 'Sugerir una mejora',
    'suggest.issueTitle': '[suggestion] ',
    'suggest.bodyTemplate': '### Lo que me gustaría hacer\n\n\n### Lo que hace hoy la aplicación\n\n\n### Dónde (pantalla, pestaña)\n\n',
    'decks.saved': 'Guardado',
    'decks.selectAll': 'Seleccionar todo',
    'decks.selectDeck': 'Seleccionar este mazo',
    'decks.exportSelection': 'Exportar la selección',
    'decks.exportDone': 'Archivo descargado.',
```

- [ ] **Step 5: Remove the guard's now-dangling exemption**

Dans `test/i18n.test.js`, supprime le bloc de commentaire et la constante `GLOSSARY_KEYS`
(lignes 168-178), puis supprime entièrement le test
`'a glossary entry uses a retired term only inside its « … » citation'` (lignes 199-214).

Rends le test restant inconditionnel — retire le `continue` et renomme-le :

```js
  // Every FR string, no exceptions. The glossary section used to be the one
  // place allowed to cite a retired English term ("en anglais « sideboard »"),
  // because a player's cards are printed in English; that section is gone from
  // the help page, so the exemption went with it rather than lingering as an
  // empty Set pointing at nothing.
  it('no FR string uses a retired term', () => {
    const offences = [];
    for (const [key, value] of Object.entries(translations.fr)) {
      for (const { bad, use } of RETIRED_FR) {
        if (bad.test(prose(value))) offences.push(`fr:${key} = "${value}"  -> use "${use}"`);
      }
    }
    expect(offences).toEqual([]);
  });
```

- [ ] **Step 6: Run the i18n suites**

Run: `npx vitest run test/i18n.test.js test/i18n-rules-contract.test.js`
Expected: PASS.

Si « no FR string uses a retired term » échoue, **corrige la chaîne française fautive** —
n'ajoute ni exemption ni liste d'exclusion : c'est précisément ce que cette tâche
supprime.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: 0 échec. La page d'aide ne rend pas encore les nouvelles clés — c'est la
tâche 7 — et aucun test ne l'exige.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/i18n.js test/i18n.test.js
git commit -m "feat: help-page copy, and the vocabulary guard loses its exemption

The glossary section leaves the help page, so GLOSSARY_KEYS goes with it
rather than lingering as an empty Set pointing at a section that no
longer exists. Every French string is now held to the vocabulary rules.

Also: Ruins & Lairs reads "Ruines & Antres" in French.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: bouton « Enregistrer » dans le header du deck

**Files:**
- Modify: `web/src/App.jsx` (état, `saveDeck`, les deux instances de `DeckPanel`)
- Modify: `web/src/components/DeckPanel.jsx:374-391` (le header)
- Modify: `web/src/styles.css` (une règle pour le message d'erreur du header)

**Interfaces:**
- Consumes: `deckSignature` et `deckPayload` de la tâche 1 ; `decks.save`, `decks.saved`,
  `decks.storageFull` (existantes) et `common.error` (existante).
- Produces: `DeckPanel` accepte trois props supplémentaires — `dirty: boolean`,
  `onSave: () => void`, `saveState: 'idle' | 'saving' | 'saved' | string` (une chaîne
  quelconque étant un message d'erreur déjà traduit).

- [ ] **Step 1: Add the signature state and the save function in `App.jsx`**

Complète l'import de `lib/deck.js` avec `deckSignature, deckPayload`.

Après la déclaration de `zones` (ligne 32), ajoute :

```js
  // Signature of what is currently on disk for this deck. The Save button
  // compares the live deck against it; anything that is not one of the four
  // moments below (mount, load, new, successful save) must NOT touch it --
  // an import in particular leaves the deck dirty on purpose, because the
  // imported work is not stored yet.
  const [savedSignature, setSavedSignature] = useState(() => deckSignature({
    deck: normalizeDeck({ id: null, name: 'Nouveau deck', backAssignments: {} }),
    quantities: {},
    zones: emptyZones(),
  }));
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | <error message>
```

Dans `loadDeckIntoState` (ligne 176), après `setShowManager(false)` :

```js
    setSavedSignature(deckSignature({ deck: normalized, quantities: d.quantities || countOccurrences(d.cardIds || []), zones: normalized.zones }));
    setSaveState('idle');
```

Dans `newDeck` (ligne 186), après `setShowSetup(true)` :

```js
    setSavedSignature(deckSignature({ deck: normalizeDeck({ id: null, name: t('app.newDeck'), backAssignments: {} }), quantities: {}, zones: emptyZones() }));
    setSaveState('idle');
```

Ajoute la fonction de sauvegarde, après `applySetup` :

```js
  // The header's Save button. An unsaved deck goes through the manager
  // instead: creating a record is where the name and the exact deck settings
  // get decided, and that form already exists there.
  async function saveDeck() {
    if (!deck.id) { setShowManager(true); return; }
    setSaveState('saving');
    try {
      const saved = await api.updateDeck(deck.id, deckPayload({ deck, cardIds, quantities, zones }));
      setDeck((prev) => normalizeDeck({ ...prev, ...saved }));
      setSavedSignature(deckSignature({ deck, quantities, zones }));
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (e) {
      setSaveState(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
    }
  }
```

> `cardIds` est calculé ligne 236, **après** ces fonctions mais avant le rendu : c'est une
> `function` déclarée, donc la closure lit la valeur du rendu courant. C'est correct ici —
> `saveDeck` n'est appelée que depuis un gestionnaire d'événement.

Enfin, dans `onSaved` du `DeckManager` (ligne 327), remets la signature à jour :

```js
          onSaved={(d) => {
            setDeck((prev) => normalizeDeck({ ...prev, ...d }));
            setSavedSignature(deckSignature({ deck: { ...deck, ...d }, quantities, zones }));
            setSaveState('idle');
          }}
```

- [ ] **Step 2: Compute `dirty` and pass the three props**

Juste après `const hasSelection = ...` (ligne 239) :

```js
  const dirty = deckSignature({ deck, quantities, zones }) !== savedSignature;
```

Ajoute aux **deux** instances de `DeckPanel` (desktop ligne 248, feuille mobile ligne 273) :

```js
            dirty={dirty}
            onSave={saveDeck}
            saveState={saveState}
```

- [ ] **Step 3: Render the button in the deck panel header**

Dans `web/src/components/DeckPanel.jsx`, ajoute `dirty`, `onSave` et `saveState` à la
signature du composant, puis insère dans `.deckpanel-head`, juste après le
`<span className="muted deckpanel-total">` (ligne 382) :

```jsx
        <button
          className="btn small deckpanel-save"
          onClick={onSave}
          disabled={!dirty || saveState === 'saving'}
          title={t('decks.save')}
        >{saveState === 'saved' ? `✓ ${t('decks.saved')}` : t('decks.save')}</button>
```

et, juste après la fermeture de `</div>` du header (ligne 391) :

```jsx
      {saveState !== 'idle' && saveState !== 'saving' && saveState !== 'saved' && (
        <p className="deckpanel-save-error">{saveState}</p>
      )}
```

- [ ] **Step 4: Style the error line**

Dans `web/src/styles.css`, à la suite du bloc `.deckpanel-head` (~ligne 648) :

```css
/* Save failure (storage full, most likely). It belongs under the header rather
   than in an alert: the button that failed is right above it. */
.deckpanel-save-error {
  margin: 0;
  padding: 6px 12px;
  color: var(--danger);
  font-size: 12px;
}
```

- [ ] **Step 5: Verify in the running app**

Lance le serveur avec l'outil de prévisualisation (`preview_start`, jamais `npm run dev`
via Bash) et vérifie, dans cet ordre :

1. deck vide, aucune modification → le bouton est grisé ;
2. ajoute une carte → le bouton s'active ;
3. clique → « Mes decks » s'ouvre (le deck n'a pas d'`id`) ; nomme-le, clique Créer,
   ferme → le bouton est de nouveau grisé ;
4. ajoute une carte, clique Enregistrer → « ✓ Enregistré » pendant 2 s, puis le bouton
   redevient grisé ;
5. recharge la page, charge le deck depuis « Mes decks » → le bouton est grisé ;
6. ouvre l'import, colle une liste, valide → le bouton est **actif** (travail non écrit).

Relève les erreurs de console avec `read_console_messages` avant de conclure.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 0 échec.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.jsx web/src/components/DeckPanel.jsx web/src/styles.css
git commit -m "feat: save a deck from its own header

The signature is refreshed at four moments and four only: mount, load,
new, and a successful save. An import is deliberately not one of them --
imported work is not on disk yet, and greying the button right after an
import would say the opposite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: lien « suggérer une amélioration »

**Files:**
- Modify: `web/src/components/FilterBar.jsx:173`
- Modify: `web/src/styles.css` (une règle, à côté de `.docs-btn`)

**Interfaces:**
- Consumes: `REPORT_ISSUES_URL` (`web/src/lib/constants.js:25`) et les clés
  `suggest.label`, `suggest.issueTitle`, `suggest.bodyTemplate` de la tâche 4.

- [ ] **Step 1: Add the link**

Dans `web/src/components/FilterBar.jsx`, ajoute l'import :

```js
import { REPORT_ISSUES_URL } from '../lib/constants.js';
```

Puis, juste après le bouton `.docs-btn` (ligne 173) :

```jsx
        {/* A link, not a button: the destination is a URL, so it opens in a new
            tab, copies, and announces itself correctly. Built the same way as
            the per-rule "report" links in RulesDoc. */}
        <a
          className="chip-toggle suggest-btn"
          href={`${REPORT_ISSUES_URL}?labels=enhancement&title=${encodeURIComponent(t('suggest.issueTitle'))}&body=${encodeURIComponent(t('suggest.bodyTemplate'))}`}
          target="_blank"
          rel="noreferrer"
          title={t('suggest.label')}
          aria-label={t('suggest.label')}
        >💡</a>
```

- [ ] **Step 2: Style it**

Dans `web/src/styles.css`, sous `.docs-btn` (ligne 538) :

```css
/* Same footprint as the help button: the logo row is already full on a phone,
   so the label lives in title/aria-label rather than on screen. */
.suggest-btn { text-decoration: none; line-height: 1; }
```

- [ ] **Step 3: Verify in the running app**

Avec la prévisualisation ouverte, lis la page (`read_page`) et vérifie que le lien porte
bien `aria-label="Suggérer une amélioration"` et un `href` contenant
`labels=enhancement`. **N'ouvre pas** l'URL GitHub : ouvrir un formulaire de création
d'issue n'a rien à faire dans une vérification, et rien ne doit être publié.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: 0 échec.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FilterBar.jsx web/src/styles.css
git commit -m "feat: suggest an improvement from the logo row

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: la page « ? » devient une page d'aide en deux parties

**Files:**
- Create: `web/src/components/FeaturesDoc.jsx`
- Modify: `web/src/components/RulesDoc.jsx:20-32` (suppression de `GLOSSARY`), `:65-87`
  (la prose), et insertion des deux titres de partie
- Modify: `web/src/styles.css` (suppression de `.doc-glossary` si elle n'a plus d'usage)

**Interfaces:**
- Consumes: les clés `docs.part.*` et `docs.feat.*` de la tâche 4.
- Produces: `FeaturesDoc` — composant sans prop, rendant un fragment de `<section>`.

- [ ] **Step 1: Create `FeaturesDoc.jsx`**

```jsx
import React from 'react';
import { useT } from '../i18n.jsx';

// Part 1 of the help page: what the application does, in the order a new user
// meets it. Renders sections only -- RulesDoc owns the modal, its title and its
// close button, and part 2 (the rule tables) stays there.
//
// The list is data rather than hand-written JSX so a new feature is one entry
// plus its two i18n keys, and so nothing can render a title without its body.
const TOPICS = ['search', 'decks', 'import', 'export', 'proxy', 'lang'];

export default function FeaturesDoc() {
  const t = useT();
  return (
    <section className="doc-prose">
      <h3>{t('setup.mode.freeform')}</h3>
      <p>{t('docs.freeform')}</p>
      <h3>{t('setup.mode.deckbuilding')}</h3>
      <p>{t('docs.deckbuilding')}</p>
      <h3>{t('docs.zonesTitle')}</h3>
      <p>{t('docs.zones')}</p>
      {TOPICS.map((k) => (
        <React.Fragment key={k}>
          <h3>{t(`docs.feat.${k}Title`)}</h3>
          <p>{t(`docs.feat.${k}`)}</p>
        </React.Fragment>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Rewrite the prose block of `RulesDoc.jsx`**

Ajoute l'import :

```js
import FeaturesDoc from './FeaturesDoc.jsx';
```

Supprime la constante `GLOSSARY` et son commentaire (lignes 20-32), puis remplace tout le
bloc `<section className="doc-prose"> … </section>` (lignes 65-87) par :

```jsx
        <p className="doc-intro">{t('docs.intro')}</p>

        <h2 className="doc-part">{t('docs.part.featuresTitle')}</h2>
        <FeaturesDoc />

        <h2 className="doc-part">{t('docs.part.rulesTitle')}</h2>
        <section className="doc-prose">
          <h3>{t('docs.warningsTitle')}</h3>
          <p>{t('docs.warnings')}</p>
          <h3>{t('docs.enforcementTitle')}</h3>
          <p>{t('docs.enforcement')}</p>
        </section>
```

Le reste du composant — tableau des règles, lacunes, camps, longueurs, bannies — ne bouge
pas.

- [ ] **Step 3: Style the part headings, drop the dead rule**

Dans `web/src/styles.css`, ajoute sous `.modal.doc` :

```css
/* The two halves of the help page: what the app does, then what the rules say. */
.doc-part {
  margin: 18px 0 4px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}
.doc-intro { margin: 0 0 8px; }
```

Cherche `.doc-glossary` dans le fichier : la section ayant disparu, supprime la règle si
plus rien ne l'utilise (`grep -rn "doc-glossary" web/src`).

- [ ] **Step 4: Verify in the running app**

Ouvre la prévisualisation, clique le `?`, et vérifie avec `read_page` :

1. le titre de la modale est « Aide » ;
2. « Utiliser l'application » précède les neuf rubriques, « Règles » précède les tables ;
3. **aucune section « Vocabulaire »**, et aucune définition orpheline ;
4. les cases à cocher des règles fonctionnent toujours sur un deck en mode construction ;
5. bascule la langue en `en` puis `es` : aucune clé brute (`docs.feat.…`) à l'écran — une
   clé affichée telle quelle signifie qu'elle manque dans ce dictionnaire.

Prends une capture (`computer` / `screenshot`) de la page en français.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 0 échec. `test/docText.test.js` ne doit pas bouger : la partie 2 est intacte.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/FeaturesDoc.jsx web/src/components/RulesDoc.jsx web/src/styles.css
git commit -m "feat: the ? page documents the application, not just the rules

Nine topics before the rule tables, and the vocabulary section is gone --
it read as developer notes. RulesDoc keeps the modal and the tables;
FeaturesDoc is sections only, driven by a topic list so a new feature is
one entry and two keys rather than more JSX.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: export massif depuis « Mes decks »

**Files:**
- Modify: `web/src/components/DeckManager.jsx` (sélection, barre d'actions, export)
- Modify: `web/src/App.jsx:319-329` (deux props supplémentaires)
- Modify: `web/src/styles.css` (une règle pour la barre de sélection)

**Interfaces:**
- Consumes: `buildDeckListZip` (tâche 2), `buildDeckListText`
  (`web/src/lib/deckList.js:81`), `api.getDeck`, et les clés `decks.selectAll`,
  `decks.selectDeck`, `decks.exportSelection`, `decks.exportDone` (tâche 4).
- Produces: `DeckManager` accepte `cardsById: Map` et `uiLang: string`.

- [ ] **Step 1: Pass the two new props from `App.jsx`**

Dans le bloc `{showManager && (<DeckManager … />)}` (ligne 320), ajoute :

```jsx
          cardsById={cardsById}
          uiLang={uiLang}
```

- [ ] **Step 2: Add selection state and the export routine to `DeckManager.jsx`**

Complète les imports :

```js
import { buildDeckListZip } from '../lib/export/deckListZip.js';
import { buildDeckListText } from '../lib/deckList.js';
```

Ajoute `cardsById`, `uiLang` à la signature du composant, et l'état, sous `dragIndex` :

```js
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
```

Dans `refresh()`, purge la sélection des decks disparus — sans quoi supprimer un deck
coché laisse un id fantôme dans le compteur du bouton :

```js
  async function refresh() {
    const rows = await api.listDecks();
    setDecks(rows);
    setSelectedIds((prev) => {
      const alive = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }
```

Ajoute la bascule et l'export :

```js
  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.size === decks.length ? new Set() : new Set(decks.map((d) => d.id))));
  }

  // Text lists only: several decks pulling their images at once is a browser
  // memory problem, not a bigger version of the same button. These .txt files
  // paste straight back into the importer, so a batch export doubles as a
  // backup -- which is the reason to reuse buildDeckListText rather than write
  // a second, quietly diverging serialiser here.
  async function exportSelection() {
    setExporting(true);
    setError(null);
    setExportDone(false);
    try {
      const entries = [];
      // Sequential on purpose: reads come from localStorage and the list is
      // short, so ordering the archive like the on-screen list is worth more
      // than parallelism nobody would perceive.
      for (const d of decks) {
        if (!selectedIds.has(d.id)) continue;
        const full = await api.getDeck(d.id);
        entries.push({
          name: full.name,
          text: buildDeckListText(cardsById, full.quantities || {}, full.name, uiLang, {
            zones: full.zones, notes: full.notes, mode: full.mode, ruleset: full.ruleset,
          }),
        });
      }
      const bytes = await buildDeckListZip(entries);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `decks-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      setError(t('common.error', { msg: e.message }));
    } finally {
      setExporting(false);
    }
  }
```

- [ ] **Step 3: Render the selection bar and the per-row checkbox**

Juste avant `<ul className="deck-list">` (ligne 145) :

```jsx
        {decks.length > 0 && (
          <div className="row deck-select-bar">
            <label style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === decks.length}
                onChange={toggleAll}
              />
              {' '}{t('decks.selectAll')}
            </label>
            <span className="spacer" />
            {exportDone && <span className="muted">✅ {t('decks.exportDone')}</span>}
            <button
              className="btn secondary"
              onClick={exportSelection}
              disabled={exporting || selectedIds.size === 0}
            >{t('decks.exportSelection')} ({selectedIds.size})</button>
          </div>
        )}
```

Dans le `<li>`, en toute première position — avant le bloc `{isMobile && (` :

```jsx
                <input
                  type="checkbox"
                  className="deck-select"
                  checked={selectedIds.has(d.id)}
                  onChange={() => toggleSelected(d.id)}
                  aria-label={t('decks.selectDeck')}
                />
```

- [ ] **Step 4: Style the bar**

Dans `web/src/styles.css`, près des règles `.deck-list` :

```css
/* Ticking is not grabbing: the rows stay draggable for reordering while a
   selection is being built. */
.deck-select-bar { border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.deck-select { flex: 0 0 auto; }
```

- [ ] **Step 5: Verify in the running app**

Avec la prévisualisation :

1. enregistre deux decks portant **le même nom** ;
2. ouvre « Mes decks », coche les deux, clique « Exporter la sélection (2) » ;
3. l'archive se télécharge ; ouvre-la et vérifie **deux** fichiers, `<Nom>.txt` et
   `<Nom>-2.txt` — un seul fichier signifie que la déduplication ne s'applique pas ;
4. « Tout sélectionner » coche et décoche l'ensemble ; le bouton est grisé à zéro ;
5. supprime un deck coché → le compteur du bouton décroît ;
6. glisse une ligne pour la réordonner pendant que des cases sont cochées : l'ordre
   change et la sélection survit.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 0 échec.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/DeckManager.jsx web/src/App.jsx web/src/styles.css
git commit -m "feat: export several decks at once as text lists

Same serialiser as the single-deck export, so the archive re-imports
one file at a time. Deleting a ticked deck drops it from the selection,
which is the only way the button's count could have lied.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: documentation

Une fonctionnalité n'est pas terminée tant que `docs/ARCHITECTURE.md` n'est pas à jour.
C'est la règle n°1 du projet, et cette tâche est la seule qui y touche — pour que le
document reçoive un passage cohérent plutôt que huit retouches.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§4, §5, §7, §9, §10, §13, §15, et la date en tête)
- Modify: `README.md`

- [ ] **Step 1: Read the protocol and the affected sections**

Lis **§0** (protocole de mise à jour : quelle section pour quel changement, règles
d'écriture, *definition of done*), puis §4, §5, §7, §9, §10, §13, §14, §15.

- [ ] **Step 2: Write the section updates**

- **§4** (forme d'un deck) — `deckSignature` : ce qu'elle couvre, et pourquoi `id`,
  `order` et `updatedAt` en sont exclus. `deckPayload` comme définition unique d'un deck
  stocké.
- **§5** (état de `App.jsx`) — `savedSignature` et `saveState` ; les **quatre** moments
  où la signature est réécrite, et le fait qu'un import n'en est délibérément pas un.
- **§7** (export) — `deckListZip.js` ; le piège de l'écrasement silencieux par JSZip sur
  un chemin dupliqué, et pourquoi la déduplication se fait **après** l'assainissement du
  nom.
- **§9** (traductions) — ajout de « Antres » (Ruins & Lairs) au vocabulaire FR ;
  disparition de la section glossaire de la page d'aide ; **le garde-fou `RETIRED_FR` n'a
  plus aucune exemption** : `GLOSSARY_KEYS` est supprimé, et toute chaîne FR y est
  soumise. Précise que `lib/import/vocabulary.js` est une autre chose et n'a pas bougé.
- **§10** (composants, CSS) — bouton Enregistrer dans `.deckpanel-head` ; `OPTIONAL_TABS`
  et `tabPresentation` ; le lien de suggestion dans la rangée logo ; la barre de sélection
  de `DeckManager` ; `FeaturesDoc.jsx` et le partage de responsabilité avec `RulesDoc.jsx`.
- **§13** (ce qui existe) — page d'aide, sauvegarde depuis le header, export massif, lien
  de suggestion.
- **§15** — une entrée datée **2026-08-04**.
- La **date en tête du fichier** passe à 2026-08-04.

- [ ] **Step 3: Update `README.md`**

Trois ajouts visibles par l'utilisateur : la page d'aide (ex-« Règles et modes »), le
bouton Enregistrer du panneau de deck, et l'export massif depuis « Mes decks ».

- [ ] **Step 4: Final verification**

Run: `npm test`
Expected: **0 échec**, fichiers compris (36 attendus : 33 + `deckListZip` + `zoneTabs`,
`deck.test.js` étant enrichi et non ajouté — vérifie le compte réel plutôt que ce chiffre).

Run: `npm run build`
Expected: succès, sans avertissement nouveau.

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: record the six changes and the guard that lost its exemption

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Auto-revue du plan

**Couverture de la spec.** §1 page d'aide → tâches 4 (clés) et 7 (rendu). §2 Ruines &
Antres → tâche 4. §3 pilule talon → tâche 3. §4 bouton Enregistrer → tâches 1 et 5.
§5 suggestion → tâches 4 et 6. §6 export massif → tâches 2, 4 et 8. Tests → répartis dans
chaque tâche. Documentation → tâche 9. Hors périmètre → rien n'y contrevient.

**Cohérence des noms.** `deckSignature` / `deckPayload` (tâches 1, 5) ; `buildDeckListZip`
et `safeFileName` (tâches 2, 8) ; `tabPresentation` et `OPTIONAL_TABS` (tâche 3) ;
`docs.feat.<sujet>` avec `<sujet>` ∈ `TOPICS` de la tâche 7 = les clés écrites en tâche 4
(`search`, `decks`, `import`, `export`, `proxy`, `lang`) ; props `dirty` / `onSave` /
`saveState` (tâches 1, 5) ; `cardsById` / `uiLang` sur `DeckManager` (tâche 8).

**Point de vigilance pour l'exécutant.** Le compte de fichiers de test attendu à la
tâche 9 est une estimation ; c'est le **zéro échec** qui fait foi, pas le nombre.
