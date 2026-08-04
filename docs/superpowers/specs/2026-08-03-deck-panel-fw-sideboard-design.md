# Panneau de deck : en-tête, zoom fixe, talon anti-Sorcier déchu

**Date** : 2026-08-03
**Branche** : `deck-panel-fw-sideboard` (depuis `dev`)

Cinq changements sur le panneau de deck, dont un seul touche vraiment au modèle : une
nouvelle zone optionnelle, le talon réservé à un adversaire Sorcier déchu (règle 1.6.1).
Les quatre autres sont de l'interface.

---

## 1. Ce qu'on livre

1. **En-tête** — suppression des trois pastilles Total / Pioche / Sites, remplacées par un
   titre porteur : nom du deck, pastille de camp, nombre total de cartes.
2. **Zoom** — suppression de la glissière. La taille des cartes du panneau devient celle du
   sélecteur, et s'adapte comme lui à la largeur disponible.
3. **Nouvelle zone `sideboardFw`** — le talon anti-Sorcier déchu de la règle 1.6.1,
   plafonné à 10 cartes, atteignable par import et par glisser-déposer.
4. **Pastilles de zone élargies**, avec un retour visuel au survol d'un glisser-déposer.
5. Le tout traduit dans les trois langues, exporté, validé et documenté.

**Hors périmètre** : aucune autre zone, aucune refonte de la barre de filtres, aucun
changement au moteur d'export au-delà de l'ajout d'une section.

---

## 2. Décisions prises avant d'écrire ce document

| Question | Choix | Raison |
|---|---|---|
| Taille de carte fixe | La déclaration exacte du sélecteur, `repeat(auto-fill, minmax(120px, 1fr))` | « Taille équivalente » veut dire même densité visuelle ; comme le sélecteur, elle s'adapte quand on élargit le volet. |
| Onglet vide de la nouvelle zone | Pastille en pointillés `+ Talon vs SD`, sans compteur | C'est une cible d'ajout tant qu'elle est vide ; elle devient un onglet normal `3 / 10` dès qu'elle contient une carte. |
| Nomenclature | FR `Talon vs SD` · EN `SB vs FW` · ES `SB vs MC` | Réutilise `side.fallen-wizard` (« Sorcier déchu »), tient dans une pastille, le nom complet et la référence 1.6.1 vivent dans l'infobulle. |
| Plafond de 10 | Contrôle `SIDEBOARD-FW-MAX` indépendant de `SIDEBOARD-MAX` | 1.6.1 dit « up to 10 **additional** cards » : ces cartes ne consomment pas le plafond 30/35/40. |
| Plafonds d'exemplaires | La zone compte dans le scope `'total'` | Ce sont des cartes du deck ; `copies.js` documente déjà que les plafonds sont cumulatifs entre zones. |
| Sous-limite avatar (1.6.2) | **Combinée** sur les deux talons | « one copy of each avatar in the sideboard » : le talon anti-SD *est* du talon. Un plafond par zone autoriserait deux exemplaires du même avatar, ce que la règle ne dit pas. Décision du propriétaire, 2026-08-03. |
| Total affiché en en-tête | `totalCopies`, talon anti-SD compris | Un seul total dans l'interface, sinon deux nombres différents cohabitent. |
| Export | Section propre, après le talon | Sinon l'export perd une information que le deck contient. |

---

## 3. Modèle de deck (ARCHITECTURE §4)

Id de zone : **`sideboardFw`** — anglais, comme `sideboard` et `pool`.

```js
// deck.js — normalizeDeck
const zones = {
  sideboard:   { ...((d.zones && d.zones.sideboard) || {}) },
  pool:        { ...((d.zones && d.zones.pool) || {}) },
  sideboardFw: { ...((d.zones && d.zones.sideboardFw) || {}) },
};
```

Pas de numéro de version de schéma : la compatibilité ascendante tient parce que
`normalizeDeck` s'applique à chaque lecture, et qu'un deck écrit avant ce changement y
gagne une zone vide. C'est l'invariant §4 ; toute évolution du schéma passe par cette
fonction et par elle seule.

`totalCopies(quantities, zones)` ajoute `zones.sideboardFw` à sa somme. C'est ce total qui
alimente l'en-tête (§6) et le badge du rail replié.

---

## 4. Moteur de règles (ARCHITECTURE §6)

### 4.1 `zones.js`

Partout où `'sideboard'` figure dans `extra`, `'sideboardFw'` le suit, **en dernier** —
l'ordre de `extra` pilote l'ordre d'affichage des compteurs du sélecteur, et la zone la
plus rare doit venir après les autres.

| Famille de carte | `zonesFor` après changement |
|---|---|
| Site / Region | `{ primary: 'deck', extra: [] }` — inchangé |
| Avatar | `{ primary: 'deck', extra: ['sideboard', 'sideboardFw'] }` |
| Personnage non-avatar | `{ primary: 'pool', extra: ['deck', 'sideboard', 'sideboardFw'] }` |
| Objet mineur / Stage | `{ primary: 'deck', extra: ['sideboard', 'pool', 'sideboardFw'] }` |
| Défaut | `{ primary: 'deck', extra: ['sideboard', 'sideboardFw'] }` |

Que Site et Region gardent `extra: []` n'est pas un oubli : c'est ce qui rend la zone
inatteignable pour eux **partout à la fois** — glisser-déposer, menu « déplacer vers » et
import — puisque les trois passent par `zoneTargets()`. L'invariant « aucun import ne met
un site au talon » s'étend donc au talon anti-SD sans une ligne de code de plus.

`ZONE_LABEL_KEY` gagne `sideboardFw: 'zones.sideboardFw'`.

### 4.2 `dropTargets.js`

**Aucun changement.** `resolveDropTarget` ne traite spécialement que `play`/`location`/
`cards` ; tout le reste se renvoie à lui-même. `isDropAllowed` est bâti sur `zoneTargets`,
donc il hérite de la nouvelle zone — c'est précisément la garantie que le commentaire du
fichier revendique, et la vérifier par un test est moins cher que la contourner.

### 4.3 `copies.js`

Deux changements.

```js
// remainingCopies — le scope 'total' voit désormais les quatre zones
const total = countIn('deck') + countIn('sideboard') + countIn('pool') + countIn('sideboardFw');
```

Et la forme du scope par zone passe du singulier au pluriel, pour porter la sous-limite
avatar combinée :

```js
// copyCaps — 1.6.2, un exemplaire de chaque avatar au talon, les deux talons confondus
caps.push({
  limit: GENERAL.avatarMaxInSideboard,
  scope: { zones: ['sideboard', 'sideboardFw'] },
  ruleId: 'AVATAR-SIDEBOARD',
});
```

```js
// remainingCopies — un cap par zones contraint la zone visée, et compte les deux
else if (cap.scope.zones.includes(zone)) {
  used = cap.scope.zones.reduce((n, z) => n + countIn(z), 0);
}
else continue;
```

`{ zone }` disparaît au profit de `{ zones }` : une seule forme, pas deux à maintenir.
`validate.js` lit la même structure et suit le même changement.

### 4.4 `formats.js` et `validate.js`

```js
// formats.js — 1.6.1 : +10 quelle que soit la longueur de partie, donc hors de LENGTHS
export const SIDEBOARD_FW_MAX = 10;
```

`validate.js` émet `SIDEBOARD-FW-MAX` quand le talon anti-SD dépasse 10, à côté de
`SIDEBOARD-MAX` et sans interagir avec lui. La boucle qui construit les entrées de
`copyCaps` doit inclure `zones.sideboardFw` dans le total par carte, sans quoi un
exemplaire y échapperait aux plafonds.

`catalog.js` enregistre la règle (id, référence 1.6.1, sévérité, activée par défaut) pour
qu'elle apparaisse dans la doc des règles et reste désactivable comme les autres.

---

## 5. Import (ARCHITECTURE §4, pipeline d'import)

Une entrée dans le `TABLE` de `vocabulary.js` :

```js
[['Sideboard vs FW', 'Sideboard vs. fw', 'Sideboard vs Fallen-wizard',
  'FW sideboard', 'Fallen-wizard opponent sideboard', 'Anti-FW sideboard', 'SB vs FW',
  'Talon vs SD', 'Talon contre Sorcier déchu', 'SB vs MC'], zone('sideboardFw')],
```

`target.js` n'est pas touché : il demande déjà la légalité à `zoneTargets()` plutôt que de
la re-dériver, ce qui maintient l'invariant « un import ne peut pas construire un deck que
l'interface refuserait de construire à la main ».

**Piège à couvrir par un test** : les alias contenant `Sideboard` ne doivent pas être
capturés par l'entrée `Sideboard` existante. L'ordre de résolution et la normalisation des
en-têtes seront vérifiés à l'implémentation, et le test `importVocabulary` figera le
comportement dans les deux sens (un `Sideboard` nu ne va pas dans `sideboardFw`, un
`Sideboard vs FW` n'atterrit pas dans `sideboard`).

---

## 6. Export (ARCHITECTURE §7)

`deckSections.js` gagne une quatrième section, **après** le talon :

```
Réserve → Pioche → Sites → Talon → Talon vs SD
```

Mêmes `GROUP_DEFS` que le talon (personnages / ressources / périls). L'ordre est la source
unique consommée par le PDF, le ZIP et la liste texte : les trois en héritent sans
changement propre. La section porte le titre long (`zones.sideboardFwFull`), pas
l'abréviation de pastille — un export se lit hors contexte.

---

## 7. Interface

### 7.1 En-tête (points 1 et 5)

Le bloc `.deckpanel-counts` — trois pastilles Total / Pioche / Sites — disparaît, ainsi
que le CSS `.count-pill` s'il ne sert plus ailleurs. Il redisait, en moins précis, ce que
les onglets de zone disent déjà.

À la place :

```
Deck « Nom du deck »   [Sorcier déchu]   (108)
```

- Titre : clé `panel.titleNamed`. Deck sans nom → `panel.title` seul.
- Pastille de camp : `<span className={`side-badge ${sideKey}`}>` avec
  `sideKey = deck.mode === 'deckbuilding' ? deck.ruleset.side : 'freeform'` — exactement
  la dérivation et la classe de `DeckManager`, réutilisées et non réécrites, pour que les
  deux surfaces ne puissent pas diverger.
- Compteur : `totalCopies(quantities, zones)`, toutes zones confondues.

Le badge du rail replié passe lui aussi à `totalCopies`, sinon deux totaux différents
cohabitent dans la même interface pour le même deck.

`.deckpanel-head` a déjà `flex-wrap: wrap` : « Sorcier déchu » est le libellé le plus long
et passera à la ligne dans un volet étroit, ce qui est acceptable.

### 7.2 Zoom fixe (point 2)

**Suppressions** : `zoomControl`, l'état `showZoom`, le bouton `.ztabs-zoom`, la rangée
`.sheet-zoom`, les props `zoom` / `onZoom`, l'état `cardZoom` d'`App.jsx` et sa
persistance, la clé i18n `panel.zoom` dans les trois langues.

**`zoom.js` devient `cardGrid.js`**. Ce qui survit, et ce qui part :

| Export actuel | Devenir |
|---|---|
| `BODY_PADDING_X`, `deckZoneWidth` | **Conservés** — la largeur utile du volet reste la même notion. |
| `SOURCE_WIDTH` | **Conservé** — plafond de la vignette, encore lu par `deckThumbWidth`. |
| `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM_MOBILE`, `DEFAULT_ZOOM_DESKTOP`, `ZOOM_STORAGE_KEY`, `clampZoom`, `parseStoredZoom`, `defaultZoom`, `cardWidthFor` | **Supprimés** — plus de pourcentage, donc plus de valeur à valider ni à persister. |
| `MIN_CARD_WIDTH`, `FULL_CONTROLS_CARD_WIDTH` | **Supprimés** — le plancher de grille est maintenant 120px, largement au-dessus des 80px où les contrôles d'une mini-carte se dégradent. La règle `@container` de `styles.css` reste (elle protège encore le rendu), mais la constante qui servait à prouver que les défauts la franchissaient n'a plus d'objet. |

```js
export const GRID_MIN_WIDTH = 120; // miroir de .grid dans styles.css — garder synchronisé
export const GRID_GAP = 10;        // idem

// Largeur de colonne que `repeat(auto-fill, minmax(120px, 1fr))` produira dans un volet
// de `outerWidth`. Sert uniquement à choisir la vignette : le CSS possède la mise en page.
export function deckCardWidth(outerWidth) { … }
```

La grille du panneau reçoit la déclaration exacte du sélecteur ; `deckThumbWidth` continue
de quantifier la vignette par pas de 100px, mais à partir d'une largeur calculée au lieu
d'une largeur choisie à la glissière. Son commentaire, qui parle encore de « zoom slider »,
est réécrit.

Le CSS possède désormais la mise en page, le JS n'en garde qu'une lecture — c'est le
renversement à documenter en §12.

La clé `meccg.cardZoom` reste orpheline dans `localStorage`. Aucune migration : elle est
inoffensive et personne ne la lit plus. Entrée §14.

### 7.3 Pastilles élargies (point 4)

```css
.ztab { padding: 8px 14px; min-height: 34px; gap: 8px; }   /* était 4px 10px, gap 6px */
.ztab.drop-over { border-color: var(--accent); }
```

`ZoneTabs` tient un état `dragOver` (l'id de l'onglet survolé) alimenté par
`onDragEnter` / `onDragLeave`, remis à zéro sur `onDrop`. Aujourd'hui une pastille ne
réagit pas du tout au survol d'une carte traînée : une cible qui ne répond pas ne se lit
pas comme une cible, et c'est la moitié du point 4.

Six onglets dans un volet de 360px passeront sur deux rangées. `.ztabs` a déjà
`flex-wrap: wrap`, rien à ajouter.

### 7.4 La pastille « + Talon vs SD » (point 3.1)

Deckbuilding : `tabs = ['play', 'pool', 'sideboard', 'sideboardFw', 'location', 'notes']`.

| État de la zone | Rendu |
|---|---|
| Vide | `.ztab.optional` — pointillés, atténuée, libellé `+ Talon vs SD`, **sans compteur**. Cliquable, et cible de dépôt à part entière. |
| Non vide | Onglet normal, compteur `3 / 10`. |

Freeform : visible seulement si non vide, comme la réserve et le talon — même règle, même
raison (`normalizeDeck` conserve les zones d'un deck passé en freeform, et ces cartes
doivent rester atteignables).

Le `useEffect` qui rabat sur `tabs[0]` quand l'onglet actif disparaît gagne
`hasSideboardFw` dans ses dépendances.

### 7.5 Traductions (ARCHITECTURE §9) — les trois langues d'un seul tenant

| Clé | FR | EN | ES |
|---|---|---|---|
| `zones.sideboardFw` | Talon vs SD | SB vs FW | SB vs MC |
| `zoneShort.sideboardFw` | T.SD | SBFW | SBMC |
| `zones.sideboardFwFull` | Talon contre un adversaire Sorcier déchu | Sideboard vs a Fallen-wizard opponent | Reserva contra un Mago caído |
| `panel.titleNamed` | Deck « {name} » | Deck "{name}" | Mazo «{name}» |
| `cap.SIDEBOARD-FW-MAX` | Maximum de 10 cartes dans le talon anti-Sorcier déchu. | Maximum 10 cards in the Fallen-wizard sideboard. | Máximo de 10 cartas en la reserva contra Mago caído. |

Plus les clés de règle exigées par le contrat `i18n-rules-catalog` pour
`SIDEBOARD-FW-MAX` (titre, texte, référence), dont la forme exacte est dictée par
`test/i18n-rules-contract.test.js`.

Le `+` de la pastille optionnelle est composé dans le composant, pas dupliqué en clé.

**Vocabulaire FR** : `talon` = sideboard, référent déjà fixé et gardé par un test. Le
nouveau libellé s'y adosse au lieu d'inventer un synonyme. `SD` = Sorcier déchu, forme
déjà employée par `side.fallen-wizard`.

---

## 8. Tests

| Fichier | Ce qu'on y ajoute |
|---|---|
| `test/rules.test.js` | `zonesFor`/`zoneTargets` incluent `sideboardFw` pour chaque famille de carte et **jamais** pour Site/Region ; `isDropAllowed` sur le nouvel onglet ; `remainingCopies` compte la zone dans le scope `'total'` ; sous-limite avatar combinée (un avatar au talon ⇒ zéro restant au talon anti-SD) ; `SIDEBOARD-FW-MAX` à 10 et à 11 ; `SIDEBOARD-MAX` indifférent au contenu de la nouvelle zone. |
| `test/deckModel.test.js` | `normalizeDeck` crée la zone vide, préserve une zone existante, survit à un `zones` absent ; `totalCopies` l'inclut. |
| `test/importVocabulary.test.js` | Les dix alias résolvent vers `sideboardFw` ; un `Sideboard` nu résout toujours vers `sideboard`. |
| `test/importTarget.test.js` | Un site sous un en-tête « Sideboard vs FW » n'atterrit pas dans la zone. |
| `test/deckSections.test.js` | Nouvelle section, position après le talon, groupes corrects, absente quand la zone est vide. |
| `test/cardGrid.test.js` | Remplace `test/zoom.test.js` : `deckCardWidth` reproduit le calcul de `auto-fill` sur une série de largeurs, et les constantes de grille valent bien celles du sélecteur. |
| `test/i18n.test.js` | Parité de clés — automatique, mais c'est lui qui échouera si une des trois langues est oubliée. |

Critère de sortie : `npm test` à **0 échec**, en lisant le compte de *fichiers* autant que
celui de tests (une erreur de syntaxe JSX fait échouer un fichier à la compilation).

---

## 9. Documentation à mettre à jour dans le même commit

| Section | Contenu |
|---|---|
| §4 | Forme du deck : quatrième zone, garantie de `normalizeDeck`, `totalCopies` ; alias d'import de la nouvelle zone. |
| §6 | `zonesFor`/`zoneTargets` étendus ; scope `{ zones }` de `copyCaps` ; `SIDEBOARD-FW-MAX` ; pourquoi `dropTargets.js` n'a pas bougé. |
| §7 | Nouvel ordre des sections d'export. |
| §9 | Nouvelles clés, vocabulaire `Talon vs SD` / `SD`. |
| §10 | En-tête refondu, grille fixe, pastilles élargies, retour visuel de dépôt, pastille optionnelle. |
| §12 | Deux décisions datées : (a) la grille du panneau adopte celle du sélecteur, le CSS reprend la mise en page au JS ; (b) la sous-limite avatar 1.6.2 est lue comme combinée sur les deux talons. |
| §13 | La zone 1.6.1 est livrée ; la glissière de zoom et les pastilles d'en-tête sont retirées. |
| §14 | `meccg.cardZoom` orpheline dans `localStorage`. |
| §15 | Entrée datée 2026-08-03 + date en tête du fichier. |

`README.md` : la nouvelle zone et la disparition de la glissière sont visibles par
l'utilisateur, donc à mentionner.

---

## 10. Risques connus

- **Collision d'alias d'import.** « Sideboard vs FW » contient « Sideboard ». Selon la
  normalisation de `vocabulary.js`, le nouvel en-tête pourrait être avalé par l'ancien.
  Vérification à l'implémentation, test dans les deux sens.
- **Densité du panneau.** Passer de 84px (zoom 25 %) à ~163px dans un volet de 360px
  réduit fortement le nombre de cartes visibles. C'est le comportement demandé : la
  correction se fait en élargissant le volet, exactement comme pour le sélecteur.
- **`{ zone }` → `{ zones }`.** La forme du scope change dans `copies.js` *et* dans
  `validate.js`, qui la lisent tous deux. Une seule des deux mise à jour donnerait un
  plafond silencieusement ignoré — le test d'accord entre le validateur et les boutons `+`
  de `test/rules.test.js` est ce qui l'attrape.
</content>
</invoke>
