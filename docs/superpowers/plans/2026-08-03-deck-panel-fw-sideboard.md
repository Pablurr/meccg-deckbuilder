# Panneau de deck : en-tête, grille fixe, talon anti-Sorcier déchu — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la zone de deck optionnelle « talon anti-Sorcier déchu » (règle 1.6.1, 10 cartes) et refondre l'en-tête et la grille du panneau de deck : plus de pastilles Total/Pioche/Sites, plus de glissière de zoom, des pastilles de zone plus larges.

**Architecture:** La nouvelle zone est un quatrième id (`sideboardFw`) tissé par les sources uniques de vérité existantes — `zones.js` pour la légalité, `copies.js` pour les plafonds, `deckSections.js` pour l'export, `vocabulary.js` pour l'import — sans qu'aucune de ces logiques soit réimplémentée ailleurs. La taille des cartes passe du JavaScript (pourcentage persisté) au CSS (`repeat(auto-fill, minmax(120px, 1fr))`, la déclaration exacte du sélecteur) ; le JS n'en garde qu'une lecture pure, pour choisir la vignette.

**Tech Stack:** Vite + React 18, JSX sans TypeScript, Vitest, CSS artisanal. Aucune nouvelle dépendance.

**Spec :** [`docs/superpowers/specs/2026-08-03-deck-panel-fw-sideboard-design.md`](../specs/2026-08-03-deck-panel-fw-sideboard-design.md)

## Global Constraints

- **Français pour la prose** (docs, commentaires destinés au propriétaire), **anglais pour le code** : identifiants, ids de règles, messages de commit. Les ids de règles restent en anglais (`SIDEBOARD-FW-MAX`) parce que les joueurs les citent.
- **Vocabulaire FR imposé et gardé par un test** : pioche / talon / réserve / péril / séide / progression. `talon` = sideboard. Ne pas inventer de synonyme.
- **« Faction » ne désigne jamais un camp.** Le mot est **camp** (`side`).
- **Aucune nouvelle dépendance runtime.** Il y en a deux : `jszip`, `pdf-lib`.
- **Une source unique de vérité par domaine.** `zones.js`, `copies.js`, `roles.js`, `deckSections.js`, `proxy.js` sont autoritaires. Réimplémenter leur logique ailleurs est une régression.
- **Les commentaires de ce dépôt expliquent le *pourquoi* et les pièges, pas le *quoi*.** Tenir ce niveau.
- **Les trois langues ensemble.** Toute clé i18n ajoutée ou retirée l'est en `fr`, `en` et `es` dans le même commit — `test/i18n.test.js` vérifie la parité.
- **Id de zone** : `sideboardFw` partout (état, `localStorage`, import, export). Jamais `sideboardFW`, jamais `fwSideboard`.
- **Commandes** : `npm test` (Vitest, 33 fichiers / 594 tests avant ce lot), `npm run dev`, `npm run build`. Lire le compte de **fichiers** autant que celui de tests : une erreur de syntaxe JSX fait échouer un fichier à la compilation, pas à l'assertion.

---

## Structure des fichiers

**Créés**
- `web/src/lib/cardGrid.js` — remplace `web/src/lib/zoom.js`. Constantes de grille + `deckCardWidth()`.
- `test/cardGrid.test.js` — remplace `test/zoom.test.js`.

**Supprimés**
- `web/src/lib/zoom.js`, `test/zoom.test.js`.

**Modifiés**
| Fichier | Responsabilité dans ce lot |
|---|---|
| `web/src/lib/deck.js` | `normalizeDeck` garantit `zones.sideboardFw` ; `totalCopies` l'additionne. |
| `web/src/lib/rules/zones.js` | `zonesFor` / `zoneTargets` / `ZONE_LABEL_KEY` connaissent la zone. |
| `web/src/lib/rules/copies.js` | Scope `{ zones }` au lieu de `{ zone }` ; total sur quatre zones. |
| `web/src/lib/rules/formats.js` | `SIDEBOARD_FW_MAX = 10`. |
| `web/src/lib/rules/catalog.js` | Entrée `SIDEBOARD-FW-MAX`. |
| `web/src/lib/rules/validate.js` | Lit la zone dans les totaux ; nouveau contrôle ; scope `{ zones }`. |
| `web/src/lib/deckList.js` | `SECTION_TITLES.sideboardFw`. |
| `web/src/lib/export/deckSections.js` | Cinquième section. |
| `web/src/lib/import/vocabulary.js` | Alias d'en-tête. |
| `web/src/lib/import/target.js` | `ZONE_BY_TARGET` + `bucketFor`. |
| `web/src/App.jsx` | Vidage/sélection sur quatre zones ; suppression de l'état `cardZoom`. |
| `web/src/components/DeckPanel.jsx` | En-tête, onglets, grille CSS, suppression du zoom. |
| `web/src/components/ZoneTabs.jsx` | Pastille optionnelle + retour visuel de dépôt. |
| `web/src/lib/i18n.js` | Clés ajoutées (zone, règle, titre) et retirées (`panel.zoom`), ×3 langues. |
| `web/src/styles.css` | Pastilles élargies, `.ztab.optional`, `.ztab.drop-over`, grille du deck, purge du CSS de zoom. |
| `docs/ARCHITECTURE.md`, `README.md` | Mémoire technique et doc utilisateur. |

**Tests modifiés** : `test/deckModel.test.js`, `test/rules.test.js`, `test/deckSections.test.js`, `test/importVocabulary.test.js`, `test/importTarget.test.js`, `test/i18n-rules-contract.test.js`.

---

## Task 1 : la zone dans le modèle de deck

**Files:**
- Modify: `web/src/lib/deck.js:35-38` (`totalCopies`), `web/src/lib/deck.js:86-91` (`normalizeDeck`)
- Test: `test/deckModel.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: `normalizeDeck(d)` renvoie toujours `zones.sideboardFw` — un objet `{ [cardId]: number }`, éventuellement vide. `totalCopies(quantities, zones)` compte les quatre zones.

- [ ] **Step 1: Write the failing test**

Ajouter à `test/deckModel.test.js` :

```js
describe('sideboardFw zone (1.6.1)', () => {
  it('normalizeDeck always provides an empty sideboardFw map', () => {
    expect(normalizeDeck({}).zones.sideboardFw).toEqual({});
    expect(normalizeDeck({ zones: {} }).zones.sideboardFw).toEqual({});
    // A deck written before this zone existed must read as having it, empty:
    // that is the whole of the ascending-compatibility guarantee, since there
    // is no schema version number to branch on.
    expect(normalizeDeck({ zones: { sideboard: { 'TW-1': 2 } } }).zones.sideboardFw).toEqual({});
  });

  it('normalizeDeck preserves an existing sideboardFw map', () => {
    const d = normalizeDeck({ zones: { sideboardFw: { 'TW-1': 3 } } });
    expect(d.zones.sideboardFw).toEqual({ 'TW-1': 3 });
  });

  it('totalCopies counts the sideboardFw zone', () => {
    const zones = { sideboard: { a: 2 }, pool: { b: 1 }, sideboardFw: { c: 4 } };
    expect(totalCopies({ d: 3 }, zones)).toBe(10);
  });

  it('totalCopies still works when sideboardFw is absent', () => {
    expect(totalCopies({ d: 3 }, { sideboard: { a: 2 }, pool: {} })).toBe(5);
  });
});
```

Vérifier que `totalCopies` et `normalizeDeck` sont bien tous deux importés en tête de `test/deckModel.test.js` ; ajouter l'import manquant le cas échéant.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/deckModel.test.js`
Expected: FAIL — `expected undefined to equal {}` sur le premier test.

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/deck.js`, `totalCopies` :

```js
export function totalCopies(quantities = {}, zones = {}) {
  const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  return sum(quantities) + sum(zones.sideboard) + sum(zones.pool) + sum(zones.sideboardFw);
}
```

Dans `normalizeDeck` :

```js
  const zones = {
    sideboard: { ...((d.zones && d.zones.sideboard) || {}) },
    pool: { ...((d.zones && d.zones.pool) || {}) },
    // 1.6.1 -- the ten cards preselected for a Fallen-wizard OPPONENT, on top
    // of the sideboard's own 30/35/40. Defaulted here like the other two
    // because there is no schema version to branch on: every deck written
    // before this zone existed reads as having it, empty.
    sideboardFw: { ...((d.zones && d.zones.sideboardFw) || {}) },
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/deckModel.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/deck.js test/deckModel.test.js && git commit -m "feat: the deck record carries a Fallen-wizard sideboard zone"
```

---

## Task 2 : légalité de zone et libellés

**Files:**
- Modify: `web/src/lib/rules/zones.js:4-25` (`zonesFor`), `web/src/lib/rules/zones.js:56-60` (`ZONE_LABEL_KEY`)
- Modify: `web/src/lib/i18n.js` — trois blocs de langue
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: `zonesFor(card).extra` contient `'sideboardFw'` en dernier pour toute carte non-Site/Region. `zoneTargets(card)` l'inclut donc, et `moveTargets`, `isDropAllowed`, `targetForCard` et la modale de carte en héritent sans changement propre. `ZONE_LABEL_KEY.sideboardFw === 'zones.sideboardFw'`.

- [ ] **Step 1: Write the failing test**

Ajouter à `test/rules.test.js` (les helpers `cards` / `byId` y existent déjà ; réutiliser la même façon de récupérer une carte que les tests `zonesFor` voisins) :

```js
describe('sideboardFw as a zone (1.6.1)', () => {
  const avatar = cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
  const character = cards.find((c) => c.type === 'Character' && !c.attributes.avatar && c.alignment === 'Hero');
  const hazard = cards.find((c) => c.type === 'Hazard');
  const site = cards.find((c) => c.type === 'Site');
  const region = cards.find((c) => c.type === 'Region');
  const minorItem = cards.find((c) => c.type === 'Resource' && c.attributes.subtype === 'Minor Item');

  it('is offered to every card family the ordinary sideboard is offered to', () => {
    for (const c of [avatar, character, hazard, minorItem]) {
      expect(zoneTargets(c)).toContain('sideboardFw');
    }
  });

  it('is never offered to a Site or a Region', () => {
    // Not an oversight: this is what keeps the zone unreachable in ALL THREE
    // surfaces at once -- drag-and-drop, the "move to" menu and import --
    // because the three ask zoneTargets rather than each deciding for itself.
    expect(zoneTargets(site)).not.toContain('sideboardFw');
    expect(zoneTargets(region)).not.toContain('sideboardFw');
  });

  it('comes last, after the zones that already existed', () => {
    const t = zoneTargets(character);
    expect(t.indexOf('sideboardFw')).toBe(t.length - 1);
  });

  it('is a legal drop target for a hazard and refused for a site', () => {
    expect(isDropAllowed(hazard, 'sideboardFw')).toBe(true);
    expect(isDropAllowed(site, 'sideboardFw')).toBe(false);
  });

  it('resolveDropTarget maps the tab onto itself', () => {
    expect(resolveDropTarget('sideboardFw')).toBe('sideboardFw');
  });

  it('has a full-name label key', () => {
    expect(ZONE_LABEL_KEY.sideboardFw).toBe('zones.sideboardFw');
  });
});
```

Ajouter aux imports du fichier ce qui manque : `zoneTargets`, `ZONE_LABEL_KEY` depuis `web/src/lib/rules/zones.js`, `isDropAllowed`, `resolveDropTarget` depuis `web/src/lib/rules/dropTargets.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js`
Expected: FAIL — `expected [ 'deck', 'sideboard' ] to contain 'sideboardFw'`.

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/rules/zones.js`, réécrire `zonesFor` — `'sideboardFw'` suit systématiquement `'sideboard'`, et vient en dernier dans `extra` :

```js
export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') {
    // 1.7 -- the pool holds up to ten NON-avatar characters, so an avatar's
    // zones are the play deck and the two sideboards only.
    if (a.avatar === true) return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
    return { primary: 'pool', extra: ['deck', 'sideboard', 'sideboardFw'] };
  }
  // 1.7 -- the pool may also hold up to two minor items. Two families qualify:
  // actual Minor Item cards, and the six permanent-events whose own text says
  // they may be played with a starting company "in lieu of a minor item"
  // (AS-94, BA-31, BA-44, BA-60, BA-70, WH-46), which consume an item slot.
  // 1.7.F1 -- a third family, Fallen-wizard only: Stage resource
  // permanent-events, up to three of them totalling exactly three stage points.
  if (type === 'Resource' && (a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true
    || (card.alignment === 'Stage' && a.subtype === 'Permanent-event'))) {
    return { primary: 'deck', extra: ['sideboard', 'pool', 'sideboardFw'] };
  }
  return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
}
```

Ajouter au-dessus de `zonesFor` :

```js
// 1.6.1 -- 'sideboardFw' is the ten cards preselected for a Fallen-wizard
// OPPONENT. It follows 'sideboard' everywhere and comes last in `extra`,
// because `extra`'s order drives the order the browser tile lists its zone
// counters in, and the rarest zone belongs after the common ones.
//
// Site and Region keep an empty `extra`, which is what makes the zone
// unreachable for them in the three surfaces at once -- drag-and-drop, the
// "move to" menu and import all ask zoneTargets instead of each deciding.
```

Et `ZONE_LABEL_KEY` :

```js
export const ZONE_LABEL_KEY = {
  deck: 'zones.play',
  sideboard: 'zones.sideboard',
  pool: 'zones.pool',
  sideboardFw: 'zones.sideboardFw',
};
```

Dans `web/src/lib/i18n.js`, ajouter aux trois blocs, juste après la ligne `zoneShort.pool` existante de chaque bloc :

```js
// bloc fr (après 'zoneShort.pool': 'Rés',)
'zoneShort.sideboardFw': 'T.SD',
```
```js
// bloc en (après 'zoneShort.pool': 'Pool',)
'zoneShort.sideboardFw': 'SBFW',
```
```js
// bloc es (après 'zoneShort.pool': 'Res',)
'zoneShort.sideboardFw': 'SBMC',
```

Et à côté des clés `zones.*` existantes de chaque bloc (chercher `'zones.sideboard':` pour les localiser) :

```js
// fr
'zones.sideboardFw': 'Talon vs SD',
'zones.sideboardFwFull': 'Talon contre un adversaire Sorcier déchu',
```
```js
// en
'zones.sideboardFw': 'SB vs FW',
'zones.sideboardFwFull': 'Sideboard vs a Fallen-wizard opponent',
```
```js
// es
'zones.sideboardFw': 'SB vs MC',
'zones.sideboardFwFull': 'Reserva contra un Mago caído',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules.test.js test/i18n.test.js`
Expected: PASS pour les deux fichiers.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rules/zones.js web/src/lib/i18n.js test/rules.test.js && git commit -m "feat: zoneTargets offers the Fallen-wizard sideboard, never to a site"
```

---

## Task 3 : plafonds d'exemplaires sur quatre zones

**Files:**
- Modify: `web/src/lib/rules/copies.js:52-54` (cap avatar), `web/src/lib/rules/copies.js:94-102` (`remainingCopies`)
- Modify: `web/src/lib/rules/validate.js:111` (boucle des totaux), `web/src/lib/rules/validate.js:220` (lecture du scope)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: Task 2 (`zonesFor`).
- Produces: la forme du scope d'un cap devient `'total'` ou `{ zones: string[] }`. `{ zone }` n'existe plus. `remainingCopies(card, 'sideboardFw', …)` est défini.

- [ ] **Step 1: Write the failing test**

Ajouter à `test/rules.test.js` :

```js
describe('copy caps across the two sideboards', () => {
  const avatar = cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
  const unique = cards.find((c) => c.attributes.unique === true && !c.attributes.avatar && c.type !== 'Site');
  const ctx = { side: 'wizard', ruleOverrides: {} };

  it('counts the Fallen-wizard sideboard in the whole-deck total', () => {
    // 1.3.1 -- a unique card held in one zone leaves no room in any other.
    const held = { quantities: {}, zones: { sideboard: {}, pool: {}, sideboardFw: { [unique.id]: 1 } } };
    expect(remainingCopies(unique, 'deck', held, ctx).remaining).toBe(0);
    expect(remainingCopies(unique, 'deck', held, ctx).ruleId).toBe('UNIQUE-LIMIT');
  });

  it('reads the 1.6.2 avatar sub-cap as combined over both sideboards', () => {
    // Owner's decision, 2026-08-03: the Fallen-wizard sideboard IS sideboard,
    // so one copy of an avatar there consumes the single copy 1.6.2 allows.
    const held = { quantities: {}, zones: { sideboard: { [avatar.id]: 1 }, pool: {}, sideboardFw: {} } };
    expect(remainingCopies(avatar, 'sideboardFw', held, ctx).remaining).toBe(0);
    expect(remainingCopies(avatar, 'sideboardFw', held, ctx).ruleId).toBe('AVATAR-SIDEBOARD');
  });

  it('emits AVATAR-SIDEBOARD when the two sideboards hold one avatar copy each', () => {
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true, cardsById,
      quantities: {},
      zones: { sideboard: { [avatar.id]: 1 }, pool: {}, sideboardFw: { [avatar.id]: 1 } },
    });
    expect(byId(out, 'AVATAR-SIDEBOARD')).toHaveLength(1);
    expect(byId(out, 'AVATAR-SIDEBOARD')[0].params.count).toBe(2);
  });

  it('still allows the copies the whole-deck cap leaves', () => {
    const held = { quantities: { [avatar.id]: 1 }, zones: { sideboard: {}, pool: {}, sideboardFw: {} } };
    // AVATAR-COPIES caps the avatar at 3 across the deck; one is placed.
    expect(remainingCopies(avatar, 'sideboardFw', held, ctx).remaining).toBe(1);
  });
});
```

Note sur le dernier cas : le restant est `1` et non `2`, parce que la sous-limite avatar combinée (1 exemplaire, aucun placé dans les deux talons) est plus contraignante que le restant de 2 du plafond total. C'est le comportement voulu — `remainingCopies` renvoie toujours le plafond le plus serré.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js`
Expected: FAIL — `expected 1 to be 0` sur le premier test (la zone n'entre pas dans le total).

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/rules/copies.js`, remplacer le commentaire d'en-tête des lignes 12-14 par :

```js
// A { zones } scope is an ADDITIONAL restriction layered on top of a total cap,
// never a replacement for it. Only 1.6.2 needs one: one copy of each avatar in
// the sideboard, out of the three that avatar may have in the whole deck.
//
// It names a LIST of zones, not one, because 1.6.1's Fallen-wizard sideboard
// is sideboard too: "one copy of each avatar in the sideboard" reads as one
// copy across both, and a per-zone cap would quietly permit two. Owner's
// decision, 2026-08-03.
```

Puis le cap avatar :

```js
    if (on('AVATAR-SIDEBOARD')) {
      caps.push({ limit: GENERAL.avatarMaxInSideboard, scope: { zones: ['sideboard', 'sideboardFw'] }, ruleId: 'AVATAR-SIDEBOARD' });
    }
```

Puis `remainingCopies` :

```js
  const countIn = (z) => ((z === 'deck' ? quantities : (zones[z] || {}))[card.id] || 0);
  const total = countIn('deck') + countIn('sideboard') + countIn('pool') + countIn('sideboardFw');
  let remaining = Infinity;
  let ruleId = null;
  for (const cap of caps) {
    let used;
    if (cap.scope === 'total') used = total;
    // A zoned cap constrains only the zones it names, and counts all of them:
    // the copy this zone may still take is what the FAMILY has left, not what
    // this one zone happens to hold.
    else if (cap.scope.zones.includes(zone)) used = cap.scope.zones.reduce((n, z) => n + countIn(z), 0);
    else continue; // a zone cap on other zones does not constrain this one
    const left = cap.limit - used;
    if (left < remaining) { remaining = left; ruleId = cap.ruleId; }
  }
```

Dans `web/src/lib/rules/validate.js`, ligne 95-96, ajouter la zone :

```js
  const sb = zones.sideboard || {};
  const pool = zones.pool || {};
  const sbFw = zones.sideboardFw || {};
```

Ligne 111, la boucle des totaux :

```js
  for (const zoneMap of [quantities, sb, pool, sbFw]) {
```

Ligne 218-220, la lecture du scope — remplacer le ternaire par une somme sur les zones nommées, en miroir exact de `remainingCopies` :

```js
    // Copy caps all come from copies.js -- the same function the + buttons
    // consult -- so a card the counter refuses is exactly a card this reports.
    // `e.count` is already the deck + both sideboards + pool total.
    const zoneMaps = { sideboard: sb, pool, sideboardFw: sbFw };
    for (const cap of copyCaps(c, { side, ruleOverrides })) {
      const used = cap.scope === 'total'
        ? e.count
        : cap.scope.zones.reduce((n, z) => n + ((zoneMaps[z] || {})[e.id] || 0), 0);
      if (used <= cap.limit) continue;
```

Déplacer la déclaration de `zoneMaps` hors de la boucle sur `entries` si la boucle englobante la recrée à chaque carte — la placer juste après `const sbFw = …`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules.test.js`
Expected: PASS, y compris le test d'accord existant entre le validateur et les boutons `+`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rules/copies.js web/src/lib/rules/validate.js test/rules.test.js && git commit -m "feat: copy caps span both sideboards, and 1.6.2 reads as one combined cap"
```

---

## Task 4 : le contrôle SIDEBOARD-FW-MAX

**Files:**
- Modify: `web/src/lib/rules/formats.js`
- Modify: `web/src/lib/rules/catalog.js:71`
- Modify: `web/src/lib/rules/validate.js:289-291`
- Modify: `web/src/components/DeckPanel.jsx:69`
- Modify: `web/src/lib/i18n.js` — six clés, deux par langue
- Test: `test/rules.test.js`, `test/i18n-rules-contract.test.js`

**Interfaces:**
- Consumes: Task 3 (`sbFw` dans `validateDeck`).
- Produces: `SIDEBOARD_FW_MAX` exporté par `formats.js` ; un avertissement `{ ruleId: 'SIDEBOARD-FW-MAX', code: 'SIDEBOARD-FW-MAX', params: { count, max } }`.

- [ ] **Step 1: Write the failing test**

Dans `test/rules.test.js` :

```js
describe('SIDEBOARD-FW-MAX (1.6.1)', () => {
  const avatar = cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
  const hz = cards.find((c) => c.type === 'Hazard' && !c.attributes.unique);
  const run = (sideboardFw, length = 'standard') => validateDeck({
    side: 'wizard', length, tournament: true, cardsById,
    quantities: { [avatar.id]: 1 }, zones: { sideboard: {}, pool: {}, sideboardFw },
  });

  it('stays silent at exactly ten cards', () => {
    expect(byId(run({ [hz.id]: 10 }), 'SIDEBOARD-FW-MAX')).toHaveLength(0);
  });

  it('fires at eleven, reporting the count and the cap', () => {
    const w = byId(run({ [hz.id]: 11 }), 'SIDEBOARD-FW-MAX');
    expect(w).toHaveLength(1);
    expect(w[0].params).toMatchObject({ count: 11, max: 10 });
    expect(w[0].severity).toBe('error');
  });

  it('does not vary with the game length: 1.6.1 grants ten on top of any sideboard', () => {
    expect(byId(run({ [hz.id]: 11 }, 'campaign'), 'SIDEBOARD-FW-MAX')).toHaveLength(1);
  });

  it('does not consume the ordinary sideboard allowance', () => {
    // 30 in the sideboard is exactly the `standard` cap; ten more in the
    // Fallen-wizard sideboard must not push SIDEBOARD-MAX over.
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true, cardsById,
      quantities: { [avatar.id]: 1 },
      zones: { sideboard: { [hz.id]: 30 }, pool: {}, sideboardFw: { [hz.id]: 10 } },
    });
    expect(byId(out, 'SIDEBOARD-MAX')).toHaveLength(0);
    expect(byId(out, 'SIDEBOARD-FW-MAX')).toHaveLength(0);
  });
});
```

Et dans `test/i18n-rules-contract.test.js`, ajouter un cas au `switch` de `buildFixture`, juste après le cas `'SIDEBOARD-MAX'` (ligne 191-194) :

```js
    case 'SIDEBOARD-FW-MAX': {
      const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique);
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: {}, pool: {}, sideboardFw: { [hz.id]: 11 } } };
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules.test.js test/i18n-rules-contract.test.js`
Expected: FAIL — `expected [] to have a length of 1` sur « fires at eleven ».

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/rules/formats.js`, après la table `LENGTHS` :

```js
// 1.6.1 -- "up to 10 additional cards ... preselected for Fallen-wizard
// opponents". ADDITIONAL: this allowance sits on top of sideboardMax rather
// than inside it, and unlike sideboardMax it does not vary with the game
// length -- which is exactly why it is a constant here and not a fifth column
// in LENGTHS.
export const SIDEBOARD_FW_MAX = 10;
```

Dans `web/src/lib/rules/catalog.js`, juste après la ligne `SIDEBOARD-MAX` :

```js
  // 1.6.1 -- the ten extra cards preselected for a Fallen-wizard OPPONENT,
  // on top of the length-dependent sideboard cap above.
  { id: 'SIDEBOARD-FW-MAX', severity: 'error', status: 'verified', ref: '1.6.1', source: COE },
```

Dans `web/src/lib/rules/validate.js`, importer la constante avec `LENGTHS` en tête de fichier, puis après le bloc `--- sideboard ---` :

```js
  // --- Fallen-wizard sideboard (1.6.1) ---
  // Counted and capped on its own: these ten cards are "additional", so they
  // never enter sbCount and SIDEBOARD-MAX never sees them.
  const sbFwCount = Object.entries(sbFw).reduce((s, [id, n]) => s + (cardsById.get(id) ? n : 0), 0);
  if (sbFwCount > SIDEBOARD_FW_MAX) emit('SIDEBOARD-FW-MAX', { count: sbFwCount, max: SIDEBOARD_FW_MAX });
```

Dans `web/src/components/DeckPanel.jsx:69`, ajouter la règle à celles pour lesquelles `localizeParams` dérive `{over}` :

```js
  if ((w.ruleId === 'SIDEBOARD-MAX' || w.ruleId === 'SIDEBOARD-FW-MAX' || w.ruleId === 'POOL-CHARS' || w.ruleId === 'POOL-ITEMS') && p.count != null && p.max != null) {
    p.over = p.count - p.max;
  }
```

Dans `web/src/lib/i18n.js`, à côté de chaque `rules.SIDEBOARD-MAX` et de chaque `rules.SIDEBOARD-MAX.doc` :

```js
// fr — après 'rules.SIDEBOARD-MAX'
'rules.SIDEBOARD-FW-MAX': 'Le talon anti-Sorcier déchu a {count} cartes ; la limite est {max}. Sors-en {over}.',
// fr — après 'rules.SIDEBOARD-MAX.doc'
'rules.SIDEBOARD-FW-MAX.doc': 'Dix cartes au plus, présélectionnées contre un adversaire Sorcier déchu, en plus du talon.',
```
```js
// en
'rules.SIDEBOARD-FW-MAX': 'The Fallen-wizard sideboard has {count} cards; the limit is {max}. Move {over} out.',
'rules.SIDEBOARD-FW-MAX.doc': 'Up to ten cards preselected for a Fallen-wizard opponent, on top of the sideboard.',
```
```js
// es
'rules.SIDEBOARD-FW-MAX': 'La reserva contra Mago caído tiene {count} cartas; el límite es {max}. Saca {over}.',
'rules.SIDEBOARD-FW-MAX.doc': 'Hasta diez cartas preseleccionadas contra un Mago caído, además del sideboard.',
```

Note : aucune clé `cap.SIDEBOARD-FW-MAX` n'est nécessaire. Les clés `cap.*` n'existent que pour les règles `hard: true`, celles que `copyCaps` produit et que le bouton `+` refuse ; celle-ci est un contrôle du validateur, pas un plafond par carte.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules.test.js test/i18n-rules-contract.test.js test/i18n.test.js test/docText.test.js`
Expected: PASS pour les quatre.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rules/formats.js web/src/lib/rules/catalog.js web/src/lib/rules/validate.js web/src/components/DeckPanel.jsx web/src/lib/i18n.js test/rules.test.js test/i18n-rules-contract.test.js && git commit -m "feat: 1.6.1 caps the Fallen-wizard sideboard at ten, on top of the sideboard"
```

---

## Task 5 : export et titre de section canonique

**Files:**
- Modify: `web/src/lib/deckList.js:37` (`SECTION_TITLES`)
- Modify: `web/src/lib/export/deckSections.js:23-28` (`GROUP_DEFS`), `web/src/lib/export/deckSections.js:57-62` (sections)
- Modify: `web/src/lib/i18n.js` — titres de section d'export s'il en existe (chercher `section.sideboard`)
- Test: `test/deckSections.test.js`

**Interfaces:**
- Consumes: Task 1 (`zones.sideboardFw`).
- Produces: `SECTION_TITLES.sideboardFw === 'Sideboard vs FW'` — Task 6 l'importe comme alias canonique. `deckSections()` renvoie une section `{ id: 'sideboardFw' }` en cinquième position.

- [ ] **Step 1: Write the failing test**

Ajouter à `test/deckSections.test.js` :

```js
describe('the Fallen-wizard sideboard section (1.6.1)', () => {
  it('comes last, after the ordinary sideboard', () => {
    const sections = deckSections({
      quantities: { [playCardId]: 1 },
      zones: { pool: {}, sideboard: { [sideboardCardId]: 1 }, sideboardFw: { [sideboardCardId]: 1 } },
      cardsById,
    });
    expect(sections.map((s) => s.id)).toEqual(['play', 'sideboard', 'sideboardFw']);
  });

  it('is dropped entirely when the zone is empty', () => {
    const sections = deckSections({
      quantities: { [playCardId]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById,
    });
    expect(sections.map((s) => s.id)).not.toContain('sideboardFw');
  });

  it('groups like the ordinary sideboard does', () => {
    const [section] = deckSections({
      quantities: {}, zones: { pool: {}, sideboard: {}, sideboardFw: { [hazardId]: 2 } }, cardsById,
    });
    expect(section.id).toBe('sideboardFw');
    expect(section.groups.map((g) => g.id)).toEqual(['hazards']);
  });

  it('has a canonical English heading, so an export re-imports', () => {
    expect(SECTION_TITLES.sideboardFw).toBe('Sideboard vs FW');
  });
});
```

Adapter `playCardId` / `sideboardCardId` / `hazardId` aux fixtures déjà utilisées en tête de `test/deckSections.test.js`, et importer `SECTION_TITLES` depuis `web/src/lib/deckList.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/deckSections.test.js`
Expected: FAIL — la liste des ids vaut `['play', 'sideboard']`.

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/deckList.js:37` :

```js
export const SECTION_TITLES = { pool: 'Pool', play: 'Play deck', locations: 'Locations', sideboard: 'Sideboard', sideboardFw: 'Sideboard vs FW' };
```

Dans `web/src/lib/export/deckSections.js`, remplacer le commentaire d'en-tête pour dire le nouvel ordre, ajouter le groupe et la section :

```js
// The single source of export order: the PDF, the ZIP and the text list all
// consume it, so they cannot disagree. Applies in both deck modes — a freeform
// deck exports in this order too (owner decision, 2026-07-26), so there is only
// one export order to explain. Sections: Pool, Play deck, Locations, Sideboard,
// Sideboard vs FW.
```

Au-dessus de `GROUP_DEFS`, extraire les groupes du talon, partagés par les deux zones — les copier serait deux tables à garder d'accord pour une seule règle :

```js
// 1.6.1's Fallen-wizard sideboard holds the same kinds of card as the
// ordinary one, so it groups the same way. Shared rather than copied: two
// copies of this list are two things to keep in agreement for one rule.
const SIDEBOARD_GROUPS = [
  { id: 'characters', match: (c) => c.type === 'Character' },
  { id: 'resources', match: (c) => c.type === 'Resource' },
  { id: 'hazards', match: (c) => c.type === 'Hazard' },
];
```

et dans `GROUP_DEFS` :

```js
  sideboard: SIDEBOARD_GROUPS,
  // A separate SECTION though it groups identically: it is a separate ten-card
  // allowance, and the player has to be able to count it on its own.
  sideboardFw: SIDEBOARD_GROUPS,
```

```js
    { id: 'sideboard', entries: toEntries(zones.sideboard || {}, cardsById) },
    { id: 'sideboardFw', entries: toEntries(zones.sideboardFw || {}, cardsById) },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/deckSections.test.js test/deckList.test.js test/pdf.test.js test/zip.test.js`
Expected: PASS pour les quatre. Si un test d'export attend une liste de sections figée, l'étendre plutôt que de contourner : la nouvelle section est voulue.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/deckList.js web/src/lib/export/deckSections.js test/deckSections.test.js && git commit -m "feat: exports carry the Fallen-wizard sideboard as its own section"
```

---

## Task 6 : import

**Files:**
- Modify: `web/src/lib/import/vocabulary.js:58-59`
- Modify: `web/src/lib/import/target.js:25`, `web/src/lib/import/target.js:39-44`
- Test: `test/importVocabulary.test.js`, `test/importTarget.test.js`

**Interfaces:**
- Consumes: Task 2 (`zoneTargets`), Task 5 (`SECTION_TITLES.sideboardFw`).
- Produces: `lookupHeading('## Sideboard vs FW')` renvoie `{ family: 'zone', zone: 'sideboardFw', type: null }`. `bucketFor(card, 'sideboardFw', deck)` renvoie `zones.sideboardFw`.

- [ ] **Step 1: Write the failing test**

Dans `test/importVocabulary.test.js` :

```js
describe('the Fallen-wizard sideboard heading (1.6.1)', () => {
  const aliases = [
    'Sideboard vs FW', 'Sideboard vs. fw', '## SIDEBOARD VS FALLEN-WIZARD',
    'FW sideboard', 'Fallen-wizard opponent sideboard', 'Anti-FW sideboard',
    'SB vs FW', 'Talon vs SD', 'Talon contre Sorcier déchu', 'SB vs MC',
    '### Sideboard vs FW (10)', '**Sideboard vs FW**', 'Sideboard vs FW:',
  ];

  it.each(aliases)('%s resolves to the sideboardFw zone', (raw) => {
    expect(lookupHeading(raw)).toMatchObject({ family: 'zone', zone: 'sideboardFw' });
  });

  it('leaves a bare Sideboard heading on the ordinary sideboard', () => {
    // The trap this pins: 'Sideboard vs FW' CONTAINS 'Sideboard'. If the
    // lookup ever became a prefix or substring match instead of an exact
    // normalized-word match, one of these two would silently swallow the other.
    for (const raw of ['Sideboard', 'SB', 'Side', 'Talon', '## Sideboard (30)']) {
      expect(lookupHeading(raw)).toMatchObject({ family: 'zone', zone: 'sideboard' });
    }
  });
});
```

Dans `test/importTarget.test.js` :

```js
describe('targeting the Fallen-wizard sideboard', () => {
  it('accepts a hazard', () => {
    expect(targetForCard(hazard, 'sideboardFw')).toBe('sideboardFw');
  });

  it('refuses a site and falls back to the main deck', () => {
    // The invariant: an import cannot build a deck the interface would refuse
    // to build by hand. targetForCard asks zoneTargets rather than deciding,
    // so this holds for the new zone without a rule of its own.
    expect(targetForCard(site, 'sideboardFw')).toBe('quantities');
  });

  it('buckets into the zones.sideboardFw map', () => {
    const deck = { quantities: {}, zones: { sideboard: {}, pool: {}, sideboardFw: {} } };
    expect(bucketFor(hazard, 'sideboardFw', deck)).toBe(deck.zones.sideboardFw);
    expect(bucketFor(site, 'sideboardFw', deck)).toBe(deck.quantities);
  });
});
```

Réutiliser les fixtures `hazard` / `site` déjà définies en tête de `test/importTarget.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/importVocabulary.test.js test/importTarget.test.js`
Expected: FAIL — `lookupHeading` renvoie `null`.

- [ ] **Step 3: Write minimal implementation**

Dans `web/src/lib/import/vocabulary.js`, après la ligne du sideboard :

```js
  // -- zone: sideboard. Spanish keeps the English word (i18n zones.sideboard).
  [['Sideboard', 'Side', 'SB', 'Talon', SECTION_TITLES.sideboard], zone('sideboard')],
  // -- zone: the 1.6.1 Fallen-wizard sideboard. Its canonical title comes from
  // SECTION_TITLES like every other section's, so our own export re-imports.
  // The rest are community shapes; "vs" and "vs." normalize alike, so both
  // spellings are one word here rather than two entries.
  //
  // These all CONTAIN the word "Sideboard", which is safe only because the
  // lookup matches a whole normalized heading and never a prefix -- see the
  // "leaves a bare Sideboard heading alone" test in importVocabulary.test.js,
  // which is what stops a future "startsWith" refactor from merging the two.
  [['Sideboard vs FW', 'Sideboard vs. FW', 'Sideboard vs Fallen-wizard',
    'FW sideboard', 'Fallen-wizard opponent sideboard', 'Anti-FW sideboard', 'SB vs FW',
    'Talon vs SD', 'Talon contre Sorcier déchu', 'SB vs MC',
    SECTION_TITLES.sideboardFw], zone('sideboardFw')],
```

Vérifier au passage que `normalizeName` traite `vs.` et `vs` identiquement (il retire la ponctuation). Si ce n'est pas le cas, garder les deux graphies dans la liste — elles y sont déjà.

Dans `web/src/lib/import/target.js` :

```js
const ZONE_BY_TARGET = { quantities: 'deck', pool: 'pool', sideboard: 'sideboard', sideboardFw: 'sideboardFw' };
```

```js
export function bucketFor(card, target, { quantities, zones }) {
  const t = targetForCard(card, target);
  if (t === 'pool') return zones.pool;
  if (t === 'sideboard') return zones.sideboard;
  if (t === 'sideboardFw') return zones.sideboardFw;
  return quantities;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/importVocabulary.test.js test/importTarget.test.js test/importDeck.test.js test/importDocument.test.js`
Expected: PASS pour les quatre. `importVocabulary.test.js` contient un test « une seule lecture par mot » qui inspecte `TABLE` : il doit rester vert, sinon un alias entre en collision avec une entrée existante.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/import/vocabulary.js web/src/lib/import/target.js test/importVocabulary.test.js test/importTarget.test.js && git commit -m "feat: an import can fill the Fallen-wizard sideboard, and still never a site"
```

---

## Task 7 : câblage de l'état applicatif

**Files:**
- Modify: `web/src/App.jsx:68` (`deckEmpty`), `web/src/App.jsx:245` (`hasSelection`), `web/src/App.jsx:117-118` (commentaire de `changeZoneQty`)
- Test: aucun nouveau — couvert par Task 1 et par les tests d'App existants s'il y en a.

**Interfaces:**
- Consumes: Task 1 (`totalCopies`).
- Produces: la feuille mobile et le panneau s'ouvrent pour un deck qui n'a que des cartes anti-SD.

- [ ] **Step 1: Vérifier le comportement à corriger**

`deckEmpty` et `hasSelection` énumèrent les zones à la main. Un deck ne contenant que des cartes dans `sideboardFw` serait donc considéré vide : le panneau ne s'afficherait pas et la feuille mobile se refermerait, rendant ces cartes inatteignables. C'est le même piège que le commentaire de `totalCopies` documente déjà pour la réserve et le talon.

Run: `npx vitest run` — noter le total actuel de fichiers et de tests pour comparaison.

- [ ] **Step 2: Remplacer les deux énumérations par la source unique**

Dans `web/src/App.jsx:68` :

```js
  // When the deck empties the mobile sheet unmounts; reset its flag so re-adding
  // a card doesn't pop the sheet back open unprompted.
  //
  // Asked of totalCopies rather than by listing the zones here: a zone added
  // later and forgotten in this expression would make its cards unreachable on
  // mobile, which is exactly the bug totalCopies' own comment records.
  const deckEmpty = totalCopies(quantities, zones) === 0;
```

Dans `web/src/App.jsx:245` :

```js
  const hasSelection = totalCopies(quantities, zones) > 0;
```

`totalCopies` est déjà importé ligne 3 — vérifier et ne pas dupliquer l'import.

Dans `web/src/App.jsx:117-118`, corriger le commentaire devenu faux :

```js
  // zone is 'deck' | 'sideboard' | 'pool' | 'sideboardFw'; 'deck' routes to the
  // existing quantities map rather than being a zone of its own.
```

`changeZoneQty` lui-même n'a pas besoin de changer : il indexe `prev[zone]`, donc il accepte la nouvelle zone dès lors que `normalizeDeck` en garantit la clé (Task 1) — sans quoi `bumpCount(undefined, …)` lèverait.

- [ ] **Step 3: Vérifier à la main dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173`, créer un deck en mode deckbuilding, ajouter une carte, puis vérifier que le panneau reste affiché et que la console ne montre aucune erreur. La pastille de la nouvelle zone n'existe pas encore (Task 8) — c'est attendu.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: 0 échec, même nombre de fichiers qu'à l'étape 1.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.jsx && git commit -m "fix: a deck holding only Fallen-wizard sideboard cards is not an empty deck"
```

---

## Task 8 : la pastille de zone, élargie et optionnelle

**Files:**
- Modify: `web/src/components/ZoneTabs.jsx` (réécriture complète)
- Modify: `web/src/components/DeckPanel.jsx:160-164` (onglets), `:240-243` (effet de repli), `:310-331` (compteurs, plafonds, libellés), `:335-353` (entrées actives)
- Modify: `web/src/styles.css:716-738`
- Test: aucun test unitaire — composant de rendu ; vérification par le navigateur, la logique testable étant déjà couverte par `dropTargets`.

**Interfaces:**
- Consumes: Tasks 1, 2, 4 (`SIDEBOARD_FW_MAX`), les clés i18n de Task 2.
- Produces: `ZoneTabs` accepte une prop `optional` — un `Set` d'ids d'onglets à rendre en pastille d'ajout quand leur compte est nul.

- [ ] **Step 1: Réécrire ZoneTabs**

`web/src/components/ZoneTabs.jsx`, dans son intégralité :

```jsx
import React, { useState } from 'react';

// Tab bar for the deck panel: one tab per zone (deckbuilding: Play deck / Pool /
// Sideboard / SB vs FW / Location / Notes; freeform: Cards / Notes — order
// fixed by spec).
// Each tab is itself a drop target: zones live in separate tabs so source and
// destination can never both be visible, and this also works when the
// destination zone is empty (there is no drop area inside it to aim at).
//
// `optional` names the tabs that stand for a zone a deck may simply not use
// (1.6.1's Fallen-wizard sideboard). While such a zone is empty its tab reads
// as an INVITATION -- dashed, muted, prefixed with "+", and carrying no count,
// because "0 / 10" claims a budget the player never opted into. It becomes an
// ordinary tab, count and all, the moment it holds a card.
//
// `dragOver` exists because a tab that does not react to a card held over it
// does not read as a target at all. It is the tab's own state rather than the
// panel's: nothing outside this bar needs to know, and a drop or a leave
// always clears it, so it cannot get stuck lit.
export default function ZoneTabs({ tabs, active, onSelect, onDrop, labels, counts, caps, optional }) {
  const [dragOver, setDragOver] = useState(null);
  return (
    <div className="ztabs">
      {tabs.map((id) => {
        const cap = caps[id];
        const count = counts[id];
        const over = cap != null && count != null && count > cap;
        const inviting = optional && optional.has(id) && !count;
        return (
          <button
            key={id}
            type="button"
            className={[
              'ztab',
              active === id ? 'on' : '',
              over ? 'over' : '',
              inviting ? 'optional' : '',
              dragOver === id ? 'drop-over' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOver(id)}
            onDragLeave={() => setDragOver((cur) => (cur === id ? null : cur))}
            onDrop={(e) => { setDragOver(null); onDrop(e, id); }}
          >
            {inviting ? `+ ${labels[id]}` : labels[id]}
            {!inviting && count != null && (
              <span className="cnt">{cap != null ? `${count} / ${cap}` : count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Câbler l'onglet dans DeckPanel**

`web/src/components/DeckPanel.jsx`, remplacer le bloc lignes 160-164 :

```js
  const hasPool = Object.keys(zones.pool || {}).length > 0;
  const hasSideboard = Object.keys(zones.sideboard || {}).length > 0;
  const hasSideboardFw = Object.keys(zones.sideboardFw || {}).length > 0;
  const tabs = deckbuilding
    ? ['play', 'pool', 'sideboard', 'sideboardFw', 'location', 'notes']
    : ['cards', ...(hasPool ? ['pool'] : []), ...(hasSideboard ? ['sideboard'] : []),
       ...(hasSideboardFw ? ['sideboardFw'] : []), 'notes'];
```

Ligne 240-243, ajouter la dépendance :

```js
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckbuilding, hasPool, hasSideboard, hasSideboardFw]);
```

Lignes 315-331, les trois tables :

```js
  const tabCounts = {
    play: counts.byGroup.playdeck,
    location: counts.byGroup.locationdeck,
    pool: poolCharCount(zones.pool, cardsById),
    sideboard: sumQty(zones.sideboard),
    sideboardFw: sumQty(zones.sideboardFw),
    cards: counts.total,
    notes: null, // the Notes tab carries no count
  };
  // 1.6.1's ten are granted flat, so unlike sideboardMax this cap does not
  // depend on the ruleset -- it is the same number in freeform, where the tab
  // only appears at all because the zone is non-empty.
  const tabCaps = { play: null, location: null, pool: poolMax, sideboard: sbMax, sideboardFw: SIDEBOARD_FW_MAX, cards: null, notes: null };
  const tabLabels = {
    play: t('zones.play'),
    location: t('zones.location'),
    pool: t('zones.pool'),
    sideboard: t('zones.sideboard'),
    sideboardFw: t('zones.sideboardFw'),
    cards: t('zones.cards'),
    notes: t('zones.notes'),
  };
  const optionalTabs = new Set(['sideboardFw']);
```

Ligne 344, la branche des zones éditables :

```js
  } else if (tab === 'pool' || tab === 'sideboard' || tab === 'sideboardFw') {
```

Et à l'appel de `<ZoneTabs …>` (ligne 411), ajouter `optional={optionalTabs}` ainsi qu'un `title` explicite sur la nouvelle zone en passant par les libellés — laisser `ZoneTabs` tel quel et poser l'infobulle par le CSS n'est pas possible, donc ajouter à la place la ligne suivante juste sous `tabLabels` et n'en rien faire de plus : le nom long est déjà porté par la section d'export et par la doc des règles.

Importer `SIDEBOARD_FW_MAX` en tête de fichier, à côté de `LENGTHS` :

```js
import { LENGTHS, SIDEBOARD_FW_MAX } from '../lib/rules/formats.js';
```

- [ ] **Step 3: Élargir les pastilles et styler les deux nouveaux états**

`web/src/styles.css`, remplacer le bloc `.ztab` et ses variantes :

```css
/* Wider than they were (4px 10px): these are drop targets first and labels
   second, and a 24px-tall pill is a hard thing to aim a dragged card at. */
.ztab {
  background: var(--panel-2);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
  padding: 8px 14px;
  min-height: 34px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ztab:hover { border-color: var(--accent); }
.ztab.on { font-weight: 700; border-color: currentColor; }
.ztab .cnt { opacity: .65; font-variant-numeric: tabular-nums; }
.ztab.over .cnt { color: var(--danger); font-weight: 700; opacity: 1; }
/* An optional zone nobody has put a card in yet: an invitation, not a budget. */
.ztab.optional { border-style: dashed; color: var(--muted); }
/* A card is being held over this tab. Without it a tab gives no sign it will
   accept the drop, which is most of why the pills read as labels. */
.ztab.drop-over { border-color: var(--accent); border-style: solid; color: var(--text); }
```

- [ ] **Step 4: Vérifier dans le navigateur**

Run: `npm run dev`

À vérifier, dans cet ordre :
1. En deckbuilding, la barre montre six pastilles, la quatrième en pointillés et libellée `+ Talon vs SD`, sans compteur.
2. Faire glisser un péril depuis le sélecteur sur cette pastille : elle s'allume pendant le survol, et la carte y atterrit ; la pastille devient pleine et affiche `1 / 10`.
3. Faire glisser un site sur la même pastille : rien ne bouge, et le site reste où il était.
4. Vider la zone : la pastille redevient pointillée sans compteur.
5. Repasser le deck en freeform depuis la boîte de configuration : la pastille disparaît si la zone est vide, reste si elle ne l'est pas.
6. Aucune erreur en console.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ZoneTabs.jsx web/src/components/DeckPanel.jsx web/src/styles.css && git commit -m "feat: a wider zone pill, lit on drag-over, invites the Fallen-wizard sideboard"
```

---

## Task 9 : zoom fixe

**Files:**
- Create: `web/src/lib/cardGrid.js`, `test/cardGrid.test.js`
- Delete: `web/src/lib/zoom.js`, `test/zoom.test.js`
- Modify: `web/src/App.jsx:11,41-50,62-64,270-271,296-297`
- Modify: `web/src/components/DeckPanel.jsx:2,18,138-139,166-170,245-283,410-430`
- Modify: `web/src/lib/lang.js:79-85` (commentaire)
- Modify: `web/src/styles.css:659-668,702-715`
- Modify: `web/src/lib/i18n.js` — retirer `panel.zoom` des trois blocs

**Interfaces:**
- Consumes: rien.
- Produces: `cardGrid.js` exporte `GRID_MIN_WIDTH = 120`, `GRID_GAP = 10`, `BODY_PADDING_X = 24`, `SOURCE_WIDTH = 570`, `deckZoneWidth(outerWidth)`, `deckCardWidth(outerWidth)`. `DeckPanel` n'accepte plus `zoom` ni `onZoom`.

- [ ] **Step 1: Write the failing test**

Créer `test/cardGrid.test.js` :

```js
import { describe, it, expect } from 'vitest';
import {
  GRID_MIN_WIDTH, GRID_GAP, BODY_PADDING_X, deckZoneWidth, deckCardWidth,
} from '../web/src/lib/cardGrid.js';

// The point of this module is that the deck panel and the card browser lay
// their cards out identically. These constants ARE that promise, and they are
// duplicated in styles.css (.grid, .deckpanel-body) -- if one side moves,
// this file is where the other side finds out.
describe('grid constants mirror the card selector', () => {
  it('uses the selector\'s 120px floor and 10px gap', () => {
    expect(GRID_MIN_WIDTH).toBe(120);
    expect(GRID_GAP).toBe(10);
  });
});

describe('deckZoneWidth', () => {
  it('takes the deck body padding off the panel width', () => {
    expect(deckZoneWidth(360)).toBe(360 - BODY_PADDING_X);
  });

  it('is total for junk rather than producing a negative width', () => {
    expect(deckZoneWidth(undefined)).toBe(0);
    expect(deckZoneWidth('abc')).toBe(0);
    expect(deckZoneWidth(10)).toBe(0);
  });
});

describe('deckCardWidth', () => {
  // These are the numbers CSS `repeat(auto-fill, minmax(120px, 1fr))` with a
  // 10px gap actually produces. The function exists ONLY to predict them, so
  // the right thing to assert is the prediction itself.
  it('predicts what auto-fill will do at the default panel width', () => {
    // 336px usable: two columns fit (2*120 + 10 = 250), three do not (390).
    expect(deckCardWidth(360)).toBe(163);
  });

  it('fits more columns as the panel grows', () => {
    // 776px usable: six columns fit (6*120 + 5*10 = 770), seven do not.
    expect(deckCardWidth(800)).toBe(121);
  });

  it('never returns less than the grid floor, however narrow the panel', () => {
    expect(deckCardWidth(100)).toBe(GRID_MIN_WIDTH);
    expect(deckCardWidth(0)).toBe(GRID_MIN_WIDTH);
    expect(deckCardWidth(undefined)).toBe(GRID_MIN_WIDTH);
  });
});
```

**Poser les deux attendus chiffrés en faisant l'arithmétique à la main, avant d'écrire la moindre ligne d'implémentation** — jamais en exécutant le code pour voir ce qu'il sort, ce qui ne prouverait rien.

- 360px → utile `360 − 24 = 336` ; colonnes `floor((336 + 10) / 130) = 2` ; largeur `floor((336 − 10) / 2) = 163`.
- 800px → utile `800 − 24 = 776` ; colonnes `floor((776 + 10) / 130) = 6` ; largeur `floor((776 − 50) / 6) = 121`.

L'attendu du second test est donc **121**, pas 120 : corriger le bloc de test ci-dessus avant de le lancer.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cardGrid.test.js`
Expected: FAIL — `Cannot find module '../web/src/lib/cardGrid.js'`.

- [ ] **Step 3: Créer cardGrid.js et supprimer zoom.js**

Créer `web/src/lib/cardGrid.js` :

```js
// Card sizing for the deck panel's grid.
//
// THE CHANGE THIS FILE RECORDS: the deck panel used to size its cards from a
// persisted zoom percentage, with a slider in the head. It now uses the card
// SELECTOR's grid rule verbatim -- `repeat(auto-fill, minmax(120px, 1fr))` --
// so one card is one size across both surfaces, and the way to see more or
// fewer cards is to drag the panel wider or narrower, exactly as it is in the
// selector. Owner decision, 2026-08-03.
//
// The consequence worth stating: the CSS owns the layout now. Nothing here
// sets a column width. `deckCardWidth` exists only to PREDICT the width the
// browser will compute, because `deckThumbWidth` still has to pick which
// proxy thumbnail to request, and a `1fr` column has no width in JavaScript.
// A prediction that drifts costs a slightly wrong thumbnail size, never a
// broken layout.

// Natural source-image width. Cards are never drawn wider than this: past it
// the proxy has nothing left to serve and we would just upsample.
export const SOURCE_WIDTH = 570;

// Mirrors `.grid` in styles.css, which both surfaces now use — keep in sync.
export const GRID_MIN_WIDTH = 120;
export const GRID_GAP = 10;

// .deckpanel-body has `padding: 10px 12px` in styles.css — keep in sync.
export const BODY_PADDING_X = 24;

// Width available to the card grid inside a panel/sheet of `outerWidth`.
export function deckZoneWidth(outerWidth) {
  const n = Number(outerWidth);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n) - BODY_PADDING_X);
}

// The column width `repeat(auto-fill, minmax(GRID_MIN_WIDTH, 1fr))` will
// produce in a panel of `outerWidth`: as many columns as fit at the floor,
// then the leftover shared out between them.
//
// Floored at GRID_MIN_WIDTH so a panel too narrow for even one column still
// names a real thumbnail size instead of zero or a negative.
export function deckCardWidth(outerWidth) {
  const w = deckZoneWidth(outerWidth);
  if (!(w > 0)) return GRID_MIN_WIDTH;
  const cols = Math.max(1, Math.floor((w + GRID_GAP) / (GRID_MIN_WIDTH + GRID_GAP)));
  return Math.max(GRID_MIN_WIDTH, Math.floor((w - GRID_GAP * (cols - 1)) / cols));
}
```

```bash
git rm web/src/lib/zoom.js test/zoom.test.js
```

- [ ] **Step 4: Purger le zoom d'App.jsx**

Supprimer l'import ligne 11. Supprimer les lignes 41-50 (le commentaire sur `cardZoom` et le `useState`), en conservant `const isMobile = useIsMobile();` qui remonte alors avec le reste des hooks. Supprimer le `useEffect` lignes 62-64. Supprimer `zoom={cardZoom}` et `onZoom={setCardZoom}` aux deux appels de `DeckPanel` (lignes 270-271 et 296-297).

- [ ] **Step 5: Purger le zoom de DeckPanel.jsx**

- Ligne 18 : remplacer l'import par `import { deckZoneWidth, deckCardWidth } from '../lib/cardGrid.js';`
- Lignes 138-139 : supprimer les props `zoom` et `onZoom` de la signature.
- Lignes 166-170 : supprimer l'état `showZoom` et son commentaire.
- Lignes 245-262 : remplacer le bloc de calcul par :

```js
  // The card grid uses the card selector's rule verbatim (see lib/cardGrid.js),
  // so a card is the same size on both surfaces and the panel's width is what
  // changes the density -- the same lever the selector has always had.
  //
  // The zone's outer width comes from data we already hold — the `width` prop
  // on desktop, the viewport on the full-screen sheet — rather than from a
  // measured DOM node, which keeps deckCardWidth a pure function. It feeds the
  // THUMBNAIL choice only; the layout itself is the .grid rule in styles.css.
  const outerWidth = asSheet
    ? (typeof window !== 'undefined' ? window.innerWidth : DEFAULT_WIDTH)
    : width;
  const thumbW = deckThumbWidth(deckCardWidth(outerWidth));
```

- Lignes 264-283 : supprimer le bloc `zoomControl` en entier.
- Supprimer toute occurrence restante de `gridStyle` : la grille du deck reçoit désormais sa mise en page par la classe CSS seule. Chercher `gridStyle` dans le fichier et retirer l'attribut `style={gridStyle}` du conteneur de la grille, en s'assurant que ce conteneur porte bien `className="grid"`.
- Lignes 420-430 : supprimer le bouton `.ztabs-zoom` et la rangée `{asSheet && showZoom && <div className="sheet-zoom">{zoomControl}</div>}`. La `<div className="ztabs-row">` n'a plus qu'un enfant ; la garder telle quelle, la classe porte la bordure basse.

`deckZoneWidth` n'est plus utilisé directement par le composant si `deckCardWidth` l'appelle en interne : retirer l'import inutilisé le cas échéant.

- [ ] **Step 6: Purger le CSS et l'i18n**

`web/src/styles.css` : supprimer `.deckpanel-zoom`, `.deckpanel-zoom input[type="range"]`, `.deckpanel-zoom-val`, `.ztabs-zoom`, `.ztabs-zoom:hover, .ztabs-zoom.on`, `.sheet-zoom`, `.sheet-zoom .deckpanel-zoom`.

Vérifier que le conteneur de la grille du panneau possède bien la règle du sélecteur. Si le panneau utilise une classe qui lui est propre, lui donner la même déclaration que `.grid` plutôt que de dupliquer les valeurs :

```css
/* The deck grid IS the selector's grid: one rule, one card size, one place to
   change it. Duplicating the numbers here is what let the two drift before. */
.deckpanel-body .grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
```

`web/src/lib/i18n.js` : retirer `'panel.zoom'` des trois blocs.

`web/src/lib/lang.js:79-82` : le commentaire de `deckThumbWidth` parle encore de la glissière. Le réécrire :

```js
// Thumbnail width to request from the proxy for a deck-panel card displayed at
// `cardW` px. Quantized to 100px steps (floor 200, cap 570 = source width) so
// the handful of panel widths a player actually drags to yield a handful of
// distinct, cache-friendly URLs while staying >= the on-screen size.
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: 0 échec. `test/zoom.test.js` a disparu, `test/cardGrid.test.js` l'a remplacé : le compte de fichiers est inchangé. Toute référence oubliée à `lib/zoom.js` fait échouer un fichier **à la compilation** — lire le compte de fichiers.

- [ ] **Step 8: Vérifier dans le navigateur**

Run: `npm run dev`

1. Aucune glissière dans l'en-tête du panneau, aucun bouton `%` dans la barre d'onglets.
2. Les cartes du panneau ont visiblement la taille de celles du sélecteur.
3. Élargir le panneau par son bord gauche : le nombre de colonnes augmente, comme dans le sélecteur.
4. En mobile (réduire la fenêtre ou utiliser les outils de développement), la feuille plein écran affiche la même grille, sans rangée de zoom.
5. `localStorage` peut encore contenir `meccg.cardZoom` — c'est voulu, plus personne ne la lit.

- [ ] **Step 9: Commit**

```bash
git add -A web/src/lib/cardGrid.js test/cardGrid.test.js web/src/App.jsx web/src/components/DeckPanel.jsx web/src/lib/lang.js web/src/lib/i18n.js web/src/styles.css && git commit -m "feat: the deck grid drops its zoom slider for the card selector's own rule"
```

---

## Task 10 : l'en-tête du panneau

**Files:**
- Modify: `web/src/components/DeckPanel.jsx:387-408` (l'en-tête), `:370-378` (le badge replié)
- Modify: `web/src/lib/i18n.js` — `panel.titleNamed`, trois langues
- Modify: `web/src/styles.css:650-658`
- Test: aucun test unitaire ; vérification navigateur.

**Interfaces:**
- Consumes: Task 1 (`totalCopies`), Task 9 (en-tête déjà débarrassé du zoom).
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1: Remplacer le titre et supprimer les pastilles**

Dans `web/src/components/DeckPanel.jsx`, importer `totalCopies` à la ligne 12 :

```js
import { backGroupForType, totalCopies } from '../lib/deck.js';
```

Juste avant le `return` du composant (à côté de `sbMax` / `poolMax`, vers la ligne 313) :

```js
  // The header's own count. totalCopies, not counts.total: counts.total is the
  // PLAY DECK, which is what the three pills that used to sit here reported --
  // and reporting a partial number under the word "Total", beside zone tabs
  // that each report their own, is what made them worth removing.
  const deckTotal = totalCopies(quantities, zones);
  // Same derivation and same class as DeckManager's list rows, so the badge a
  // deck wears in the list is the badge it wears open. Freeform has no side.
  const sideKey = deckbuilding && deck.ruleset ? deck.ruleset.side : 'freeform';
```

Remplacer le bloc lignes 393-406 :

```jsx
        <b>{deck && deck.name ? t('panel.titleNamed', { name: deck.name }) : t('panel.title')}</b>
        <span className={`side-badge ${sideKey}`}>{t(`side.${sideKey}`)}</span>
        <span className="muted deckpanel-total">({deckTotal})</span>
```

en gardant le bouton de repli et le bouton d'agrandissement où ils sont. Le `<div className="deckpanel-counts">…</div>` disparaît entièrement.

Lignes 370-378, le rail replié compte aussi le deck entier :

```jsx
  if (collapsed) {
    return (
      <div className="deckpanel collapsed">
        <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.expand')}>
          <span className="chevron">‹</span>
          {/* The same number the open header shows: two totals for one deck,
              differing by whichever zones one of them forgot, is worse than
              either. */}
          <span className="deckpanel-badge">{deckTotal}</span>
        </button>
      </div>
    );
  }
```

Attention : ce bloc `if (collapsed)` s'exécute **avant** la déclaration de `deckTotal` dans le corps actuel. Déplacer les trois déclarations (`deckTotal`, `sideKey`, et ce dont elles dépendent) au-dessus du `if (collapsed)`, sinon la constante est utilisée avant son initialisation.

- [ ] **Step 2: Ajouter la clé de titre**

`web/src/lib/i18n.js`, à côté de chaque `'panel.title'` :

```js
'panel.titleNamed': 'Deck « {name} »',   // fr
'panel.titleNamed': 'Deck "{name}"',     // en
'panel.titleNamed': 'Mazo «{name}»',     // es
```

- [ ] **Step 3: Ajuster le CSS**

`web/src/styles.css` : supprimer `.deckpanel-counts`. Si `.count-pill` ne sert plus nulle part, le supprimer aussi — le vérifier par une recherche sur `count-pill` dans `web/src` avant de retirer la règle. Ajouter :

```css
/* Pushes the count to the far end of the head, so the deck's name and its
   side badge stay together as one label. */
.deckpanel-total { margin-left: auto; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: Vérifier dans le navigateur**

Run: `npm run dev`

1. L'en-tête lit `Deck « <nom> »`, la pastille de camp, puis `(N)` à droite.
2. `N` change quand on ajoute une carte à la réserve, au talon **et** au talon anti-SD — pas seulement à la pioche.
3. Un deck freeform porte la pastille grise `Libre` / `Freeform`.
4. Replier le panneau : le badge du rail montre le même `N`.
5. Réduire le panneau à sa largeur minimale (280px) : le titre passe à la ligne proprement, rien ne déborde.
6. Aucune pastille Total / Pioche / Sites nulle part.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: 0 échec.

```bash
git add web/src/components/DeckPanel.jsx web/src/lib/i18n.js web/src/styles.css && git commit -m "feat: the deck panel header names the deck, its side and its real total"
```

---

## Task 11 : documentation et vérification finale

**Files:**
- Modify: `docs/ARCHITECTURE.md` — §4, §6, §7, §9, §10, §12, §13, §14, §15 + la date en tête
- Modify: `README.md`

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: la mémoire technique du projet, à jour. **Une fonctionnalité n'est pas terminée tant que ce fichier ne l'est pas.**

- [ ] **Step 1: Lire le protocole avant d'écrire**

Lire `docs/ARCHITECTURE.md` §0 : il dicte quelle section reçoit quel type de changement, les règles d'écriture et la *definition of done*. Le suivre à la lettre plutôt que d'improviser une structure.

- [ ] **Step 2: Mettre à jour chaque section**

| Section | Ce qu'on y écrit |
|---|---|
| §4 | La quatrième zone `sideboardFw`, ce que `normalizeDeck` en garantit, `totalCopies` sur quatre zones, et les alias d'en-tête que l'import lui reconnaît. |
| §6 | `zonesFor`/`zoneTargets` étendus et **pourquoi Site/Region gardent un `extra` vide** ; le passage de `scope: { zone }` à `scope: { zones }` ; `SIDEBOARD-FW-MAX` ; le fait que `dropTargets.js` n'a pas bougé, et que c'est la preuve que la garantie qu'il revendique tient. |
| §7 | Le nouvel ordre d'export : Pool → Play deck → Locations → Sideboard → Sideboard vs FW. |
| §9 | Les clés ajoutées, le vocabulaire `Talon vs SD`, `SD` = Sorcier déchu, et le retrait de `panel.zoom`. |
| §10 | L'en-tête refondu, la grille alignée sur le sélecteur, les pastilles élargies, `.ztab.optional` et `.ztab.drop-over`. |
| §12 | Deux décisions datées 2026-08-03 : (a) la grille du panneau adopte celle du sélecteur, le CSS reprend la mise en page au JS ; (b) la sous-limite avatar 1.6.2 est lue comme combinée sur les deux talons — une interprétation, à signaler comme telle. |
| §13 | La zone 1.6.1 est livrée ; la glissière de zoom et les pastilles d'en-tête sont retirées. |
| §14 | La clé `meccg.cardZoom` reste orpheline dans `localStorage`, sans migration. Et : le compteur des listes de decks (`deckStore.list()`) reste sur la pioche seule tandis que l'en-tête du panneau compte tout le deck — deux nombres différents pour un même deck selon la surface, non traité dans ce lot. |
| §15 | Une entrée datée 2026-08-03 résumant le lot. |

Mettre à jour la date en tête du fichier.

- [ ] **Step 3: Mettre à jour le README**

Deux changements visibles par l'utilisateur : la nouvelle zone de deck (à quoi elle sert, comment on la remplit) et la disparition de la glissière de zoom (la largeur du volet la remplace). Rester au niveau de détail des entrées voisines.

- [ ] **Step 4: Vérification finale**

```bash
npm test
```

Expected: **0 échec**. Lire le compte de **fichiers** autant que celui de tests.

```bash
npm run build
```

Expected: build réussi, aucune erreur d'import non résolu (`lib/zoom.js` a disparu).

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md README.md && git commit -m "docs: the Fallen-wizard sideboard, the fixed card grid and the new header"
```

---

## Auto-revue du plan

**Couverture du spec** — chaque section du spec a une tâche : §3 → T1 · §4.1-4.2 → T2 · §4.3 → T3 · §4.4 → T4 · §5 → T6 · §6 → T5 · §7.1 → T10 · §7.2 → T9 · §7.3-7.4 → T8 · §7.5 → réparti entre T2, T4, T9, T10 · §8 → intégré à chaque tâche · §9 → T11.

**Écart assumé par rapport au spec** — le spec annonçait une clé `cap.SIDEBOARD-FW-MAX`. Elle est retirée : les clés `cap.*` ne servent que les règles `hard: true` que `copyCaps` produit et que le bouton `+` refuse, or `SIDEBOARD-FW-MAX` est un contrôle du validateur. L'ajouter aurait créé une clé morte qu'aucun test n'aurait attrapée.

**Cohérence des noms** — `sideboardFw` partout (état, import, export, CSS, i18n) · `SIDEBOARD_FW_MAX` la constante · `SIDEBOARD-FW-MAX` l'id de règle · `deckCardWidth` en T9 est bien celle appelée par `DeckPanel` · `optional` la prop de `ZoneTabs`, `optionalTabs` le `Set` que `DeckPanel` lui passe.

**Point à surveiller à l'exécution** — deux attendus chiffrés de `test/cardGrid.test.js` (163 et 120/121) sont à revérifier à la main avant de coder ; l'étape 1 de la Task 9 le dit explicitement.
</content>
