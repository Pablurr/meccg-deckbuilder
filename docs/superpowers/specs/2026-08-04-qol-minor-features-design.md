# Six améliorations de confort — design

Date : 2026-08-04
Branche : `qol-minor-features` (depuis `dev`)

Six changements indépendants, sans dépendance entre eux sauf mention explicite. Aucun ne
touche au moteur de règles, aux exports images, ni au format de stockage des decks.

---

## 1. La page « ? » devient une page d'aide en deux parties

### État actuel

`RulesDoc.jsx` rend une modale titrée « Règles et modes » : une section de prose
(`docs.intro`, les deux modes, les zones, le vocabulaire, les avertissements, l'application
des règles), puis quatre sections tirées des données (`RULES`, `SIDES`, `LENGTHS`,
`BANNED`). La prose ne parle que des règles ; rien n'y décrit l'import, les exports, le
mode proxy, les decks enregistrés ni les langues. `docs.zones` est devenu faux : il annonce
« quatre zones » et ignore le talon contre un Sorcier déchu.

### Cible

La page est renommée **Aide** (`docs.title`) et se lit en deux parties :

**Partie 1 — Utiliser l'application.** Nouveau composant `web/src/components/FeaturesDoc.jsx`,
qui exporte un fragment de sections (`<section class="doc-prose">`) sans coquille de modale :
`RulesDoc` reste propriétaire de la modale, du titre et du bouton Fermer. Huit rubriques,
chacune un couple de clés `docs.feat.<sujet>Title` / `docs.feat.<sujet>` :

| sujet | contenu |
|---|---|
| `search` | recherche par nom et par texte de carte, facettes (set, type, alignement, rareté, artiste, race, sous-type, compétence), langue d'affichage des noms |
| `modes` | mode libre vs construction de deck — reprend `docs.freeform` et `docs.deckbuilding`, qui migrent ici sans être réécrits |
| `zones` | les cinq zones et leurs onglets : pioche, deck de sites, réserve, talon, talon contre un Sorcier déchu ; ajout au `+`, glisser-déposer entre onglets, plafonds de copies |
| `decks` | enregistrer, charger, renommer, dupliquer, réordonner, supprimer ; stockage local au navigateur, sans compte |
| `import` | coller une liste, choisir « nouveau deck » ou « remplacer », sections et notes reconnues |
| `export` | ZIP MPC, planches PDF (US Letter / A4 / A3), liste texte ; dos personnalisés par groupe |
| `proxy` | le tampon « Proxy » sur le copyright, à l'écran et à l'export |
| `langues` | fr/en/es pour l'interface et les noms ; images disponibles en fr/en/es |

**Partie 2 — Règles.** Les sections existantes, inchangées : tableau des règles avec cases
à cocher, lacunes connues, camps, longueurs, cartes bannies.

Un titre de niveau `<h2>` ouvre chaque partie (`docs.part.featuresTitle`,
`docs.part.rulesTitle`).

### La section « Vocabulaire » disparaît

Sont supprimés : la constante `GLOSSARY` de `RulesDoc.jsx`, le bloc `<dl class="doc-glossary">`,
et les huit clés `docs.glossaryTitle`, `docs.glossaryIntro`, `docs.glossary.play`,
`docs.glossary.sideboard`, `docs.glossary.pool`, `docs.glossary.hazard`,
`docs.glossary.minion`, `docs.glossary.stage`, dans les trois langues.

**Conséquence à assumer, pas à contourner.** `test/i18n.test.js:175` définit `GLOSSARY_KEYS`
comme la *seule* exemption au garde-fou de vocabulaire français : ces six clés sont les
seules autorisées à citer un terme anglais retiré (« sideboard », « play deck », « pool »),
et c'est ce qui donnait au joueur la correspondance avec ses cartes imprimées en anglais.
En les supprimant, cette correspondance quitte l'application.

Le traitement retenu : `GLOSSARY_KEYS` devient un `Set` **vide**, avec un commentaire
expliquant que l'exemption existe toujours mais ne couvre plus aucune clé. Le test
« a glossary entry uses a retired term only inside its « … » citation » est **conservé**
(il itère sur un ensemble vide et passe) : c'est le point d'ancrage si un glossaire
revient. Le test « no FR string outside the glossary uses a retired term » devient
strictement plus strict, ce qui est correct.

**Contrainte directe sur la prose de la partie 1 :** aucune des huit nouvelles rubriques ne
peut employer, en français, `deck de jeu`, `magicien`, `sbire`, `mise en scène`, `danger(s)`,
`pool`, `sideboard`, `play deck`, `minion`, `hazard`, `stage`. Le vocabulaire imposé est
pioche / talon / réserve / péril / séide / progression. La rubrique `export` parle donc de
« périls », jamais de « hazards ». `test/i18n.test.js` échoue sinon.

### Volume

Environ 20 nouvelles clés (8 titres + 8 corps + 2 titres de partie + `docs.title` révisé),
dans **fr, en et es** : le test de parité des ensembles de clés
(`i18n.test.js:28`) échoue si une langue en manque une, et le test de parité des
`{placeholders}` (`i18n.test.js:262`) si les jetons divergent — aucune de ces chaînes n'a
besoin de placeholder, ce qui rend ce second point trivial.

---

## 2. « Ruins & Lairs » → « Ruines & Antres »

Une seule occurrence côté application : `web/src/lib/i18n.js:308`, clé `docs.gap.geann`,
« Ruines & Repaires » devient « Ruines & Antres ». L'anglais et l'espagnol ne bougent pas.

Les autres occurrences (`web/public/cards.json`) sont du texte de carte officiel et ne sont
pas touchées : ce corpus est une donnée d'entrée, pas de la traduction d'interface.

Le terme est ajouté à la liste de vocabulaire français d'`ARCHITECTURE.md` §9. Il n'entre
**pas** dans `RETIRED_FR` : « Repaires » n'a jamais désigné autre chose, ce n'est pas une
rotation de sens, donc il n'y a rien à interdire — juste une occurrence à corriger.

---

## 3. La pilule « talon » vide prend l'aspect « invitation »

`ZoneTabs.jsx` implémente déjà exactement le rendu voulu : quand un onglet appartient à
l'ensemble `optional` **et** que son compteur est nul, il passe `inviting` — bordure en
pointillés (`.ztab.optional`), libellé préfixé `+ `, et **aucun compteur affiché**.

Le changement tient en un mot : `DeckPanel.jsx:314`,
`const optionalTabs = new Set(['sideboardFw'])` devient `new Set(['sideboard', 'sideboardFw'])`.

Conséquences voulues :

- le talon vide n'affiche plus « 0 / 10 » — c'est précisément l'argument déjà écrit dans le
  commentaire d'en-tête de `ZoneTabs.jsx` (« 0 / 10 réclame un budget que le joueur n'a
  jamais choisi ») ;
- dès qu'une carte y entre, la pilule redevient ordinaire, compteur et plafond compris ;
- `tabTitles` n'a pas d'entrée pour `sideboard`, donc l'`aria-label` composé ne s'applique
  pas et le nom accessible reste le texte du bouton. Rien à faire de ce côté.

Le comportement est identique en mode libre, où l'onglet talon n'apparaît de toute façon
que si la zone est non vide — la branche `inviting` y est donc inatteignable, ce qui est
sans effet.

---

## 4. Bouton « Enregistrer » dans le header de la zone de deck

### Le problème de fond

Il n'existe aujourd'hui **aucune notion de « modifié »** dans l'application. Rien n'écrit en
stockage tant que l'utilisateur n'ouvre pas « Mes decks » et ne clique pas sur
« Enregistrer » / « Créer ». Un bouton grisé « s'il n'y a pas de modification en cours »
suppose donc de construire cette notion.

### Empreinte de deck

Nouvelle fonction pure dans `web/src/lib/deck.js` :

```js
export function deckSignature({ deck, quantities, zones })
```

Elle rend une chaîne stable couvrant tout ce qu'une sauvegarde persiste : `name`, `mode`,
`ruleset` (side, length, tournament, ruleOverrides), `notes`, `backAssignments`,
`quantities`, `zones`. Les clés d'objet sont triées avant sérialisation, sinon deux états
identiques produisent deux empreintes différentes selon l'ordre d'insertion — c'est le
piège central de cette fonction et la raison de ses tests.

Ne sont **pas** dans l'empreinte : `id`, `order`, `updatedAt`. Aucun n'est modifiable depuis
l'écran de deck ; les inclure rendrait un deck fraîchement enregistré immédiatement
« modifié ».

### État dans `App.jsx`

Un état `savedSignature` (chaîne, `null` au démarrage). `dirty` est calculé au rendu :

```js
const dirty = deckSignature({ deck, quantities, zones }) !== savedSignature;
```

`savedSignature` est réécrit à quatre endroits, et à quatre seulement :

| moment | valeur |
|---|---|
| montage initial (deck vide) | empreinte de l'état vide → non modifié |
| `loadDeckIntoState` | empreinte de l'état chargé → non modifié |
| `newDeck` | empreinte du nouvel état vide → non modifié |
| après sauvegarde réussie (header **ou** `DeckManager`) | empreinte de ce qui vient d'être écrit |

Un import laisse volontairement le deck **modifié** : le travail importé n'est pas encore
sur disque, et griser le bouton juste après un import donnerait exactement le mauvais
signal.

### Payload de sauvegarde — source unique

`DeckManager.save()` construit aujourd'hui le payload à la main. Le bouton du header ferait
la même chose ailleurs, et les deux divergeraient au premier champ ajouté. Le payload est
donc extrait dans `web/src/lib/deck.js` :

```js
export function deckPayload({ deck, cardIds, quantities, zones, name })
```

`DeckManager.save()` l'appelle (avec son `name` d'édition), le header aussi (avec
`deck.name`). Un champ persisté ajouté plus tard se déclare à un seul endroit.

### Comportement du bouton

Dans le header de `DeckPanel` (variante desktop **et** variante `asSheet` mobile), à côté du
nom du deck : un bouton `Enregistrer` (`decks.save`).

- `disabled` quand `!dirty`.
- Deck déjà enregistré (`deck.id != null`) → `api.updateDeck(deck.id, deckPayload(...))`,
  puis `savedSignature` mis à jour et un « ✓ » transitoire de 2 s à la place du libellé.
- Aucun deck enregistré (`deck.id == null`) → ouvre **Mes decks** (`setShowManager(true)`),
  où le champ nom et le bouton « Créer » existent déjà. C'est l'écran de sauvegarde qui
  permet de régler les paramètres exacts avant création.
- Échec : le message `decks.storageFull` (ou `common.error`) s'affiche sous le header, pas
  dans une alerte — même traitement que dans `DeckManager`.

`App.jsx` porte la fonction `saveDeck()` et passe `dirty`, `onSave` et `saving` aux deux
instances de `DeckPanel`.

---

## 5. Bouton « Suggérer une amélioration »

Un lien-chip à droite du `?`, dans la rangée logo de `FilterBar` (`FilterBar.jsx:173`), qui
héberge déjà le sélecteur de langue, l'interrupteur proxy et le bouton d'aide.

C'est un `<a target="_blank" rel="noreferrer">` stylé `.chip-toggle`, pas un `<button>` : la
destination est une URL, et un lien s'ouvre dans un nouvel onglet, se copie et s'annonce
correctement aux lecteurs d'écran.

URL construite comme `reportRuleUrl` l'est déjà dans `RulesDoc.jsx` :

```
${REPORT_ISSUES_URL}?labels=enhancement&title=<encodé>&body=<encodé>
```

`REPORT_ISSUES_URL` existe (`lib/constants.js:25`). Le titre et le corps sont traduits
(`suggest.issueTitle`, `suggest.bodyTemplate`) : le corps est un court gabarit — ce que tu
voudrais faire, ce que l'application fait aujourd'hui, à quel écran. Le libellé visible est
une ampoule `💡` avec `title` et `aria-label` = `suggest.label`, donc sans texte à faire
tenir dans une rangée déjà chargée sur mobile.

Trois nouvelles clés (`suggest.label`, `suggest.issueTitle`, `suggest.bodyTemplate`) en
fr/en/es.

---

## 6. Export massif depuis « Mes decks »

### Interface

Dans `DeckManager`, chaque ligne reçoit une case à cocher en tête, et une barre au-dessus de
la liste porte « Tout sélectionner » et un bouton « Exporter la sélection (n) », désactivé
tant que rien n'est coché. Les cases s'affichent à l'identique sur desktop et sur mobile —
pas de mode sélection séparé — et le glisser-déposer de réorganisation reste actif pendant
la sélection : cocher n'est pas saisir.

L'état vit dans `DeckManager` (`selectedIds`, un `Set`). Un deck supprimé est retiré de la
sélection au rafraîchissement.

### Format produit

Un seul `.zip`, contenant un `.txt` par deck coché, nommé
`decks-YYYY-MM-DD.zip`. Chaque fichier est produit par `buildDeckListText` — le **même**
générateur que l'export unitaire, ce qui garantit que ces `.txt` se réimportent dans
l'application par le dialogue d'import : l'export massif est donc aussi une sauvegarde.

La langue de liste est celle de l'interface (`uiLang`), sans sélecteur supplémentaire.

Noms de fichiers : même assainissement que l'export unitaire
(`replace(/[^a-zA-Z0-9_-]+/g, '_')`). Deux decks de même nom produiraient deux fois la même
entrée, et JSZip écraserait silencieusement la première — les collisions reçoivent donc un
suffixe `-2`, `-3`, etc. C'est le seul piège réel de cette fonctionnalité et il est couvert
par un test.

### Découpage

Nouveau module `web/src/lib/export/deckListZip.js` :

```js
export async function buildDeckListZip(entries)  // [{ name, text }] -> Uint8Array
```

Pur, sans DOM, testable directement — il ne fait que dédoublonner les noms et empaqueter.
La lecture des decks (`api.getDeck`) et le téléchargement du blob restent dans
`DeckManager`, qui reçoit une nouvelle prop `cardsById` depuis `App.jsx` (elle y existe
déjà, mémoïsée) et `uiLang`.

`DeckManager` passe de 210 à ~280 lignes. C'est encore lisible ; si une septième
responsabilité s'y ajoutait un jour, la liste de decks mériterait son propre composant.

---

## Tests

| fichier | ce qui est couvert |
|---|---|
| `test/deckSignature.test.js` (nouveau) | même état → même empreinte quel que soit l'ordre d'insertion des clés ; chaque champ persisté change l'empreinte ; `id`/`order` ne la changent pas |
| `test/deck.test.js` | `deckPayload` porte tous les champs que `DeckManager.save()` portait |
| `test/deckListZip.test.js` (nouveau) | un fichier par entrée ; collisions de noms suffixées `-2`, `-3` ; zip lisible par JSZip |
| `test/i18n.test.js` | `GLOSSARY_KEYS` vidé ; parité fr/en/es des nouvelles clés ; aucune nouvelle chaîne FR n'emploie un terme retiré |
| `test/docText.test.js` | inchangé — la partie 2 de la page ne bouge pas |
| couverture `ZoneTabs` | un onglet `sideboard` vide et *optional* rend `+ Talon` sans compteur |

`npm test` doit finir à **0 échec**, comptage de *fichiers* inclus (une erreur de syntaxe
JSX fait échouer un fichier à la compilation, pas à l'assertion).

## Documentation

`docs/ARCHITECTURE.md` : §9 (vocabulaire FR, ajout de « Antres » ; disparition du
glossaire et vidage de l'exemption), §10 (bouton Enregistrer dans le header, pilule talon
optionnelle, lien de suggestion), §4 et §5 (`deckSignature`, `deckPayload`, `savedSignature`),
§7 (`deckListZip`), §13 (inventaire), §15 (journal daté) et la date en tête du fichier.

`README.md` : la page d'aide, le bouton Enregistrer et l'export massif sont visibles par
l'utilisateur.

## Hors périmètre

- Pas de sauvegarde automatique ni d'avertissement « modifications non enregistrées » à la
  fermeture de l'onglet. Le bouton rend l'état visible ; en faire un garde-fou est une autre
  décision.
- Pas d'export massif MPC ou PDF : plusieurs decks tirant leurs images simultanément est un
  problème de mémoire navigateur, pas une variante du même bouton.
- Pas de renommage du fichier `RulesDoc.jsx`, qui reste propriétaire de la modale et des
  règles.
