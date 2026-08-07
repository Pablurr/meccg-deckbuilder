# Sélection des cartes à l'export — design

Date : 2026-08-05
Branche : `export-card-selection` (depuis `dev`)

Permettre à l'utilisateur d'exporter **un sous-ensemble** du deck au lieu du deck entier,
dans les trois formats (ZIP MPC, planches PDF, liste texte). Le comportement actuel —
exporter tout — reste le défaut et n'est pas modifié.

---

## 1. Ce qui existe aujourd'hui

`ExportDialog.jsx` calcule une seule liste, en une expression
([`ExportDialog.jsx:54`](../../../web/src/components/ExportDialog.jsx)) :

```js
const orderedCards = flattenSections(deckSections({ quantities, zones, cardsById, lang: uiLang }))
  .flatMap((e) => Array(e.count).fill(e.card));
const orderedCardIds = orderedCards.map((c) => c.id);
```

`deckSections()` produit la hiérarchie **section → groupe → carte** dans l'ordre d'export
canonique (§7 de `ARCHITECTURE.md`), et `flattenSections()` l'aplatit. La structure dont a
besoin une grille de sélection existe donc déjà : rien à ajouter dans
`lib/export/deckSections.js`.

**Mais les trois formats ne consomment pas la même chose**, et c'est le fait central de ce
design :

| Format | Ce que reçoit l'exporteur |
|---|---|
| ZIP MPC | `cardIds` — la liste plate ci-dessus |
| PDF | `cardIds` — la même |
| Liste texte | **`quantities` et `zones` bruts**, jamais `cardIds` |

`buildDeckListText(cardsById, quantities, deck.name, listLang, { zones, … })`
([`ExportDialog.jsx:91`](../../../web/src/components/ExportDialog.jsx)) refait son propre
`deckSections()` en interne à partir du deck complet. **Une sélection partielle doit donc
être projetée dans les deux formes**, pas seulement en liste d'ids. C'est le piège
principal de cette fonctionnalité : filtrer `cardIds` seul donnerait un ZIP et un PDF
partiels mais une liste texte toujours complète, sans le moindre signal d'erreur.

## 2. Décisions déjà prises

| Question | Décision |
|---|---|
| Portée | **Une sélection commune** aux trois formats, pas une par format |
| État initial | **Tout coché** — on décoche ce qu'on ne veut pas |
| Persistance | **Éphémère** : perdue à la fermeture d'`ExportDialog`, jamais écrite en `localStorage` |
| Emplacement | Case « Export partiel » dans `ExportDialog`, sous le compteur ; ouvre une seconde modale |
| Granularité « tout cocher » | **Section *et* sous-groupe** |
| Représentation d'une carte à N exemplaires | **Une vignette + N petites cases** |
| Annuler | Jette les changements, retour à la modale d'export |
| Recherche texte | **Hors périmètre** ; on replie/déplie les groupes à la place |

## 3. Architecture — un module pur, une coquille JSX

**Contrainte du dépôt** : il n'y a ni `jsdom` ni `@testing-library/react` dans les
`devDependencies`, et aucun test ne rend un composant React. Le pattern en vigueur est
d'exporter la logique pure depuis le fichier de composant et de la tester directement —
`test/zoneTabs.test.js` importe `tabPresentation` depuis `ZoneTabs.jsx` et ne rend rien.

Ce design suit ce pattern plutôt que d'introduire une dépendance de test : **toute la
logique de sélection vit dans un module pur**, et le JSX n'est qu'une coquille de rendu.
Ce qui n'est pas testable au niveau unité se réduit ainsi au placement des pixels.

### 3.1 Nouveau module — `web/src/lib/export/selection.js`

Sans React, sans DOM. Le vocabulaire est le **slot** : un exemplaire physique d'une carte à
une position donnée.

```js
// La liste plate et ordonnée des slots sélectionnables, dans l'ordre d'export canonique.
// -> [{ key, sectionId, groupId, cardId, copyIndex }]
export function buildSlots(sections)

export function allKeys(slots)                    // -> Set — le défaut « tout coché »
export function toggle(selected, key)             // -> nouveau Set
export function setMany(selected, keys, value)    // -> nouveau Set (groupe, section, Ctrl+A)
export function selectRange(selected, orderedSlots, anchorKey, targetKey, value)
export function groupState(selected, keys)        // -> 'all' | 'none' | 'partial'

export function selectedCardIds(slots, selected)          // pour le ZIP et le PDF
export function selectedQuantitiesZones(slots, selected)  // pour la liste texte
```

Toutes les fonctions sont **pures** : elles rendent un nouveau `Set` et ne mutent jamais
celui qu'on leur passe.

### 3.2 La clé d'un slot inclut la section — ce n'est pas un détail

```
`${sectionId}:${groupId}:${cardId}:${copyIndex}`
```

Une même carte peut apparaître dans **plusieurs sections** : deux exemplaires dans la
pioche et un dans le talon sont trois slots distincts, et le commentaire de
[`ExportDialog.jsx:50-53`](../../../web/src/components/ExportDialog.jsx) dit déjà qu'elle
s'imprime « une fois par exemplaire, dans chaque section où elle apparaît ». Une clé
réduite à `cardId` fusionnerait ces slots : décocher l'exemplaire du talon décocherait
aussi ceux de la pioche, en silence. Le `groupId` y est pour la même raison, un cran plus
bas.

`copyIndex` est un simple compteur `0..count-1`. **Quel** exemplaire est coché n'a aucune
importance — deux copies de la même carte sont interchangeables à l'impression. Seul leur
*nombre* compte, et l'itération ordonnée des slots le produit sans qu'on ait à compter.

### 3.3 Les deux projections

`selectedCardIds` est direct, et l'ordre canonique tombe tout seul puisque les slots sont
déjà construits dans cet ordre :

```js
slots.filter((s) => selected.has(s.key)).map((s) => s.cardId)
```

`selectedQuantitiesZones` reconstruit la paire `{ quantities, zones }` attendue par
`buildDeckListText`, en comptant les slots cochés par section :

| Section | Destination |
|---|---|
| `pool` | `zones.pool` |
| `play` | `quantities` |
| `locations` | `quantities` |
| `sideboard` | `zones.sideboard` |
| `sideboardFw` | `zones.sideboardFw` |

**`play` et `locations` retournent tous les deux dans `quantities`** : `deckSections()` les
avait séparés en lisant `backGroupForType(card.type)`
([`deckSections.js:64-65`](../../../web/src/lib/export/deckSections.js)), et la projection
inverse les refusionne. Les fabriquer comme deux dictionnaires distincts produirait une
liste texte à laquelle il manque le deck de sites.

Rien de tout cela ne réimplémente `deckSections()` : la projection **repart** de la sortie
de `deckSections()`, elle ne la recalcule pas. La source unique d'ordre reste intacte.

### 3.4 Conséquence assumée : une liste texte partielle ne fait plus l'aller-retour

§7 de `ARCHITECTURE.md` insiste sur le cycle export → import : un `.txt` exporté se recolle
tel quel dans la fenêtre d'import. **Une liste texte partielle rompt cette promesse** — elle
se réimporte en un deck amputé, sans avertissement.

C'est accepté, parce que c'est littéralement ce que l'utilisateur a demandé, et parce que
l'export complet reste le défaut. Aucun marqueur « partiel » n'est écrit dans le fichier :
ce serait un jeton de plus à faire lire à l'import (§4), pour une asymétrie que le bloc
`## Metadata` ne peut de toute façon pas restaurer. **La conséquence est documentée dans
`ARCHITECTURE.md` §7 plutôt que compensée dans le format.**

Les noms de fichiers ne changent pas non plus. La parité caractère pour caractère entre
`safeFileName` et l'assainissement d'`ExportDialog` est épinglée par un test (§7) ; y
greffer un suffixe `_partial` mettrait cet invariant en jeu pour un confort mineur.

## 4. `ExportDialog.jsx` — les changements

Sous la ligne du compteur `t('export.selected', …)`
([`ExportDialog.jsx:157`](../../../web/src/components/ExportDialog.jsx)) :

- Une case à cocher **« Export partiel »**, décochée par défaut. Décochée, tout le chemin
  actuel est inchangé, au caractère près.
- Cochée, le bouton principal devient **« Choisir les cartes »** et ouvre
  `CardSelectionDialog` par-dessus. Après validation, il reprend son libellé normal
  (`export.run.zip` / `.pdf` / `.list`) et lance l'export du sous-ensemble.
- Une fois une sélection validée, un lien discret **« Modifier la sélection »**
  (`export.partial.edit`) rouvre la grille sans repartir de zéro : sans lui, ajuster une
  case obligerait à décocher puis recocher « Export partiel ».
- Le compteur affiche alors le nombre **sélectionné**, pas le total du deck.

L'état vit dans `ExportDialog` :

```js
const [partial, setPartial] = useState(false);
const [selected, setSelected] = useState(null); // null = jamais validé
```

La règle est en un point : **`partial === false` ⇒ `orderedCardIds` tel quel**, quelle que
soit la valeur de `selected`. Le sous-ensemble n'est consulté que si `partial === true` *et*
`selected !== null`.

Les trois états du bouton principal :

| `partial` | `selected` | Bouton |
|---|---|---|
| `false` | peu importe | Libellé d'export normal — chemin actuel intact |
| `true` | `null` | « Choisir les cartes » → ouvre la grille |
| `true` | un `Set` | Libellé d'export normal, + lien « Modifier la sélection » |

- Décocher puis recocher « Export partiel » **conserve** la dernière sélection validée : on
  désactive un filtre, on ne détruit pas un travail de cochage.
- Zéro carte sélectionnée → bouton d'export désactivé, comme l'actuel
  `orderedCardIds.length === 0`.

Le module de sélection étant pur, `ExportDialog` ne fait qu'appeler `selectedCardIds` ou
`selectedQuantitiesZones` selon le format au moment de `runExport()`.

## 5. `CardSelectionDialog.jsx` — la grille

Composant nouveau, purement présentationnel : il reçoit les slots et le `Set`, et rend.
Toute décision passe par `selection.js`.

**Structure** — la hiérarchie de `deckSections()`, telle quelle :

```
▼ [x] Play deck                          (section, case tri-état + chevron)
   ▼ [–] Personnages                     (sous-groupe, case tri-état + chevron)
        [vignette] Aragorn II    [x][x][ ]
        [vignette] Bilbo         [x]
   ▶ [x] Ressources  (12)                (replié)
```

- **Case tri-état** sur chaque en-tête de section et de sous-groupe : `all` / `none` /
  `partial`. Cliquer coche tout si ce n'est pas déjà tout coché, sinon décoche tout.
- **Chevron** de repli/dépliage, indépendant de la case : replier ne change **jamais** la
  sélection, c'est une affaire de vue.
- Une ligne par carte : vignette (via l'aide de `MiniCard`), nom dans `uiLang`, puis une
  petite case par exemplaire.
- Compteur live en tête : `X / Y cartes sélectionnées`.
- Pied : **Valider** (remonte le `Set` à `ExportDialog`, referme) et **Annuler** (referme,
  jette les changements, retour à la modale d'export).

### 5.1 Shift-click

Étend depuis la dernière case cliquée (l'ancre) jusqu'à la case courante, et applique à
toute la plage **le nouvel état de la case shift-cliquée** — convention tableur : shift-clic
sur une case décochée coche toute la plage.

La plage court sur les slots **actuellement visibles**, dans l'ordre canonique : les cases
masquées par un repli sont sautées. C'est le comportement d'un tableur dont on a masqué des
lignes, et c'est aussi le seul qui ne fasse pas basculer en silence des cartes que
l'utilisateur ne voit pas à l'écran.

Le composant filtre la liste des slots par ce qui est déplié et passe **cette** liste à
`selectRange` — ce qui garde le module pur, ignorant de la notion de repli.

### 5.2 Ctrl / Cmd + A

Coche **tout le deck** ; si tout est déjà coché, décoche tout (bascule).

**Portée volontairement différente de celle du shift-clic** : Ctrl+A porte sur l'intégralité,
sections repliées comprises. Le repli est un confort de navigation, pas un filtre ; une
plage de shift-clic est spatiale par nature, « tout sélectionner » ne l'est pas. La règle
énonçable est : *le repli ne restreint que le shift-clic.*

`preventDefault()` est sûr ici — la modale ne contient aucun champ texte (pas de recherche
en v1), donc rien ne réclame le « tout sélectionner » natif du navigateur. **Si une
recherche est ajoutée plus tard, cette hypothèse tombe** et le raccourci devra ignorer les
frappes issues d'un champ.

### 5.3 Le piège de la case tri-état

`indeterminate` est une **propriété DOM, pas un attribut HTML** : React ne la pose pas via
JSX. Il faut une `ref` et un `useEffect`. Écrire `<input type="checkbox" indeterminate={…}>`
ne produit aucune erreur et n'affiche jamais l'état partiel — c'est un échec silencieux.

## 6. Traductions

Les chaînes vivent dans `web/src/lib/i18n.js`, en trois dictionnaires plats — fr (~l. 183),
en (~l. 566), es (~l. 910). `test/i18n.test.js` vérifie que les trois portent les mêmes
clés : **toute clé nouvelle s'ajoute aux trois langues** ou la suite échoue.

Nouvelles clés, préfixe `export.partial.*` et `select.*` :

| Clé | Rôle |
|---|---|
| `export.partial.toggle` | « Export partiel » |
| `export.partial.run` | « Choisir les cartes » |
| `export.partial.edit` | « Modifier la sélection » |
| `select.title` | Titre de la modale |
| `select.count` | « {n} / {total} cartes sélectionnées » |
| `select.all` / `select.none` | Libellés des actions de masse |
| `select.confirm` / `select.cancel` | Boutons du pied |
| `select.hint` | Aide brève : shift-clic, Ctrl/Cmd+A |

Les titres de section et de groupe **réutilisent les clés existantes** (`export.group.*` et
celles des zones). En créer de nouvelles ferait diverger le nom d'une section entre la
grille et le reste de l'application.

Prose française soumise au glossaire imposé (§9) : *pioche, talon, réserve, péril, séide,
progression*. Un test le garde et **n'admet aucune exemption**.

## 7. Tests — `test/exportSelection.test.js`

Tout porte sur `selection.js`, en logique pure :

1. `buildSlots` produit un slot par exemplaire, dans l'ordre canonique de `deckSections()`.
2. **Une carte présente dans deux sections donne des slots de clés distinctes** — le test
   qui protège §3.2. Décocher celui du talon laisse ceux de la pioche cochés.
3. `allKeys` couvre exactement tous les slots.
4. `toggle`, `setMany`, `selectRange` rendent un nouveau `Set` sans muter l'entrée.
5. `selectRange` sur une liste amputée (repli simulé) ne touche pas les slots absents.
6. `groupState` rend bien `all` / `none` / `partial`.
7. `selectedCardIds` préserve l'ordre canonique et le nombre d'exemplaires.
8. **`selectedQuantitiesZones` refusionne `play` et `locations` dans `quantities`** — le
   test qui protège §3.3.
9. **Cohérence des deux projections** : à sélection égale, la liste d'ids et la paire
   `{quantities, zones}` décrivent le même multi-ensemble de cartes. C'est le test qui
   empêche ZIP/PDF et liste texte de diverger.
10. Sélection totale ⇒ `selectedCardIds` égale l'`orderedCardIds` actuel — la non-régression
    du chemin par défaut.

## 8. Hors périmètre

- Recherche ou filtre texte dans la grille.
- Mémorisation de la sélection en `localStorage`.
- Sélection différente par format.
- Toute modification de `deckSections.js`, des exporteurs (`zip.js`, `pdf.js`,
  `deckList.js`) ou du format des fichiers produits.
- L'export massif de deck lists (`deckListZip.js`) reste **toujours complet** : c'est une
  sauvegarde, et une sauvegarde partielle qui n'a l'air de rien est un piège.

## 9. Definition of done

- [ ] `npm test` — 0 échec, y compris les erreurs de transformation esbuild.
- [ ] `docs/ARCHITECTURE.md` : §7 (les deux formes que consomment les exporteurs, et la
      rupture d'aller-retour de la liste partielle), §10 (la nouvelle modale), §15 (journal
      daté), et la date en tête du fichier.
- [ ] `README.md` mis à jour — la fonctionnalité est visible par l'utilisateur.
- [ ] Vérification manuelle sur les trois formats, sélection partielle et complète.
