# Mémoire technique — MECCG Deck Builder

> **Document de référence unique pour tout agent LLM travaillant sur ce dépôt.**
> Lis la section pertinente **avant** de modifier du code, et **mets ce fichier à jour
> dans le même commit** que ton changement. Le protocole est décrit en §0.
>
> Public : LLM. Style : dense, factuel, pas de prose d'introduction.
> Doc utilisateur : [`README.md`](../README.md). Ce fichier-ci décrit le *comment* et le *pourquoi*.

**Dernière mise à jour : 2026-08-02** — contrôles de zone en lignes horizontales, panneau
de survol des avertissements, vocabulaire FR (Sorcier / Spectre / Séide)
(état : branche `polish-ui-a11y`).

---

## §0 — Protocole de maintenance de ce document

### Quand le mettre à jour

| Tu as fait… | Section(s) à toucher |
|---|---|
| Ajouté / modifié / supprimé une règle | §6, §13, §14 |
| Changé la forme persistée d'un deck | §4 (+ §12 si décision) |
| Ajouté un état dans `App.jsx` | §5 |
| Touché au pipeline d'export ou aux dimensions d'impression | §7 |
| Touché à la géométrie ou aux patchs proxy | §8 |
| Ajouté une clé i18n / une langue / changé le vocabulaire FR | §9 |
| Ajouté un composant, changé le breakpoint mobile, l'a11y | §10 |
| Pris une décision d'architecture ou renoncé à une piste | §12 (nouvelle entrée datée) |
| Livré ou retiré une fonctionnalité utilisateur | §13 |
| Différé sciemment un travail | §14 |
| **Quoi que ce soit** | §15 (journal) + la date en tête de fichier |

### Règles d'écriture

1. **Toute affirmation doit être vérifiable dans le code.** Si tu écris un chiffre, un nom
   de clé, un chemin, tu l'as lu. Pas de « probablement », pas de « il semble ».
2. **Écris le *pourquoi*, pas le *quoi*.** Le code dit ce qu'il fait. Ce document dit
   pourquoi c'est fait ainsi et ce qui casse si on le change.
3. **Datation.** Toute décision et tout report portent une date absolue (`2026-07-26`),
   jamais « récemment » ou « la semaine dernière ».
4. **Ne supprime pas une décision devenue caduque : marque-la `[ABANDONNÉ — date — raison]`.**
   Savoir qu'une piste a été essayée et rejetée vaut autant que la solution retenue.
5. **Pas de duplication du `README.md`.** Le README explique à un joueur comment utiliser
   l'app ; ici on explique à un agent comment la modifier.

### Definition of Done

Une fonctionnalité **n'est pas terminée** tant que :

- [ ] `npm test` passe intégralement (0 échec, y compris la transformation esbuild) ;
- [ ] les sections concernées ci-dessus sont à jour ;
- [ ] §15 porte une ligne datée ;
- [ ] la date en tête de ce fichier est à jour ;
- [ ] si la fonctionnalité est visible par l'utilisateur, `README.md` est à jour aussi.

---

## §1 — Vue d'ensemble et contraintes produit

**Ce que c'est :** une SPA **100 % statique** pour construire des decks
*Middle-earth Collectible Card Game* (MECCG) à partir de la collection *Remastered*
(1683 cartes, 7 sets : AS, BA, DM, LE, TD, TW, WH) et produire des fichiers
**prêts à imprimer** — soit un ZIP d'images pour **MPC (MakePlayingCards)**, soit
des planches PDF, soit une deck list texte.

**Contraintes structurantes — ne pas les enfreindre :**

| Contrainte | Conséquence |
|---|---|
| **Aucun serveur, aucun backend** | Pas de route API, pas de secret, pas de SSR. Tout est `fetch` vers un CDN public ou du calcul navigateur. |
| **Aucun compte, aucune base** | La persistance est `localStorage`. Pas de synchro entre appareils : le transfert de deck passe par l'export texte. |
| **Les images ne sont jamais hébergées ici** | Elles viennent de jsDelivr (`imageBaseUrl[lang] + image`). Le dépôt ne contient que les *dos* de cartes et les *patchs proxy*. |
| **Les exports tournent dans le navigateur** | `canvas` pour le bleed, `pdf-lib` pour les planches, `jszip` pour l'archive. Aucune dépendance native (plus de `sharp`/`pdfkit`/`archiver`). |
| **Rien n'est jamais bloqué en mode Construction** | Le moteur de règles *avertit*. Il n'empêche jamais l'utilisateur d'ajouter une carte, sauf les caps `hard: true` sur le bouton `+`. |

**Usage réel :** personnel, mobile compris (le propriétaire consulte des builds de branche
depuis son téléphone — voir §2).

---

## §2 — Stack, commandes, déploiement

**Stack :** Vite 5 + React 18 (JSX, pas de TypeScript, pas de router, pas de state manager).
Dépendances runtime : **`jszip`** et **`pdf-lib`** uniquement. Tests : **Vitest 2**.
Node 18+ requis *pour builder seulement* ; l'app livrée est du statique.

```bash
npm install
npm run dev       # Vite HMR sur http://localhost:5173
npm run build     # → web/dist
npm run preview   # sert web/dist
npm test          # vitest run
```

**Structure du dépôt**

```
web/src/            toute l'application
  App.jsx           état global, orchestration (~17 Ko — le seul « gros » composant)
  api.js            façade : chargement cards.json, CRUD decks, déclenchement des exports
  i18n.jsx          contexte React + hook useT()
  components/       17 composants, un fichier chacun
  lib/
    rules/          moteur de règles pur (12 modules, aucun import React)
    export/         pipeline d'export pur (10 modules, aucun import React)
    *.js            deck, deckStore, filter, importDeck, lang, proxy, tags, zoom…
web/public/         servi tel quel : cards.json, card-backs/, proxy-patches/, _redirects
test/               26 fichiers Vitest, 370 tests
docs/superpowers/   specs et plans d'implémentation, datés (historique des intentions)
scripts/            make_proxy_patches.py (génération des patchs proxy, hors build)
```

**Déploiement — Cloudflare Pages.** Le nom du projet Pages est **`meccg-deckprint`**,
qui **diffère du nom du dépôt GitHub** (`Pablurr/meccg-deckbuilder`) et n'apparaît
nulle part dans le code (pas de `wrangler.toml`, pas de CI).

- Production : `https://meccg-deckprint.pages.dev`
- Preview par branche : `https://<nom-de-branche>.meccg-deckprint.pages.dev`
- Build : commande `npm run build`, sortie **`web/dist`**, fallback SPA via
  [`web/public/_redirects`](../web/public/_redirects) (`/* /index.html 200`).
- Déploiement direct alternatif : `npx wrangler pages deploy web/dist`.

> **Piège de vérification :** une URL de preview inconnue renvoie le fallback SPA
> (`index.html`, ~403 octets, `text/html`) avec un **HTTP 200**. Un code de statut ne
> prouve donc rien : pour vérifier qu'une preview sert bien le commit poussé, récupère un
> asset qui n'existe *que* sur cette branche et contrôle son contenu.

---

## §3 — Les données de cartes (`cards.json`)

Fichier statique de ~3,5 Mo dans `web/public/`, chargé une fois au montage par
`api.getCards()` → `parseCards()`.

**Forme source :** `{ SETCODE: { imageBaseUrl: {en,es,fr,enOriginal,esOriginal}, cards: { "AS-1": {…} } } }`.

**Forme après `parseCards()`** — `{ cards, facets, index }` :

- `cards` : tableau aplati. Chaque carte porte `id`, `set`, `name{en,es,de,fr,it,nl,fi,ja}`,
  `type`, `alignment`, `attributes{}`, `image` (nom de fichier nu), `imageBaseUrl`
  (recopié depuis le set), `rarity`, `artist`, `relativePath`, `text`.
- `facets` : valeurs uniques triées pour les filtres (sets, types, alignments, rarities,
  artists, races, subtypes, skills, keywords).
- `index` : `Map<id, card>`, mémorisée dans le module `api.js` (`_index`) et requise par
  les exports via `requireIndex()`.

**Répartition :** Resource 767, Hazard 450, Site 220, Character 194, Region 52.
Alignements : Hero, Minion, Neutral, Stage, Balrog, Fallen-wizard, Dual.

### Pièges de données — vérifiés, coûteux à redécouvrir

- **Deux chemins d'image, à ne pas confondre.** `relativePath` désigne une copie *locale*
  historique et est aujourd'hui **inerte** (héritage d'avant la migration CDN, §12).
  Le chemin vivant est `imageBaseUrl[lang] + image`.
- **Les images n'existent qu'en `en`/`es`/`fr`.** Pas de `de`/`nl`. D'où : 3 langues
  d'export d'images, mais 5 langues de deck list texte.
- **Complétude des noms :** `en`/`fr`/`es` 100 %, `de`/`nl` ≥ 99,9 %, `it` 29 %, `fi` 29 %,
  `ja` 51 % — ces trois-là sont trop lacunaires et sont exclus de l'UI.
- **Apostrophes courbes.** Les données utilisent U+2019, pas `'` (`Gollum’s Fate`).
- **Deux cartes sont mal orthographiées dans la source** : `Glamour of Surpassing
  Excellance` (et non « Excellence ») et `News Must Get Trough` (et non « Through »).
  **Il faut matcher l'orthographe des données** ; « corriger » casse la correspondance.
- **Repli avant comparaison :**
  `.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()`.
  Écris la plage avec des échappements `\u` explicites — des marques combinantes
  littérales sont détruites par un copier-coller et le strip cesse silencieusement d'agir.
- **194 noms anglais désignent plus d'une carte** (ex. Angmarim = Hero AS-58 + Minion AS-62)
  → l'import doit désambiguïser.
- **Les avatars se reconnaissent par `attributes.avatar === true`** (20 cartes), pas par le
  chemin : The Balrog (BA-3) est un avatar mais n'est pas dans un dossier `/avatars/`.
- **`attributes.specific`** découpe des pools propres à un camp : 46 cartes BA portent
  `specific: "Balrog"`, et 33 cartes WH nomment un sorcier déchu précis (Alatar 6,
  Gandalf 7, Pallando 6, Radagast 8, Saruman 6) — contrainte plus fine que le camp.
- **`attributes.playableAsStartingMinorItem`** identifie exactement les ressources
  éligibles à un pool de départ.
- **Les valeurs de facettes ne sont pas traduites** : ce sont des données de jeu lues
  directement dans `cards.json`. Seul le chrome d'interface est traduit. (Voir §14 : c'est
  le dernier endroit où du vocabulaire anglais reste visible dans l'UI FR.)

**Vignettes.** La grille du navigateur de cartes ne sert pas l'image pleine résolution :
`cardThumbSrc()` ([`lang.js`](../web/src/lib/lang.js)) passe par le proxy d'images
**wsrv.nl** (260 px WebP ≈ 20 Ko contre 182 Ko, ~9×), avec repli thumb-EN puis jsDelivr
pleine résolution si le proxy tombe. L'aperçu au survol, le panneau de deck et **tous les
exports** gardent la pleine résolution jsDelivr (l'export a besoin des 300 DPI).
`deckThumbWidth()` quantifie la largeur demandée par pas de 100 px (plancher 200, plafond
570 = largeur source) pour que le curseur de zoom ne produise que ~5 URLs distinctes,
donc cachables.

---

## §4 — Modèle de deck et persistance

### Forme persistée

Il n'y a **pas de numéro de version de schéma**. La compatibilité ascendante est assurée
par `normalizeDeck()` ([`web/src/lib/deck.js`](../web/src/lib/deck.js)), appliqué à chaque
lecture. Toute évolution du schéma **doit** passer par cette fonction.

```js
{
  id, name,
  mode: 'freeform' | 'deckbuilding',   // absent ⇒ 'freeform'
  ruleset: null | {                    // null si mode === 'freeform'
    side: 'wizard'|'ringwraith'|'fallen-wizard'|'balrog',
    length: 'starter'|'standard'|'long'|'campaign',
    tournament: boolean,
    ruleOverrides: { [ruleId]: boolean },
  },
  quantities: { [cardId]: number },    // le deck principal (play deck + locations)
  zones: { sideboard: {…}, pool: {…} },
  backAssignments: { playdeck?: dataURL, locationdeck?: dataURL },
  notes: { starting, resourceStrategy, hazardStrategy, other },
  savedRuleOverrides: { [ruleId]: boolean },
  createdAt, updatedAt, order: number | null,
}
```

**Points non évidents :**

- **`quantities` contient le deck principal *et* les lieux.** La séparation play deck /
  location deck n'est **pas** une zone : elle se dérive du type de carte via
  `backGroupForType()`. Ne crée pas de zone pour ça.
- **`savedRuleOverrides` est un champ de premier niveau, délibérément hors de `ruleset`.**
  En freeform, `ruleset` vaut `null` ; si les overrides y vivaient, un aller-retour
  deckbuilding → freeform → deckbuilding effacerait silencieusement toutes les règles
  ignorées par l'utilisateur. `normalizeDeck` le remiroite depuis `ruleset.ruleOverrides`
  quand celui-ci existe, et le laisse passer intact sinon.
- **Un deck `deckbuilding` dont `side` ou `length` est inconnu retombe en `freeform`**
  plutôt que de lever une exception.

### `localStorage`

| Clé | Contenu | Écrit par |
|---|---|---|
| `meccg.decks.v1` | tous les decks (tableau JSON) | [`deckStore.js`](../web/src/lib/deckStore.js) |
| `meccg.proxyMode` | `'1'` / `'0'` — défaut **activé** | `App.jsx` |
| `meccg.cardZoom` | pourcentage de zoom du panneau | `App.jsx` via `ZOOM_STORAGE_KEY` |

- **Quota (~5 Mo) :** les dos personnalisés sont des data URL JPEG et sont volumineux.
  `deckStore.writeAll` relance une erreur explicite `storage-full` sur `QuotaExceededError`,
  que `DeckManager` affiche (clé i18n `decks.storageFull`).
- **Toute valeur lue de `localStorage` est validée**, car l'utilisateur peut l'écrire et
  d'autres onglets la partagent. Une valeur de zoom aberrante retombe sur le **défaut**,
  elle n'est pas *clampée* — clamper présenterait une donnée corrompue comme une préférence.
- **Pas de synchronisation multi-onglets.** Deux onglets ouverts peuvent s'écraser
  mutuellement. Connu, non traité (voir §14).

---

## §5 — État du front et flux de données

Pas de Redux, pas de Zustand, pas de `useReducer` global : **`App.jsx` détient l'état et le
descend en props**. Le seul contexte React est `I18nContext`.

**États principaux de `App.jsx` :** `cards`, `facets`, `defaultBacks`, `deck`, `quantities`,
`zones`, `filters`, `uiLang`, `proxyMode`, `cardZoom`, `panelCollapsed`, `panelWidth`,
`previewCard`, `deckSheetOpen`, les booléens de modales (`showManager`, `showSetup`,
`showExport`, `showImport`, `showDocs`) et `error`.

**Dérivés (`useMemo`) :** `cardsById`, `derivedFacets`, `capCtx` (contexte de plafonds de
copies, `null` hors mode deckbuilding), `ruleWarnings`.

**Mutations :** définies dans `App.jsx`, descendues en callbacks
(`onChangeQty`, `changeZoneQty`, `moveCopy`, `onToggleRule`, `onChangeNote`…). La logique
pure vit dans [`deckMutations.js`](../web/src/lib/deckMutations.js) (`applyDelta`,
`applyToggle`, `applySelectAll`), qui consulte systématiquement `roomFor` avant d'appliquer.

**Deux exceptions à connaître :**

- **`moveCopy` ne vérifie pas la capacité de destination** (il fait un `-1` puis un `+1`).
  C'est voulu : le total ne change pas, et il faut pouvoir déplacer une carte déjà à sa
  limite (4/4) d'une zone à l'autre.
- **`totalCopies()` ≠ `deckCounts().total`.** `totalCopies` somme *toutes* les zones
  (deck + sideboard + pool) ; `deckCounts().total` ne compte que le deck principal parce
  qu'il alimente la ventilation par type/alignement. **Tout ce qui teste « ce deck
  contient-il des cartes ? » doit utiliser `totalCopies`** — un deck rempli uniquement via
  le pool était autrement déclaré vide, ce qui désactivait le bouton « voir le deck »,
  seul accès à ces zones sur mobile.

---

## §6 — Le moteur de règles (`web/src/lib/rules/`)

Module **pur** : aucun import React, entièrement testable. C'est le sous-système le plus
dense du projet ; `test/rules.test.js` fait 91 Ko à lui seul.

### Cartographie

| Fichier | Rôle | Exports clés |
|---|---|---|
| `catalog.js` | **Métadonnées** des règles, séparées du validateur | `RULES`, `RULE_BY_ID`, `isRuleEnabled`, `ruleRefs`, `COE` |
| `validate.js` | Le validateur | `validateDeck` (ré-exporte `RULES`, `isRuleEnabled`) |
| `sides.js` | Profil de chaque camp + limites transversales | `SIDES`, `GENERAL`, `SPECIFIC_TO_SIDES`, `isLegalForSide`, `raceAllowed` |
| `formats.js` | Seuils par longueur de partie | `LENGTHS` |
| `zones.js` | Quelles zones une carte peut occuper | `zonesFor`, `zoneTargets`, `moveTargets`, `ZONE_LABEL_KEY` |
| `dropTargets.js` | Légalité d'un drop sur un onglet | `isDropAllowed` |
| `copies.js` | Plafonds de copies (source unique UI + validateur) | `copyCaps`, `remainingCopies` |
| `roles.js` | Rôle effectif d'une carte selon le camp | `roleFor` |
| `races.js` | Normalisation/comparaison des races | `singularize`, `matchesRace` |
| `sites.js` | Index et interrogation des sites | `siteIndex` |
| `banned.js` | Listes de cartes bannies + résolution vers des ids | `BANNED`, `resolveBanned` |
| `docText.js` | Génération du texte de la page « Règles et modes » | `copiesText`, `poolText`, `playDeckText`, `refText`, `capTitle` |

### Forme canonique d'une règle (`catalog.js`)

```js
{ id: 'AVATAR-COPIES', severity: 'error', status: 'verified',
  refs: ['1.5', '1.6'], hard: true, source: COE }
```

- **`id`** — anglais, en majuscules. **Ne jamais traduire** : les joueurs le citent dans
  les tickets, et il s'affiche en `<code>` sur la page de règles.
- **`severity`** — `'error'` pour toute règle citant une clause de la source (la section 1
  est de la légalité dure) ; `'warning'` pour les avis maison (`house: true`), qui **ne
  doivent jamais afficher de citation**.
- **`ref` / `refs`** — la ou les clauses source. `printedAs` corrige les coquilles de
  numérotation de la source (ex. `{ '1.3.F6': '1.5.F6' }`).
- **`hard: true`** — plafond de copies que le bouton `+` fait respecter réellement. C'est
  la **seule** catégorie de règle qui bloque quoi que ce soit.
- **`interpretation: true`** — lecture du propriétaire, plus stricte que la lettre du texte.
- **`status`** — `'verified'`. `defaultEnabled` en découle.
- **`source`** — `COE` = `https://www.councilofelrond.org/rules/#Section1`.

**État au 2026-08-02 : les 30 règles sont `status: 'verified'`.** L'avertissement du README
sur des « valeurs stubs désactivées par défaut » décrit un état antérieur (voir §14).

**Les 30 règles :** `AVATAR-PRESENT`, `AVATAR-COPIES`, `AVATAR-SIDEBOARD`, `AVATAR-COUNT`,
`AVATAR-MULTIPLES`, `AVATAR-SIDE`, `ALIGN-LEGAL`, `BANNED`, `SPECIFIC-AVATAR`,
`SPECIFIC-SIDE`, `AGENT-MIND`, `COPIES-LIMIT`, `UNIQUE-LIMIT`, `SITE-COPIES`,
`REGION-EXCLUDED`, `SITE-SIDE`, `SITE-BALROG-VERSION`, `BALROG-RACE`, `BALROG-MIND`,
`FACTION-RACE`, `DECKSIZE-RESOURCES`, `DECKSIZE-HAZARDS`, `DECKSIZE-CHARS`, `CREATURE-MIN`,
`DECKSIZE-LOCATION`, `SIDEBOARD-MAX`, `POOL-CHARS`, `POOL-ITEMS`, `POOL-ELIGIBLE`,
`POOL-STAGE`.

### Contrat de `validateDeck`

```js
validateDeck({ side, length, tournament, ruleOverrides, quantities, zones, cardsById })
  → Array<{ ruleId, code, severity, params }>
```

- `code` peut être plus fin que `ruleId` (ex. `AVATAR-COUNT.total`) pour porter un message
  précis ; c'est `code` qui indexe la clé i18n.
- Le **mode casual** (`tournament: false`) **abaisse chaque sévérité d'un cran**. Il n'y a
  donc pas besoin d'un réglage warning/error séparé.
- `ruleOverrides` (par deck) désactive une règle : `isRuleEnabled` la court-circuite et
  elle n'est pas évaluée du tout.

### Modèle de zones

Trois zones logiques : **`deck`**, **`pool`**, **`sideboard`**. `zonesFor(card)` renvoie
`{ primary, extra[] }` — la forme dont parle le texte des règles. `zoneTargets(card)`
aplatit en une liste ordonnée avec `'deck'` toujours ajouté en queue (toute carte peut
rejoindre le play deck), dédoublonnée. **`isDropAllowed` est construit sur `zoneTargets`,
pas sur une dérivation parallèle** : l'UI tactile et le drag-and-drop ne doivent pas
pouvoir diverger sur la destination autorisée.

Rappel : `deck` couvre à la fois le play deck et le location deck ; l'onglet UI `'play'`
est résolu vers la zone logique `'deck'`.

### Camps (`sides.js`)

`SIDES` est une table statique indexée par `wizard | ringwraith | fallen-wizard | balrog`.
Chaque profil porte : `avatarAlignment`, `alignments[]`, `copies[]`, `pool{maxCharacters,
maxMinorItems, balrogMindPerCharacterLimit, requireRaces, stagePoints}`, `agents{role}`,
`flexMaxAsResource`, `heroTreatment`, `specificMode`, `locationDeck{alignments,
unlimitedFwSites, requireBalrogVersion}`, `factionRaces`.

`GENERAL` porte ce qui ne dépend pas du camp : `agentMindMax: 36`, `uniqueMax: 1`,
`siteMax: 1`, `avatarMaxCopies: 3`, `avatarMaxDistinct: 2`, `avatarMaxInSideboard: 1`,
`avatarMaxWithMultiples: 1`, `avatarMaxInPlayDeck: 3`, et
`playDeck { resourcesMin: 30, resourcesMax: 50, maxCharacters: 10, minCreatures: 12 }`.

`LENGTHS` (`formats.js`) ne porte plus qu'un seuil : `sideboardMax` (starter 30, standard
30, long 35, campaign 40). **La longueur de partie n'affecte donc que la taille de la
réserve, jamais la légalité d'une carte.**

### Ajouter une règle — ordre des opérations

1. **`catalog.js`** — ajouter l'objet dans `RULES` avec un `id` unique et sa citation.
2. **`validate.js`** — garder derrière `isRuleEnabled(id, ruleOverrides)`, émettre via
   `emit(ruleId, params, code)`.
3. **Données** — si la règle dépend du camp, de la longueur ou d'un plafond de copies,
   modifier `sides.js` / `formats.js` / `copies.js` plutôt que de coder en dur dans le
   validateur.
4. **i18n** — une clé de message par `code` émis, dans **les trois** dictionnaires
   (`fr`/`en`/`es`). Un test de contrat échoue sinon (§9, §11).
5. **`docText.js`** — si la règle doit apparaître sur la page « Règles et modes ».
6. **`test/rules.test.js`** — cas passant et cas échouant.
7. **§6, §13, §15 de ce document.**

### Pièges du moteur

- **Cycle d'import évité par construction.** `catalog.js` ne doit **jamais** importer
  `validate.js` : `copies.js` a besoin de `isRuleEnabled`, et `validate.js` importe
  `copies.js`. C'est la raison d'être de la séparation catalogue/validateur.
- **Sources uniques de vérité.** `roles.js`, `zones.js`, `copies.js`, `banned.js`,
  `sites.js` sont autoritaires pour leur domaine. Toute logique réimplémentée dans
  `validate.js` ou dans un composant est une régression, pas une optimisation.
- **Mémoïsation par `WeakMap`.** `siteIndex` (clé : le tableau `cards`) et `bannedFor`
  (clé : `cardsById`) mémoïsent pour ne pas recalculer à chaque frappe. Si tu recrées ces
  objets à chaque rendu, tu détruis silencieusement le cache.
- **Normalisation avant toute comparaison de nom ou de race** (§3).

---

## §7 — Pipeline d'export (`web/src/lib/export/`)

Modules purs, sans React. `api.js` est le seul orchestrateur.

| Fichier | Rôle |
|---|---|
| `deckSections.js` | **L'ordre d'export canonique** — consommé par ZIP, PDF *et* liste texte |
| `images.js` | `fetchBytes`, `fetchCardImageBytes` (repli EN), `dataUrlToBytes`, `mapLimit` |
| `bleedCanvas.js` | `renderCutFace`, `toMpcPng`, `toStampedJpeg` |
| `bleedOps.js` | Géométrie d'extension des bords |
| `pngDpi.js` | `withPngDpi` — injection du chunk `pHYs` |
| `zip.js` | `buildDeckZip` — arborescence + manifeste |
| `pdf.js` | `buildSheetPdf` — planches pdf-lib |
| `sheetLayout.js` | `PAGE_SIZES`, `sheetLayout`, `backColumnIndex`, `chunk` |
| `backGroups.js` | `backGroupForType`, `slug` |
| `proxyDraw.js` | `drawProxyOnFace`, `loadPatchBitmaps`, `closePatchBitmaps` |

### Ordre d'export — invariant

`deckSections()` produit **Pool → Play deck → Locations → Sideboard**, et à l'intérieur de
chaque section un ordre de groupes fixe (play : avatars → characters → resources → hazards).
Les trois formats le consomment, donc ils **ne peuvent pas** diverger. Cet ordre s'applique
**aussi en mode freeform** (décision propriétaire du 2026-07-26), pour qu'il n'y ait qu'un
seul ordre d'export à expliquer.

Le tri à l'intérieur d'un groupe utilise `localeCompare(…, 'en')` : le **collationnement**
est épinglé sur `'en'` (les *noms* restent rendus dans `lang`) afin que Node et le
navigateur produisent le même ordre. Ne remplace pas ce `'en'` par `lang`.

### Chaîne ZIP MPC

`api.exportDeck()` → `makeStampFor()` (charge uniquement les patchs nécessaires) →
`prefetchFronts(cards, lang, bytes => toMpcPng(bytes, stampFor(card)))` avec
**concurrence bornée à 6** (`mapLimit`) et une seule image traitée par carte unique →
`buildDeckZip()` → `Blob` → téléchargement.

- `toMpcPng` : `renderCutFace` (dessin à `CARD_W_CUT`×`CARD_H_CUT` = 750×1050, tampon proxy
  appliqué ici si fourni) → `bleedOps` étend jusqu'à 822×1122 → `withPngDpi` écrit le
  chunk `pHYs` à 300 DPI.
- `imageSmoothingEnabled = false` pendant le bleed : réplication exacte des pixels de bord.
- Arborescence : `{playdeck|locationdeck}/fronts/{id}_{slug(name.en)}[_cN].png`,
  `{group}/back.png`, `manifest.txt`. Le suffixe `_cN` n'apparaît que si la carte a
  plusieurs copies.
- **Les dos ne sont jamais tamponnés.**
- Un échec de fetch produit **une** entrée dans `failures` **par id de carte**, pas par
  exemplaire (les copies partagent l'image traitée).

### Chaîne PDF

`api.exportPdf()` → `prefetchFronts` → `buildSheetPdf({ cards, getFrontBytes, getBackBytes,
includeBacks, format })`.

- **Proxy éteint : les octets CDN bruts sont embarqués tels quels** — pdf-lib met à
  l'échelle vectoriellement vers 2,5×3,5 po, donc aucun rééchantillonnage. C'est voulu.
- **Proxy allumé : `toStampedJpeg`** produit une face à la taille de coupe avec le tampon
  cuit dedans. C'est la seule différence entre les deux chemins.
- `embedAuto` **renifle la signature** PNG (`89 50 4E 47`) au lieu de se fier au nom : les
  faces CDN sont des JPEG, les dos peuvent être PNG (défauts livrés) ou JPEG (uploads
  normalisés).
- Formats : `letter` 3×3=9, `a4` 3×3=9, `a3` **paysage** 6×3=18.
- **`pdf-lib` a son origine en bas à gauche**, `sheetLayout` et le canvas en haut à gauche.
  D'où les `pageSize.h - cell.y` partout. Ne « simplifie » pas ces expressions.
- `backColumnIndex(col, cols)` inverse les colonnes sur les pages de dos, pour un
  recto-verso avec retournement bord long.
- `seamLines` trace des filets **blancs** très fins sur les coutures intérieures : les
  cartes sont posées bord à bord, donc leurs bordures noires fusionnent sans ça.
- Une face en échec est ajoutée à `failures`, stockée à `null`, et la carte est **filtrée**
  de la pagination (`printable`) — elle ne laisse pas de trou.

### Deck list texte (`deckList.js`)

```
# <nom du deck>
## Notes            (seulement si au moins une note est non vide)
### <titre de note>
<contenu>
## Pool | Play deck | Locations | Sideboard
### <Groupe> (<total>)
<N>x <nom de carte dans `lang`>
```

**Les titres de section et de groupe sont en anglais canonique**, quelle que soit la langue
choisie, **parce que l'import les reparse**. Seuls les noms de cartes suivent `lang`.
Casser cette asymétrie casse le cycle export → import.

### Cibles d'impression

Tout est dans [`constants.js`](../web/src/lib/constants.js) : `DPI = 300`, `BLEED_PX = 36`,
`CARD_W_BLEED = 822`, `CARD_H_BLEED = 1122`, coupe dérivée 750×1050.
**À vérifier contre le gabarit MPC réel avant une vraie commande** — un seul endroit à
changer. Les images source font 570×796 @72 DPI, soit un agrandissement d'environ 1,4× :
correct pour des proxies, pas parfaitement net. C'est inhérent aux fichiers source.

---

## §8 — Le tampon Proxy

**Pourquoi :** MPC exige que les cartes proxy ne portent pas la mention de copyright.
L'app **repeint** la zone avec le cadre vierge du type de carte, puis écrit « Proxy » par-dessus.

**Interrupteur activé par défaut** (`meccg.proxyMode`, §4).

### Classification — [`web/src/lib/proxy.js`](../web/src/lib/proxy.js)

`swatchKeyForCard(card)` renvoie **une des 16 clés** ou `null`. `null` = carte laissée
intacte : c'est un **fail-safe, jamais un mauvais tampon**.

Ordre de décision (ne pas réordonner) :

1. `type === 'Region'` → `null`.
2. `race === 'Ringwraith'` ou (`race === 'Balrog'` **et** `type === 'Character'`) → `red`.
   Les 9 Nazgûl et The Balrog partagent un cadre rouge identique ; le garde de type garde
   les 22 Site/Balrog sur `balrog-site`.
3. `race === 'Wizard' | 'Fallen-wizard'` → la clé porte le **nom** du sorcier
   (`alatar`…`saruman`), le cadre étant identique dans les deux versions. Toute carte de
   race avatar est un avatar : elle ne retombe donc jamais sur les cadres génériques.
4. `type === 'Resource'` et `alignment === 'Dual'` → table `DUAL_BY_NAME` (4 cartes).
5. `type === 'Hazard'` → `hazard`.
6. Sinon `BY_TYPE_ALIGNMENT['<type>/<alignment>']`, ou `null`.

### Géométrie — couplage à surveiller

`PROXY_PATCH_RECT = { x: 0.1377, y: 0.9232, w: 0.3146, h: 0.0606 }` (fractions de la carte)
est **la transcription arrondie de la boîte de crop en pixels du générateur**
`scripts/make_proxy_patches.py` (`boxes()` / `build_patch()`), **pas** une dérivation
indépendante. Recalibrer le générateur **oblige** à mettre à jour ce rect.

Le rect couvre à la fois le `©19xx Tolkien Enterprises` aligné à gauche (en/es) et le nom
d'extension plus centré des cartes FR, **tout en s'arrêtant avant** le crédit français
« Remastérisé… » (premier glyphe à x 0.4684) qui doit rester lisible.

`PROXY_LABEL_FONT_CQW` et `PROXY_LABEL_DY_CQH` sont **dérivés** de `PROXY_LABEL_FONT_FRAC`
et `PROXY_LABEL_POS` en unités de container query, pour que l'overlay CSS et le rendu canvas
ne puissent pas diverger. **Ne les règle jamais à la main.**

`PROXY_LABEL_COLOR` est généré par le script (voir `scripts/proxy-patch-colors.txt`) et
committé en littéraux pour que CSS et canvas rendent identiquement.

### Patchs

32 fichiers PNG dans `web/public/proxy-patches/` : 16 clés × 2 variantes. `patchUrl(key, lang)`
ajoute le suffixe **`-fr`** pour le français, dont les images viennent d'un autre dépôt et
portent une colorimétrie différente. Le décalage est cuit dans le PNG.

Régénération : `python scripts/make_proxy_patches.py`. Exige le corpus local sous `cards/`
(gitignoré, **absent d'un clone frais**), Pillow, et une police Windows Arial Bold. Avant de
committer des patchs régénérés, relire `scripts/proxy-patch-qa.png` (planche de contrôle
visuelle, non committée).

Si le chargement d'un patch échoue, `drawProxyOnFace` retombe sur un aplat de couleur
moyenne — jamais une erreur bloquante.

**Le tampon apparaît à l'écran (overlay CSS, `ProxyStamp.jsx` / `CardPreview.jsx`) et dans
les exports (canvas).** Les deux chemins partagent les mêmes constantes ; c'est tout
l'intérêt du module `proxy.js`.

---

## §9 — i18n et vocabulaire

**Mécanique.** `translations` dans [`web/src/lib/i18n.js`](../web/src/lib/i18n.js) : un bloc
par langue, **exactement les mêmes clés**. `makeT(lang)` produit la fonction `t`, exposée
via `I18nProvider` / `useT()` ([`i18n.jsx`](../web/src/i18n.jsx)). Interpolation par
`{token}` remplacé depuis l'objet `params`. Repli : la clé elle-même.

**Trois langues d'interface : `fr`, `en`, `es`** (`UI_LANGUAGES`). Le sélecteur change
simultanément le chrome, les noms de cartes **et** les images de cartes.

**Namespaces de clés existants** — reste dedans plutôt que d'en inventer :
`alignment.` `app.` `browser.` `cap.` `common.` `decks.` `docs.` `drawer.` `export.`
`filter.` `group.` `import.` `lang.` `length.` `notes.` `panel.` `proxy.` `race.` `rules.`
`setup.` `side.` `status.` `warn.` `zoneShort.` `zones.`

**Ajouter une langue :** un bloc avec les mêmes clés + une entrée dans `UI_LANGUAGES`
([`lang.js`](../web/src/lib/lang.js)). Attention : `LIST_LANGUAGES` (5) et `IMAGE_LANGUAGES`
(3) sont des listes **distinctes**, contraintes par les données (§3).

### Glossaire FR — imposé par un test

Vocabulaire arrêté le 2026-07-29 et **gardé par un test** dans `test/i18n.test.js` :

| EN | FR |
|---|---|
| play deck | pioche |
| sideboard | talon |
| pool | réserve |
| hazard | péril |
| minion | séide |
| stage | progression |

**Trois de ces termes sont une rotation, pas un renommage :** « talon » désignait
auparavant le play deck, et « réserve » désignait le sideboard. Un mot retiré n'est donc
pas simplement démodé — **il désigne maintenant une autre zone**. C'est pourquoi le garde
bannit les anciens termes purement et simplement au lieu de les laisser à la relecture.

**« Faction » est interdit** pour désigner un camp : en MECCG, *faction* est une catégorie
de carte. Le mot juste est **camp** (`side`). Un test vérifie qu'aucune chaîne liée aux
camps n'emploie « faction ».

**`Nazgûl` et `Ringwraith` sont deux races, pas deux orthographes.** `Nazgûl` porte les
9 hazards METW (Creature/Permanent-event), `Ringwraith` les 9 personnages MELE : les mêmes
individus, mais on joue les uns **contre** l'adversaire et les autres **comme** avatar.
La facette Race doit donc les séparer — **ne jamais les replier l'un sur l'autre dans
`RACE_ALIASES`** ([`tags.js`](../web/src/lib/tags.js)), qui n'existe que pour les vrais
doublons (pluriels : `Orcs`→`Orc`, `Dúnedain`→`Dúnadan`). En FR : « Nazgûl » et
« Spectre », les noms des cartes elles-mêmes (« Adûnaphel la Spectre ») ; en ES,
« Espectro del Anillo ». Avant 2026-08-02 les deux s'affichaient « Nazgûl » en FR, ce qui
donnait deux entrées identiques dans le menu.

**« Magicien » est interdit : *Wizard* se dit « Sorcier »**, pour le camp (`side.wizard`)
comme pour la race (`race.Wizard`), et « Sorcier déchu » pour *Fallen-wizard*. Le mot
était partagé en deux — `side.*` et les docs de règles disaient « Sorcier », `alignment.*`
et `race.*` disaient « Magicien » — et rien ne l'a révélé tant que les menus de filtres
n'ont pas localisé alignements et races, ce qui a mis les deux mots à l'écran dans la même
session. « Magicien » est maintenant dans `RETIRED_FR` (banni), et un test épingle en plus
les chaînes exactes : le bannissement seul serait satisfait par n'importe quel autre mot,
et ce sont les assertions positives qui font échouer bruyamment une correction partielle.

**Les identifiants de règles restent en anglais** (`AVATAR-SIDEBOARD`, `SIDEBOARD-MAX`) :
les joueurs les citent quand ils signalent une règle, et ils apparaissent en `<code>`.

---

## §10 — Couche UI, responsive, accessibilité

### Composition

```
App
├── FilterBar          (facettes, recherche, LangPicker, ProxyToggle, bouton « ? »)
├── CardBrowser        (grille filtrée)
│   ├── ZoneCtrls      (compteurs par zone, interne) → ZoneRow (× n)
│   └── ProxyStamp
├── DeckPanel          (panneau latéral desktop / feuille plein écran mobile)
│   ├── ZoneTabs       (onglets + compteurs + plafonds + cibles de drop)
│   ├── MiniCard       (× n) → ProxyStamp
│   └── DeckNotes
├── DeckDrawer         (barre d'actions du bas)
├── CardPreview        (aperçu au survol, desktop)
└── modales : DeckManager · DeckSetupDialog · ImportDialog · ExportDialog
             · RulesDoc · CardPreviewModal
```

### Mobile

**Un seul breakpoint, basé sur la largeur :** `MOBILE_QUERY = '(max-width: 768px)'`
dans [`mobile.js`](../web/src/lib/mobile.js), consommé par le hook
[`useIsMobile`](../web/src/lib/useIsMobile.js) (`matchMedia`, abonné aux changements).
Il n'y a **pas** de détection d'agent utilisateur — délibérément.

Différences de forme :

- `DeckPanel` passe en feuille plein écran (`asSheet`) ; le panneau latéral disparaît.
- `CardBrowser` rend les `ZoneCtrls` en lecture seule ; l'ajout passe par
  `CardPreviewModal`, qui porte un sélecteur de zone.
- `MiniCard` réduit `− / count / +` à un simple compteur ; le bouton `⇄` (déplacer) reste.
- `FilterBar` replie les facettes derrière un bouton « Filtres ».
- `DeckDrawer` affiche d'abord « voir le deck » avec le total, puis **des icônes seules**.

### Contrôles de zone sur une tuile (`ZoneRow`, desktop)

**Une ligne horizontale par zone — `LABEL − n +`, ~22 px.** C'était une pile verticale
(label / + / compteur / −) coûtant ~65 px par zone : les trois zones réclamaient donc
~200 px dans une tuile de 168 px, et déplier n'en montrait qu'une. Mesuré après :
85,7 px de haut pour les trois dans une tuile de 192 px. La largeur d'une ligne est dictée
par son contenu, pas par la cellule — 100 px avec les libellés FR, les plus longs des trois
langues (`Pioche`) — donc elle tient dans le minimum de 120 px de la grille
(`minmax(120px, 1fr)`), vérifié à 125,7 px.

L'ordre `−/compteur/+` va de gauche à droite parce que c'est le sens dans lequel le nombre
se déplace, et c'est déjà celui de la barre de `CardPreviewModal`. **L'argument
« vers le haut = plus » ne valait que tant que le contrôle était une pile verticale.**

Le bouton d'expansion est une **bascule** : il ne l'était pas, `setExpanded(true)` était
sans retour, donc ouvrir pour vérifier un compteur confisquait l'illustration jusqu'à la
fin de la vie de la cellule. Replié il liste les zones cachées avec leurs compteurs,
déplié seulement leurs noms — les compteurs sont alors juste en dessous, et les répéter
est du bruit sur une tuile de 116 px. Garder les noms dans les deux états est ce qui donne
au bouton un nom accessible sans inventer de clé i18n.

Les `aria-label` des boutons **nomment leur zone** (`zoneShort`, la seule clé qui existe
pour les trois : la pioche est `zoneShort.deck` mais `zones.play`) : trois lignes sont
visibles à la fois, sans quoi un lecteur d'écran annonce trois boutons homonymes.

### Panneau de survol des avertissements ([`popover.js`](../web/src/lib/popover.js))

Survoler une carte d'avertissement **pliée** en affiche le texte complet. Le repliement a
rendu la liste lisible mais a mis le message derrière un clic, ce qui est cher quand on a
déjà la souris en main.

**`position: fixed` n'est pas un raccourci, c'est le fond du problème :** `.rule-warns` est
un conteneur de défilement (`max-height: 35vh`, `overflow-y: auto`), donc un enfant en
position absolue serait rogné **exactement quand la liste est assez longue pour défiler**,
c'est-à-dire dans le cas qui justifie le panneau. Une boîte `fixed` prend le viewport comme
bloc conteneur et échappe à ce rognage — **à condition qu'aucun ancêtre n'ait `transform`,
`filter`, `contain` ou `will-change`**, qui deviendraient le bloc conteneur à sa place.
`.deckpanel` n'en a aucun (vérifié en direct). Le calcul des coordonnées vit dans un module
pur, `placePopover()`, testable sans DOM.

Volontairement **`pointer-events: none` et `aria-hidden`** : c'est une commodité souris, en
lecture seule. Les actions (ignorer, signaler, lien CoE) restent dans la carte dépliée,
donc rien ici n'a besoin d'être atteignable, le pointeur n'a jamais à voyager jusqu'à un
panneau qui pourrait se dérober, et le même texte reste accessible via le bouton de
dépliage — l'exposer deux fois dupliquerait toute la liste aux technologies d'assistance.

Masqué au `mouseleave` **et à tout défilement** (`capture: true`, même piège que
`useCardPreview` : le défilement n'émet pas d'événements souris fiables et invalide le
rectangle d'ancrage). Délai de 180 ms. Supprimé si l'avertissement est déjà déplié, et sur
tactile — où le tap-pour-déplier reste le seul chemin.

### Accessibilité — patterns en place

- Les labels textuels des boutons de la barre du bas **restent dans le DOM** et sont
  masqués visuellement ; les icônes portent `aria-hidden="true"`. Le nom accessible est
  donc toujours le texte, jamais l'emoji.
- `aria-expanded` sur tout ce qui se déplie ; `Escape` ferme les menus de facettes.
- `.sr-only` pour ce qu'une icône seule ne dit pas (ex. le marqueur d'illégalité).
- **Le bloc d'avertissements de règles est `role="region"`, pas `role="status"`.** En
  `status`, tout le bloc était une live region : `validateDeck` se ré-exécutant à chaque
  édition, les cinq avertissements étaient réannoncés en entier à chaque frappe. Seul un
  compteur court est `aria-live="polite"` désormais ; les avertissements eux-mêmes sont du
  contenu navigable.

### Zoom du panneau ([`zoom.js`](../web/src/lib/zoom.js))

Le zoom est un **pourcentage de la largeur disponible** (`deckZoneWidth(outerWidth)`), plus
un pourcentage de la largeur source de 570 px — ainsi la densité visuelle reste constante
quelle que soit la largeur du panneau. `parseStoredZoom` valide la valeur stockée et
**retombe sur le défaut** en cas d'absurdité (§4).

### Conventions de style

- Les unités **`cqw`/`cqh`** (container queries) servent aux overlays dimensionnés
  relativement à leur conteneur — notamment `ProxyStamp`.
- Classes d'état : `.on`, `.over`, `.selected`, `.illegal`.
- `user-select: none` pendant drag et redimensionnement.
- Tout le CSS est dans un fichier unique, [`styles.css`](../web/src/styles.css) (38 Ko).
  Pas de CSS-in-JS, pas de modules CSS.

---

## §11 — Tests

`npm test` → Vitest, **27 fichiers, 494 tests**. Node pur, pas de DOM : les composants ne
sont pas montés, ce sont les **modules purs** qui sont testés.

C'est ce qui dicte la façon d'aborder un travail d'interface ici : **on extrait la décision
dans un module pur, et c'est lui qu'on teste** (`dropTargets.js`, `zoom.js`, `popover.js`).
Le rendu lui-même n'est vérifié que par mesure en direct dans le navigateur — voir §14.

Fichiers notables :

- `rules.test.js` (91 Ko) — le moteur de règles, cas par cas.
- `i18n-rules-contract.test.js` (20 Ko) — **contrat** : chaque `code` que `validateDeck`
  peut émettre a une clé dans les trois dictionnaires. C'est ce test qui casse si tu
  ajoutes une règle sans ses traductions. Il importe `DeckPanel.jsx`, donc **une erreur de
  syntaxe JSX le fait échouer à la transformation**, pas à l'assertion.
- `i18n.test.js` — parité stricte des clés `fr`/`en`/`es`, parité des `{placeholder}`,
  garde du glossaire FR, interdit « faction » et « magicien » (§9).
- `popover.test.js` — `placePopover()` : côté préféré, bascule, bornage dans le viewport,
  jamais de coordonnée négative.
- `importDeck.test.js`, `deckList.test.js`, `deckSections.test.js` — le cycle
  export texte → import.
- `pngDpi.test.js`, `bleedOps.test.js`, `sheetLayout.test.js`, `pdf.test.js`, `zip.test.js`
  — la géométrie et les octets d'export.
- `proxy.test.js`, `proxyPatches.test.js` — classification et présence des 32 patchs.

---

## §12 — Décisions techniques (journal daté)

### 2026-07-10 — Passage à une SPA 100 % statique *(livré 2026-07-11)*

L'app était une application Node/Fastify avec `sharp`, `archiver` et `pdfkit`. Elle est
devenue une SPA statique sur Cloudflare Pages.

- **Images :** jsDelivr uniquement (`imageBaseUrl[set][lang] + image`), plus d'arbre local.
- **Decks :** `localStorage` + import/export texte. Pas de comptes, pas de base.
- **Exports :** navigateur (JSZip, pdf-lib, canvas). `sharp`/`archiver`/`pdfkit` retirés.
- **Serveur :** `src/` supprimé, migré vers `web/src/lib/`.
- **Pourquoi :** simplicité de déploiement et de maintenance ; hébergement statique gratuit
  et sans état.
- **[ABANDONNÉ — 2026-07-10]** la migration en submodules (`cards/fr`,
  `cards/remastered-all`) initialement demandée : inutile en CDN-first. C'est ce qui rend
  `relativePath` inerte (§3).

### 2026-07-11 — Vignettes via le proxy wsrv.nl

La grille chargeait des images pleine résolution (182 Ko/carte). Passage à des vignettes
WebP 260 px (~20 Ko, ~9×) via wsrv.nl, avec repli. Voir §3.

### 2026-07-25 — Modes de deck, et les plafonds de copies cessent de bloquer

Introduction de `mode: 'freeform' | 'deckbuilding'`. **Le compteur est délibérément
non plafonné dans les deux modes** : `maxCopies` survit comme donnée de référence pour le
validateur, qui **avertit** au lieu de bloquer. Seuls les caps `hard: true` du catalogue
sont appliqués par le bouton `+`.

### 2026-07-26 — Un seul ordre d'export

`deckSections` s'applique aussi aux decks freeform, pour qu'il n'y ait qu'un ordre d'export
à documenter et à tester. Voir §7.

### 2026-07-28 — Patchs de cadre, en remplacement du clonage de bande

Le tampon proxy clonait auparavant une bande de la carte elle-même pour masquer le
copyright. Remplacé par **16 cadres vierges** extraits des gabarits de cartes, en deux
variantes colorimétriques (en/es et fr). Voir §8.
**[ABANDONNÉ — 2026-07-28]** la variante « self-clone » (branche
`proxy-card-stamp-selfclone`), superseded par les patchs de cadre.

### 2026-07-29 — Glossaire FR gardé par un test

Voir §9. Décision : bannir les anciens termes plutôt que les signaler, parce que trois
d'entre eux ont **changé de référent**.

### Décision transverse — sévérité dérivée de la citation

Une règle qui cite une clause de la source est `error` (la section 1 est de la légalité
dure de construction) ; un avis maison est `warning` et n'affiche pas de citation. Le mode
casual abaisse tout d'un cran. Il n'y a donc **pas** de réglage warning/error séparé, et il
ne faut pas en réintroduire un.

### Décision transverse — `fwExtra` retiré volontairement

`formats.js` portait `fwExtra: 10` (« +10 cartes de réserve contre un adversaire Sorcier
déchu »). **Rien ne le lisait**, et l'allocation dépend du camp de l'*adversaire*, que
l'app ne modélise pas (il n'y a pas de second joueur dans le périmètre). Retiré plutôt que
recâblé. Si un adversaire est un jour modélisé, il faudra le sourcer et le câbler
proprement, pas restaurer un champ que personne ne consommait.

---

## §13 — État des fonctionnalités

| Fonctionnalité | État |
|---|---|
| Grille + facettes, recherche insensible aux accents | **Livré** |
| Quantités (`−`/`+`, clic image = bascule), « Tout sélectionner (N) » | **Livré** |
| Modes de deck (freeform / deckbuilding) + migration transparente | **Livré** |
| Zones : play deck, location deck, réserve, pool de départ | **Livré** |
| Moteur de règles — 30 règles, toutes `verified` | **Livré** |
| Ignorer une règle par deck / signaler une règle (ticket GitHub pré-rempli) | **Livré** |
| Filtre de légalité dans le navigateur de cartes | **Livré** |
| Page « Règles et modes » générée depuis les mêmes données que le validateur | **Livré** |
| Notes de deck (4 champs) + reprises dans l'export texte | **Livré** |
| Sauvegarde `localStorage`, duplication, réordonnancement par glisser-déposer | **Livré** |
| Import de liste `Nx nom` avec désambiguïsation et restauration des zones | **Livré** |
| Export ZIP MPC (822×1122 @300 DPI, bleed, manifeste) | **Livré** |
| Export planches PDF (letter / a4 / a3 paysage, dos en miroir) | **Livré** |
| Export deck list texte, ré-importable, 5 langues | **Livré** |
| Dos par défaut + dos personnalisé par groupe | **Livré** |
| Mode Proxy (écran + exports), 16 cadres × 2 variantes | **Livré** |
| i18n complète FR / EN / ES (chrome, noms, images) | **Livré** |
| UI mobile (feuille de deck, modale de carte, barre d'icônes) | **Livré** |
| Passe accessibilité / polish | **En cours** — branche `polish-ui-a11y` |

---

## §14 — Dettes connues et travaux différés

1. **Localisation partielle des races.** Les données portent **39 valeurs de race
   distinctes**, et `i18n.js` n'a de clé `race.*` que pour **12** — celles des personnages.
   Le menu Race mêle donc « Nain », « Elfe », « Sorcier » et « Dragon », « Eagle », « Ent ».
   Le repli est correct par construction (`localize()` rend la valeur brute, ce qui est
   **exigé** pour les codes d'extension et les noms d'artistes, qui sont des noms propres),
   mais la liste est mixte. **Le garde de terminologie ne peut pas le voir** : il n'inspecte
   que `translations.fr`, et ces chaînes n'y ont jamais été.

2. **Pas de tests de composants.** Aucun rendu React n'est monté (§11) : tout le travail
   d'interface n'est vérifié que par mesure en direct dans le navigateur. C'est une lacune
   structurelle, pas un oubli — mais elle signifie qu'une régression de rendu ne casse
   aucun test.

3. **Pas de synchronisation multi-onglets sur `localStorage`.** Deux onglets ouverts sur
   l'app peuvent s'écraser mutuellement (§4). Connu, non traité.

4. **Pas de gestion de version de schéma de deck.** La compatibilité repose entièrement sur
   `normalizeDeck`. Ça tient tant que les évolutions restent additives ; un changement
   destructif exigerait un vrai champ de version.

5. **Qualité d'image plafonnée par la source.** 570×796 @72 DPI agrandis ~1,4×. Rien à
   faire côté code.

6. **La grille n'est pas virtualisée** (`CAP = 600` dans `CardBrowser.jsx`). Au-delà, les
   cartes sont simplement tronquées avec un message invitant à affiner les filtres.

*Réglé le 2026-08-02 :* le `README.md` décrivait les règles comme des « stubs » non
vérifiés démarrant désactivés — périmé depuis que les 30 règles portent
`status: 'verified'`. Les trois passages concernés (limites de copies, avertissements de
règles, structure) ont été réécrits.

*Réglé le 2026-08-02 (commit `1b1cdea`) :* l'erreur de syntaxe JSX de `DeckPanel.jsx`
(un `{/* … */}` placé à l'intérieur d'un `{cond && ( … )}`, où `{}` est lu comme un
littéral d'objet — `esbuild` échouait et `i18n-rules-contract.test.js` ne compilait pas),
et les menus de facettes qui affichaient les valeurs anglaises brutes. **Le piège de la
première reste vrai** : une erreur de syntaxe JSX fait échouer un fichier de test *à la
transformation*, donc lis le compte de **fichiers**, pas seulement celui des tests.

---

## §15 — Journal des mises à jour de ce document

| Date | Changement |
|---|---|
| 2026-08-02 | Création. État capturé sur la branche `polish-ui-a11y` (HEAD `3a1d8f5`) : 30 règles vérifiées, 370 tests, 1 erreur de syntaxe non committée consignée en §14. |
| 2026-08-02 | `README.md` repris : limites de copies décrites par mode de deck (elles n'existent qu'en construction de deck, et les havres comme les sites de sorcier déchu y échappent), paragraphe « stubs » remplacé par l'état vérifié réel, section Structure complétée d'un renvoi vers `CLAUDE.md` et ce document. Dette §14 n°3 réglée, liste renumérotée. |
| 2026-08-02 | §9 : « Magicien » banni, *Wizard* = « Sorcier » partout. §10 : `ZoneRow` (contrôles de zone en lignes horizontales) et panneau de survol des avertissements (`popover.js`, pourquoi `position: fixed`). §11 : 27 fichiers / 494 tests, et la façon d'aborder un travail d'interface ici. Retrait de deux lignes parasites (`</content>`, `</invoke>`) laissées en fin de fichier à sa création. |
| 2026-08-02 | §9 : `Nazgûl` ≠ `Ringwraith` (deux races, pas deux orthographes) et pourquoi `RACE_ALIASES` ne doit pas les fusionner ; `race.Ringwraith` FR passe à « Spectre », ES à « Espectro del Anillo », ajout de `race.Nazgûl`. `import.alignPref.*` traduit (FR et ES l'affichaient en anglais, « Minion » compris) et `Fallen Wizard` → `Fallen-wizard` en EN. Garde étendu : les six termes anglais du glossaire, tokens `{placeholder}` exclus de l'inspection. §14 : deux dettes réglées, liste renumérotée. 496 tests. |
