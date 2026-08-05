# Sélection des cartes à l'export — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'exporter un sous-ensemble choisi du deck — ZIP MPC, PDF et liste texte — sans toucher au chemin d'export complet, qui reste le défaut.

**Architecture:** Toute la logique de sélection va dans un module pur, `web/src/lib/export/selection.js`, construit **au-dessus** de la sortie de `deckSections()` (jamais en la recalculant). Deux composants React ne font que rendre : une nouvelle modale de grille et une case dans `ExportDialog`. Le module projette la sélection dans les **deux** formes que consomment les exporteurs — une liste d'ids pour le ZIP et le PDF, une paire `{quantities, zones}` pour la liste texte.

**Tech Stack:** Vite + React 18, JSX sans TypeScript. Vitest (`npm test`). Aucune dépendance nouvelle.

**Spec :** [`docs/superpowers/specs/2026-08-05-export-card-selection-design.md`](../specs/2026-08-05-export-card-selection-design.md)

## Global Constraints

- **Aucune dépendance nouvelle**, ni runtime ni dev. Il n'y a ni `jsdom` ni `@testing-library/react` : **aucun test ne rend un composant React**. La logique testable doit donc vivre hors du JSX.
- **Français pour la prose, anglais pour le code** (identifiants, commentaires, messages de commit).
- **Toute clé i18n s'ajoute aux trois dictionnaires** de `web/src/lib/i18n.js` — fr (~l. 183), en (~l. 566), es (~l. 910). `test/i18n.test.js` échoue sinon (`fr, en and es have identical key sets`).
- **Parité des `{placeholder}`** : une clé doit porter exactement les mêmes tokens `{…}` dans les trois langues (`placeholder parity across fr/en/es`).
- **Termes bannis dans toute chaîne FR**, sans exemption : `deck de jeu`, `Magicien`, `magiciens`, `Sbire`, `sbires`, `Mise en scène`, `danger`, `Dangers`, `pool`, `Sideboard`, `Play deck`, `Minion`, `minions`, `Hazard`, `Stage`. Employer : **pioche, talon, réserve, péril, séide, progression**.
- **Ne pas modifier** `deckSections.js`, `zip.js`, `pdf.js`, `deckList.js`, ni le format des fichiers produits.
- **Les fonctions du module de sélection sont pures** : elles rendent un nouveau `Set` et ne mutent jamais leur entrée.
- Les commentaires expliquent le *pourquoi* et les pièges, pas le *quoi* — c'est le niveau du code voisin.
- Commits fréquents, un par tâche.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `web/src/lib/export/selection.js` | **Créer.** Toute la logique : slots, mutations, tri-état, les deux projections. Sans React. |
| `test/exportSelection.test.js` | **Créer.** Couvre le module ci-dessus. |
| `web/src/components/CardSelectionDialog.jsx` | **Créer.** La grille. Purement présentationnel. |
| `web/src/lib/i18n.js` | **Modifier.** Nouvelles clés, dans les trois langues. |
| `web/src/components/ExportDialog.jsx` | **Modifier.** Case « Export partiel », ouverture de la grille, branchement des projections. |
| `docs/ARCHITECTURE.md` | **Modifier.** §7, §10, §15, date en tête. |
| `README.md` | **Modifier.** Section « Formats d'export » (l. 148). |

**Le fixture de test du dépôt** — à reprendre tel quel, c'est celui de `test/deckSections.test.js` :

```js
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
const { cards, index } = parseCards(raw);
const find = (p) => { const c = cards.find(p); expect(c).toBeTruthy(); return c; };
```

`index` est la `Map` attendue par `deckSections({ … cardsById })`.

---

### Task 1 : le module de sélection — slots et identité des clés

**Files:**
- Create: `web/src/lib/export/selection.js`
- Test: `test/exportSelection.test.js`

**Interfaces:**
- Consumes: `deckSections()` de `web/src/lib/export/deckSections.js` (existant, non modifié).
- Produces:
  - `buildSlots(sections) -> Array<{ key: string, sectionId: string, groupId: string, cardId: string, copyIndex: number }>`
  - `allKeys(slots) -> Set<string>`

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `test/exportSelection.test.js` :

```js
import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';
import { buildSlots, allKeys } from '../web/src/lib/export/selection.js';

const { cards, index } = parseCards(raw);
const find = (p) => { const c = cards.find(p); expect(c).toBeTruthy(); return c; };

const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
const res = find((c) => c.type === 'Resource');
const hz = find((c) => c.type === 'Hazard');
const site = find((c) => c.type === 'Site');

describe('buildSlots', () => {
  it('emits one slot per physical copy, in canonical export order', () => {
    const sections = deckSections({
      quantities: { [res.id]: 3, [site.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    // flattenSections already carries the canonical order; expanding it by
    // count is exactly what the slot list must equal.
    const expected = flattenSections(sections).flatMap((e) => Array(e.count).fill(e.card.id));
    expect(slots.map((s) => s.cardId)).toEqual(expected);
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s.cardId === res.id).map((s) => s.copyIndex)).toEqual([0, 1, 2]);
  });

  // The invariant the section-qualified key exists for: the same card in two
  // sections is two independent stacks of copies. A key reduced to the card id
  // would merge them, and unticking the sideboard copy would silently untick
  // the play-deck ones.
  it('gives a card that sits in two sections distinct keys per section', () => {
    const sections = deckSections({
      quantities: { [hz.id]: 2 },
      zones: { pool: {}, sideboard: { [hz.id]: 1 }, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((s) => s.key)).size).toBe(3);
    expect(slots.filter((s) => s.sectionId === 'play')).toHaveLength(2);
    expect(slots.filter((s) => s.sectionId === 'sideboard')).toHaveLength(1);
  });

  it('carries the section and group each slot belongs to', () => {
    const sections = deckSections({
      quantities: { [chr.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const [slot] = buildSlots(sections);
    expect(slot.sectionId).toBe('play');
    expect(slot.groupId).toBe('characters');
    expect(slot.key).toBe(`play:characters:${chr.id}:0`);
  });
});

describe('allKeys', () => {
  it('covers every slot exactly once', () => {
    const sections = deckSections({
      quantities: { [res.id]: 2, [hz.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    const keys = allKeys(slots);
    expect(keys.size).toBe(slots.length);
    for (const s of slots) expect(keys.has(s.key)).toBe(true);
  });
});
```

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : ÉCHEC, `Failed to resolve import ".../lib/export/selection.js"`.

- [ ] **Step 3 : écrire l'implémentation minimale**

Créer `web/src/lib/export/selection.js` :

```js
// Turns the section -> group -> card tree from deckSections() into a flat,
// ordered list of "slots": one slot per physical copy. Built on top of that
// tree rather than recomputing it, so the canonical export order stays owned
// by deckSections.js alone.

// The key is qualified by section AND group because the same card can sit in
// several sections at once (two copies in the play deck, one in the sideboard
// prints once per copy, in every section it appears in). A key reduced to the
// card id would merge those stacks into one.
function slotKey(sectionId, groupId, cardId, copyIndex) {
  return `${sectionId}:${groupId}:${cardId}:${copyIndex}`;
}

export function buildSlots(sections) {
  const slots = [];
  for (const section of sections) {
    for (const group of section.groups) {
      for (const entry of group.entries) {
        // Which copy is ticked never matters -- two copies of a card are
        // interchangeable in print. copyIndex only keeps the keys distinct.
        for (let copyIndex = 0; copyIndex < entry.count; copyIndex += 1) {
          slots.push({
            key: slotKey(section.id, group.id, entry.card.id, copyIndex),
            sectionId: section.id,
            groupId: group.id,
            cardId: entry.card.id,
            copyIndex,
          });
        }
      }
    }
  }
  return slots;
}

export function allKeys(slots) {
  return new Set(slots.map((s) => s.key));
}
```

- [ ] **Step 4 : lancer les tests et vérifier qu'ils passent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : PASS, 4 tests.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/export/selection.js test/exportSelection.test.js
git commit -m "feat: build one selectable slot per physical card copy"
```

---

### Task 2 : mutations et état tri-état

**Files:**
- Modify: `web/src/lib/export/selection.js`
- Test: `test/exportSelection.test.js`

**Interfaces:**
- Consumes: `buildSlots`, `allKeys` (Task 1).
- Produces:
  - `toggle(selected: Set<string>, key: string) -> Set<string>`
  - `setMany(selected: Set<string>, keys: string[], value: boolean) -> Set<string>`
  - `selectRange(selected: Set<string>, orderedSlots: Slot[], anchorKey: string, targetKey: string, value: boolean) -> Set<string>`
  - `groupState(selected: Set<string>, keys: string[]) -> 'all' | 'none' | 'partial'`

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à la fin de `test/exportSelection.test.js` (et compléter la ligne d'import du module avec `toggle, setMany, selectRange, groupState`) :

```js
describe('selection mutations', () => {
  const keys = ['a', 'b', 'c', 'd'];
  const slots = keys.map((key) => ({ key }));

  it('toggle flips one key and never mutates its input', () => {
    const before = new Set(['a']);
    const on = toggle(before, 'b');
    expect([...on].sort()).toEqual(['a', 'b']);
    expect(toggle(on, 'a').has('a')).toBe(false);
    expect([...before]).toEqual(['a']);
  });

  it('setMany adds or removes a batch without mutating its input', () => {
    const before = new Set(['a']);
    expect([...setMany(before, ['b', 'c'], true)].sort()).toEqual(['a', 'b', 'c']);
    expect([...setMany(new Set(keys), ['a', 'b'], false)].sort()).toEqual(['c', 'd']);
    expect([...before]).toEqual(['a']);
  });

  it('selectRange applies one value across the span, in either direction', () => {
    expect([...selectRange(new Set(), slots, 'b', 'd', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...selectRange(new Set(), slots, 'd', 'b', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...selectRange(new Set(keys), slots, 'a', 'c', false)].sort()).toEqual(['d']);
  });

  // The collapse case: the anchor was clicked, then its section was folded
  // away. Ranging to an anchor that is no longer on screen would either throw
  // or silently span the wrong slots, so it degrades to a plain single click.
  it('falls back to the clicked slot when the anchor is no longer visible', () => {
    const visible = [{ key: 'c' }, { key: 'd' }];
    expect([...selectRange(new Set(), visible, 'a', 'd', true)]).toEqual(['d']);
  });

  it('groupState reports all, none or partial', () => {
    expect(groupState(new Set(keys), keys)).toBe('all');
    expect(groupState(new Set(), keys)).toBe('none');
    expect(groupState(new Set(['a']), keys)).toBe('partial');
  });

  // deckSections() drops empty groups, so this cannot arise from a real deck --
  // it is pinned only so the ambiguous "0 of 0" case has one defined answer
  // instead of depending on which check runs first.
  it('calls an empty group none, not all', () => {
    expect(groupState(new Set(), [])).toBe('none');
  });
});
```

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : ÉCHEC, `toggle is not a function` (ou une erreur d'import équivalente).

- [ ] **Step 3 : écrire l'implémentation minimale**

Ajouter à `web/src/lib/export/selection.js` :

```js
export function toggle(selected, key) {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function setMany(selected, keys, value) {
  const next = new Set(selected);
  for (const key of keys) {
    if (value) next.add(key);
    else next.delete(key);
  }
  return next;
}

// `orderedSlots` is whatever the caller considers rangeable -- the dialog passes
// only the slots currently on screen, so a collapsed section is skipped the way
// a spreadsheet skips hidden rows. Keeping that filtering in the caller is what
// lets this module stay ignorant of collapsing.
export function selectRange(selected, orderedSlots, anchorKey, targetKey, value) {
  const from = orderedSlots.findIndex((s) => s.key === anchorKey);
  const to = orderedSlots.findIndex((s) => s.key === targetKey);
  // The anchor can have been collapsed away since it was clicked. Spanning to a
  // slot that is no longer on screen would touch cards the user cannot see.
  if (from === -1 || to === -1) return setMany(selected, [targetKey], value);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return setMany(selected, orderedSlots.slice(lo, hi + 1).map((s) => s.key), value);
}

export function groupState(selected, keys) {
  let on = 0;
  for (const key of keys) if (selected.has(key)) on += 1;
  // Order matters: an empty group satisfies both `on === 0` and
  // `on === keys.length`, and 'none' is the answer that renders an empty box.
  if (on === 0) return 'none';
  return on === keys.length ? 'all' : 'partial';
}
```

- [ ] **Step 4 : lancer les tests et vérifier qu'ils passent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : PASS, 10 tests.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/export/selection.js test/exportSelection.test.js
git commit -m "feat: add selection mutations and tri-state group reporting"
```

---

### Task 3 : les deux projections

C'est la tâche qui porte le risque réel de la fonctionnalité : ZIP/PDF et liste texte ne consomment pas la même chose, et rien ne signalerait qu'une seule des deux a été filtrée.

**Files:**
- Modify: `web/src/lib/export/selection.js`
- Test: `test/exportSelection.test.js`

**Interfaces:**
- Consumes: `buildSlots` (Task 1) ; `emptyZones` de `web/src/lib/deck.js`.
- Produces:
  - `selectedCardIds(slots: Slot[], selected: Set<string>) -> string[]`
  - `selectedQuantitiesZones(slots: Slot[], selected: Set<string>) -> { quantities: Record<string, number>, zones: { pool, sideboard, sideboardFw } }`

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `test/exportSelection.test.js` (compléter l'import avec `selectedCardIds, selectedQuantitiesZones`) :

```js
describe('projections', () => {
  const build = () => deckSections({
    quantities: { [res.id]: 2, [hz.id]: 1, [site.id]: 2 },
    zones: { pool: { [chr.id]: 1 }, sideboard: { [hz.id]: 1 }, sideboardFw: {} },
    cardsById: index, lang: 'en',
  });

  it('selectedCardIds keeps canonical order and copy counts', () => {
    const slots = buildSlots(build());
    const ids = selectedCardIds(slots, allKeys(slots));
    expect(ids).toEqual(slots.map((s) => s.cardId));
    expect(ids.filter((id) => id === res.id)).toHaveLength(2);
  });

  it('selectedCardIds drops exactly what was unticked', () => {
    const slots = buildSlots(build());
    const oneResourceOff = setMany(allKeys(slots), [slots.find((s) => s.cardId === res.id).key], false);
    const ids = selectedCardIds(slots, oneResourceOff);
    expect(ids).toHaveLength(slots.length - 1);
    expect(ids.filter((id) => id === res.id)).toHaveLength(1);
  });

  // The trap this whole module exists for: deckSections() split one
  // `quantities` map into a play section and a locations section by card type.
  // Handing the text list two separate maps would drop the location deck.
  it('selectedQuantitiesZones folds play and locations back into one quantities map', () => {
    const slots = buildSlots(build());
    const { quantities, zones } = selectedQuantitiesZones(slots, allKeys(slots));
    expect(quantities[res.id]).toBe(2);
    expect(quantities[hz.id]).toBe(1);
    expect(quantities[site.id]).toBe(2);
    expect(zones.pool[chr.id]).toBe(1);
    expect(zones.sideboard[hz.id]).toBe(1);
    expect(zones.sideboardFw).toEqual({});
  });

  // The same card in the play deck and in the sideboard must not have its
  // sideboard copy counted into `quantities`.
  it('keeps a card that sits in two sections in the right bucket each time', () => {
    const slots = buildSlots(build());
    const { quantities, zones } = selectedQuantitiesZones(slots, allKeys(slots));
    expect(quantities[hz.id]).toBe(1);
    expect(zones.sideboard[hz.id]).toBe(1);
  });

  it('omits a card entirely once its last copy is unticked', () => {
    const slots = buildSlots(build());
    const noHazardInPlay = setMany(
      allKeys(slots),
      slots.filter((s) => s.sectionId === 'play' && s.cardId === hz.id).map((s) => s.key),
      false,
    );
    const { quantities, zones } = selectedQuantitiesZones(slots, noHazardInPlay);
    expect(quantities[hz.id]).toBeUndefined();
    expect(zones.sideboard[hz.id]).toBe(1);
  });

  // The guard that keeps the two export paths honest: whatever the selection,
  // the id list and the quantities/zones pair must describe the same multiset
  // of cards. Without it, one path could be filtered and the other not, and no
  // test would notice.
  it('both projections describe the same multiset for any selection', () => {
    const slots = buildSlots(build());
    const partial = setMany(allKeys(slots), [slots[0].key, slots[slots.length - 1].key], false);
    const fromIds = selectedCardIds(slots, partial).reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    const { quantities, zones } = selectedQuantitiesZones(slots, partial);
    const fromMaps = {};
    for (const map of [quantities, zones.pool, zones.sideboard, zones.sideboardFw]) {
      for (const [id, n] of Object.entries(map)) fromMaps[id] = (fromMaps[id] || 0) + n;
    }
    expect(fromMaps).toEqual(fromIds);
  });

  // Non-regression on the default path: a full selection must reproduce the
  // exact list ExportDialog builds today.
  it('a full selection equals the unfiltered export order', () => {
    const sections = build();
    const slots = buildSlots(sections);
    const today = flattenSections(sections).flatMap((e) => Array(e.count).fill(e.card.id));
    expect(selectedCardIds(slots, allKeys(slots))).toEqual(today);
  });
});
```

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : ÉCHEC, `selectedCardIds is not a function`.

- [ ] **Step 3 : écrire l'implémentation minimale**

Ajouter à `web/src/lib/export/selection.js` — et compléter le haut du fichier avec `import { emptyZones } from '../deck.js';` :

```js
// The ZIP and the PDF take a flat id list; slots are already in canonical
// order, so filtering preserves it for free.
export function selectedCardIds(slots, selected) {
  return slots.filter((s) => selected.has(s.key)).map((s) => s.cardId);
}

const ZONE_OF_SECTION = { pool: 'pool', sideboard: 'sideboard', sideboardFw: 'sideboardFw' };

// The text list does NOT take an id list: buildDeckListText re-derives its own
// sections from raw `quantities` and `zones`. Filtering only the id list would
// leave the .txt showing the whole deck, with nothing to signal it.
export function selectedQuantitiesZones(slots, selected) {
  const quantities = {};
  const zones = emptyZones();
  for (const slot of slots) {
    if (!selected.has(slot.key)) continue;
    // `play` and `locations` are one map that deckSections() split by card
    // type; the projection has to put them back, or the .txt loses the sites.
    const target = slot.sectionId === 'play' || slot.sectionId === 'locations'
      ? quantities
      : zones[ZONE_OF_SECTION[slot.sectionId]];
    if (!target) continue;
    target[slot.cardId] = (target[slot.cardId] || 0) + 1;
  }
  return { quantities, zones };
}
```

- [ ] **Step 4 : lancer les tests et vérifier qu'ils passent**

```bash
npx vitest run test/exportSelection.test.js
```

Attendu : PASS, 17 tests.

- [ ] **Step 5 : lancer toute la suite**

```bash
npm test
```

Attendu : 0 échec. Lire le compte de **fichiers** autant que celui de tests — une erreur de syntaxe JSX fait échouer un fichier à la compilation, pas à l'assertion.

- [ ] **Step 6 : commit**

```bash
git add web/src/lib/export/selection.js test/exportSelection.test.js
git commit -m "feat: project a selection into both shapes the exporters consume"
```

---

### Task 4 : les clés de traduction

**Files:**
- Modify: `web/src/lib/i18n.js` (trois blocs : fr ~l. 183, en ~l. 566, es ~l. 910)

**Interfaces:**
- Produces: les clés `export.partial.*` et `select.*` consommées par les Tasks 5 et 6.

**Ce qui est réutilisé, et pourquoi.** Les titres de section et de groupe existent déjà ; en créer de nouveaux ferait diverger le nom d'une section entre la grille et le reste de l'application.

| id de section | clé existante | id de groupe | clé existante |
|---|---|---|---|
| `pool` | `zones.pool` | `characters` | `panel.group.Character` |
| `play` | `zones.play` | `resources` | `panel.group.Resource` |
| `locations` | `zones.location` | `hazards` | `panel.group.Hazard` |
| `sideboard` | `zones.sideboard` | `sites` | `panel.group.Site` |
| `sideboardFw` | `zones.sideboardFw` | `regions` | `panel.group.Region` |

Seuls `avatars` et `other` n'ont pas de libellé existant, d'où `select.group.avatars` et `select.group.other` ci-dessous. Le bouton Annuler réutilise `common.cancel`.

- [ ] **Step 1 : ajouter les clés au dictionnaire français** (après `'export.group.locationdeck'`, ~l. 192)

```js
    'export.partial.toggle': 'Export partiel — choisir les cartes',
    'export.partial.run': 'Choisir les cartes',
    'export.partial.edit': 'Modifier la sélection',
    'select.title': 'Cartes à exporter',
    'select.count': '{n} / {total} cartes sélectionnées',
    'select.all': 'Tout cocher',
    'select.none': 'Tout décocher',
    'select.confirm': 'Valider la sélection',
    'select.hint': 'Maj+clic pour cocher une plage, Ctrl/Cmd+A pour tout cocher ou tout décocher.',
    'select.group.avatars': 'Avatars',
    'select.group.other': 'Autres',
```

Aucune de ces chaînes n'emploie de terme banni (§ Global Constraints) : les noms de zones viennent des clés `zones.*` existantes, qui portent déjà *pioche / talon / réserve*.

- [ ] **Step 2 : ajouter les mêmes clés au dictionnaire anglais** (après `'export.group.locationdeck'`, ~l. 575)

```js
    'export.partial.toggle': 'Partial export — pick cards',
    'export.partial.run': 'Pick cards',
    'export.partial.edit': 'Edit selection',
    'select.title': 'Cards to export',
    'select.count': '{n} / {total} cards selected',
    'select.all': 'Select all',
    'select.none': 'Clear all',
    'select.confirm': 'Confirm selection',
    'select.hint': 'Shift-click to tick a range, Ctrl/Cmd+A to select or clear everything.',
    'select.group.avatars': 'Avatars',
    'select.group.other': 'Other',
```

- [ ] **Step 3 : ajouter les mêmes clés au dictionnaire espagnol** (après `'export.group.locationdeck'`, ~l. 919)

```js
    'export.partial.toggle': 'Exportación parcial — elegir cartas',
    'export.partial.run': 'Elegir cartas',
    'export.partial.edit': 'Modificar la selección',
    'select.title': 'Cartas a exportar',
    'select.count': '{n} / {total} cartas seleccionadas',
    'select.all': 'Seleccionar todo',
    'select.none': 'Deseleccionar todo',
    'select.confirm': 'Confirmar la selección',
    'select.hint': 'Mayús+clic para marcar un rango, Ctrl/Cmd+A para marcar o desmarcar todo.',
    'select.group.avatars': 'Avatares',
    'select.group.other': 'Otras',
```

- [ ] **Step 4 : lancer les tests i18n**

```bash
npx vitest run test/i18n.test.js
```

Attendu : PASS. Trois gardes sont en jeu : parité des jeux de clés, parité des `{placeholder}` (`select.count` porte `{n}` **et** `{total}` dans les trois langues), et l'absence de terme retiré dans toute chaîne FR.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/i18n.js
git commit -m "i18n: add keys for partial export and the card picker"
```

---

### Task 5 : la modale de grille

**Files:**
- Create: `web/src/components/CardSelectionDialog.jsx`

**Interfaces:**
- Consumes: tout `selection.js` (Tasks 1-3) ; `cardThumbSrc` de `web/src/lib/lang.js` ; `useT` de `web/src/i18n.jsx`.
- Produces: le composant par défaut, avec ces props —
  `{ sections, slots, initialSelected: Set<string>, lang: string, onConfirm: (Set<string>) => void, onCancel: () => void }`

**Pas de `ProxyStamp` dans cette grille.** Le tampon est une affaire de fidélité d'impression ; `ExportDialog` ne reçoit pas `setNames`, et le faire descendre pour un sélecteur serait élargir le périmètre sans rien régler.

**Aucun test unitaire ici** — le dépôt ne rend aucun composant React. C'est justement pourquoi les Tasks 1-3 ont sorti toute la logique du JSX : ce fichier ne décide rien.

- [ ] **Step 1 : créer le composant**

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cardThumbSrc, cardName } from '../lib/lang.js';
import { useT } from '../i18n.jsx';
import { allKeys, toggle, setMany, selectRange, groupState } from '../lib/export/selection.js';

const THUMB_W = 90;

// Section and group titles reuse the keys the rest of the app already shows,
// so a section cannot be called one thing here and another in the deck panel.
const SECTION_KEY = {
  pool: 'zones.pool',
  play: 'zones.play',
  locations: 'zones.location',
  sideboard: 'zones.sideboard',
  sideboardFw: 'zones.sideboardFw',
};
const GROUP_KEY = {
  characters: 'panel.group.Character',
  resources: 'panel.group.Resource',
  hazards: 'panel.group.Hazard',
  sites: 'panel.group.Site',
  regions: 'panel.group.Region',
  avatars: 'select.group.avatars',
  other: 'select.group.other',
};

// `indeterminate` is a DOM property, not an HTML attribute: React will not set
// it from JSX. Written as <input indeterminate={…}> it fails silently -- no
// warning, and the partial state simply never shows.
function TriBox({ state, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'partial';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'all'}
      aria-label={label}
      onChange={() => onChange(state !== 'all')}
    />
  );
}

export default function CardSelectionDialog({ sections, slots, initialSelected, lang, onConfirm, onCancel }) {
  const t = useT();
  const [working, setWorking] = useState(() => new Set(initialSelected));
  const [collapsed, setCollapsed] = useState(() => new Set());
  // The shift-click anchor is a ref, not state: it steers the next click and
  // nothing renders from it, so storing it in state would only add renders.
  const anchorRef = useRef(null);

  const sectionId = (id) => `sec:${id}`;
  const groupId = (sec, grp) => `grp:${sec}:${grp}`;
  const isCollapsed = (id) => collapsed.has(id);
  const toggleCollapse = (id) => setCollapsed((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Only what is on screen can be shift-ranged. Folding is a view concern, so
  // it is filtered here and selection.js never hears about it.
  const visibleSlots = useMemo(
    () => slots.filter((s) => !isCollapsed(sectionId(s.sectionId)) && !isCollapsed(groupId(s.sectionId, s.groupId))),
    [slots, collapsed],
  );

  // Ctrl/Cmd+A deliberately spans the whole deck, collapsed sections included:
  // folding is navigation, not a filter. Only shift-click ranges are spatial.
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
      // Safe only because this dialog has no text field. If a search box is
      // ever added, this must stop swallowing the browser's own select-all.
      e.preventDefault();
      setWorking((cur) => (cur.size === slots.length ? new Set() : allKeys(slots)));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots]);

  function clickBox(e, slot) {
    const value = !working.has(slot.key);
    if (e.shiftKey && anchorRef.current) {
      setWorking(selectRange(working, visibleSlots, anchorRef.current, slot.key, value));
    } else {
      setWorking(toggle(working, slot.key));
    }
    anchorRef.current = slot.key;
  }

  const keysOf = (pred) => slots.filter(pred).map((s) => s.key);
  const bulk = (pred, value) => setWorking(setMany(working, keysOf(pred), value));

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t('select.title')}</h2>
        <p className="muted">{t('select.count', { n: working.size, total: slots.length })}</p>
        <p className="muted" style={{ fontSize: 12 }}>{t('select.hint')}</p>

        <div className="select-grid">
          {sections.map((section) => {
            const secKey = sectionId(section.id);
            const secPred = (s) => s.sectionId === section.id;
            return (
              <div className="select-section" key={section.id}>
                <div className="select-head">
                  <button
                    className="select-chevron"
                    onClick={() => toggleCollapse(secKey)}
                    aria-expanded={!isCollapsed(secKey)}
                  >{isCollapsed(secKey) ? '▶' : '▼'}</button>
                  <TriBox
                    state={groupState(working, keysOf(secPred))}
                    label={t(SECTION_KEY[section.id] || section.id)}
                    onChange={(v) => bulk(secPred, v)}
                  />
                  <span>{t(SECTION_KEY[section.id] || section.id)}</span>
                </div>

                {!isCollapsed(secKey) && section.groups.map((group) => {
                  const grpKey = groupId(section.id, group.id);
                  const grpPred = (s) => s.sectionId === section.id && s.groupId === group.id;
                  return (
                    <div className="select-group" key={group.id}>
                      <div className="select-head sub">
                        <button
                          className="select-chevron"
                          onClick={() => toggleCollapse(grpKey)}
                          aria-expanded={!isCollapsed(grpKey)}
                        >{isCollapsed(grpKey) ? '▶' : '▼'}</button>
                        <TriBox
                          state={groupState(working, keysOf(grpPred))}
                          label={t(GROUP_KEY[group.id] || group.id)}
                          onChange={(v) => bulk(grpPred, v)}
                        />
                        <span>{t(GROUP_KEY[group.id] || group.id)}</span>
                      </div>

                      {!isCollapsed(grpKey) && (
                        <div className="select-cards">
                          {group.entries.map((entry) => {
                            const cardSlots = slots.filter(
                              (s) => s.sectionId === section.id && s.groupId === group.id && s.cardId === entry.card.id,
                            );
                            return (
                              <div className="select-card" key={entry.card.id}>
                                <img
                                  src={cardThumbSrc(entry.card, lang, THUMB_W)}
                                  alt={cardName(entry.card, lang)}
                                  loading="lazy"
                                  width={THUMB_W}
                                />
                                <div className="select-card-name">{cardName(entry.card, lang)}</div>
                                <div className="select-boxes">
                                  {cardSlots.map((slot) => (
                                    <input
                                      key={slot.key}
                                      type="checkbox"
                                      checked={working.has(slot.key)}
                                      aria-label={`${cardName(entry.card, lang)} ${slot.copyIndex + 1}`}
                                      onChange={() => {}}
                                      onClick={(e) => clickBox(e, slot)}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <button className="btn secondary" onClick={() => setWorking(allKeys(slots))}>{t('select.all')}</button>
            <button className="btn secondary" onClick={() => setWorking(new Set())}>{t('select.none')}</button>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="btn" onClick={() => onConfirm(working)}>{t('select.confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

`onChange={() => {}}` sur les cases d'exemplaire est délibéré : React exige un `onChange` sur une case contrôlée, mais c'est `onClick` qui porte la décision, parce que lui seul expose `shiftKey`.

- [ ] **Step 2 : ajouter le CSS**

Dans `web/src/styles.css`, à la suite des styles de modale existants :

```css
.modal-wide { max-width: 1100px; width: 92vw; }
.select-grid { max-height: 60vh; overflow-y: auto; margin: 8px 0; }
.select-section { margin-bottom: 10px; }
.select-head { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-weight: 600; }
.select-head.sub { padding-left: 18px; font-weight: 500; opacity: 0.9; }
.select-chevron { background: none; border: 0; cursor: pointer; color: inherit; padding: 0 2px; }
.select-cards { display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 0 8px 36px; }
.select-card { width: 90px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.select-card img { width: 90px; border-radius: 3px; }
.select-card-name { font-size: 11px; text-align: center; line-height: 1.2; }
.select-boxes { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
```

- [ ] **Step 3 : vérifier que rien n'est cassé**

```bash
npm test
```

Attendu : 0 échec. Le composant n'est pas encore monté, mais une erreur de syntaxe JSX ferait échouer la **transformation** — c'est ce que cette étape attrape.

- [ ] **Step 4 : commit**

```bash
git add web/src/components/CardSelectionDialog.jsx web/src/styles.css
git commit -m "feat: add the card picker grid with range and bulk ticking"
```

---

### Task 6 : brancher `ExportDialog`

**Files:**
- Modify: `web/src/components/ExportDialog.jsx`

**Interfaces:**
- Consumes: `buildSlots`, `allKeys`, `selectedCardIds`, `selectedQuantitiesZones` (Tasks 1-3) ; `CardSelectionDialog` (Task 5) ; les clés de la Task 4.

- [ ] **Step 1 : ajouter l'état et les imports**

L'état vient **en premier**, auprès des autres `useState` (~l. 36) : l'étape 2 en dérive des `const`, et un `const` n'est pas hoisté — déclaré plus bas dans le fichier, il ferait une erreur de zone morte temporelle à l'exécution.

```jsx
  const [partial, setPartial] = useState(false);
  const [selected, setSelected] = useState(null); // null = never confirmed
  const [picking, setPicking] = useState(false);
```

Et compléter les imports en tête :

```jsx
import CardSelectionDialog from './CardSelectionDialog.jsx';
import { buildSlots, allKeys, selectedCardIds, selectedQuantitiesZones } from '../lib/export/selection.js';
```

`flattenSections` n'est plus utilisé après l'étape 2 — le retirer de l'import de `deckSections.js`.

- [ ] **Step 2 : remplacer le calcul de la liste ordonnée** (lignes 54-56 actuelles)

`orderedCards` n'était lu que pour en tirer `orderedCardIds` ; les slots portent la même information, et en garder deux calculs serait tenir deux définitions d'un même ordre.

```jsx
  const sections = deckSections({ quantities, zones, cardsById, lang: uiLang });
  const slots = buildSlots(sections);
  // Same list as before: slots are the canonical order expanded per copy.
  const orderedCardIds = slots.map((s) => s.cardId);

  // A subset only applies once one has actually been confirmed. Unticking
  // "partial" keeps `selected` alive so re-ticking it does not throw away the
  // ticking work -- it disables a filter, it does not undo it.
  const activeSelection = partial && selected ? selected : null;
  const exportCardIds = activeSelection ? selectedCardIds(slots, activeSelection) : orderedCardIds;
```

- [ ] **Step 3 : faire consommer la sélection par `runExport`**

Dans `runExport`, remplacer les trois usages. Pour le ZIP (l. 79) et le PDF (l. 85), `cardIds: orderedCardIds` devient `cardIds: exportCardIds`. Pour la liste texte (l. 91) :

```jsx
        // The text list never took an id list: buildDeckListText re-derives its
        // own sections from raw quantities/zones, so the subset has to reach it
        // in that shape or the .txt would come out complete.
        const src = activeSelection
          ? selectedQuantitiesZones(slots, activeSelection)
          : { quantities, zones };
        const text = buildDeckListText(cardsById, src.quantities, deck.name, listLang, { zones: src.zones, notes: deck.notes, mode: deck.mode, ruleset: deck.ruleset });
```

- [ ] **Step 4 : ajouter la case et le lien sous le compteur** (après la ligne `export.selected`, l. 157)

```jsx
        <p className="muted">{t('export.selected', { n: exportCardIds.length })}</p>

        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
          {t('export.partial.toggle')}
        </label>
        {partial && selected && (
          <div className="row">
            <button className="btn secondary small" onClick={() => setPicking(true)}>
              {t('export.partial.edit')}
            </button>
          </div>
        )}
```

Noter que le compteur lit désormais `exportCardIds`, donc il reflète le sous-ensemble.

- [ ] **Step 5 : faire basculer le bouton principal**

Remplacer la définition de `runLabel` (l. 102) et le bouton (l. 195) :

```jsx
  const needsPicking = partial && !selected;
  const runLabel = needsPicking
    ? t('export.partial.run')
    : busy ? t('export.run.generating') : format === 'mpc' ? t('export.run.zip') : format === 'pdf' ? t('export.run.pdf') : t('export.run.list');
```

```jsx
          <button
            className="btn"
            onClick={() => (needsPicking ? setPicking(true) : runExport())}
            disabled={busy || exportCardIds.length === 0}
          >
            {runLabel}
          </button>
```

- [ ] **Step 6 : monter la modale**

Juste avant le `</div>` fermant de `.modal` :

```jsx
        {picking && (
          <CardSelectionDialog
            sections={sections}
            slots={slots}
            initialSelected={selected || allKeys(slots)}
            lang={uiLang}
            onConfirm={(next) => { setSelected(next); setPicking(false); }}
            onCancel={() => setPicking(false)}
          />
        )}
```

`initialSelected` retombe sur `allKeys(slots)` — l'état initial « tout coché » de la spec. `onCancel` referme sans rien remonter : les changements sont perdus, on revient à la modale d'export.

- [ ] **Step 7 : lancer toute la suite**

```bash
npm test
```

Attendu : 0 échec, en fichiers comme en tests.

- [ ] **Step 8 : vérification manuelle**

```bash
npm run dev
```

À vérifier sur un deck contenant au moins une carte en plusieurs exemplaires **et** une carte présente à la fois dans la pioche et au talon :

1. Case décochée → le bouton et le décompte sont ceux d'avant.
2. Case cochée → le bouton devient « Choisir les cartes ».
3. Dans la grille : replier une section, shift-cliquer une plage, vérifier que rien de replié ne bascule.
4. Ctrl/Cmd+A coche tout, y compris le replié ; à nouveau, décoche tout.
5. Décocher un seul exemplaire d'une carte qui en a trois → « Valider » → le décompte perd 1.
6. Décocher l'exemplaire du talon → celui de la pioche reste coché.
7. Exporter en **liste texte** et vérifier que le `.txt` porte bien le sous-ensemble, pas le deck entier.
8. Exporter en **PDF** et vérifier le nombre de pages.
9. « Annuler » dans la grille → retour à la modale d'export, sélection précédente intacte.

**Rappel : l'extension Dark Reader inverse les couleurs sur localhost.** Si une couleur semble n'avoir pas changé, la suspecter avant de déboguer.

- [ ] **Step 9 : commit**

```bash
git add web/src/components/ExportDialog.jsx
git commit -m "feat: let the export dialog run on a picked subset of the deck"
```

---

### Task 7 : la documentation

Une fonctionnalité n'est pas terminée tant que `docs/ARCHITECTURE.md` n'est pas à jour — c'est la règle n°1 du projet, et elle vaut pour ce plan.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§7 vers l. 659, §10, §15, date en tête)
- Modify: `README.md` (§ « Formats d'export », l. 148)

- [ ] **Step 1 : §7 — le tableau des modules**

Ajouter la ligne à la table de `web/src/lib/export/` :

```markdown
| `selection.js` | Sélection à l'export : slots par exemplaire, et **les deux projections** |
```

- [ ] **Step 2 : §7 — la sous-section neuve**

À ajouter après « Deck list texte (`deckList.js`) » :

```markdown
### Sélection partielle à l'export (`selection.js`, 2026-08-05)

`buildSlots(deckSections(…))` aplatit l'arbre en **un slot par exemplaire physique**, dans
l'ordre canonique. La clé d'un slot est `section:groupe:carte:index` et **la section en fait
partie** : une même carte peut occuper plusieurs sections à la fois, et une clé réduite à
l'id de carte fusionnerait ces piles — décocher l'exemplaire du talon décocherait aussi ceux
de la pioche, sans un mot. `index` ne sert qu'à distinguer les clés : quel exemplaire est
coché n'a aucun sens, deux copies sont interchangeables à l'impression.

**Le piège qui justifie ce module : les trois formats ne consomment pas la même chose.** Le
ZIP et le PDF reçoivent `cardIds` ; la liste texte reçoit `quantities` et `zones` bruts, et
`buildDeckListText` refait son propre `deckSections()` par-dessus. Filtrer la seule liste
d'ids donnerait donc un ZIP et un PDF partiels et **une liste texte toujours complète**,
sans erreur ni avertissement. D'où deux projections, `selectedCardIds` et
`selectedQuantitiesZones`, et un test qui vérifie qu'à sélection égale elles décrivent le
même multi-ensemble de cartes.

`selectedQuantitiesZones` **refusionne `play` et `locations` dans `quantities`** :
`deckSections()` les avait séparés en lisant `backGroupForType`, et les rendre comme deux
dictionnaires distincts ferait perdre le deck de sites à la liste texte.

**Conséquence assumée : une liste texte partielle ne fait plus l'aller-retour.** Elle se
réimporte en un deck amputé. Aucun marqueur « partiel » n'est écrit dans le fichier — ce
serait un jeton de plus à faire lire à l'import pour une asymétrie que `## Metadata` ne peut
pas restaurer de toute façon. Les noms de fichiers ne changent pas non plus : la parité
`safeFileName` est épinglée par un test, et un suffixe la mettrait en jeu pour un confort
mineur.

**L'export massif de deck lists reste toujours complet** (`deckListZip.js`) : c'est une
sauvegarde, et une sauvegarde partielle qui n'en a pas l'air est un piège.
```

- [ ] **Step 3 : §10 — le composant**

Ajouter à l'inventaire des composants :

```markdown
`CardSelectionDialog.jsx` — la grille de choix des cartes à exporter, ouverte depuis
`ExportDialog`. **Elle ne décide rien** : toute la logique est dans `lib/export/selection.js`,
parce que le dépôt ne rend aucun composant React en test (ni `jsdom` ni
`@testing-library/react`) et que ce qui vit dans le JSX n'est donc pas couvert.

Trois points qui ne se déduisent pas du code :
- **`indeterminate` est une propriété DOM, pas un attribut.** Écrite en JSX elle est ignorée
  en silence, et l'état partiel des cases de section ne s'affiche jamais. D'où la `ref` et le
  `useEffect` de `TriBox`.
- **Le repli ne restreint que le shift-clic.** Une plage est spatiale, donc elle s'arrête à
  ce qui est à l'écran ; Ctrl/Cmd+A porte sur tout le deck, sections repliées comprises. Le
  filtrage du visible se fait dans le composant, `selection.js` ignore la notion de repli.
- **`preventDefault()` sur Ctrl+A n'est sûr que tant que la modale n'a pas de champ texte.**
  Ajouter une recherche obligerait à ignorer les frappes venues d'un champ.
```

- [ ] **Step 4 : §15 — le journal daté et la date en tête**

Entrée de journal :

```markdown
### 2026-08-05 — Export d'un sous-ensemble du deck

Nouvelle case « Export partiel » dans `ExportDialog`, qui ouvre une grille de choix des
cartes, par exemplaire. L'export complet reste le défaut et son chemin est inchangé. La
découverte qui a façonné le design : ZIP/PDF et liste texte ne consomment pas la même
donnée, donc la sélection est projetée dans deux formes plutôt qu'une (§7).
```

Mettre également à jour la date en tête du fichier.

- [ ] **Step 5 : `README.md`**

Dans « Formats d'export » (l. 148), ajouter :

```markdown
Chaque format s'exporte au choix en entier ou partiellement : cocher « Export partiel »
ouvre une grille où l'on choisit les cartes, exemplaire par exemplaire (Maj+clic pour une
plage, Ctrl/Cmd+A pour tout). Une liste texte partielle ne se réimporte évidemment que
partielle.
```

- [ ] **Step 6 : vérification finale**

```bash
npm test
```

Attendu : 0 échec. Compter les **fichiers** autant que les tests.

- [ ] **Step 7 : commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: record the partial export selection and its two projections"
```

---

## Definition of done

- [ ] `npm test` — 0 échec, fichiers comme tests.
- [ ] `docs/ARCHITECTURE.md` : §7, §10, §15, date en tête.
- [ ] `README.md` à jour.
- [ ] Les neuf vérifications manuelles de la Task 6 Step 8 sont passées.
