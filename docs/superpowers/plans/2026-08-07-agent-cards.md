# Cartes « Agent » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la chaîne légalité → zones → validation → affichage consciente du camp, pour qu'un agent MECCG soit traité comme péril en deck Sorcier/Balrog et comme personnage en deck Ombre Noire/Magicien Déchu ; et porter 1.3.B4 (races et mind des personnages du Balrog) du seul plafond de réserve au deck entier.

**Architecture:** Le moteur de règles sait déjà basculer le rôle d'un agent selon le camp (`roleFor`). Trois modules l'ignorent : `isLegalForSide` (qui masque les agents au Sorcier), `zonesFor` (qui leur propose la Réserve) et les regroupements d'affichage (qui les classent par `card.type`). On leur passe le camp, en gardant le paramètre optionnel pour que l'absence de camp conserve le comportement actuel.

**Tech Stack:** Vite + React 18, JSX sans TypeScript, Vitest. Aucune dépendance nouvelle.

Spec de référence : [docs/superpowers/specs/2026-08-07-agent-cards-design.md](../specs/2026-08-07-agent-cards-design.md)

## Global Constraints

- **Prose en français, code en anglais** (identifiants, commentaires, ids de règles, messages de commit). **Les commentaires de test sont du code** : ils s'écrivent en anglais, comme ceux de la production. Si un bloc de code de ce plan porte un commentaire français, c'est une erreur du plan — traduis-le, ne le supprime pas : il porte le *pourquoi*.
- **Vocabulaire FR imposé et gardé par un test** : pioche / talon / réserve / péril / séide / progression. Le mot pour un camp est **camp** (`side`), jamais « faction ». Zéro exemption : corriger la chaîne, jamais ajouter de dérogation au garde.
- **Les ids de règles restent en anglais** (`POOL-ELIGIBLE`, `BALROG-RACE`).
- **Chaque `code` émis par `validateDeck` doit avoir une clé i18n dans les trois langues** (fr, en, es) — garanti par `test/i18n-rules-contract.test.js`.
- **Pas de nouvelle dépendance runtime.**
- **Une source unique de vérité par domaine** : `zones.js`, `copies.js`, `roles.js`, `deckSections.js`, `proxy.js` sont autoritaires. Ne pas réimplémenter leur logique ailleurs.
- **Les commentaires expliquent le *pourquoi* et les pièges, pas le *quoi*.** Tenir le niveau du code voisin.
- **Convention de test du dépôt : les tests utilisent de VRAIES cartes** via `index.get('DM-1')` ou `firstWhere(pred)`, jamais des objets carte fabriqués à la main.
- `npm test` doit finir à **0 échec**, en lisant le compte de **fichiers** autant que celui des tests (une erreur de syntaxe JSX fait échouer un fichier à la compilation esbuild).
- **`docs/ARCHITECTURE.md` doit être à jour dans le même commit** que le code : sections concernées + §15 (journal daté) + la date en tête du fichier.

---

## Structure des fichiers

| Fichier | Rôle après ce plan |
|---|---|
| `web/public/cards.json` | Porte le keyword `Agent` sur 32 cartes ; BA-3 perd son `subtype` |
| `web/src/lib/rules/sides.js` | `requireRaces`/`balrogMindPerCharacterLimit` au niveau du camp ; `isLegalForSide` connaît les agents et 1.3.B4 |
| `web/src/lib/rules/docText.js` | Décrit ces deux contraintes comme des règles de camp, plus de réserve |
| `web/src/lib/rules/zones.js` | `zonesFor`/`zoneTargets`/`moveTargets` acceptent un `sideId` optionnel |
| `web/src/lib/rules/dropTargets.js` | Propage le camp |
| `web/src/lib/import/target.js` | Propage le camp |
| `web/src/lib/rules/validate.js` | Passe le camp à `zonesFor` ; motif `POOL-ELIGIBLE.agent` ; compte les personnages de réserve par rôle |
| `web/src/lib/deckList.js` | `buildGroups` regroupe par rôle |
| `web/src/components/DeckPanel.jsx`, `CardBrowser.jsx` | Passent le camp |
| `web/src/App.jsx` | Passe le camp à `zoneTargets` |
| `web/src/lib/i18n.js` | Clés nouvelles et renommées, en fr/en/es |

**Hors périmètre, délibérément :** `web/src/lib/export/deckSections.js` garde son regroupement par `card.type`. Ses titres de groupe (`Characters`, `Hazards`) sont du **vocabulaire d'import** — `web/src/lib/import/vocabulary.js:82-84` les lit comme des indices de type (`group('Hazard')`). Exporter un agent de type `Character` sous « Hazards » enverrait au parseur un indice qui contredit le type réel de la carte, et casserait l'aller-retour export → import. L'affichage change dans le panneau de deck ; la liste exportée reste ancrée sur le type physique.

---

## Task 1: Les données (`cards.json`)

**Files:**
- Modify: `web/public/cards.json`
- Create: `test/agentData.test.js`

**Interfaces:**
- Consumes: rien (tâche autonome, aucune dépendance de code).
- Produces: les 32 cartes `attributes.agent === true` portent `attributes.keywords` contenant `"Agent"`. `BA-3` n'a plus `attributes.subtype` et son `attributes.keywords` contient `"Spawn"`.

**Contexte indispensable.** `cards.json` fait 3,4 Mo, 63 704 lignes, **indentation d'un espace, fins de ligne CRLF, et aucune newline finale**. Un aller-retour Python est exactement fidèle avec `json.dumps(d, indent=1, ensure_ascii=False).replace('\n', '\r\n')` et rien d'autre — c'est vérifié octet à octet. N'édite pas ce fichier à la main et n'utilise aucun autre jeu de paramètres, sous peine de reformater 63 000 lignes.

Structure : `{ "SET": { "cards": { "DM-1": {...} } } }`. Les cartes visées n'ont aujourd'hui **aucune** clé `keywords` : il faut la créer.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/agentData.test.js` :

```javascript
import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';

const { cards, index } = parseCards(raw);

describe('agent card data', () => {
  it('every card flagged as an agent also carries the "Agent" keyword', () => {
    const agents = cards.filter((c) => c.attributes.agent === true);
    // 30 Character/Minion cards from Dark Minions plus the two Hazard-type
    // agents (DM-28, DM-29). The keyword says "this is an agent", not "this
    // is an agent character", which is why the two hazards carry it too.
    expect(agents).toHaveLength(32);
    for (const c of agents) expect(c.attributes.keywords).toContain('Agent');
  });

  it('the "Agent" keyword is on agents and nowhere else', () => {
    const keyworded = cards.filter((c) => (c.attributes.keywords || []).includes('Agent'));
    expect(keyworded.map((c) => c.id).sort()).toEqual(
      cards.filter((c) => c.attributes.agent === true).map((c) => c.id).sort(),
    );
  });

  it('The Balrog (BA-3) carries Spawn as a keyword, not as a subtype', () => {
    // "Spawn" is not a card subtype: this was the only subtype:"Spawn" in the
    // whole game, a stray entry in the browser's Subtype facet.
    const balrog = index.get('BA-3');
    expect(balrog.attributes.subtype).toBeUndefined();
    expect(balrog.attributes.keywords).toContain('Spawn');
  });

  it('no card is left with a "Spawn" subtype', () => {
    expect(cards.filter((c) => c.attributes.subtype === 'Spawn')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
npx vitest run test/agentData.test.js
```

Attendu : ÉCHEC — `expected undefined to contain 'Agent'`.

- [ ] **Step 3: Écrire le script d'édition et l'exécuter**

Créer le script jetable dans le scratchpad (**pas** dans le dépôt) et le lancer :

```python
import json

p = 'web/public/cards.json'
orig = open(p, encoding='utf-8', newline='').read()
d = json.loads(orig)

touched = 0
for s in d.values():
    for card in s['cards'].values():
        a = card.get('attributes') or {}
        if a.get('agent') is True:
            kw = a.setdefault('keywords', [])
            if 'Agent' not in kw:
                kw.append('Agent')
            touched += 1

balrog = d['BA']['cards']['BA-3']['attributes']
balrog.pop('subtype', None)
kw = balrog.setdefault('keywords', [])
if 'Spawn' not in kw:
    kw.append('Spawn')

assert touched == 32, touched
open(p, 'w', encoding='utf-8', newline='').write(
    json.dumps(d, indent=1, ensure_ascii=False).replace('\n', '\r\n')
)
print('ok', touched)
```

- [ ] **Step 4: Vérifier que le diff est chirurgical**

```bash
git diff --stat web/public/cards.json
```

Attendu : de l'ordre de 35 lignes ajoutées et 1 supprimée — **pas** 63 000 lignes modifiées. Si le diff est massif, le fichier a été reformaté : `git checkout web/public/cards.json` et reprendre l'étape 3 sans toucher aux paramètres de `json.dumps`.

- [ ] **Step 5: Lancer le test pour le voir passer**

```bash
npx vitest run test/agentData.test.js
```

Attendu : PASS, 4 tests.

- [ ] **Step 6: Vérifier qu'aucun test existant ne régresse**

```bash
npm test
```

Attendu : 0 échec. `test/parseCards.test.js` compte 1683 cartes — le nombre ne change pas.

- [ ] **Step 7: Commit**

```bash
git add web/public/cards.json test/agentData.test.js && git commit -m "data: keyword Agent on the 32 agent cards, Spawn off BA-3's subtype"
```

---

## Task 2: La passe agent dans `isLegalForSide`

**Files:**
- Modify: `web/src/lib/rules/sides.js:128-153`
- Test: `test/rules.test.js` (ajouter au `describe('sides data')`, après la ligne 293)

**Interfaces:**
- Consumes: `SIDES[sideId].agents.role` (`'hazard'` | `'character'`), déjà défini lignes 47, 61, 87, 104.
- Produces: `isLegalForSide(card, sideId, openBalrog, bannedIds)` rend `true` pour un agent dont le camp fait un péril, quel que soit son alignement. Signature inchangée.

**Contexte.** Aujourd'hui les 30 agents-personnages sont d'alignement `Minion` et `wizard.alignments` vaut `['Hero','Neutral','Dual']` : la dernière ligne de la fonction les rejette, et `CardBrowser.jsx:148` masque par défaut les cartes illégales. Un joueur Sorcier ne peut donc pas les trouver.

La nouvelle passe se place **après** la passe `specific` et **avant** la passe `openBalrog`. Aucun agent ne porte `specific` aujourd'hui (vérifié sur les 32), mais cet ordre garantit que 1.3.4 primera si la donnée évolue. Le ban, testé en tête de fonction, continue de primer sur tout.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `test/rules.test.js`, à la fin du `describe('sides data', ...)` :

```javascript
  it('isLegalForSide: an agent character is legal for the two camps that count it as a hazard (1.3.W2, 1.3.B2)', () => {
    // Anarin is a Minion-aligned agent. Without a pass of its own it is hidden
    // from the Wizard browser, whose alignments are Hero/Neutral/Dual -- while
    // 1.3.W2 makes it precisely a hazard that camp may play.
    const anarin = index.get('DM-1');
    expect(anarin.attributes.agent).toBe(true);
    expect(anarin.alignment).toBe('Minion');
    expect(isLegalForSide(anarin, 'wizard')).toBe(true);
    expect(isLegalForSide(anarin, 'balrog')).toBe(true);
  });

  it('isLegalForSide: agents stay legal for the camps that count them as characters', () => {
    const anarin = index.get('DM-1');
    expect(isLegalForSide(anarin, 'ringwraith')).toBe(true);
    expect(isLegalForSide(anarin, 'fallen-wizard')).toBe(true);
  });

  it('isLegalForSide: every agent card is visible to all four camps', () => {
    const agents = cards.filter((c) => c.attributes.agent === true);
    expect(agents).toHaveLength(32);
    const { openBalrog } = siteIndex(cards);
    for (const c of agents) {
      for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
        expect(isLegalForSide(c, side, openBalrog)).toBe(true);
      }
    }
  });

  it('isLegalForSide: a ban outranks the agent pass', () => {
    // Same ordering guard the avatar and Balrog-specific passes already have.
    const anarin = index.get('DM-1');
    expect(isLegalForSide(anarin, 'wizard', undefined, new Set(['DM-1']))).toBe(false);
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
npx vitest run test/rules.test.js -t "agent character is legal"
```

Attendu : ÉCHEC — `expected false to be true`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `web/src/lib/rules/sides.js`, insérer juste après le bloc `if (a.specific && SPECIFIC_TO_SIDES[a.specific]) { ... }` et avant `if (openBalrog && ...)` :

```javascript
  // 1.3.W2 / 1.3.B2 -- an agent a camp counts as a HAZARD is playable by that
  // camp whatever its alignment. Without this the 30 Minion-aligned agent
  // characters fail the alignment pass below and the browser hides them from a
  // Wizard deck, which is the one camp 1.3.W2 exists for. Placed after the
  // `specific` pass so 1.3.4 keeps priority if an agent ever gains one.
  if (a.agent === true && side.agents.role === 'hazard') return true;
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

```bash
npx vitest run test/rules.test.js
```

Attendu : PASS, aucun échec dans le fichier.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rules/sides.js test/rules.test.js && git commit -m "fix: an agent is legal for the camps that count it as a hazard (1.3.W2, 1.3.B2)"
```

---

## Task 3: 1.3.B4 comme contrainte de deck entier

**Files:**
- Modify: `web/src/lib/rules/sides.js` (les 4 blocs `pool`, `raceAllowed`, `isLegalForSide`)
- Modify: `web/src/lib/rules/validate.js:238-239`
- Modify: `web/src/lib/rules/docText.js:49-63`
- Modify: `web/src/lib/i18n.js` (2 clés renommées × 3 langues)
- Test: `test/rules.test.js`, `test/docText.test.js`

**Interfaces:**
- Consumes: `isLegalForSide` de la Task 2 (la passe agent doit exister avant celle-ci, sinon les 30 agents tombent sous 1.3.B4).
- Produces: `SIDES[side].characterRaces` (`['Orc','Troll']` pour le Balrog, `null` ailleurs) et `SIDES[side].characterMindLimit` (`9` / `null`). `raceAllowed(card, sideId)` lit `characterRaces`. `SIDES[side].pool` n'a plus `requireRaces` ni `balrogMindPerCharacterLimit`. `sideText(t, side)` remplace la portion correspondante de `poolText`.

**Contexte.** 1.3.B4 dit que **tout** personnage non-avatar d'un deck Balrog doit être Orc ou Troll de mind < 9, sauf les cartes Balrog-spécifiques. La règle est aujourd'hui rangée sous `SIDES.balrog.pool`, ce qui la cantonne à la réserve. Le propriétaire a confirmé qu'elle porte sur le deck entier et doit filtrer le navigateur.

Effet mesuré : **33 personnages** passent masqués par défaut dans un navigateur Balrog — 30 de race non-Orc/Troll, plus LE-20, LE-21, LE-22 (Trolls de mind 9). BA-5 et BA-9 sont eux aussi des Trolls de mind 9, mais **Balrog-spécifiques**, donc exemptés : l'exemption porte sur deux cartes réelles et doit être couverte par un test. (Corrigé le 2026-08-07 : le plan disait 35 et affirmait l'exemption théorique ; les deux étaient faux.)

Le mind se lit avec `parseInt(a.mind, 10)` — la donnée le stocke en chaîne (`"5"`). Une valeur absente ou non numérique ne restreint rien : une donnée qu'on ne sait pas interpréter ne doit jamais masquer une carte en silence, exactement comme un `specific` inconnu.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `test/rules.test.js`, `describe('sides data')` :

```javascript
  it('1.3.B4 is a whole-deck constraint, so it lives on the camp and not on its pool', () => {
    // Filed under `pool`, the rule only ever reached the starting pool, while
    // 1.3.B4 governs every non-avatar character in the deck.
    expect(SIDES.balrog.characterRaces).toEqual(['Orc', 'Troll']);
    expect(SIDES.balrog.characterMindLimit).toBe(9);
    expect(SIDES.balrog.pool.requireRaces).toBeUndefined();
    expect(SIDES.balrog.pool.balrogMindPerCharacterLimit).toBeUndefined();
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard']) {
      expect(SIDES[side].characterRaces).toBe(null);
      expect(SIDES[side].characterMindLimit).toBe(null);
    }
  });

  it('isLegalForSide: a non-Orc, non-Troll character is hidden from a Balrog deck (1.3.B4)', () => {
    const man = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar
      && c.attributes.agent !== true && c.attributes.specific !== 'Balrog'
      && ['Minion', 'Neutral'].includes(c.alignment) && matchesRace(c.attributes.race, 'Man'));
    expect(isLegalForSide(man, 'balrog')).toBe(false);
    expect(isLegalForSide(man, 'ringwraith')).toBe(true);
  });

  it('isLegalForSide: an Orc or Troll at the mind limit is hidden from a Balrog deck (1.3.B4)', () => {
    const bigMind = index.get('BA-5');
    expect(parseInt(bigMind.attributes.mind, 10)).toBe(9);
    expect(isLegalForSide(bigMind, 'balrog')).toBe(false);
  });

  it('isLegalForSide: agents escape 1.3.B4 -- most of them are Men or Elves', () => {
    // Without an exemption the race pass would hide all 32 agents from the
    // Balrog browser, while 1.3.B2 makes them hazards that camp plays.
    const agents = cards.filter((c) => c.attributes.agent === true);
    for (const c of agents) expect(isLegalForSide(c, 'balrog')).toBe(true);
  });

  it('isLegalForSide: a Balrog-specific character escapes 1.3.B4', () => {
    // specificMode 'balrog-exempt'. No real card is both Balrog-specific and
    // out of races today, so this is an ordering guard.
    const balrogAvatar = index.get('BA-3');
    expect(isLegalForSide(balrogAvatar, 'balrog')).toBe(true);
  });

  it('isLegalForSide: an avatar is never judged on 1.3.B4', () => {
    const balrogAvatar = index.get('BA-3');
    expect(balrogAvatar.attributes.race).toBe('Balrog');
    expect(isLegalForSide(balrogAvatar, 'balrog')).toBe(true);
  });

  it('1.3.B4 hides exactly the 35 characters it should, and none was hidden already', () => {
    // Asserted over the real data: this stops a refactor from dropping the
    // pass while the per-card tests above keep passing.
    const { openBalrog } = siteIndex(cards);
    const newlyHidden = cards.filter((c) => c.type === 'Character' && !c.attributes.avatar
      && c.attributes.agent !== true
      && SIDES.balrog.alignments.includes(c.alignment)
      && !isLegalForSide(c, 'balrog', openBalrog));
    expect(newlyHidden).toHaveLength(35);
  });
```

Ajouter dans `test/docText.test.js`, en remplacement du test `'balrog: the universal caps plus the per-character mind-below-9 clause (1.3.B4) and the required-races clause'` (ligne 75) :

```javascript
  it('balrog: the pool text keeps only the universal caps, 1.3.B4 having moved to the camp', () => {
    const pool = SIDES.balrog.pool;
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · ` +
      `docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('balrog: the camp text carries the 1.3.B4 race and mind clauses', () => {
    const side = SIDES.balrog;
    expect(side.characterRaces).toEqual(['Orc', 'Troll']);
    expect(side.characterMindLimit).toBe(9);
    expect(sideText(stubT, side)).toBe(
      `docs.side.characterRaces::{"races":"${side.characterRaces.join(', ')}"} · ` +
      `docs.side.characterMindBelow::{"n":${side.characterMindLimit}}`
    );
  });

  it('a camp without 1.3.B4 constraints has no camp text at all', () => {
    expect(sideText(stubT, SIDES.wizard)).toBe('');
  });
```

Ajouter `sideText` à la ligne d'import de `docText.js` en tête de `test/docText.test.js`.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
npx vitest run test/rules.test.js test/docText.test.js -t "1.3.B4"
```

Attendu : ÉCHEC — `expected undefined to equal [ 'Orc', 'Troll' ]`.

- [ ] **Step 3: Déplacer les clés dans `sides.js`**

Dans les quatre entrées de `SIDES`, retirer `requireRaces` et `balrogMindPerCharacterLimit` de l'objet `pool`, et ajouter deux clés au niveau du camp, à côté de `factionRaces`. Pour `wizard`, `ringwraith` et `fallen-wizard` :

```javascript
    characterRaces: null,      // 1.3.B4 -- Balrog only
    characterMindLimit: null,  // 1.3.B4 -- Balrog only
```

Pour `balrog` :

```javascript
    // 1.3.B4 -- non-avatar characters must be Orc or Troll with mind < 9,
    // unless they are Balrog-specific. A WHOLE-DECK constraint: it used to sit
    // under `pool`, which silently reduced it to the starting pool.
    characterRaces: ['Orc', 'Troll'],
    characterMindLimit: 9,
```

Mettre à jour `raceAllowed` :

```javascript
export function raceAllowed(card, sideId) {
  const side = SIDES[sideId];
  if (!side || !side.characterRaces) return true;
  return side.characterRaces.some((r) => matchesRace((card.attributes || {}).race, r));
}
```

- [ ] **Step 4: Ajouter la passe 1.3.B4 à `isLegalForSide`**

Juste après la passe agent ajoutée en Task 2 :

```javascript
  // 1.3.B4 -- a camp may restrict its non-avatar characters by race and mind.
  // Avatars are already returned above; agents are already returned above too,
  // which is what keeps the 32 agents (mostly Men and Elves) visible to the
  // Balrog under 1.3.B2. `specific` cards escaped via SPECIFIC_TO_SIDES above,
  // which is where 'balrog-exempt' is honoured.
  //
  // A mind that is absent or non-numeric restricts nothing: data we cannot
  // read must not silently hide a card, same principle as an unknown
  // `specific` value.
  if (card.type === 'Character' && (side.characterRaces || side.characterMindLimit != null)) {
    if (!raceAllowed(card, sideId)) return false;
    const mind = parseInt(a.mind, 10);
    if (side.characterMindLimit != null && Number.isFinite(mind) && mind >= side.characterMindLimit) return false;
  }
```

- [ ] **Step 5: Mettre à jour le validateur**

Dans `web/src/lib/rules/validate.js`, lignes 238-239, remplacer les deux lectures de `profile.pool.balrogMindPerCharacterLimit` par `profile.characterMindLimit`. La forme du warning `BALROG-MIND` (`params.limit`) ne change pas.

- [ ] **Step 6: Déplacer les fragments de documentation**

Dans `web/src/lib/rules/docText.js`, retirer de `poolText` les deux blocs `balrogMindPerCharacterLimit` et `requireRaces` (lignes 58-61), puis ajouter la fonction sœur :

```javascript
// 1.3.B4 -- the camp-wide character constraints, as short localized fragments
// for the same reason poolText is built that way: both fields are null for
// three of the four camps. Kept out of poolText because they are NOT pool
// rules -- describing them under "starting pool" is what made the rule look
// like a pool cap in the first place.
export function sideText(t, side) {
  const parts = [];
  if (side.characterRaces && side.characterRaces.length) {
    parts.push(t('docs.side.characterRaces', { races: side.characterRaces.map((r) => localize(t, 'race', r)).join(', ') }));
  }
  if (side.characterMindLimit != null) parts.push(t('docs.side.characterMindBelow', { n: side.characterMindLimit }));
  return parts.join(' · ');
}
```

- [ ] **Step 7: Renommer les clés i18n dans les trois langues**

Dans `web/src/lib/i18n.js`, renommer `docs.pool.balrogMindBelow` → `docs.side.characterMindBelow` et `docs.pool.requireRaces` → `docs.side.characterRaces`, dans les blocs fr, en et es. Reformuler le texte français pour qu'il parle du deck et non de la réserve — le laisser dire « réserve » serait une documentation fausse. Vocabulaire imposé : **réserve**, **pioche**, **talon**, **péril**, **camp**.

- [ ] **Step 8: Câbler `sideText` là où `poolText` est rendu**

```bash
grep -rn "poolText" web/src --include=*.js --include=*.jsx
```

Chaque endroit qui rend `poolText(t, profile.pool)` doit aussi rendre `sideText(t, profile)` quand il retourne une chaîne non vide, sous un intitulé de camp et non de réserve.

- [ ] **Step 9: Lancer la suite complète**

```bash
npm test
```

Attendu : 0 échec, y compris `test/i18n-rules-contract.test.js` et le garde de vocabulaire FR.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "fix: 1.3.B4 restricts a Balrog's characters deck-wide, not just its pool"
```

---

## Task 4: `zonesFor` connaît le camp

**Files:**
- Modify: `web/src/lib/rules/zones.js:12-56`
- Modify: `web/src/lib/rules/dropTargets.js:40`
- Modify: `web/src/lib/import/target.js:33`
- Modify: `web/src/components/CardBrowser.jsx:61`
- Modify: `web/src/App.jsx:431`
- Test: `test/rules.test.js`, `test/importTarget.test.js`

**Interfaces:**
- Consumes: `SIDES` de `sides.js` (import nouveau dans `zones.js` — aucun cycle : `sides.js` ne dépend que de `races.js`).
- Produces: `zonesFor(card, sideId)`, `zoneTargets(card, sideId)`, `moveTargets(card, fromZone, sideId)`. `sideId` **optionnel** : omis, la sortie est strictement celle d'aujourd'hui. `isDropAllowed` et la fonction de `import/target.js` gagnent un paramètre `sideId` final, également optionnel.

**Contexte.** `zonesFor` renvoie `primary: 'pool'` pour tout Character non-avatar. Un agent-péril se voit donc offrir la Réserve au glisser-déposer, au menu « déplacer » et à l'import. Le paramètre optionnel suit le précédent d'`openBalrog`/`bannedIds` dans `isLegalForSide` : les appelants qui ne connaissent pas le camp restent corrects, et les tests existants ne bougent pas.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `test/rules.test.js`, `describe('zonesFor')` :

```javascript
  it('an agent character offers no pool to a camp that counts it as a hazard (1.3.W2, 1.3.B2)', () => {
    const anarin = index.get('DM-1');
    for (const side of ['wizard', 'balrog']) {
      expect(zonesFor(anarin, side)).toEqual({ primary: 'deck', extra: ['sideboard', 'sideboardFw'] });
      expect(zoneTargets(anarin, side)).not.toContain('pool');
    }
  });

  it('an agent character keeps the pool for a camp that counts it as a character (1.3.R2, 1.3.F4)', () => {
    const anarin = index.get('DM-1');
    for (const side of ['ringwraith', 'fallen-wizard']) {
      expect(zonesFor(anarin, side)).toEqual({ primary: 'pool', extra: ['deck', 'sideboard', 'sideboardFw'] });
    }
  });

  it('omitting the side keeps every card on its side-blind zones', () => {
    // Regression guard: the parameter is optional, the way openBalrog and
    // bannedIds are for isLegalForSide. A caller that knows no camp must
    // behave exactly as it did before.
    for (const c of cards) expect(zonesFor(c, undefined)).toEqual(zonesFor(c));
  });

  it('an unknown side id changes nothing', () => {
    const anarin = index.get('DM-1');
    expect(zonesFor(anarin, 'not-a-side')).toEqual(zonesFor(anarin));
  });

  it('a non-agent character keeps the pool for every camp', () => {
    const plain = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.agent !== true);
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(zonesFor(plain, side).primary).toBe('pool');
    }
  });

  it('the two Hazard-type agents were never pool-eligible and still are not', () => {
    for (const id of ['DM-28', 'DM-29']) {
      expect(zoneTargets(index.get(id), 'wizard')).not.toContain('pool');
      expect(zoneTargets(index.get(id), 'ringwraith')).not.toContain('pool');
    }
  });
```

Puis, dans le `describe('zoneTargets / moveTargets')` :

```javascript
  it('drag-and-drop refuses the pool for an agent in a Wizard deck', () => {
    const anarin = index.get('DM-1');
    expect(isDropAllowed(anarin, 'pool', 'wizard')).toBe(false);
    expect(isDropAllowed(anarin, 'pool', 'ringwraith')).toBe(true);
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
npx vitest run test/rules.test.js -t "agent character offers no pool"
```

Attendu : ÉCHEC — la sortie contient `primary: 'pool'`.

- [ ] **Step 3: Rendre `zones.js` conscient du camp**

En tête de `web/src/lib/rules/zones.js` :

```javascript
import { SIDES } from './sides.js';
```

Puis la signature et la branche Character :

```javascript
export function zonesFor(card, sideId) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') {
    // 1.7 -- the pool holds up to ten NON-avatar characters, so an avatar's
    // zones are the play deck and the two sideboards only.
    if (a.avatar === true) return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
    // 1.3.W2 / 1.3.B2 -- an agent a camp counts as a hazard takes a hazard's
    // zones: the starting pool holds characters, and for this camp the card is
    // not one. Side-blind callers keep the old answer, which is why sideId is
    // optional -- the same contract openBalrog/bannedIds have in sides.js.
    const side = SIDES[sideId];
    if (a.agent === true && side && side.agents.role === 'hazard') {
      return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
    }
    return { primary: 'pool', extra: ['deck', 'sideboard', 'sideboardFw'] };
  }
```

Le reste de la fonction est inchangé. Propager ensuite :

```javascript
export function zoneTargets(card, sideId) {
  if (!card) return [];
  const z = zonesFor(card, sideId);
  return [...new Set([z.primary, ...z.extra, 'deck'])];
}

export function moveTargets(card, fromZone, sideId) {
  return zoneTargets(card, sideId).filter((zone) => zone !== fromZone);
}
```

- [ ] **Step 4: Propager aux quatre appelants**

- `web/src/lib/rules/dropTargets.js` : ajouter `sideId` en dernier paramètre de `isDropAllowed` et le passer à `zoneTargets` ligne 40.
- `web/src/lib/import/target.js:33` : ajouter `sideId` en dernier paramètre et le passer à `zoneTargets`. Remonter le camp depuis l'appelant, que l'import connaît déjà via le deck.
- `web/src/components/CardBrowser.jsx:61` : passer la prop `side` (déjà reçue ligne 119) à `zonesFor`.
- `web/src/App.jsx:431` : passer `deck.ruleset.side` à `zoneTargets`, en mode deckbuilding uniquement — c'est déjà la branche conditionnelle de la ligne.
- `web/src/components/DeckPanel.jsx:359` (`isDropAllowed`) et `:551` (`moveTargets`) : **ce sont les vraies surfaces de glisser-déposer et de menu « déplacer »**. Les oublier laisse le blocage de la Réserve sans effet dans l'UI, qui est tout l'objet de la tâche. `sideKey` est déjà dérivé de `deck.ruleset.side` ligne 181 ; le passer en mode deckbuilding uniquement. (Ajouté le 2026-08-07 : le plan ne listait que les appelants trouvés par un grep sur `zonesFor`/`zoneTargets`, et manquait les deux qui passent par `dropTargets`/`moveTargets`.)

Vérifier qu'aucun appelant n'a été oublié :

```bash
grep -rn "zonesFor\|zoneTargets\|moveTargets\|isDropAllowed" web/src --include=*.js --include=*.jsx
```

- [ ] **Step 5: Lancer la suite complète**

```bash
npm test
```

Attendu : 0 échec. `test/importTarget.test.js` doit passer sans modification (paramètre optionnel).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: zonesFor takes the camp, so an agent-hazard cannot reach the pool"
```

---

## Task 5: Le validateur

**Files:**
- Modify: `web/src/lib/rules/validate.js:304-320`
- Modify: `web/src/lib/i18n.js` (1 clé × 3 langues)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `zonesFor(card, sideId)` de la Task 4 ; `roleFor(card, side)` (déjà importé ligne 14).
- Produces: le code `POOL-ELIGIBLE` gagne le motif `'agent'` ; la clé i18n `rules.POOL-ELIGIBLE.agent` existe en fr, en et es.

**Contexte.** Ligne 310, `zonesFor(c)` est appelée sans camp : le validateur accepterait encore un agent en réserve. Et le motif `'type'` mentirait — ce n'est pas le type de l'agent qui le disqualifie, c'est le camp. Ligne 316, `c.type === 'Character'` compte l'agent dans le plafond des dix personnages ; c'est redondant une fois la zone bloquée, mais deux sources de vérité qui peuvent diverger finiront par diverger.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `test/rules.test.js`, `describe('validateDeck')` :

```javascript
  it('POOL-ELIGIBLE: an agent forced into a Wizard pool fires with reason "agent", not "type"', () => {
    // The reason matters: it is not the card's type that disqualifies it
    // (it really is a Character), it is the camp that makes it a hazard.
    const out = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { 'DM-1': 1 } },
    });
    const hits = byId(out, 'POOL-ELIGIBLE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.reason).toBe('agent');
    expect(hits[0].params.id).toBe('DM-1');
  });

  it('POOL-ELIGIBLE: the same agent in a Ringwraith pool is perfectly legal', () => {
    const rwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Minion');
    const out = validateDeck({
      ...base, side: 'ringwraith',
      quantities: { [rwAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { 'DM-1': 1 } },
    });
    expect(byId(out, 'POOL-ELIGIBLE')).toHaveLength(0);
  });

*(Corrigé le 2026-08-07 : le plan proposait ici un test « an agent in a Wizard play deck does
not eat a pool character slot ». Il est **vacuous** — il ne peuple jamais `zones.pool`, donc
il ne touche jamais le code modifié et passe aussi bien avant qu'après. N'écris pas ce test.
Voir la note de l'étape 3 : le passage de `c.type === 'Character'` à `roleFor(...).bucket`
est inobservable aujourd'hui, et un commentaire est le bon véhicule pour ça, pas un test.)*
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
npx vitest run test/rules.test.js -t "POOL-ELIGIBLE"
```

Attendu : ÉCHEC — `expected 'type' to be 'agent'` (ou 0 hit).

- [ ] **Step 3: Écrire l'implémentation**

Dans `web/src/lib/rules/validate.js`, boucle de la réserve :

```javascript
    const z = zonesFor(c, side);
    const poolEligible = z.primary === 'pool' || z.extra.includes('pool');
    if (!poolEligible) {
      // 1.3.W2 / 1.3.B2 -- an agent this camp counts as a hazard is a Character
      // by type, so "type" would be a lie: it is the camp that bars it.
      //
      // The `c.type === 'Character'` gate is load-bearing, not decoration.
      // DM-28 and DM-29 are agents whose own type is Hazard, and roleFor
      // short-circuits them to bucket 'hazard' on EVERY camp (roles.js:54 only
      // consults side.agents.role for a Character). Without the gate they would
      // report reason 'agent' -- telling the player their camp reclassified the
      // card, when in truth a Hazard can never sit in the pool on any camp.
      // That is the same lie this reason code exists to remove, pointing the
      // other way.
      const reason = c.type === 'Character' && (c.attributes || {}).agent === true
        && roleFor(c, side).bucket === 'hazard' ? 'agent' : 'type';
      emit('POOL-ELIGIBLE', { id, name: name(c), reason }, `POOL-ELIGIBLE.${reason}`);
      continue;
    }
    if (roleFor(c, side).bucket === 'character') poolChars += n;
```

- [ ] **Step 4: Ajouter la clé i18n dans les trois langues**

Dans `web/src/lib/i18n.js`, à côté de chaque `rules.POOL-ELIGIBLE.type` (lignes ~243, ~626, ~1012). Le texte doit dire que le camp compte cette carte comme un **péril**, et l'orienter vers la **pioche** ou le **talon** — pas vers la réserve. Vocabulaire imposé.

- [ ] **Step 5: Lancer la suite complète**

```bash
npm test
```

Attendu : 0 échec, `test/i18n-rules-contract.test.js` compris.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix: the validator rejects an agent-hazard in the pool, with its own reason"
```

---

## Task 6: L'affichage

**Files:**
- Modify: `web/src/lib/deckList.js:63-70`
- Modify: `web/src/components/DeckPanel.jsx:198,347`
- Test: `test/rules.test.js` (`buildGroups` y est déjà importé, ligne 15)

**Interfaces:**
- Consumes: `roleFor(card, side)` de `roles.js`.
- Produces: `buildGroups(entries, lang, sideId)`. `sideId` **optionnel** : omis, le regroupement reste celui par `card.type`. La forme de sortie ne change pas — `[{ type, items }]`, ordonnée par `TYPE_ORDER`.

**Contexte.** `buildGroups` regroupe sur `card.type` : un agent s'affiche donc sous « Personnages » même dans un deck Sorcier où c'est un péril. `DeckPanel.jsx:198` compte les personnages de réserve de la même façon.

`buildGroups` renvoie des clés de `TYPE_ORDER` (`'Character'`, `'Resource'`, `'Hazard'`, `'Site'`, `'Region'`), pas des buckets de `roleFor` (`'character'`, `'hazard'`, `'resource'`, `'site'`, `'region'`, `'avatar'`). Il faut donc traduire le bucket vers le type d'affichage, et surtout **ne pas** router le bucket `'avatar'` ailleurs que sur `'Character'` : `buildGroups` n'a jamais eu de groupe Avatars et ce plan ne lui en donne pas.

Rappel : `web/src/lib/export/deckSections.js` **ne change pas** — voir la note « Hors périmètre » en tête de plan.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `test/rules.test.js` un `describe` nouveau :

```javascript
describe('buildGroups (display role, 1.3.W2/R2/B2)', () => {
  const anarin = () => index.get('DM-1');
  const plainHazard = () => firstWhere((c) => c.type === 'Hazard' && c.attributes.agent !== true);

  it('groups an agent under Hazard for the camps that count it as one', () => {
    const entries = [{ card: anarin(), qty: 1 }, { card: plainHazard(), qty: 1 }];
    for (const side of ['wizard', 'balrog']) {
      const groups = buildGroups(entries, 'en', side);
      expect(groups.map((g) => g.type)).toEqual(['Hazard']);
      expect(groups[0].items).toHaveLength(2);
    }
  });

  it('groups the same agent under Character for the camps that count it as one', () => {
    const entries = [{ card: anarin(), qty: 1 }];
    for (const side of ['ringwraith', 'fallen-wizard']) {
      expect(buildGroups(entries, 'en', side).map((g) => g.type)).toEqual(['Character']);
    }
  });

  it('omitting the side keeps the old grouping by card type', () => {
    const entries = [{ card: anarin(), qty: 1 }];
    expect(buildGroups(entries, 'en').map((g) => g.type)).toEqual(['Character']);
  });

  it('an avatar still groups under Character, since there is no Avatars group here', () => {
    const avatar = firstWhere((c) => c.attributes.avatar === true && c.type === 'Character');
    expect(buildGroups([{ card: avatar, qty: 1 }], 'en', 'wizard').map((g) => g.type)).toEqual(['Character']);
  });

  it('keeps TYPE_ORDER and drops empty groups', () => {
    const site = firstWhere((c) => c.type === 'Site');
    const entries = [{ card: plainHazard(), qty: 1 }, { card: site, qty: 1 }];
    expect(buildGroups(entries, 'en', 'wizard').map((g) => g.type)).toEqual(['Hazard', 'Site']);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
npx vitest run test/rules.test.js -t "buildGroups"
```

Attendu : ÉCHEC — `expected [ 'Character', 'Hazard' ] to equal [ 'Hazard' ]`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `web/src/lib/deckList.js`, ajouter l'import et remplacer `buildGroups` :

```javascript
import { roleFor } from './rules/roles.js';
```

```javascript
// roleFor's buckets, mapped onto the TYPE_ORDER keys this function has always
// returned. 'avatar' maps to Character on purpose: there is no Avatars group
// here (deckSections.js has one, this does not), and an avatar has always
// shown up among the characters.
const TYPE_BY_BUCKET = { character: 'Character', avatar: 'Character', resource: 'Resource', hazard: 'Hazard', site: 'Site', region: 'Region' };

// Bucket a { card, qty } entry list by TYPE_ORDER, sorted by name within each
// group, dropping empty groups. Shared by the deck panel's zone tabs (play,
// pool, sideboard, location, cards).
//
// With a camp, the grouping follows roleFor rather than card.type, so a
// Wizard's agents are listed among the hazards they actually are (1.3.W2,
// 1.3.B2). Without one -- freeform decks -- the old type grouping stands,
// which is why sideId is optional.
export function buildGroups(entries, lang, sideId) {
  const displayType = (card) => {
    if (!sideId) return card.type;
    return TYPE_BY_BUCKET[roleFor(card, sideId).bucket] || card.type;
  };
  return TYPE_ORDER.map((type) => {
    const items = entries
      .filter((it) => it.card && displayType(it.card) === type)
      .sort((a, b) => cardName(a.card, lang).localeCompare(cardName(b.card, lang)));
    return { type, items };
  }).filter((g) => g.items.length > 0);
}
```

- [ ] **Step 4: Câbler `DeckPanel.jsx`**

Ligne 347, passer le camp — en mode deckbuilding uniquement, `sideKey` étant déjà dérivé de `deck.ruleset.side` ligne 181 :

```javascript
  const groups = tab === 'notes' ? [] : buildGroups(activeEntries, lang, deck.mode === 'deckbuilding' ? sideKey : undefined);
```

Ligne 198, remplacer le filtre `c.type === 'Character'` de `poolCharCount` par le rôle, pour que le compteur affiché et le plafond `POOL-CHARS` du validateur ne puissent pas diverger. Importer `roleFor` depuis `web/src/lib/rules/roles.js` et, en mode deckbuilding, compter `roleFor(c, sideKey).bucket === 'character'`. En freeform, garder `c.type === 'Character'`.

- [ ] **Step 5: Lancer la suite complète**

```bash
npm test
```

Attendu : 0 échec. Vérifier le compte de **fichiers** autant que celui des tests.

- [ ] **Step 6: Vérifier dans le navigateur**

Démarrer l'aperçu, créer un deck en mode deckbuilding camp **Sorcier**, chercher « Anarin » dans le navigateur de cartes. Attendu : la carte est visible sans « tout afficher » ; l'ajouter propose la pioche et les talons mais **pas** la réserve ; elle apparaît sous « Périls » dans le panneau. Refaire avec un deck **Ombre Noire** : la réserve est de nouveau proposée et la carte s'affiche sous « Personnages ». Puis un deck **Balrog** : un personnage Homme est masqué par défaut, révélé et marqué illégal via « tout afficher ».

⚠️ L'extension Dark Reader du propriétaire inverse les couleurs sur localhost. Ne pas conclure à un bug de couleur sans l'avoir désactivée.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: the deck panel lists a camp's agents under the role that camp gives them"
```

---

## Task 7: Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§3, §6, §10, §15, et la date en tête)
- Modify: `README.md` si le changement est visible par l'utilisateur

**Interfaces:**
- Consumes: les six tâches précédentes, toutes livrées.
- Produces: rien de code.

**Contexte.** Règle n°1 du projet : une fonctionnalité n'est pas terminée tant que `docs/ARCHITECTURE.md` n'est pas à jour. Le protocole exact (quelle section pour quel type de changement, règles d'écriture, definition of done) est en **§0** du document — le lire avant d'écrire.

- [ ] **Step 1: Lire le protocole**

Lire **§0** de `docs/ARCHITECTURE.md`, puis les sections à modifier : **§3** (données de cartes), **§6** (moteur de règles), **§10** (composants et UI).

- [ ] **Step 2: Écrire les mises à jour**

À couvrir, en expliquant le *pourquoi* et les pièges, jamais le *quoi* :

- **§3** — le keyword `Agent` est un libellé de filtre ; `attributes.agent` reste le signal autoritaire des règles. `subtype: "Spawn"` n'existe plus. Le piège de `cards.json` : indentation 1 espace, CRLF, pas de newline finale, et l'unique jeu de paramètres `json.dumps` qui round-trip à l'octet près.
- **§6** — `zonesFor` prend un `sideId` optionnel et pourquoi il est optionnel ; `isLegalForSide` a deux passes nouvelles et pourquoi leur ordre relatif aux passes ban / avatar / `specific` est un invariant ; 1.3.B4 a quitté `pool` pour le camp, et pourquoi le laisser sous `pool` était un bug silencieux ; `zones.js` importe désormais `sides.js` et pourquoi cela ne crée pas de cycle.
- **§10** — `buildGroups` regroupe par rôle quand un camp est connu ; et la raison pour laquelle `deckSections.js` ne le fait **pas** (ses titres de groupe sont du vocabulaire d'import, `import/vocabulary.js:82-84`). C'est exactement le genre de décision qui sera re-découverte de zéro sans cette note.
- **§15** — une entrée datée du 2026-08-07.
- **La date en tête du fichier.**

- [ ] **Step 3: Vérification finale**

```bash
npm test
```

Attendu : 0 échec.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: record the side-aware agent handling and the 1.3.B4 move"
```

---

## Auto-relecture du plan

**Couverture de la spec.** Lot 1 → Tasks 2 et 3. Lot 2 → Task 4. Lot 3 → Task 5. Lot 4 → Task 6. Lot 5 → Task 1. Section « Tests » de la spec → répartie sur les six tâches. Aucune exigence de la spec sans tâche.

**Écart assumé par rapport à la spec.** La spec ne mentionnait que `buildGroups` pour l'affichage. L'exploration a montré un second chemin de regroupement, `deckSections.js`, également ancré sur `card.type`. Il est **délibérément exclu**, avec la raison en tête de plan : ses titres de groupe sont lus comme indices de type par le parseur d'import, et l'aller-retour export → import casserait.

**Cohérence des noms.** `characterRaces` / `characterMindLimit` (Task 3) sont employés à l'identique en Tasks 3 et 6. `sideText` est défini en Task 3 step 6 et testé en Task 3 step 1. `TYPE_BY_BUCKET` est local à Task 6. `sideId` est le nom du paramètre partout ; `sideKey` est la variable déjà existante de `DeckPanel.jsx`.
