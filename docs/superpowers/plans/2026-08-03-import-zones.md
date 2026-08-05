# Import par zones, ordre des types, cartes spécifiques — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'import de deck permissif (sections dans n'importe quel ordre, quantités à quatre positions, trois langues), ordonner le filtre Type comme l'ordre de jeu, et masquer les cartes spécifiques à un autre camp.

**Architecture :** Le parseur d'import éclate en modules purs sous `web/src/lib/import/`, `importDeck.js` devenant une façade qui garde son API publique intacte. Le parseur de ligne ne tranche pas les ambiguïtés : il renvoie des **lectures candidates** et le résolveur garde la première qui correspond à une carte réelle. La fenêtre d'import devient un assistant en deux temps — coller puis régler — ce qui rend impossible toute contradiction entre les sélecteurs et les métadonnées du texte collé.

**Tech Stack :** Vite + React 18, JSX sans TypeScript, Vitest. **Aucune nouvelle dépendance.**

**Spec :** [`docs/superpowers/specs/2026-08-03-import-zones-design.md`](../specs/2026-08-03-import-zones-design.md)

## Global Constraints

- **Français pour la prose, anglais pour le code.** Identifiants, commentaires, ids de règles et messages de commit en anglais.
- **Aucune nouvelle dépendance runtime.** Il y en a deux (`jszip`, `pdf-lib`) et ça ne change pas.
- **Glossaire FR imposé, gardé par un test** (`test/i18n.test.js`) : play deck → **pioche**, sideboard → **talon**, pool → **réserve**, hazard → **péril**, minion → **séide**, stage → **progression**. Les mots retirés sont bannis, pas dépréciés : « talon » désignait le play deck avant le 2026-07-29 et « réserve » désignait le sideboard.
- **« Faction » ne désigne jamais un camp.** Le mot est **camp** (`side`). Un test le vérifie.
- **Toute nouvelle clé i18n va dans les trois dictionnaires** (`fr`, `en`, `es`) de `web/src/lib/i18n.js`, sinon `test/i18n-rules-contract.test.js` échoue.
- **Une source unique de vérité par domaine.** `zones.js`, `copies.js`, `roles.js`, `deckSections.js`, `proxy.js`, `sides.js` sont autoritaires. Réimplémenter leur logique ailleurs est une régression.
- **Les commentaires expliquent le *pourquoi* et les pièges, pas le *quoi*.** Tenir le niveau du code voisin.
- **`docs/ARCHITECTURE.md` est mis à jour dans le même commit** que le code qu'il décrit (Task 12 regroupe ce qui reste).
- **`npm test` doit finir à 0 échec — lire le compte de *fichiers*, pas seulement celui des tests.** Une erreur de syntaxe JSX fait échouer un fichier *à la transformation esbuild*, pas à l'assertion.

---

## Structure des fichiers

**Créés**

| Fichier | Responsabilité |
|---|---|
| `web/src/lib/import/normalize.js` | `normalizeName` — feuille sans dépendance, existe pour casser le cycle façade ↔ vocabulaire |
| `web/src/lib/import/line.js` | une ligne brute → lectures candidates |
| `web/src/lib/import/vocabulary.js` | les quatre familles de titres, trois langues |
| `web/src/lib/import/document.js` | machine à états : lignes + titres → `{ name, meta, notes, lines }` |
| `web/src/lib/import/resolve.js` | index de noms + pile de départage |
| `test/importLine.test.js`, `test/importVocabulary.test.js`, `test/importDocument.test.js`, `test/importResolve.test.js` | un fichier par module |

**Modifiés**

| Fichier | Changement |
|---|---|
| `web/src/lib/constants.js` | accueille `TYPE_ORDER` |
| `web/src/lib/filter.js` | `sortFacetOptions` |
| `web/src/components/FilterBar.jsx` | prop `order` sur `FacetDropdown` |
| `web/src/lib/rules/sides.js` | passe `specific` dans `isLegalForSide` |
| `web/src/lib/deckList.js` | `METADATA_TITLE`, `META_KEYS`, bloc `## Metadata`, ré-export de `TYPE_ORDER` |
| `web/src/components/ExportDialog.jsx` | passe `mode`/`ruleset` à `buildDeckListText` |
| `web/src/lib/importDeck.js` | devient une façade |
| `web/src/lib/i18n.js` | nouvelles clés `import.*` ×3 langues |
| `web/src/components/ImportDialog.jsx` | assistant en deux temps |
| `web/src/App.jsx` | `importDeckData` gagne `name`/`mode`/`ruleset`/`target` |

**Garde-fous de non-régression**

- **`test/importDeck.test.js` ne doit pas être modifié.** Il teste la façade. S'il échoue, voir la note en Task 8.
- **`test/deckList.test.js` sera modifié** — le format d'export change (Task 3).

---

## Task 1 : ordre des types dans le filtre

**Files:**
- Modify: `web/src/lib/constants.js`
- Modify: `web/src/lib/deckList.js:28`
- Modify: `web/src/lib/filter.js`
- Modify: `web/src/components/FilterBar.jsx:29`, `:179-187`
- Test: `test/constants.test.js`, `test/filter.test.js`

**Interfaces:**
- Produces: `TYPE_ORDER` exporté depuis `web/src/lib/constants.js` (et ré-exporté par `deckList.js`) ; `sortFacetOptions(options, { order, label })` depuis `web/src/lib/filter.js`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `test/constants.test.js` :

```js
import { TYPE_ORDER } from '../web/src/lib/constants.js';
import { TYPE_ORDER as REEXPORTED } from '../web/src/lib/deckList.js';

it('TYPE_ORDER is the play order, not an alphabetical one', () => {
  expect(TYPE_ORDER).toEqual(['Character', 'Resource', 'Hazard', 'Site', 'Region']);
});

it('deckList re-exports the very same array, so the two can never drift', () => {
  expect(REEXPORTED).toBe(TYPE_ORDER);
});
```

Ajouter à `test/filter.test.js` :

```js
import { sortFacetOptions } from '../web/src/lib/filter.js';

const label = (v) => ({ Character: 'Personnages', Resource: 'Ressources', Hazard: 'Périls', Site: 'Sites', Region: 'Régions' }[v] || v);

it('sortFacetOptions: with an order, the display language cannot change the sequence', () => {
  const opts = ['Region', 'Hazard', 'Character', 'Site', 'Resource'];
  const order = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];
  expect(sortFacetOptions(opts, { order, label })).toEqual(order);
});

it('sortFacetOptions: a value missing from the order goes last, not first', () => {
  const order = ['Character', 'Resource'];
  expect(sortFacetOptions(['Zebra', 'Resource', 'Alpha'], { order, label: (v) => v }))
    .toEqual(['Resource', 'Alpha', 'Zebra']);
});

it('sortFacetOptions: with no order it sorts on the label, which is the existing behaviour', () => {
  expect(sortFacetOptions(['Hazard', 'Character'], { label })).toEqual(['Personnages', 'Périls'].map((l) => (l === 'Personnages' ? 'Character' : 'Hazard')));
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/constants.test.js test/filter.test.js
```

Attendu : ÉCHEC, `TYPE_ORDER` et `sortFacetOptions` ne sont pas exportés.

- [ ] **Step 3 : déplacer `TYPE_ORDER`**

Dans `web/src/lib/constants.js`, sous `LENGTH_IDS` :

```js
// Play order, not alphabetical order. Authoritative for the deck panel's
// grouping, every export, and the Type filter menu — which is why it lives
// here and not in deckList.js: the filter bar has no business importing an
// export-layer module for a constant that belongs to neither.
export const TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];
```

Dans `web/src/lib/deckList.js`, remplacer la ligne 28 par un ré-export :

```js
export { TYPE_ORDER } from './constants.js';
```

`buildGroups` continue d'utiliser `TYPE_ORDER` : ajouter l'import nommé en tête du fichier (`import { TYPE_ORDER } from './constants.js';`) en plus du ré-export, sinon la référence interne est indéfinie.

- [ ] **Step 4 : ajouter `sortFacetOptions`**

Dans `web/src/lib/filter.js` :

```js
// Facet menus are read, so they sort on what is displayed -- "Périls" belongs
// under P even though the value behind it is "Hazard". The Type facet is the
// exception: its sequence is the play order (TYPE_ORDER), which must be the
// same in all three languages. A value absent from `order` goes last rather
// than first, so a newly added data value stays visible instead of jumping
// to the head of the menu.
export function sortFacetOptions(options, { order, label = (v) => v } = {}) {
  const copy = [...options];
  if (!order) return copy.sort((a, b) => label(a).localeCompare(label(b)));
  const rank = (v) => { const i = order.indexOf(v); return i === -1 ? Infinity : i; };
  return copy.sort((a, b) => (rank(a) - rank(b)) || label(a).localeCompare(label(b)));
}
```

- [ ] **Step 5 : brancher `FilterBar`**

Dans `web/src/components/FilterBar.jsx` :

```js
import { sortFacetOptions } from '../lib/filter.js';
import { TYPE_ORDER } from '../lib/constants.js';
```

Dans `FacetDropdown`, remplacer la ligne `const ordered = [...options].sort(...)` par :

```js
  const ordered = sortFacetOptions(options, { order, label: show });
```

et ajouter `order` à la déstructuration des props de `FacetDropdown`.

Dans le helper `facet`, propager la prop :

```js
  const facet = (key, label, order) => (
    <FacetDropdown
      label={label}
      options={facets[key] || []}
      selected={filters[key]}
      onChange={(v) => set(key, v)}
      open={openKey === key}
      onToggle={() => setOpenKey((k) => (k === key ? null : key))}
      optionLabel={optionLabel(key)}
      order={order}
    />
  );
```

et ligne 180, seul appel à changer :

```js
        {facet('types', t('filter.type'), TYPE_ORDER)}
```

- [ ] **Step 6 : vérifier que ça passe**

```bash
npx vitest run test/constants.test.js test/filter.test.js test/deckList.test.js test/deckSections.test.js
```

Attendu : SUCCÈS. `deckList` et `deckSections` sont inclus parce qu'ils consomment `TYPE_ORDER` — s'ils cassent, le ré-export est mal fait.

- [ ] **Step 7 : commit**

```bash
git add web/src/lib/constants.js web/src/lib/deckList.js web/src/lib/filter.js web/src/components/FilterBar.jsx test/constants.test.js test/filter.test.js
git commit -m "feat: the Type filter follows the play order, in every language"
```

---

## Task 2 : masquer les cartes spécifiques à un autre camp

**Files:**
- Modify: `web/src/lib/rules/sides.js:131-143`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `SPECIFIC_TO_SIDES` (déjà exporté par `sides.js`).
- Produces: `isLegalForSide(card, sideId, openBalrog, bannedIds)` — signature **inchangée**, comportement durci.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `test/rules.test.js`, à côté des autres cas `isLegalForSide` (vers la ligne 378) :

```js
  it('isLegalForSide: a Balrog-specific card is hidden from a Ringwraith deck', () => {
    const card = { id: 'X-1', type: 'Character', alignment: 'Minion', attributes: { specific: 'Balrog' } };
    expect(isLegalForSide(card, 'ringwraith')).toBe(false);
    expect(isLegalForSide(card, 'balrog')).toBe(true);
  });

  it('isLegalForSide: a wizard-specific card is legal for both sides that may declare that avatar', () => {
    const card = { id: 'X-2', type: 'Resource', alignment: 'Hero', attributes: { specific: 'Gandalf' } };
    expect(isLegalForSide(card, 'wizard')).toBe(true);
    expect(isLegalForSide(card, 'fallen-wizard')).toBe(true);
    expect(isLegalForSide(card, 'ringwraith')).toBe(false);
    expect(isLegalForSide(card, 'balrog')).toBe(false);
  });

  it('isLegalForSide: an unknown `specific` value restricts nothing, rather than hiding the card everywhere', () => {
    const card = { id: 'X-3', type: 'Resource', alignment: 'Neutral', attributes: { specific: 'Unlisted' } };
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(isLegalForSide(card, side)).toBe(true);
    }
  });

  it('isLegalForSide: every real Balrog-specific card is hidden from the three other sides', () => {
    const { cards } = load(); // same helper the neighbouring tests use
    const specifics = cards.filter((c) => (c.attributes || {}).specific === 'Balrog');
    expect(specifics.length).toBeGreaterThan(40); // 46 in the current data
    for (const c of specifics) {
      expect(isLegalForSide(c, 'balrog')).toBe(true);
      expect(isLegalForSide(c, 'ringwraith')).toBe(false);
    }
  });
```

> **Note pour l'implémenteur :** le helper qui charge `cards.json` existe déjà en tête de `test/rules.test.js` (les tests voisins l'utilisent pour `siteIndex` et `resolveBanned`). Reprends **son** nom réel plutôt que `load()` ; ne crée pas un second chargeur.

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/rules.test.js -t "specific"
```

Attendu : ÉCHEC — les cartes spécifiques sont aujourd'hui déclarées légales partout.

- [ ] **Step 3 : implémenter la passe**

Dans `web/src/lib/rules/sides.js`, remplacer le corps de `isLegalForSide` (lignes 131-143) par :

```js
export function isLegalForSide(card, sideId, openBalrog, bannedIds) {
  const side = SIDES[sideId];
  if (!side || !card) return true;
  // A ban is unconditional, so it is checked before every pass below: a banned
  // card is no more playable for being an avatar, Balrog-specific, or an open
  // 1.4.1 site.
  if (bannedIds && bannedIds.has(card.id)) return false;
  const a = card.attributes || {};
  if (a.avatar === true) return card.alignment === side.avatarAlignment;
  // 1.3.4 -- a card naming a specific avatar is only playable by a side that
  // may declare that avatar. This used to be left to the validator on the
  // grounds that the filter should not hide what a rule merely restricts *per
  // avatar*; but SPECIFIC_TO_SIDES is a *side*-level fact, and the 46
  // Balrog-specific cards sat in a Ringwraith browser looking playable under
  // any avatar, which they are not. The finer, per-avatar case (a card
  // specific to Gandalf in a Saruman deck) stays with SPECIFIC-AVATAR: the
  // browser does not know which avatar the deck declares, and three distinct
  // avatars are allowed.
  // An unrecognised `specific` value restricts nothing -- data we do not know
  // about must not silently hide cards.
  if (a.specific && SPECIFIC_TO_SIDES[a.specific]) {
    return SPECIFIC_TO_SIDES[a.specific].includes(sideId);
  }
  if (openBalrog && openBalrog.has(card.id)) return true;
  return side.alignments.includes(card.alignment);
}
```

> La ligne `if (sideId === 'balrog' && a.specific === 'Balrog') return true;` disparaît : la nouvelle passe la couvre (`SPECIFIC_TO_SIDES.Balrog === ['balrog']`) et la généralise. Ne pas garder les deux.

- [ ] **Step 4 : lancer tout `rules.test.js`**

```bash
npx vitest run test/rules.test.js
```

Attendu : SUCCÈS.

**Si `test/rules.test.js:396` échoue** (« every banned card of a camp is hidden by the filter, and none was hidden already ») : c'est le risque prévu par la spec. Une carte est à la fois bannie et spécifique d'un autre camp, donc l'assertion `isLegalForSide(card, side, openBalrog) === true` avant application de la liste de bannis est trop forte. Correctif : exclure de cette assertion les cartes dont `attributes.specific` n'autorise pas le camp, avec un commentaire disant pourquoi. **Ne pas** affaiblir la seconde moitié du test (la carte doit rester illégale une fois la liste appliquée).

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/rules/sides.js test/rules.test.js
git commit -m "feat: avatar-specific cards leave the browser of a side that cannot declare them"
```

---

## Task 3 : bloc de métadonnées à l'export

**Files:**
- Modify: `web/src/lib/deckList.js`
- Modify: `web/src/components/ExportDialog.jsx:90`
- Test: `test/deckList.test.js`

**Interfaces:**
- Produces: `METADATA_TITLE = 'Metadata'` et `META_KEYS = { mode: 'Mode', side: 'Side', length: 'Game length' }` exportés depuis `deckList.js` ; `buildDeckListText(cardsById, quantities, deckName, lang, { zones, notes, mode, ruleset })`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `test/deckList.test.js` :

```js
import { buildDeckListText, METADATA_TITLE, META_KEYS } from '../web/src/lib/deckList.js';

it('buildDeckListText: a deckbuilding deck carries its mode, side and length in canonical English', () => {
  const text = buildDeckListText(new Map(), {}, 'Mon deck', 'fr', {
    mode: 'deckbuilding',
    ruleset: { side: 'balrog', length: 'standard', tournament: true, ruleOverrides: {} },
  });
  expect(text).toContain('## Metadata');
  expect(text).toContain('- Mode: Deckbuilding');
  expect(text).toContain('- Side: Balrog');
  expect(text).toContain('- Game length: Standard');
  // tournament is deliberately out: the import dialog cannot set it.
  expect(text).not.toContain('Tournament');
});

it('buildDeckListText: a freeform deck still carries a block, with the mode alone', () => {
  const text = buildDeckListText(new Map(), {}, 'Mon deck', 'fr', { mode: 'freeform', ruleset: null });
  expect(text).toContain('## Metadata');
  expect(text).toContain('- Mode: Freeform');
  expect(text).not.toContain('- Side:');
});

it('buildDeckListText: the block sits between the title and the notes', () => {
  const text = buildDeckListText(new Map(), {}, 'Mon deck', 'fr', {
    mode: 'freeform', ruleset: null, notes: { starting: 'garder Bûrat' },
  });
  expect(text.indexOf('# Mon deck')).toBeLessThan(text.indexOf('## Metadata'));
  expect(text.indexOf('## Metadata')).toBeLessThan(text.indexOf('## Notes'));
});

it('the metadata heading is not "Deck", which the vocabulary already reads as the play deck', () => {
  expect(METADATA_TITLE).toBe('Metadata');
  expect(META_KEYS).toEqual({ mode: 'Mode', side: 'Side', length: 'Game length' });
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/deckList.test.js
```

Attendu : ÉCHEC (`METADATA_TITLE` non exporté).

- [ ] **Step 3 : implémenter**

Dans `web/src/lib/deckList.js`, après `NOTE_TITLES` (ligne 34) :

```js
// Deck metadata, emitted right under the title so a pasted list can restore
// the mode/side/length the deck was built under.
//
// The heading is "Metadata" and NOT "Deck": the import vocabulary already
// reads the bare word "deck" as the play deck, which is how community lists
// use it, and one reading per word is what keeps that vocabulary a flat table.
export const METADATA_TITLE = 'Metadata';
export const META_KEYS = { mode: 'Mode', side: 'Side', length: 'Game length' };

// Canonical English values, like every heading here and for the same reason:
// a list exported in French must re-import. The parser additionally accepts
// the localized labels and the raw ids, because a human will write them.
const META_MODE = { freeform: 'Freeform', deckbuilding: 'Deckbuilding' };
const META_SIDE = { wizard: 'Wizard', ringwraith: 'Ringwraith', 'fallen-wizard': 'Fallen-wizard', balrog: 'Balrog' };
const META_LENGTH = { starter: 'Starter', standard: 'Standard', long: 'Long', campaign: 'Campaign' };
```

Puis remplacer la signature et le début du corps de `buildDeckListText` :

```js
export function buildDeckListText(cardsById, quantities = {}, deckName = 'Deck', lang = 'fr', { zones = { sideboard: {}, pool: {} }, notes = {}, mode = 'freeform', ruleset = null } = {}) {
  const lines = [`# ${deckName}`, ''];

  // Always emitted, even in freeform: a block that is sometimes absent is a
  // conditional the reader has to reconstruct, and "Mode: Freeform" is two
  // lines that make the round trip total.
  lines.push(`## ${METADATA_TITLE}`, '');
  lines.push(`- ${META_KEYS.mode}: ${META_MODE[mode] || META_MODE.freeform}`);
  if (mode === 'deckbuilding' && ruleset) {
    if (META_SIDE[ruleset.side]) lines.push(`- ${META_KEYS.side}: ${META_SIDE[ruleset.side]}`);
    if (META_LENGTH[ruleset.length]) lines.push(`- ${META_KEYS.length}: ${META_LENGTH[ruleset.length]}`);
  }
  lines.push('');
```

Le reste de la fonction (notes, sections) ne change pas.

- [ ] **Step 4 : brancher l'appelant**

Dans `web/src/components/ExportDialog.jsx:90` :

```js
        const text = buildDeckListText(cardsById, quantities, deck.name, listLang, { zones, notes: deck.notes, mode: deck.mode, ruleset: deck.ruleset });
```

- [ ] **Step 5 : réparer les fixtures d'aller-retour**

`test/deckList.test.js` contient des assertions sur le texte produit. Le bloc `## Metadata` s'y ajoute : mettre à jour les chaînes attendues. **L'assertion d'aller-retour reste et reste le garde-fou** — ne pas la supprimer, ne pas la relâcher.

```bash
npx vitest run test/deckList.test.js
```

Attendu : SUCCÈS.

- [ ] **Step 6 : commit**

```bash
git add web/src/lib/deckList.js web/src/components/ExportDialog.jsx test/deckList.test.js
git commit -m "feat: the text export carries the deck's mode, side and game length"
```

---

## Task 4 : `import/normalize.js` et `import/line.js`

**Files:**
- Create: `web/src/lib/import/normalize.js`, `web/src/lib/import/line.js`
- Test: `test/importLine.test.js`

**Interfaces:**
- Produces: `normalizeName(s) → string` ; `stripDecoration(s) → string` ; `parseLineCandidates(raw) → Array<{ qty: number, name: string, hints: string[] }>`, **la plus décapée d'abord, la moins décapée en dernier**.

> **Invariant à ne pas casser :** la **dernière** lecture candidate reproduit exactement l'ancien `parseLine` (quantité en tête seulement, rien en queue). C'est ce qui permet à la façade de garder `qty`/`name` inchangés en Task 8 et à `test/importDeck.test.js` de passer sans être modifié.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `test/importLine.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { normalizeName } from '../web/src/lib/import/normalize.js';
import { stripDecoration, parseLineCandidates } from '../web/src/lib/import/line.js';

const best = (s) => parseLineCandidates(s)[0];
const last = (s) => parseLineCandidates(s).slice(-1)[0];

describe('normalizeName', () => {
  it('reduces a name to bare alphanumerics, so accents and punctuation cannot miss a match', () => {
    expect(normalizeName('Bûrat')).toBe('burat');
    expect(normalizeName('Burat')).toBe('burat');
    expect(normalizeName("Thrór’s Map")).toBe('throrsmap');
    expect(normalizeName('Star-glass')).toBe('starglass');
    expect(normalizeName('Beorn & Co')).toBe('beornandco');
  });
});

describe('stripDecoration', () => {
  it('drops bullets and enumerators, including one after the other', () => {
    expect(stripDecoration('- Bûrat')).toBe('Bûrat');
    expect(stripDecoration('* Bûrat')).toBe('Bûrat');
    expect(stripDecoration('• Bûrat')).toBe('Bûrat');
    expect(stripDecoration('1. Bûrat')).toBe('Bûrat');
    expect(stripDecoration('2) Bûrat')).toBe('Bûrat');
    expect(stripDecoration('- 1) Bûrat')).toBe('Bûrat');
  });

  it('unwraps markdown emphasis only when it wraps the whole line', () => {
    expect(stripDecoration('**Bûrat**')).toBe('Bûrat');
    expect(stripDecoration('_Bûrat_')).toBe('Bûrat');
    expect(stripDecoration('`Bûrat`')).toBe('Bûrat');
    expect(stripDecoration('Doors of *Night*')).toBe('Doors of *Night*');
  });
});

describe('parseLineCandidates — quantity in front', () => {
  it('reads every spelling of a leading quantity', () => {
    for (const s of ['3 Bûrat', '3x Bûrat', '3X Bûrat', '3 x Bûrat', '3× Bûrat']) {
      expect(best(s)).toMatchObject({ qty: 3, name: 'Bûrat' });
    }
  });

  it('defaults to one copy', () => {
    expect(best('Bûrat')).toMatchObject({ qty: 1, name: 'Bûrat' });
  });

  it('an enumerator is never read as a quantity', () => {
    expect(best('2. Beautiful Gold Ring')).toMatchObject({ qty: 1, name: 'Beautiful Gold Ring' });
    expect(best('1) 3x Bûrat')).toMatchObject({ qty: 3, name: 'Bûrat' });
  });
});

describe('parseLineCandidates — quantity at the end', () => {
  it('reads every spelling of a trailing quantity', () => {
    for (const s of ['Bûrat (1x)', 'Bûrat [1]', 'Bûrat x1', 'Bûrat - 1', 'Bûrat -1x', 'Bûrat 1']) {
      expect(best(s)).toMatchObject({ qty: 1, name: 'Bûrat' });
    }
    expect(best('Bûrat - 2')).toMatchObject({ qty: 2, name: 'Bûrat' });
    expect(best('Bûrat -2x')).toMatchObject({ qty: 2, name: 'Bûrat' });
  });

  it('keeps the un-peeled reading as a fallback, so a name ending in a digit can still win', () => {
    const cands = parseLineCandidates('Bûrat 2');
    expect(cands[0]).toMatchObject({ qty: 2, name: 'Bûrat' });
    expect(cands.some((c) => c.name === 'Bûrat 2' && c.qty === 1)).toBe(true);
  });
});

describe('parseLineCandidates — parenthetical hints', () => {
  it('peels a hint off the name and keeps it for the resolver', () => {
    expect(best('Angmarim (AS)')).toMatchObject({ qty: 1, name: 'Angmarim', hints: ['AS'] });
    expect(best('2x Angmarim (AS-58)')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS-58'] });
    expect(best("Angmarim (Contre l'Ombre)")).toMatchObject({ name: 'Angmarim', hints: ["Contre l'Ombre"] });
  });

  it('a parenthesis holding only a quantity is a quantity, not a hint', () => {
    expect(best('Bûrat (2x)')).toMatchObject({ qty: 2, name: 'Bûrat', hints: [] });
  });

  it('reads a hint and a trailing quantity together, in either order', () => {
    expect(best('Angmarim (AS) x2')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS'] });
    expect(best('Angmarim x2 (AS)')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS'] });
  });
});

describe('parseLineCandidates — the facade contract', () => {
  it('the LAST candidate is always the old parseLine reading: leading quantity only', () => {
    expect(last('Bûrat - 2')).toMatchObject({ qty: 1, name: 'Bûrat - 2' });
    expect(last('3x Angmarim (AS)')).toMatchObject({ qty: 3, name: 'Angmarim (AS)' });
    expect(last('Doors of Night')).toMatchObject({ qty: 1, name: 'Doors of Night' });
  });

  it('a quantity of zero or less floors at one', () => {
    expect(best('0x Bûrat')).toMatchObject({ qty: 1, name: 'Bûrat' });
  });
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/importLine.test.js
```

Attendu : ÉCHEC, les modules n'existent pas.

- [ ] **Step 3 : écrire `normalize.js`**

```js
// Aggressive normalization for full-name matching so a pasted list is
// forgiving. Beyond accents and case, it makes these equivalent:
//   - hyphen vs space vs underscore ("star-glass" = "star glass")
//   - apostrophes/quotes/punctuation ("Thrór's Map" = "thrors map")
//   - "&" and "and", common ligatures (oe, ae, ss)
//
// It lives alone in a leaf module with no imports on purpose: the facade
// (importDeck.js) re-exports it while also importing the vocabulary, and the
// vocabulary needs it -- routing it through the facade would be a cycle.
//
// The combining-mark range is written with explicit \u escapes: literal
// combining marks are destroyed by a copy-paste and the strip then stops
// working silently.
export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
```

- [ ] **Step 4 : écrire `line.js`**

```js
// One pasted line -> the readings the resolver may choose from.
//
// The module deliberately does NOT decide between them. "Bûrat 2" is either
// two copies of Bûrat or one copy of a card called "Bûrat 2"; punctuation
// cannot settle that, but cards.json can. So this returns candidates, most
// peeled first, and resolve.js keeps the first that matches a real card.
//
// INVARIANT: the LAST candidate reproduces the pre-refactor parseLine exactly
// -- leading quantity only, nothing peeled off the end. importDeck.js's
// facade exposes it as `qty`/`name`, which is what lets test/importDeck.test.js
// pass untouched.

// A bullet needs the trailing space, so "*Bûrat*" stays emphasis rather than
// becoming a bullet.
const BULLET = /^[-*+•]\s+/;
// "1." and "2)" are enumerators and are dropped. "1" and "1x" are quantities.
// Nobody writes "3. Bûrat" meaning three copies; they write "3 Bûrat".
const ENUMERATOR = /^\d+[.)]\s+/;

const LEAD_QTY_MARKED = /^(\d+)\s*[x×]\s*(.+)$/i;
const LEAD_QTY_BARE = /^(\d+)\s+(.+)$/;

// A trailing "(...)" or "[...]" — either a quantity or a hint, decided below.
const TRAIL_GROUP = /^(.*?)\s*[([]([^)\]]*)[)\]]$/;
// A trailing bare quantity, optionally introduced by a dash: "- 2", "-2x", "x2", "2".
const TRAIL_QTY = /^(.*?)\s*(?:[-–—]\s*)?(?:x\s*(\d+)|(\d+)\s*[x×]?)$/i;
// The whole content of a group, when it is nothing but a quantity.
const ONLY_QTY = /^\s*(?:x\s*(\d+)|(\d+)\s*[x×]?)\s*$/i;

export function stripDecoration(s) {
  let out = String(s || '').trim();
  // Twice: a bullet may precede an enumerator ("- 1) Bûrat") and the reverse.
  for (let i = 0; i < 2; i += 1) out = out.replace(BULLET, '').replace(ENUMERATOR, '').trim();
  for (const wrap of [/^\*\*(.+)\*\*$/, /^__(.+)__$/, /^\*(.+)\*$/, /^_(.+)_$/, /^`(.+)`$/]) {
    const m = out.match(wrap);
    if (m) { out = m[1].trim(); break; }
  }
  return out;
}

const floor1 = (n) => (Number.isFinite(n) && n > 0 ? n : 1);

export function parseLineCandidates(raw) {
  const body = stripDecoration(raw);

  // Leading quantity, extracted once and shared by every candidate.
  let qty = 1;
  let rest = body;
  const lead = body.match(LEAD_QTY_MARKED) || body.match(LEAD_QTY_BARE);
  if (lead) { qty = floor1(parseInt(lead[1], 10)); rest = lead[2].trim(); }

  // The un-peeled reading. Built first, appended last: it is the fallback.
  const baseline = { qty, name: rest, hints: [] };

  const peeled = [];
  let name = rest;
  let hints = [];
  let cur = qty;

  // Peel one trailing group at a time, emitting a candidate after each peel.
  // Guarded against an empty name so "(2x)" alone cannot peel itself to "".
  for (let guard = 0; guard < 6; guard += 1) {
    const g = name.match(TRAIL_GROUP);
    if (g && g[1].trim()) {
      const inner = g[2].trim();
      const only = inner.match(ONLY_QTY);
      if (only) cur = floor1(parseInt(only[1] || only[2], 10));
      else hints = [inner, ...hints];
      name = g[1].trim();
      peeled.push({ qty: cur, name, hints: [...hints] });
      continue;
    }
    const q = name.match(TRAIL_QTY);
    if (q && q[1].trim()) {
      cur = floor1(parseInt(q[2] || q[3], 10));
      name = q[1].trim();
      peeled.push({ qty: cur, name, hints: [...hints] });
      continue;
    }
    break;
  }

  // Most peeled first, baseline last.
  return [...peeled.reverse(), baseline];
}
```

- [ ] **Step 5 : vérifier que ça passe**

```bash
npx vitest run test/importLine.test.js
```

Attendu : SUCCÈS. En cas d'échec sur `'Angmarim x2 (AS)'`, vérifier l'ordre de la boucle : le groupe parenthésé se décape avant la quantité nue, et la boucle repasse.

- [ ] **Step 6 : commit**

```bash
git add web/src/lib/import/normalize.js web/src/lib/import/line.js test/importLine.test.js
git commit -m "feat: a pasted line yields candidate readings, not one guess"
```

---

## Task 5 : `import/vocabulary.js`

**Files:**
- Create: `web/src/lib/import/vocabulary.js`
- Test: `test/importVocabulary.test.js`

**Interfaces:**
- Consumes: `normalizeName` (Task 4) ; `SECTION_TITLES`, `GROUP_TITLES`, `NOTE_TITLES`, `METADATA_TITLE`, `META_KEYS` (Task 3).
- Produces: `lookupHeading(rawLine) → null | { family, zone?, type?, field? }` avec `family ∈ { 'zone', 'group', 'notes', 'meta' }` ; `lookupMetaKey(word) → null | 'mode' | 'side' | 'length'` ; `parseMetaValue(field, raw) → string | null` ; `HEADINGS` (Map, exportée pour le test d'unicité).

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `test/importVocabulary.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { lookupHeading, lookupMetaKey, parseMetaValue, HEADINGS } from '../web/src/lib/import/vocabulary.js';

describe('lookupHeading — a heading is its content, not its markdown level', () => {
  it('reads the same word through every wrapping', () => {
    for (const s of ['## Talon', '### Talon', 'Talon', 'Talon :', 'Talon:', '**Talon**', '# Talon']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'sideboard' });
    }
  });

  it('ignores accents and case, so "Reserve" and "RÉSERVE" are one word', () => {
    for (const s of ['Réserve', 'reserve', 'RÉSERVE']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'pool' });
    }
  });

  it('drops a trailing count, which our own exports write', () => {
    expect(lookupHeading('### Characters (12)')).toMatchObject({ family: 'group', type: 'Character' });
  });

  it('routes every zone word to its zone, in the three languages', () => {
    expect(lookupHeading('Play deck')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Pioche')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Mazo de juego')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Sideboard')).toMatchObject({ zone: 'sideboard' });
    expect(lookupHeading('Pool')).toMatchObject({ zone: 'pool' });
    expect(lookupHeading('Reserva')).toMatchObject({ zone: 'pool' });
    // The location deck is not a zone of its own: it lives in `quantities`,
    // and play deck vs locations is derived from the card type.
    expect(lookupHeading('Locations')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Lieux')).toMatchObject({ zone: 'quantities' });
  });

  it('"Deck" alone is the play deck, which is why the metadata block is not called that', () => {
    expect(lookupHeading('Deck')).toMatchObject({ family: 'zone', zone: 'quantities' });
    expect(lookupHeading('Metadata')).toMatchObject({ family: 'meta' });
  });

  it('a group heading carries a TYPE_ORDER value, or none at all', () => {
    expect(lookupHeading('Hazards')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Périls')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Peligros')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Minor objects')).toMatchObject({ family: 'group', type: 'Resource' });
    expect(lookupHeading('Stage events')).toMatchObject({ family: 'group', type: 'Resource' });
    // Avatars and Other do not reduce to one type: no hint beats a false hint.
    expect(lookupHeading('Avatars')).toMatchObject({ family: 'group', type: null });
    expect(lookupHeading('Other')).toMatchObject({ family: 'group', type: null });
  });

  it('note headings select a field when they name one, and none when generic', () => {
    expect(lookupHeading('Notes')).toMatchObject({ family: 'notes', field: null });
    expect(lookupHeading('Description')).toMatchObject({ family: 'notes', field: null });
    expect(lookupHeading('Resource strategy')).toMatchObject({ family: 'notes', field: 'resourceStrategy' });
    expect(lookupHeading('Stratégie ressources')).toMatchObject({ family: 'notes', field: 'resourceStrategy' });
  });

  it('an unknown heading is not a heading', () => {
    expect(lookupHeading('Plan de jeu')).toBe(null);
    expect(lookupHeading('3x Bûrat')).toBe(null);
    expect(lookupHeading('')).toBe(null);
  });
});

describe('HEADINGS — one reading per word', () => {
  it('no normalized word belongs to two families', () => {
    // This is the assertion that would have caught "Deck" being both the play
    // deck and the metadata block heading.
    const seen = new Map();
    for (const [word, entry] of HEADINGS) {
      expect(seen.has(word)).toBe(false);
      seen.set(word, entry);
    }
    expect(seen.size).toBe(HEADINGS.size);
  });
});

describe('metadata keys and values', () => {
  it('reads the key in the three languages', () => {
    expect(lookupMetaKey('Mode')).toBe('mode');
    expect(lookupMetaKey('Side')).toBe('side');
    expect(lookupMetaKey('Camp')).toBe('side');
    expect(lookupMetaKey('Bando')).toBe('side');
    expect(lookupMetaKey('Game length')).toBe('length');
    expect(lookupMetaKey('Longueur de partie')).toBe('length');
    expect(lookupMetaKey('Nimportequoi')).toBe(null);
  });

  it('accepts the canonical value, the raw id and the localized label', () => {
    expect(parseMetaValue('side', 'Balrog')).toBe('balrog');
    expect(parseMetaValue('side', 'balrog')).toBe('balrog');
    expect(parseMetaValue('side', "Spectre de l'Anneau")).toBe('ringwraith');
    expect(parseMetaValue('side', 'Espectro del Anillo')).toBe('ringwraith');
    expect(parseMetaValue('mode', 'Deckbuilding')).toBe('deckbuilding');
    expect(parseMetaValue('mode', 'Libre')).toBe('freeform');
    expect(parseMetaValue('length', 'Standard')).toBe('standard');
    // length.standard displays as "Short" in all three languages -- the label
    // and the canonical value differ, and both must resolve.
    expect(parseMetaValue('length', 'Short')).toBe('standard');
    expect(parseMetaValue('length', 'Campagne')).toBe('campaign');
    expect(parseMetaValue('side', 'Nimportequoi')).toBe(null);
  });
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/importVocabulary.test.js
```

Attendu : ÉCHEC, le module n'existe pas.

- [ ] **Step 3 : implémenter**

Créer `web/src/lib/import/vocabulary.js` :

```js
// What a heading line means. Four families:
//   zone   -- changes the target zone
//   group  -- does NOT change the zone; posts a type hint for disambiguation
//   notes  -- switches to notes mode; no line is ever read as a card again
//   meta   -- "Key: Value" lines; never read as a card either
//
// A heading is recognised by its NORMALIZED CONTENT, never by its markdown
// level: "## Talon", "### Talon", "Talon:" and "**Talon**" are one heading.
// That is what lets sections arrive in any order and in any formatting.
//
// The canonical English titles are IMPORTED from deckList.js rather than
// copied, so the writer and the reader of our own export format can never
// drift apart.
//
// TRAP, from ARCHITECTURE.md §9: "réserve" changed referent on 2026-07-29 --
// it used to mean the sideboard and now means the pool. This table holds the
// CURRENT meaning only. That is a decision, not an oversight: no hand-written
// list uses the old sense. Do not "fix" this by adding the old one.
import { normalizeName } from './normalize.js';
import { SECTION_TITLES, GROUP_TITLES, NOTE_TITLES, METADATA_TITLE, META_KEYS } from '../deckList.js';

const zone = (z) => ({ family: 'zone', zone: z });
const group = (type) => ({ family: 'group', type });
const notes = (field) => ({ family: 'notes', field });
const meta = () => ({ family: 'meta' });

// Localized words are taken from i18n.js (zones.*, zoneShort.*,
// panel.group.*, notes.*) and not written from memory, so the parser's
// vocabulary and the interface's cannot diverge.
const TABLE = [
  // -- zone: play deck. `quantities` also holds the location deck; play deck
  // vs locations is derived from the card type (ARCHITECTURE.md §4), so both
  // point here.
  [['Playdeck', 'Play deck', 'Deck', 'Main deck', 'Maindeck', 'Pioche', 'Mazo', 'Mazo de juego', 'Baraja', SECTION_TITLES.play], zone('quantities')],
  [['Locations', 'Location deck', 'Location', 'Site deck', 'Lieux', 'Localizaciones', SECTION_TITLES.locations], zone('quantities')],
  // -- zone: sideboard. Spanish keeps the English word (i18n zones.sideboard).
  [['Sideboard', 'Side', 'SB', 'Talon', SECTION_TITLES.sideboard], zone('sideboard')],
  // -- zone: pool
  [['Pool', 'Starting pool', 'Réserve', 'Reserva', SECTION_TITLES.pool], zone('pool')],

  // -- groups: the hint is always a TYPE_ORDER value, never a finer category.
  [['Characters', 'Personnages', 'Personajes', GROUP_TITLES.characters], group('Character')],
  [['Resources', 'Ressources', 'Recursos', GROUP_TITLES.resources], group('Resource')],
  [['Hazards', 'Périls', 'Peligros', GROUP_TITLES.hazards], group('Hazard')],
  [['Sites', 'Sitios', GROUP_TITLES.sites], group('Site')],
  [['Regions', 'Régions', 'Regiones', GROUP_TITLES.regions], group('Region')],
  [['Minor objects', 'Minor items', 'Objets mineurs', 'Objetos menores'], group('Resource')],
  [['Stage events', 'Permanent events', 'Progressions', 'Eventos de etapa'], group('Resource')],
  // No type hint: these do not reduce to one type, and no hint beats a wrong one.
  [['Avatars', 'Avatares', GROUP_TITLES.avatars], group(null)],
  [['Other', 'Autres', 'Otros', GROUP_TITLES.other], group(null)],

  // -- notes: generic openers select no field; named ones select theirs.
  [['Notes', 'Notas', 'Description', 'Descripción', 'Strategy', 'Stratégie', 'Estrategia',
    'Comments', 'Commentaires', 'Comentarios', 'Intro', 'Introduction', 'Introducción',
    'Overview', 'Résumé', 'Resumen'], notes(null)],
  [[NOTE_TITLES.starting, 'Notes de départ', 'Notas iniciales'], notes('starting')],
  [[NOTE_TITLES.resourceStrategy, 'Stratégie ressources', 'Estrategia de recursos'], notes('resourceStrategy')],
  [[NOTE_TITLES.hazardStrategy, 'Stratégie périls', 'Estrategia de peligros'], notes('hazardStrategy')],
  [[NOTE_TITLES.other, 'Autres notes', 'Otras notas'], notes('other')],

  // -- metadata. NOT "Deck": that word is already the play deck above.
  [[METADATA_TITLE, 'Métadonnées', 'Deck info', 'Infos', 'Información'], meta()],
];

export const HEADINGS = new Map();
for (const [words, entry] of TABLE) {
  for (const w of words) {
    const key = normalizeName(w);
    // First writer wins, so a canonical title repeated in its own list (e.g.
    // GROUP_TITLES.sites === 'Sites') is a no-op rather than a duplicate.
    if (key && !HEADINGS.has(key)) HEADINGS.set(key, entry);
  }
}

// Strip the markdown level, a trailing colon and a trailing "(12)" count --
// the last one is what our own exports write on group headings.
function headingWord(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
    .replace(/\s*:\s*$/, '')
    .trim();
}

export function lookupHeading(raw) {
  const word = headingWord(raw);
  if (!word) return null;
  return HEADINGS.get(normalizeName(word)) || null;
}

// -- metadata keys and values -------------------------------------------------
// Keys use i18n's setup.side / setup.length wording; note that setup.length in
// English is already "Game length", the canonical key.
const META_KEY_WORDS = [
  [[META_KEYS.mode, 'Mode', 'Modo'], 'mode'],
  [[META_KEYS.side, 'Side', 'Camp', 'Bando'], 'side'],
  [[META_KEYS.length, 'Game length', 'Length', 'Longueur', 'Longueur de partie', 'Duración', 'Duración de partida'], 'length'],
];

const META_KEY_BY_WORD = new Map();
for (const [words, field] of META_KEY_WORDS) {
  for (const w of words) META_KEY_BY_WORD.set(normalizeName(w), field);
}

export function lookupMetaKey(raw) {
  return META_KEY_BY_WORD.get(normalizeName(raw)) || null;
}

// Accept the canonical English value, the raw id, and the localized label.
// `length.standard` displays as "Short" in all three languages while its
// canonical value is "Standard" -- both have to resolve, which is exactly why
// this is a table and not a toLowerCase().
const META_VALUES = {
  mode: [
    [['Freeform', 'freeform', 'Libre'], 'freeform'],
    [['Deckbuilding', 'deckbuilding'], 'deckbuilding'],
  ],
  side: [
    [['Wizard', 'wizard', 'Sorcier', 'Mago'], 'wizard'],
    [['Ringwraith', 'ringwraith', "Spectre de l'Anneau", 'Espectro del Anillo'], 'ringwraith'],
    [['Fallen-wizard', 'fallen-wizard', 'Sorcier déchu', 'Mago caído'], 'fallen-wizard'],
    [['Balrog', 'balrog'], 'balrog'],
  ],
  length: [
    [['Starter', 'starter'], 'starter'],
    [['Standard', 'standard', 'Short'], 'standard'],
    [['Long', 'long', 'Longue', 'Larga'], 'long'],
    [['Campaign', 'campaign', 'Campagne', 'Campaña'], 'campaign'],
  ],
};

const META_VALUE_INDEX = {};
for (const [field, rows] of Object.entries(META_VALUES)) {
  META_VALUE_INDEX[field] = new Map();
  for (const [words, id] of rows) {
    for (const w of words) META_VALUE_INDEX[field].set(normalizeName(w), id);
  }
}

export function parseMetaValue(field, raw) {
  const idx = META_VALUE_INDEX[field];
  if (!idx) return null;
  return idx.get(normalizeName(raw)) || null;
}
```

- [ ] **Step 4 : vérifier que ça passe**

```bash
npx vitest run test/importVocabulary.test.js
```

Attendu : SUCCÈS. **Si le test d'unicité échoue**, c'est une vraie collision : deux familles revendiquent le même mot normalisé. Résous-la en retirant le mot de la famille la moins probable, comme `Deck` l'a été pour metadata — ne la contourne pas en relâchant le test.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/import/vocabulary.js test/importVocabulary.test.js
git commit -m "feat: section headings recognized by content, in three languages"
```

---

## Task 6 : `import/document.js`

**Files:**
- Create: `web/src/lib/import/document.js`
- Test: `test/importDocument.test.js`

**Interfaces:**
- Consumes: `parseLineCandidates` (Task 4) ; `lookupHeading`, `lookupMetaKey`, `parseMetaValue` (Task 5).
- Produces: `parseDocument(text) → { name, meta, notes, lines }` où `meta = { mode, side, length }` (valeurs `null` si absentes), `notes = { starting, resourceStrategy, hazardStrategy, other }`, et `lines = Array<{ raw, qty, name, target, typeHint, candidates }>` — `qty`/`name` recopiant la **dernière** lecture candidate.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `test/importDocument.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { parseDocument } from '../web/src/lib/import/document.js';

const at = (doc, name) => doc.lines.find((l) => l.candidates[0].name === name);

describe('parseDocument — zones', () => {
  it('a headingless list is all play deck, exactly as before', () => {
    const doc = parseDocument('3x Bûrat\n2x Beautiful Gold Ring');
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines.every((l) => l.target === 'quantities')).toBe(true);
  });

  it('routes each section to its zone, in any order', () => {
    const doc = parseDocument([
      '## Talon', '1x Bûrat',
      '## Réserve', '1x Beautiful Gold Ring',
      '## Pioche', '1x Doors of Night',
    ].join('\n'));
    expect(at(doc, 'Bûrat').target).toBe('sideboard');
    expect(at(doc, 'Beautiful Gold Ring').target).toBe('pool');
    expect(at(doc, 'Doors of Night').target).toBe('quantities');
  });

  it('a group heading posts a type hint without changing the zone', () => {
    const doc = parseDocument(['## Sideboard', '### Hazards', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat')).toMatchObject({ target: 'sideboard', typeHint: 'Hazard' });
  });

  it('an unknown heading goes to the notes and leaves the zone alone', () => {
    const doc = parseDocument(['## Talon', 'Plan de jeu', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat').target).toBe('sideboard');
    expect(doc.notes.other).toContain('Plan de jeu');
  });

  it('a zone heading clears the previous type hint', () => {
    const doc = parseDocument(['### Hazards', '## Pool', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat')).toMatchObject({ target: 'pool', typeHint: null });
  });
});

describe('parseDocument — nothing is lost', () => {
  it('prose with no quantity and no match becomes notes, not a card line', () => {
    const doc = parseDocument('Contrôler les havres tôt\n3x Bûrat');
    expect(doc.lines).toHaveLength(1);
    expect(doc.notes.other).toContain('Contrôler les havres tôt');
  });

  it('a line WITH an explicit quantity stays a card line, so a typo is still reported', () => {
    const doc = parseDocument('3x Machinchose');
    expect(doc.lines).toHaveLength(1);
    expect(doc.notes.other).toBe('');
  });

  it('notes mode is absolute: even "3x Gandalf is the plan" is never a card line', () => {
    const doc = parseDocument(['## Notes', '3x Gandalf is the plan'].join('\n'));
    expect(doc.lines).toHaveLength(0);
    expect(doc.notes.other).toContain('3x Gandalf is the plan');
  });

  it('a named note heading routes to its own field', () => {
    const doc = parseDocument(['## Notes', '### Resource strategy', 'ramper sur les objets'].join('\n'));
    expect(doc.notes.resourceStrategy).toBe('ramper sur les objets');
  });

  it('notes can open the document or close it', () => {
    const first = parseDocument(['Notes:', 'un plan', '## Pioche', '1x Bûrat'].join('\n'));
    expect(first.notes.other).toContain('un plan');
    expect(first.lines).toHaveLength(1);

    const last = parseDocument(['## Pioche', '1x Bûrat', 'Description', 'un plan'].join('\n'));
    expect(last.notes.other).toContain('un plan');
    expect(last.lines).toHaveLength(1);
  });
});

describe('parseDocument — title and metadata', () => {
  it('reads the deck name off the title line', () => {
    expect(parseDocument('# Mon deck\n\n1x Bûrat').name).toBe('Mon deck');
  });

  it('a "# " line after the first heading is note text, not a second title', () => {
    const doc = parseDocument(['# Mon deck', '## Notes', '# 1 objectif : ramper'].join('\n'));
    expect(doc.name).toBe('Mon deck');
    expect(doc.notes.other).toContain('# 1 objectif : ramper');
  });

  it('reads the metadata block, and never as cards', () => {
    const doc = parseDocument([
      '# Mon deck', '## Metadata',
      '- Mode: Deckbuilding', '- Side: Balrog', '- Game length: Standard',
      '## Pioche', '1x Bûrat',
    ].join('\n'));
    expect(doc.meta).toEqual({ mode: 'deckbuilding', side: 'balrog', length: 'standard' });
    expect(doc.lines).toHaveLength(1);
  });

  it('reads a hand-written localized block', () => {
    const doc = parseDocument(['Infos', 'Camp : Spectre de l’Anneau', 'Longueur de partie : Campagne'].join('\n'));
    expect(doc.meta.side).toBe('ringwraith');
    expect(doc.meta.length).toBe('campaign');
  });

  it('an unknown metadata key is ignored, not turned into a card', () => {
    const doc = parseDocument(['## Metadata', '- Auteur: Pablo'].join('\n'));
    expect(doc.meta).toEqual({ mode: null, side: null, length: null });
    expect(doc.lines).toHaveLength(0);
  });
});

describe('parseDocument — the facade contract', () => {
  it('qty/name mirror the LAST candidate, which is the pre-refactor reading', () => {
    const doc = parseDocument('Bûrat - 2');
    expect(doc.lines[0]).toMatchObject({ qty: 1, name: 'Bûrat - 2' });
    expect(doc.lines[0].candidates[0]).toMatchObject({ qty: 2, name: 'Bûrat' });
  });
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/importDocument.test.js
```

Attendu : ÉCHEC, le module n'existe pas.

- [ ] **Step 3 : implémenter**

Créer `web/src/lib/import/document.js` :

```js
// Turn a pasted document into { name, meta, notes, lines }.
//
// Four pieces of state: the target zone, the type hint, the mode
// (cards | notes | meta) and, in notes mode, the field being filled.
//
// Two guarantees this file exists to keep:
//
// 1. NOTES MODE IS ABSOLUTE. Once in it, no line is ever handed to the card
//    parser -- not even one shaped exactly like "3x Gandalf". A note reading
//    "3x Gandalf is the plan" must not import three Gandalfs.
//
// 2. NOTHING IS LOST. A line with no explicit quantity that matches no card is
//    prose, and prose goes to the notes. A line WITH an explicit quantity
//    stays a card line even when it matches nothing, because the intent there
//    was plainly a card and a typo must still be reported.
//
// An UNKNOWN heading goes to the notes and LEAVES THE ZONE ALONE. The previous
// implementation reset the target to the main deck on any unrecognised "##",
// so a "Plan de jeu" written inside the sideboard sent every following card
// back to the play deck.
import { parseLineCandidates } from './line.js';
import { lookupHeading, lookupMetaKey, parseMetaValue } from './vocabulary.js';

const NOTE_FIELDS = ['starting', 'resourceStrategy', 'hazardStrategy', 'other'];

// "- Side: Balrog" / "Camp : Balrog" / "Side = Balrog"
const META_LINE = /^\s*[-*+•]?\s*([^:=]+)\s*[:=]\s*(.+)\s*$/;

export function parseDocument(text) {
  const notes = { starting: '', resourceStrategy: '', hazardStrategy: '', other: '' };
  const buf = { starting: [], resourceStrategy: [], hazardStrategy: [], other: [] };
  const meta = { mode: null, side: null, length: null };
  const lines = [];

  let mode = 'cards';
  let target = 'quantities';
  let typeHint = null;
  let noteField = null;
  let name = '';
  let sawHeading = false;

  const pushNote = (s) => { buf[noteField || 'other'].push(s); };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();

    if (!line) {
      // A blank line inside a note is that note's own paragraph break.
      if (mode === 'notes') pushNote('');
      continue;
    }

    // The deck title: only before the first recognised heading, so a note
    // body reading "# 1 objectif : ramper" round-trips instead of vanishing.
    if (!sawHeading && !name && /^#\s+/.test(line) && !lookupHeading(line)) {
      name = line.replace(/^#\s+/, '').trim();
      continue;
    }

    const heading = lookupHeading(line);
    if (heading) {
      sawHeading = true;
      if (heading.family === 'zone') {
        mode = 'cards'; target = heading.zone; typeHint = null; noteField = null;
      } else if (heading.family === 'group') {
        // Does NOT change the zone. Only the hint.
        mode = 'cards'; typeHint = heading.type || null; noteField = null;
      } else if (heading.family === 'notes') {
        mode = 'notes';
        noteField = NOTE_FIELDS.includes(heading.field) ? heading.field : null;
      } else {
        mode = 'meta'; noteField = null;
      }
      continue;
    }

    if (mode === 'notes') { pushNote(line); continue; }

    if (mode === 'meta') {
      const m = line.match(META_LINE);
      const key = m && lookupMetaKey(m[1]);
      if (key) {
        const value = parseMetaValue(key, m[2]);
        if (value) meta[key] = value;
      }
      // An unrecognised key is dropped rather than becoming a card or a note:
      // inside a metadata block, a "Key: Value" line is metadata by position.
      continue;
    }

    // Every non-heading line in cards mode becomes a card line here. Prose is
    // NOT separated out at this stage: telling "Contrôler les havres tôt"
    // from a bare card name requires the card index, which this module does
    // not have and must not grow. resolve.js does that split.
    const candidates = parseLineCandidates(line);
    const baseline = candidates[candidates.length - 1];
    if (!baseline.name) continue;
    lines.push({ raw: line, qty: baseline.qty, name: baseline.name, target, typeHint, candidates });
  }

  for (const f of NOTE_FIELDS) notes[f] = buf[f].join('\n').trim();
  return { name, meta, notes, lines };
}
```

> **Attention, point subtil.** `document.js` n'a pas d'index de cartes : il ne *peut pas* savoir si « Contrôler les havres tôt » est de la prose. La séparation prose / carte est donc faite par `resolve.js` (Task 7), qui a l'index, et qui renvoie les lignes rejetées pour que l'appelant les verse dans les notes. Le test « prose devient notes » de la Step 1 ci-dessus **échouera** tant que Task 7 n'est pas faite.
>
> **Fais ceci :** en Step 1, marque les deux tests concernés — « prose with no quantity and no match becomes notes » et « a line WITH an explicit quantity stays a card line » — avec `it.todo(...)` au lieu de `it(...)`, et réactive-les en Task 7 Step 5, où l'assemblage complet existe. Tous les autres tests de ce fichier doivent passer dès maintenant.

- [ ] **Step 4 : vérifier que ça passe**

```bash
npx vitest run test/importDocument.test.js
```

Attendu : SUCCÈS, avec deux `todo` en attente.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/import/document.js test/importDocument.test.js
git commit -m "feat: a document parser where sections may arrive in any order"
```

---

## Task 7 : `import/resolve.js`

**Files:**
- Create: `web/src/lib/import/resolve.js`
- Modify: `test/importDocument.test.js` (réactiver les deux `it.todo`)
- Test: `test/importResolve.test.js`

**Interfaces:**
- Consumes: `normalizeName` (Task 4) ; `ALIGNMENT_PREFERENCES`, `preferredMatchId` (aujourd'hui dans `importDeck.js`, **déplacés ici** en Task 8 — écris-les ici dès maintenant et laisse la façade les ré-exporter) ; `SIDES` (`rules/sides.js`).
- Produces: `buildNameIndex(cards, extraLang) → Map<string, card[]>` ; `PREF_BY_SIDE` ; `classifyHint(text, ctx) → { kind, value }` ; `resolveLines(lines, ctx) → { resolved, prose }` où `ctx = { nameIndex, cardsById, setNames, side, alignPref }`. `alignPref` n'est lu **que** lorsque `side` est nul : c'est le chemin freeform, où il n'y a pas de camp d'où déduire.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `test/importResolve.test.js` :

```js
import { describe, it, expect } from 'vitest';
import { buildNameIndex, resolveLines, PREF_BY_SIDE } from '../web/src/lib/import/resolve.js';
import { parseDocument } from '../web/src/lib/import/document.js';

// Two cards sharing a name, the classic import ambiguity (194 English names
// name more than one card).
const HERO = { id: 'AS-58', setCode: 'AS', type: 'Character', alignment: 'Hero', name: { en: 'Angmarim', fr: 'Angmarim' } };
const MINION = { id: 'AS-62', setCode: 'AS', type: 'Hazard', alignment: 'Minion', name: { en: 'Angmarim', fr: 'Angmarim' } };
const BURAT = { id: 'TW-119', setCode: 'TW', type: 'Character', alignment: 'Hero', name: { en: 'Bûrat', fr: 'Bûrat' } };
const CARDS = [HERO, MINION, BURAT];

const ctx = (over = {}) => ({
  nameIndex: buildNameIndex(CARDS, 'fr'),
  cardsById: new Map(CARDS.map((c) => [c.id, c])),
  setNames: { AS: { en: 'Against the Shadow', fr: "Contre l'Ombre", es: 'Contra la Sombra' } },
  side: null,
  ...over,
});

const one = (text, over) => {
  const doc = parseDocument(text);
  return resolveLines(doc.lines, ctx(over));
};

describe('resolveLines — rank 0, candidate readings', () => {
  it('keeps the reading that matches a real card', () => {
    const { resolved } = one('Bûrat 2');
    expect(resolved[0]).toMatchObject({ status: 'ok', qty: 2 });
    expect(resolved[0].matches[0].id).toBe('TW-119');
  });

  it('matches without accents', () => {
    expect(one('2x Burat').resolved[0].matches[0].id).toBe('TW-119');
  });
});

describe('resolveLines — rank 1, the parenthesis is sovereign', () => {
  it('an id in parentheses decides outright', () => {
    expect(one('1x Angmarim (AS-62)').resolved[0].matches).toHaveLength(1);
    expect(one('1x Angmarim (AS-62)').resolved[0].matches[0].id).toBe('AS-62');
  });

  it('an alignment in parentheses narrows', () => {
    expect(one('1x Angmarim (Hero)').resolved[0].matches[0].id).toBe('AS-58');
  });

  it('a set name or code narrows, in any UI language', () => {
    expect(one("1x Bûrat (Contre l'Ombre)").resolved[0].matches[0].id).toBe('TW-119');
  });

  it('beats the side, even when the result is illegal for it', () => {
    const { resolved } = one('1x Angmarim (Hero)', { side: 'ringwraith' });
    expect(resolved[0].matches[0].id).toBe('AS-58');
  });
});

describe('resolveLines — rank 2, the sub-section', () => {
  it('a group heading narrows by type', () => {
    const { resolved } = one(['### Hazards', '1x Angmarim'].join('\n'));
    expect(resolved[0].matches[0].id).toBe('AS-62');
  });
});

describe('resolveLines — rank 3, the side', () => {
  it('the side narrows by alignment when nothing finer applies', () => {
    expect(one('1x Angmarim', { side: 'ringwraith' }).resolved[0].matches[0].id).toBe('AS-62');
    expect(one('1x Angmarim', { side: 'wizard' }).resolved[0].matches[0].id).toBe('AS-58');
  });

  it('with no side, the ambiguity survives for the player to settle', () => {
    expect(one('1x Angmarim').resolved[0].status).toBe('ambiguous');
  });

  it('maps every side to an alignment preference', () => {
    expect(PREF_BY_SIDE).toEqual({ wizard: 'hero', ringwraith: 'minion', balrog: 'balrog', 'fallen-wizard': 'fallenWizard' });
  });

  it('with no side, the manual preference is what settles it — the freeform path', () => {
    expect(one('1x Angmarim', { alignPref: 'minion' }).resolved[0].matches[0].id).toBe('AS-62');
    expect(one('1x Angmarim', { alignPref: 'hero' }).resolved[0].matches[0].id).toBe('AS-58');
  });

  it('a side supersedes the manual preference rather than fighting it', () => {
    const { resolved } = one('1x Angmarim', { side: 'wizard', alignPref: 'minion' });
    expect(resolved[0].matches[0].id).toBe('AS-58');
  });
});

describe('resolveLines — a rank that would empty the set is ignored', () => {
  it('a wrong hint does not turn an existing card into a missing one', () => {
    const { resolved } = one('1x Bûrat (WH)');
    expect(resolved[0].status).toBe('ok');
    expect(resolved[0].matches[0].id).toBe('TW-119');
  });

  it('a wrong type hint is dropped rather than applied', () => {
    const { resolved } = one(['### Regions', '1x Bûrat'].join('\n'));
    expect(resolved[0].status).toBe('ok');
  });
});

describe('resolveLines — prose', () => {
  it('an unmarked line that matches nothing is prose, and is returned as such', () => {
    const { resolved, prose } = one('Contrôler les havres tôt');
    expect(resolved).toHaveLength(0);
    expect(prose).toEqual(['Contrôler les havres tôt']);
  });

  it('a marked line that matches nothing stays a reported miss', () => {
    const { resolved, prose } = one('3x Machinchose');
    expect(prose).toHaveLength(0);
    expect(resolved[0].status).toBe('notfound');
  });
});
```

- [ ] **Step 2 : vérifier que ça échoue**

```bash
npx vitest run test/importResolve.test.js
```

Attendu : ÉCHEC, le module n'existe pas.

- [ ] **Step 3 : implémenter**

Créer `web/src/lib/import/resolve.js` :

```js
// Resolve parsed lines to cards.
//
// The disambiguation stack, in order. EACH RANK NARROWS the candidate set,
// and IS IGNORED IF IT WOULD EMPTY IT -- a wrong hint must never turn a card
// that exists into a card that does not.
//
//   0. candidate readings  keep the first reading that matches a real card
//   1. parenthesis         id decides outright; set code/name and alignment narrow
//   2. sub-section         narrows by card type
//   3. side                narrows by alignment (ALIGNMENT_PREFERENCES)
//
// Rank 1 is sovereign over rank 3: what is written down beats what is
// inferred, even when the result is illegal for the side. The card is
// imported and marked, never silently swapped.
import { normalizeName } from './normalize.js';

// Alignment preferences for auto-resolving duplicate-name lines. Each maps a
// (lowercased) alignment to a rank; lower = preferred. Alignments absent from
// a table are excluded (never auto-picked).
export const ALIGNMENT_PREFERENCES = {
  hero: { hero: 0, neutral: 1, dual: 1 },
  minion: { minion: 0, neutral: 1, dual: 1 },
  balrog: { balrog: 0, minion: 1, neutral: 2, dual: 2 },
  // Fallen-wizard/Stage win; neutral/dual next; a lone hero *or* minion is
  // acceptable, but a hero+minion pair ties (rank 2) so the player chooses.
  fallenWizard: { 'fallen-wizard': 0, stage: 0, neutral: 1, dual: 1, hero: 2, minion: 2 },
};

export const PREF_BY_SIDE = {
  wizard: 'hero',
  ringwraith: 'minion',
  balrog: 'balrog',
  'fallen-wizard': 'fallenWizard',
};

export function preferredMatchId(matches, preference) {
  const table = ALIGNMENT_PREFERENCES[preference];
  if (!table || !matches || matches.length === 0) return null;
  let bestRank = Infinity;
  let best = [];
  for (const c of matches) {
    const a = String((c && c.alignment) || '').toLowerCase();
    const rank = table[a] !== undefined ? table[a] : Infinity;
    if (rank < bestRank) { bestRank = rank; best = [c]; }
    else if (rank === bestRank && rank !== Infinity) best.push(c);
  }
  if (bestRank === Infinity || best.length !== 1) return null;
  return best[0].id;
}

// Index cards by full name (en and fr, plus `extraLang` when it is a third
// language), normalized. A list exported in Spanish or German still resolves.
export function buildNameIndex(cards, extraLang) {
  const idx = new Map();
  const add = (name, card) => {
    const key = normalizeName(name);
    if (!key) return;
    if (!idx.has(key)) idx.set(key, []);
    const arr = idx.get(key);
    if (!arr.includes(card)) arr.push(card);
  };
  for (const c of cards) {
    add(c.name && c.name.en, c);
    add(c.name && c.name.fr, c);
    if (extraLang && extraLang !== 'en' && extraLang !== 'fr') add(c.name && c.name[extraLang], c);
  }
  return idx;
}

const ALIGNMENTS = ['hero', 'minion', 'neutral', 'dual', 'balrog', 'fallen-wizard', 'stage'];

// What is this parenthetical? Anything unrecognised is `unknown` and is simply
// dropped -- a note in brackets must not break the line it annotates.
export function classifyHint(text, { cardsById, setNames } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return { kind: 'unknown', value: null };
  if (cardsById && cardsById.has(raw.toUpperCase())) return { kind: 'id', value: raw.toUpperCase() };
  const norm = normalizeName(raw);
  if (ALIGNMENTS.includes(norm.replace(/wizard$/, '-wizard'))) {
    return { kind: 'alignment', value: norm.replace(/^fallenwizard$/, 'fallen-wizard') };
  }
  if (ALIGNMENTS.includes(norm)) return { kind: 'alignment', value: norm };
  for (const [code, names] of Object.entries(setNames || {})) {
    if (normalizeName(code) === norm) return { kind: 'set', value: code };
    for (const n of Object.values(names || {})) {
      if (n && normalizeName(n) === norm) return { kind: 'set', value: code };
    }
  }
  return { kind: 'unknown', value: null };
}

// Narrow, unless narrowing would empty the set.
const narrow = (matches, keep) => {
  const next = matches.filter(keep);
  return next.length ? next : matches;
};

function resolveOne(line, ctx) {
  const { nameIndex, cardsById, setNames, side, alignPref } = ctx;

  // Rank 0 -- first reading that matches anything.
  let reading = null;
  let matches = [];
  for (const c of line.candidates) {
    const found = nameIndex.get(normalizeName(c.name)) || [];
    if (found.length) { reading = c; matches = [...found]; break; }
  }
  if (!reading) {
    return { ...line, qty: line.candidates[0].qty, name: line.candidates[0].name, matches: [], status: 'notfound' };
  }

  // Rank 1 -- the parenthesis. Sovereign, even against the side.
  for (const hint of reading.hints) {
    const h = classifyHint(hint, { cardsById, setNames });
    if (h.kind === 'id') matches = narrow(matches, (c) => c.id === h.value);
    else if (h.kind === 'set') matches = narrow(matches, (c) => c.setCode === h.value);
    else if (h.kind === 'alignment') matches = narrow(matches, (c) => String(c.alignment || '').toLowerCase() === h.value);
  }

  // Rank 2 -- the sub-section's type.
  if (line.typeHint) matches = narrow(matches, (c) => c.type === line.typeHint);

  // Rank 3 -- the side, or the manual preference when there is no side (that
  // is the freeform path: no side to infer from, so the player picks).
  // preferredMatchId is reused rather than reimplemented: it already encodes
  // the fallen-wizard tie the player must settle.
  const pref = (side && PREF_BY_SIDE[side]) || alignPref || null;
  if (matches.length > 1 && pref) {
    const picked = preferredMatchId(matches, pref);
    if (picked) matches = matches.filter((c) => c.id === picked);
  }

  return {
    ...line,
    qty: reading.qty,
    name: reading.name,
    matches,
    status: matches.length > 1 ? 'ambiguous' : 'ok',
  };
}

// A line the user did not mark with a quantity and that matches no card is
// prose, not a missing card -- pasting a forum post must import its cards and
// keep its commentary, without a wall of red. A line the user DID mark stays a
// reported miss: the intent there was plainly a card, and a typo must show.
function isMarked(line) {
  return line.candidates.some((c) => c.qty > 1) || /^\s*\d/.test(line.raw) || line.candidates[0].hints.length > 0;
}

export function resolveLines(lines, ctx) {
  const resolved = [];
  const prose = [];
  for (const line of lines) {
    const r = resolveOne(line, ctx);
    if (r.status === 'notfound' && !isMarked(line)) prose.push(line.raw);
    else resolved.push(r);
  }
  return { resolved, prose };
}
```

- [ ] **Step 4 : vérifier que ça passe**

```bash
npx vitest run test/importResolve.test.js
```

Attendu : SUCCÈS.

- [ ] **Step 5 : réactiver les deux `todo` de Task 6**

Dans `test/importDocument.test.js`, les deux tests marqués `it.todo` portaient sur la prose. Ils appartiennent en réalité à l'assemblage : **déplace-les dans `test/importResolve.test.js`** (ils y ont déjà leur équivalent dans le bloc « resolveLines — prose ») et supprime les `it.todo` plutôt que de laisser des doublons.

```bash
npx vitest run test/importDocument.test.js test/importResolve.test.js
```

Attendu : SUCCÈS, aucun `todo` restant.

- [ ] **Step 6 : commit**

```bash
git add web/src/lib/import/resolve.js test/importDocument.test.js test/importResolve.test.js
git commit -m "feat: a disambiguation stack where an inference never beats what is written"
```

---

## Task 8 : `importDeck.js` devient une façade

**Files:**
- Modify: `web/src/lib/importDeck.js` (réécriture complète)
- Test: `test/importDeck.test.js` — **ne doit pas être modifié**

**Interfaces:**
- Produces: exactement les exports actuels — `normalizeName`, `parseDeckList`, `parseDeckListDocument`, `buildNameIndex`, `ALIGNMENT_PREFERENCES`, `preferredMatchId`, `resolveDeckList`, `importDeckList` — plus `parseDocument` et `resolveLines` ré-exportés pour `ImportDialog`.

- [ ] **Step 1 : lancer la suite d'abord, pour avoir la référence**

```bash
npx vitest run test/importDeck.test.js
```

Attendu : SUCCÈS (état actuel). Note le nombre de tests.

- [ ] **Step 2 : réécrire la façade**

Remplacer tout le contenu de `web/src/lib/importDeck.js` par :

```js
// Public face of the import pipeline. The work lives in ./import/*; this file
// exists so every existing caller and test keeps the API it was written
// against while the parser underneath was split into testable units.
//
// See docs/superpowers/specs/2026-08-03-import-zones-design.md for the design.
export { normalizeName } from './import/normalize.js';
export { parseLineCandidates, stripDecoration } from './import/line.js';
export { lookupHeading } from './import/vocabulary.js';
export { parseDocument } from './import/document.js';
export {
  buildNameIndex, resolveLines, classifyHint,
  ALIGNMENT_PREFERENCES, preferredMatchId, PREF_BY_SIDE,
} from './import/resolve.js';

import { parseLineCandidates } from './import/line.js';
import { parseDocument } from './import/document.js';
import { buildNameIndex, resolveLines } from './import/resolve.js';
import { normalizeName } from './import/normalize.js';

// Flat, sectionless paste. Each entry carries the pre-refactor reading
// (leading quantity only) so the shape callers destructure is unchanged.
export function parseDeckList(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const candidates = parseLineCandidates(line);
    const baseline = candidates[candidates.length - 1];
    out.push({ raw: line, qty: baseline.qty, name: baseline.name });
  }
  return out;
}

// `qty` and `name` mirror the LAST candidate on purpose: that reading is
// byte-for-byte the old parseLine, so anything reading these two fields keeps
// working. `candidates`, `typeHint`, `meta` and `name` (the deck's) are
// additive.
export function parseDeckListDocument(text) {
  const { notes, lines } = parseDocument(text);
  return { notes, lines };
}

// Resolve without a side or a card index beyond the name index -- the
// non-interactive path. Kept for callers that only have a name index.
export function resolveDeckList(parsed, nameIndex) {
  return parsed.map((item) => {
    const key = normalizeName(item.name);
    const matches = nameIndex.get(key) || [];
    let status = 'ok';
    if (matches.length === 0) status = 'notfound';
    else if (matches.length > 1) status = 'ambiguous';
    return { ...item, matches, status };
  });
}

// Full, non-interactive import: the round-trip entry point.
export function importDeckList(text, cards, lang = 'en') {
  const doc = parseDocument(text);
  const nameIndex = buildNameIndex(cards, lang);
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const { resolved } = resolveLines(doc.lines, { nameIndex, cardsById, setNames: {}, side: doc.meta.side });

  const quantities = {};
  const zones = { pool: {}, sideboard: {} };
  const unmatched = [];
  const ambiguous = [];

  for (const line of resolved) {
    if (line.status === 'notfound') { unmatched.push(line); continue; }
    if (line.status === 'ambiguous') ambiguous.push(line);
    const id = line.matches[0].id;
    const bucket = line.target === 'pool' ? zones.pool : line.target === 'sideboard' ? zones.sideboard : quantities;
    bucket[id] = (bucket[id] || 0) + line.qty;
  }

  return { quantities, zones, notes: doc.notes, unmatched, ambiguous, meta: doc.meta, name: doc.name };
}
```

- [ ] **Step 3 : lancer la suite intacte**

```bash
npx vitest run test/importDeck.test.js test/deckList.test.js
```

Attendu : SUCCÈS **sans avoir touché `test/importDeck.test.js`**.

> **En cas d'échec, applique cette règle :** un seul écart est légitime — une assertion qui figeait le fait qu'une **puce ou une décoration markdown** n'était PAS décapée (`'- 3x Bûrat'` lu comme un nom de carte). Cette assertion figeait un défaut ; corrige-la et note-le dans le message de commit. **Tout autre échec est une régression** : corrige le code, pas le test.

- [ ] **Step 4 : commit**

```bash
git add web/src/lib/importDeck.js
git commit -m "refactor: importDeck becomes a facade over four testable units"
```

---

## Task 9 : les clés i18n

**Files:**
- Modify: `web/src/lib/i18n.js` (blocs `fr`, `en`, `es`)
- Test: `test/i18n.test.js`, `test/i18n-rules-contract.test.js`

**Interfaces:**
- Produces: les clés `import.*` consommées par Task 10.

- [ ] **Step 1 : ajouter les clés, dans les trois blocs**

Dans le bloc **`fr`**, à côté des `import.*` existants (vers la ligne 143) :

```js
    'import.step2': 'Réglages de l’import',
    'import.target': 'Cible :',
    'import.target.new': 'Nouveau deck',
    'import.target.replace': 'Remplacer le deck ouvert',
    'import.mode': 'Mode :',
    'import.defaultName': 'Deck importé',
    'import.summaryProse': ', {n} ligne(s) gardée(s) en notes',
    'import.illegal': '⚠ {qty}× {name} — illégale pour le camp {side}',
    'import.prose': 'Lignes gardées en notes',
```

Dans le bloc **`en`** (vers la ligne 501) :

```js
    'import.step2': 'Import settings',
    'import.target': 'Target:',
    'import.target.new': 'New deck',
    'import.target.replace': 'Replace the open deck',
    'import.mode': 'Mode:',
    'import.defaultName': 'Imported deck',
    'import.summaryProse': ', {n} line(s) kept as notes',
    'import.illegal': '⚠ {qty}× {name} — illegal for the {side} side',
    'import.prose': 'Lines kept as notes',
```

Dans le bloc **`es`** (vers la ligne 826) :

```js
    'import.step2': 'Ajustes de importación',
    'import.target': 'Destino:',
    'import.target.new': 'Nuevo mazo',
    'import.target.replace': 'Reemplazar el mazo abierto',
    'import.mode': 'Modo:',
    'import.defaultName': 'Mazo importado',
    'import.summaryProse': ', {n} línea(s) guardada(s) como notas',
    'import.illegal': '⚠ {qty}× {name} — ilegal para el bando {side}',
    'import.prose': 'Líneas guardadas como notas',
```

- [ ] **Step 2 : réécrire `import.help`, devenu faux**

Le texte actuel annonce « `## Pool / ## Sideboard / ## Notes` » et « L'import remplace la sélection courante » — les deux sont périmés. Remplacer les trois valeurs :

```js
    // fr
    'import.help': 'Colle une liste, dans n’importe quel ordre : les titres de section (pioche, talon, réserve, lieux, notes) sont reconnus en français, anglais et espagnol, en markdown ou en texte brut. La quantité peut être devant ou derrière ({fmt}), et vaut 1 par défaut. Le nom doit être complet, mais la casse, les accents, les tirets et la ponctuation sont ignorés ({ex}). Tout ce qui n’est ni un titre ni une carte est conservé en notes.',
    // en
    'import.help': 'Paste a list, in any order: section headings (play deck, sideboard, pool, locations, notes) are recognized in French, English and Spanish, as markdown or as plain text. The quantity may lead or trail ({fmt}), and defaults to 1. The name must be complete, but case, accents, hyphens and punctuation are ignored ({ex}). Anything that is neither a heading nor a card is kept as notes.',
    // es
    'import.help': 'Pega una lista, en cualquier orden: los encabezados de sección (mazo de juego, sideboard, reserva, localizaciones, notas) se reconocen en francés, inglés y español, en markdown o en texto plano. La cantidad puede ir delante o detrás ({fmt}), y por defecto es 1. El nombre debe estar completo, pero se ignoran mayúsculas, acentos, guiones y puntuación ({ex}). Todo lo que no sea un encabezado ni una carta se conserva como notas.',
```

> **Garde FR :** le texte français emploie **pioche / talon / réserve**, jamais les mots retirés. `test/i18n.test.js` le vérifie.

- [ ] **Step 3 : vérifier**

```bash
npx vitest run test/i18n.test.js test/i18n-rules-contract.test.js
```

Attendu : SUCCÈS. Un échec ici signale presque toujours une clé présente dans un seul bloc.

- [ ] **Step 4 : commit**

```bash
git add web/src/lib/i18n.js
git commit -m "i18n: the import dialog's second step, in three languages"
```

---

## Task 10 : la fenêtre d'import en deux temps

**Files:**
- Modify: `web/src/components/ImportDialog.jsx` (réécriture complète)

**Interfaces:**
- Consumes: `parseDocument`, `buildNameIndex`, `resolveLines`, `PREF_BY_SIDE` (façade) ; `isLegalForSide` (`rules/sides.js`) ; `siteIndex` (`rules/sites.js`) ; `resolveBanned` (`rules/banned.js`) ; `SIDE_IDS`, `LENGTH_IDS` (`constants.js`).
- Produces: appelle `onImport({ quantities, zones, notes, name, mode, ruleset, target })`.

- [ ] **Step 1 : réécrire le composant**

Remplacer le contenu de `web/src/components/ImportDialog.jsx` par :

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { parseDocument, buildNameIndex, resolveLines } from '../lib/importDeck.js';
import { isLegalForSide } from '../lib/rules/sides.js';
import { siteIndex } from '../lib/rules/sites.js';
import { resolveBanned } from '../lib/rules/banned.js';
import { SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';
import { cardName } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

// Alignment preference, offered in freeform only: with no side there is
// nothing to infer a preference from. In deckbuilding the side supplies it
// (PREF_BY_SIDE), so the manual control would be a second, contradictable
// source for the same decision.
const ALIGN_OPTIONS = [
  { value: '', key: 'import.alignPref.none' },
  { value: 'hero', key: 'import.alignPref.hero' },
  { value: 'minion', key: 'import.alignPref.minion' },
  { value: 'balrog', key: 'import.alignPref.balrog' },
  { value: 'fallenWizard', key: 'import.alignPref.fallenWizard' },
];

// "Excellance" (not "Excellence") matches the card data's own spelling -- see
// banned.js:11-12. Deliberately misspelled here so the placeholder actually
// imports instead of silently matching nothing.
const PLACEHOLDER = `## Pioche
1x Bûrat
2x Beautiful Gold Ring

## Talon
3x Glamour of Surpassing Excellance`;

function cardLabel(c, lang) {
  const bits = [c.setCode, c.type, c.alignment].filter(Boolean).join(' · ');
  return `${c.id} — ${cardName(c, lang)} (${bits})`;
}

export default function ImportDialog({ cards, lang = 'fr', deck, setNames = {}, onClose, onImport }) {
  const t = useT();
  const [text, setText] = useState('');
  const [doc, setDoc] = useState(null); // parseDocument output, or null pre-analysis
  const [choice, setChoice] = useState({}); // line index -> chosen card id
  const [alignPref, setAlignPref] = useState('');

  // The controls only exist after the analysis, so a manual setting can never
  // contradict the metadata carried by the pasted text.
  const [target, setTarget] = useState('new');
  const [mode, setMode] = useState('freeform');
  const [side, setSide] = useState('wizard');
  const [length, setLength] = useState('standard');

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const nameIndex = useMemo(() => buildNameIndex(cards, lang), [cards, lang]);
  // Both are memoized on `cards` by a WeakMap inside their own modules; the
  // useMemo here only avoids re-entering them on every keystroke.
  const openBalrog = useMemo(() => siteIndex(cards).openBalrog, [cards]);
  const bannedIds = useMemo(() => (mode === 'deckbuilding' ? resolveBanned(cards).bySide[side] : undefined), [cards, mode, side]);

  // Seeding order, for the first resolution -- which runs before anything is
  // on screen: pasted metadata > the open deck's ruleset > nothing.
  function analyze() {
    const parsed = parseDocument(text);
    const r = (deck && deck.ruleset) || {};
    setMode(parsed.meta.mode || (deck && deck.mode) || 'freeform');
    setSide(parsed.meta.side || r.side || 'wizard');
    setLength(parsed.meta.length || r.length || 'standard');
    setDoc(parsed);
  }

  const effectiveSide = mode === 'deckbuilding' ? side : null;

  // alignPref is in the deps because in freeform it IS the rank-3 tiebreaker;
  // in deckbuilding effectiveSide supersedes it and resolve.js ignores it.
  const result = useMemo(() => {
    if (!doc) return null;
    return resolveLines(doc.lines, { nameIndex, cardsById, setNames, side: effectiveSide, alignPref });
  }, [doc, nameIndex, cardsById, setNames, effectiveSide, alignPref]);

  const resolved = result ? result.resolved : null;

  // Default selection per line. A manual pick SURVIVES a side change unless
  // the card it names is no longer among the candidates -- the previous
  // implementation wiped every manual pick whenever the preference moved.
  useEffect(() => {
    if (!resolved) return;
    setChoice((prev) => {
      const next = {};
      resolved.forEach((line, i) => {
        if (line.matches.length === 0) return;
        const kept = prev[i] && line.matches.some((c) => c.id === prev[i]) ? prev[i] : null;
        next[i] = kept || line.matches[0].id;
      });
      return next;
    });
  }, [resolved]);

  const importable = useMemo(() => {
    const quantities = {};
    const zones = { pool: {}, sideboard: {} };
    if (!resolved) return { quantities, zones };
    resolved.forEach((line, i) => {
      if (line.status === 'notfound') return;
      const id = choice[i] || (line.matches[0] && line.matches[0].id);
      if (!id) return;
      const count = Math.max(1, line.qty);
      const bucket = line.target === 'pool' ? zones.pool : line.target === 'sideboard' ? zones.sideboard : quantities;
      bucket[id] = (bucket[id] || 0) + count;
    });
    return { quantities, zones };
  }, [resolved, choice]);

  const importCount = [importable.quantities, importable.zones.pool, importable.zones.sideboard]
    .reduce((sum, m) => sum + Object.values(m).reduce((a, b) => a + b, 0), 0);

  const okCount = resolved ? resolved.filter((l) => l.status !== 'notfound').length : 0;
  const notFoundCount = resolved ? resolved.filter((l) => l.status === 'notfound').length : 0;
  const proseCount = result ? result.prose.length : 0;

  // Prose collected by the resolver is appended to the "other notes" field, so
  // pasting a forum post keeps its commentary instead of dropping it.
  function submit() {
    const notes = { ...(doc ? doc.notes : {}) };
    if (result && result.prose.length) {
      notes.other = [notes.other, result.prose.join('\n')].filter(Boolean).join('\n').trim();
    }
    onImport({
      quantities: importable.quantities,
      zones: importable.zones,
      notes,
      name: (doc && doc.name) || t('import.defaultName'),
      mode,
      ruleset: mode === 'deckbuilding'
        ? { side, length, tournament: !!((deck && deck.ruleset) || {}).tournament, ruleOverrides: ((deck && deck.ruleset) || {}).ruleOverrides || (deck && deck.savedRuleOverrides) || {} }
        : null,
      target,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('import.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('import.help', { fmt: '3x Bûrat · Bûrat - 3', ex: 'burat = Bûrat' })}
        </p>

        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={7}
        />

        {!doc && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn secondary" onClick={analyze} disabled={!text.trim()}>{t('import.analyze')}</button>
          </div>
        )}

        {doc && (
          <>
            <fieldset className="import-settings">
              <legend>{t('import.step2')}</legend>
              <div className="row">
                <label>{t('import.target')}
                  <select value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="new">{t('import.target.new')}</option>
                    <option value="replace">{t('import.target.replace')}</option>
                  </select>
                </label>
                <label>{t('import.mode')}
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="freeform">{t('setup.mode.freeform')}</option>
                    <option value="deckbuilding">{t('setup.mode.deckbuilding')}</option>
                  </select>
                </label>
              </div>
              {mode === 'deckbuilding' ? (
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
              ) : (
                <label className="import-alignpref">
                  {t('import.alignPref')}
                  <select value={alignPref} onChange={(e) => setAlignPref(e.target.value)}>
                    {ALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
                  </select>
                </label>
              )}
            </fieldset>

            <p className="muted">
              {t('import.summary', { ok: okCount })}
              {notFoundCount ? t('import.summaryNotFound', { n: notFoundCount }) : ''}
              {proseCount ? t('import.summaryProse', { n: proseCount }) : ''}.
            </p>

            <ul className="import-list">
              {resolved.map((line, i) => {
                if (line.status === 'notfound') {
                  return <li key={i} className="imp-notfound">{t('import.notFound', { qty: line.qty, name: line.name })}</li>;
                }
                if (line.status === 'ambiguous') {
                  return (
                    <li key={i} className="imp-ambiguous">
                      {t('import.ambiguous', { qty: line.qty, name: line.name })}
                      <select value={choice[i] || ''} onChange={(e) => setChoice((prev) => ({ ...prev, [i]: e.target.value }))}>
                        {line.matches.map((c) => <option key={c.id} value={c.id}>{cardLabel(c, lang)}</option>)}
                      </select>
                    </li>
                  );
                }
                const c = cardsById.get(choice[i]) || line.matches[0];
                // Marked, never blocked: the card imports either way. Same
                // call as CardBrowser's, so the two cannot disagree.
                const illegal = effectiveSide && !isLegalForSide(c, effectiveSide, openBalrog, bannedIds);
                if (illegal) {
                  return <li key={i} className="imp-illegal">{t('import.illegal', { qty: line.qty, name: cardName(c, lang), side: t(`side.${effectiveSide}`) })}</li>;
                }
                return (
                  <li key={i} className="imp-ok">
                    ✓ {line.qty}× <b>{cardName(c, lang)}</b> <span className="muted">({c.id})</span>
                  </li>
                );
              })}
            </ul>

            {proseCount > 0 && (
              <details className="import-prose">
                <summary>{t('import.prose')} ({proseCount})</summary>
                <pre>{result.prose.join('\n')}</pre>
              </details>
            )}
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn" onClick={submit} disabled={!doc || importCount === 0}>
            {t('import.submit', { n: importCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : ajouter le style**

Dans `web/src/styles.css`, à côté de `.import-alignpref` :

```css
.import-settings { border: 1px solid var(--line); border-radius: 8px; padding: .5rem .75rem; margin: .5rem 0; }
.import-settings legend { font-size: .85em; padding: 0 .35rem; }
/* Marked, not hidden: the card still imports. Mirrors .cardcell.illegal. */
.imp-illegal { color: var(--warn); }
.import-prose pre { white-space: pre-wrap; font-size: .85em; margin: .25rem 0 0; }
```

> Vérifie les noms de variables CSS (`--line`, `--warn`) contre ceux réellement définis en tête de `styles.css` et utilise les existants.

- [ ] **Step 3 : vérifier la compilation**

```bash
npm test
```

Attendu : 0 échec. **Lis le compte de fichiers** : une erreur de syntaxe JSX fait échouer un fichier à la transformation esbuild, pas à l'assertion.

- [ ] **Step 4 : commit**

```bash
git add web/src/components/ImportDialog.jsx web/src/styles.css
git commit -m "feat: the import dialog settles the deck's mode and side, after the paste"
```

---

## Task 11 : `App.jsx` — cible de l'import

**Files:**
- Modify: `web/src/App.jsx:154-167`, `:327-334`

**Interfaces:**
- Consumes: `onImport({ quantities, zones, notes, name, mode, ruleset, target })` (Task 10).

- [ ] **Step 1 : réécrire `importDeckData`**

```js
  // `target: 'new'` builds a fresh deck rather than overwriting the open one:
  // pasting a forum list is usually "make me a deck from this", and a failed
  // import must not destroy work in progress. `target: 'replace'` keeps the
  // open deck's name -- nobody's deck gets renamed under their feet.
  function importDeckData({ quantities: imported = {}, zones: importedZones, notes: importedNotes, name, mode, ruleset, target = 'replace' }) {
    const clamp = (map) => {
      const out = {};
      for (const [id, count] of Object.entries(map || {})) out[id] = Math.max(1, count);
      return out;
    };
    setQuantities(clamp(imported));
    setZones({
      sideboard: clamp(importedZones && importedZones.sideboard),
      pool: clamp(importedZones && importedZones.pool),
    });
    setDeck((prev) => normalizeDeck({
      ...prev,
      // A new deck drops the previous id so saving creates a record instead of
      // overwriting one.
      ...(target === 'new' ? { id: null, name: name || t('app.newDeck'), backAssignments: {} } : {}),
      mode,
      ruleset,
      notes: { ...EMPTY_NOTES, ...(importedNotes || {}) },
    }));
    setShowImport(false);
  }
```

- [ ] **Step 2 : passer les props manquantes**

Ligne 327, `ImportDialog` a besoin du deck (pour l'amorçage) et de `setNames` (pour l'indice de set) :

```jsx
      {showImport && (
        <ImportDialog
          cards={cards}
          lang={uiLang}
          deck={deck}
          setNames={setNames}
          onClose={() => setShowImport(false)}
          onImport={importDeckData}
        />
      )}
```

- [ ] **Step 3 : vérifier en direct**

```bash
npm test
```

Attendu : 0 échec.

Puis, dans le navigateur (`npm run dev`), colle ceci et vérifie les quatre points :

```
# Deck de test

## Metadata
- Mode: Deckbuilding
- Side: Balrog
- Game length: Long

## Pioche
### Characters
- 2x Bûrat
1) 3 Beautiful Gold Ring

## Talon
Glamour of Surpassing Excellance - 2

Plan de jeu : ramper sur les objets mineurs.
```

1. Les sélecteurs apparaissent sur **Balrog / Longue**, sans qu'on y touche.
2. Bûrat ×2 et Beautiful Gold Ring ×3 vont en **pioche**, Glamour ×2 en **talon**.
3. « Plan de jeu… » se retrouve dans les **notes**, pas dans la liste de cartes.
4. Passer le camp sur Sorcier **relance** l'analyse et les marques ⚠ changent.

- [ ] **Step 4 : commit**

```bash
git add web/src/App.jsx
git commit -m "feat: an import can build a new deck instead of overwriting the open one"
```

---

## Task 12 : documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§5, §6, §7, §9, §10, §13, §15 + la date en tête)
- Modify: `README.md`

- [ ] **Step 1 : mettre à jour `ARCHITECTURE.md`**

| Section | Contenu à écrire |
|---|---|
| en-tête | la date du jour |
| §5 | signature d'`importDeckData` : `{ quantities, zones, notes, name, mode, ruleset, target }` ; `target: 'new'` remet `id` à `null` |
| §6 | `isLegalForSide` : la passe `specific` au niveau **camp** ; pourquoi pas au niveau avatar (`SPECIFIC-AVATAR` a le contexte) ; la ligne `balrog-exempt` absorbée |
| §7 | `buildDeckListText` émet `## Metadata` (Mode / Side / Game length, valeurs canoniques anglaises) ; `tournament` volontairement dehors, et pourquoi |
| §9 | les nouvelles clés `import.*` ; **le vocabulaire du parseur reprend les libellés de `i18n.js`, il ne les réécrit pas** ; le piège « réserve » |
| §10 | la fenêtre d'import en deux temps, et pourquoi les sélecteurs n'existent qu'après l'analyse |
| §13 | ligne « Import de liste » → mentionner les sections libres, trois langues, quantités aux quatre positions ; ligne « Passe accessibilité » → **Livré** (branche fusionnée en `84304fe`) |
| §15 | entrée datée du jour |

Ajouter aussi une sous-section à §6 ou §4 décrivant le pipeline d'import :

```
lib/import/normalize.js → line.js → vocabulary.js → document.js → resolve.js
lib/importDeck.js = façade, API publique inchangée
```

avec les deux invariants : **la dernière lecture candidate reproduit l'ancien `parseLine`** (c'est ce qui garde `test/importDeck.test.js` intact), et **un rang de départage qui viderait l'ensemble est ignoré**.

- [ ] **Step 2 : mettre à jour `README.md`**

La section import doit dire : sections dans n'importe quel ordre, markdown ou texte brut, reconnues en FR/EN/ES ; quantité devant ou derrière ; parenthèse de désambiguïsation ; ce qui n'est ni titre ni carte finit en notes ; le bloc `## Metadata` de l'export.

- [ ] **Step 3 : vérification finale**

```bash
npm test
```

Attendu : **0 échec, et le compte de fichiers attendu** — pas seulement le compte de tests.

- [ ] **Step 4 : commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: the import pipeline, its invariants and its traps"
```

---

## Auto-revue du plan

**Couverture de la spec** — chaque section a sa tâche : §1 → Task 1 ; §2 → Task 2 ; §3.1 → Tasks 4-8 ; §3.2 → Task 4 ; §3.3 → Task 5 ; §3.4 → Task 6 ; §3.5 → Task 7 ; §3.6 → Tasks 10-11 ; §3.7 → Task 3 ; tests → intégrés à chaque tâche ; docs → Task 12.

**Écart assumé par rapport à la spec :** la spec listait quatre modules plus la façade ; le plan en crée **cinq**, en ajoutant `import/normalize.js`. Motif : la façade ré-exporte `normalizeName` tout en important le vocabulaire, et le vocabulaire a besoin de `normalizeName` — passer par la façade serait un cycle d'import. C'est exactement le piège que §6 d'`ARCHITECTURE.md` documente déjà pour `catalog.js` / `validate.js`.

**Point de vigilance connu, à traiter au moment où il se présente :** en Task 6, deux tests portant sur la prose ne peuvent pas passer avant Task 7 (la séparation prose / carte a besoin de l'index de cartes). Ils sont marqués `it.todo` puis déplacés dans `test/importResolve.test.js`. C'est signalé dans les deux tâches.

**Corrigé pendant l'auto-revue** — trois défauts, gardés ici pour que la relecture ne les re-cherche pas :

1. **`alignPref` n'atteignait pas le résolveur.** La fenêtre affichait le menu « Préférence d'alignement » en freeform mais sa valeur ne quittait jamais le composant : le contrôle n'aurait rien fait. `resolveLines` prend maintenant `alignPref` dans son contexte, le rang 3 vaut `PREF_BY_SIDE[side] || alignPref`, et deux tests couvrent le chemin freeform et la préséance du camp.
2. **Code mort dans `document.js`.** Une fonction `hasExplicitQuantity` et un `if` à corps vide, reliquats d'une première version où la séparation prose / carte se faisait là. Elle se fait dans `resolve.js`, qui a l'index ; le commentaire dit maintenant pourquoi.
3. **Import inutilisé** de `PREF_BY_SIDE` dans `ImportDialog`.
