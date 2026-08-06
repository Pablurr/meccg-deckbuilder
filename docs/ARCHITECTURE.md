# Mémoire technique — MECCG Deck Builder

> **Document de référence unique pour tout agent LLM travaillant sur ce dépôt.**
> Lis la section pertinente **avant** de modifier du code, et **mets ce fichier à jour
> dans le même commit** que ton changement. Le protocole est décrit en §0.
>
> Public : LLM. Style : dense, factuel, pas de prose d'introduction.
> Doc utilisateur : [`README.md`](../README.md). Ce fichier-ci décrit le *comment* et le *pourquoi*.

**Dernière mise à jour : 2026-08-05** — sept améliorations de confort sur l'import, le panneau
de deck et le mobile. **Dernier lot (§10) :** en mobile, `CardPreviewModal` devient la route
unique vers les zones — le bouton `⇄` de la vignette de deck est supprimé (il offrait les mêmes
destinations dans un calque écrasé sur une vignette de ~105 px), et les avertissements de
plafond de la modale sont dédupliqués par raison (`capNotices`) au lieu d'être répétés sous
chaque zone. Dette §14 n°9 réglée au passage. §4 : les lignes de pure décoration (`----`, `####`, `====`…) collées dans
une liste sont désormais ignorées plutôt que de finir en notes ; en-têtes `Starting`/`Starting
company`/`Starting deck` (et FR/ES) ajoutés comme alias de la réserve, distincts de « Starting
notes » ; en-tête `Other characters` (et FR/ES) ajouté comme zone qui referme une section
réserve/starting et renvoie ses personnages à la pioche, plutôt que de rester un groupe (ou un
titre inconnu) qui laisse la zone intacte et les y laisse fuiter. §10 : la pastille Réserve du
panneau de deck affiche un suffixe `(+n)` pour les objets mineurs/événements de stage qu'elle
contient en plus des personnages comptés par `n / max` (`poolExtraCount`, `DeckPanel.jsx` ;
prop `extras`, `ZoneTabs.jsx`) ; en mobile, la ligne du logo (logo + Proxy + langue + `?` + `💡`)
est resserrée (gap, marge du logo, marge et padding du bouton Proxy) pour tenir sur une seule
ligne ; et la ligne suivante (boîtes de recherche + bouton Filtres, réduit à une icône 🔻 +
flèche de pli) tient elle aussi sur une seule ligne, via un intercalaire `.search-row`
(`display: contents` sur desktop, vrai conteneur flex forcé à sa propre ligne en mobile) qui
évite un piège flexbox où le forçage direct de `search-group` empêchait structurellement le
bouton Filtres de jamais partager sa ligne.

Précédent : branche `export-card-selection` (`37d9d15..HEAD`) — export d'un sous-ensemble
choisi du deck, sur les trois formats (ZIP MPC, planches PDF, liste texte). Nouvelle case
« Export partiel » dans `ExportDialog`, qui ouvre `CardSelectionDialog`, une grille de choix
des cartes par exemplaire (`selection.js`, §7). La découverte qui a façonné le design : ZIP/PDF
et liste texte ne consomment pas la même donnée — d'où deux projections, `selectedCardIds` et
`selectedQuantitiesZones`, plutôt qu'une liste d'ids unique. L'export complet reste le défaut
et son chemin est inchangé.

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
test/               37 fichiers Vitest, 678 tests
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

**Forme source :** `{ SETCODE: { name: {en,es,fr}, order, imageBaseUrl: {en,es,fr,enOriginal,esOriginal}, cards: { "AS-1": {…} } } }`.

**Forme après `parseCards()`** — `{ cards, facets, index, setNames }` :

- `cards` : tableau aplati. Chaque carte porte `id`, `set`, `name{en,es,de,fr,it,nl,fi,ja}`,
  `type`, `alignment`, `attributes{}`, `image` (nom de fichier nu), `imageBaseUrl`
  (recopié depuis le set), `rarity`, `artist`, `relativePath`, `text`.
- `facets` : valeurs uniques triées pour les filtres (sets, types, alignments, rarities,
  artists, races, subtypes, skills, keywords).
- `index` : `Map<id, card>`, mémorisée dans le module `api.js` (`_index`) et requise par
  les exports via `requireIndex()`.
- `setNames` : `{ AS: {en,es,fr}, … }`, extrait de `setObj.name`. **Les sept sets portent
  leur nom complet dans les trois langues d'interface, dans les données elles-mêmes** —
  c'est ce que lit le filtre Set (§9), donc un set ajouté aux données arrive nommé, sans
  clé i18n à écrire. `flattenCards` ne recopie **pas** ce nom sur chaque carte : c'est une
  métadonnée de set, et 1683 copies du même objet ne font pas une table de correspondance.

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
  zones: { sideboard: {…}, pool: {…}, sideboardFw: {…} },
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
- **`zones.sideboardFw` (règle 1.6.1, 2026-08-03) — la quatrième zone.** Les dix cartes
  préselectionnées pour un adversaire Sorcier déchu, *en plus* du talon ordinaire
  (`SIDEBOARD_FW_MAX`, §6). Toujours pas de numéro de version de schéma (voir ci-dessus) :
  `normalizeDeck` la défaute comme `sideboard`/`pool`, donc tout deck enregistré avant que
  cette zone existe se relit comme la possédant, vide. `totalCopies` somme désormais **quatre**
  zones (`quantities` + `sideboard` + `pool` + `sideboardFw`) — c'est ce total, pas une liste de
  zones tenue à la main, qui répond à « ce deck contient-il des cartes ? » (§5).
- **`emptyZones()` (`deck.js`, 2026-08-04, revue finale de branche) — l'unique façon de
  construire un `zones` vide.** `normalizeDeck` garantit la forme ci-dessus pour tout ce qui
  passe par `localStorage`, mais **huit endroits** construisaient un `zones` en mémoire sans
  jamais appeler `normalizeDeck` : l'état initial d'`App.jsx`, `newDeck`, `importDeckData`,
  le littéral de `ImportDialog.jsx`, celui d'`importDeck.js`, et trois paramètres par défaut
  (`deckList.js`, `ExportDialog.jsx`, `DeckPanel.jsx`). Quatre de ces huit étaient sur un chemin de production
  réel, et chacun ne nommait que `sideboard`/`pool` — un oubli qui n'était pas une
  fonctionnalité manquante mais une exception non levée : `bumpCount`
  ([`deckMutations.js`](../web/src/lib/deckMutations.js)) fait `map[id]` sans repli, et un
  `zones.sideboardFw` valant `undefined` y plante — pendant un rendu React côté fenêtre
  d'import (`ImportDialog.jsx`, dans un `useMemo`), ce qui démonte l'arbre entier faute de
  error boundary dans `web/src`. `emptyZones()` est maintenant la seule source de la forme
  vide ; `normalizeDeck` construit son propre `zones` à partir des clés d'`emptyZones()`
  plutôt que de les re-lister, pour que les deux ne puissent plus diverger. **Une sixième zone
  n'exige d'éditer qu'`emptyZones()`** — un `grep` de `sideboard: {}` dans `web/src` après
  coup doit ne renvoyer que sa propre définition.

### `deckPayload()` et `deckSignature()` (`deck.js`, 2026-08-04)

**`deckPayload({ deck, cardIds, quantities, zones, name })` est la définition unique de ce
qu'un enregistrement contient.** Les deux chemins de sauvegarde — le bouton de l'en-tête du
panneau (`App.saveDeck`) et le formulaire de `DeckManager.save()` — la traversent, si bien
qu'un champ ajouté là atteint `localStorage` depuis l'un comme depuis l'autre. C'est
précisément ce que les deux littéraux écrits à la main qu'elle remplace ne pouvaient pas
promettre : ils listaient les mêmes neuf champs deux fois, et rien n'obligeait la deuxième
liste à suivre la première.

**`deckSignature({ deck, quantities, zones })` répond à « ce deck diffère-t-il de ce qui est
sur le disque ? »** — c'est elle qui allume ou éteint le bouton Enregistrer (§5). Deux points
sont indispensables et aucun ne se déduit du code :

- **Les clés d'objet sont triées à *tous* les niveaux** (`stable()`). `JSON.stringify` suit
  l'**ordre d'insertion** : deux decks portant exactement les mêmes cartes, ajoutées dans un
  ordre différent, produiraient deux textes différents, et un deck qu'on vient d'ouvrir sans
  y toucher se lirait comme modifié. Le tri doit rester **récursif** — `quantities` et chaque
  map de `zones` sont des objets dont les clés arrivent dans l'ordre des clics de
  l'utilisateur, donc c'est en profondeur que le problème vit, pas au premier niveau.
- **`id`, `order` et `updatedAt` sont délibérément exclus.** Aucun des trois n'est modifiable
  depuis l'écran de deck, et les inclure ferait lire le deck comme modifié à l'instant même
  où le stockage renvoie l'`id` ou l'horodatage qu'il vient d'attribuer — c'est-à-dire juste
  après une sauvegarde réussie, exactement quand le bouton doit s'éteindre. Sont couverts :
  `name`, `mode`, `ruleset`, `notes`, `backAssignments`, `quantities`, `zones`.

### Pipeline d'import (`web/src/lib/import/`, 2026-08-03)

```
lib/import/normalize.js → line.js → vocabulary.js → document.js → resolve.js → target.js
lib/importDeck.js = façade, API publique inchangée (263 → 139 lignes)
```

- **`normalize.js`** — `normalizeName()` seule, sans aucun import. Elle vit dans une feuille
  à part **pour casser un cycle** : la façade `importDeck.js` ré-exporte `normalizeName` tout
  en important `vocabulary.js`, et `vocabulary.js` a besoin de `normalizeName` — la faire
  transiter par la façade créerait le cycle. Même piège que la séparation `catalog.js` /
  `validate.js` déjà documentée en §6.
- **`line.js`** — `parseLineCandidates(raw)` renvoie des **lectures candidates**, pas une
  seule supposition : « Bûrat 2 » est soit deux exemplaires de Bûrat soit une carte nommée
  « Bûrat 2 », et seul `cards.json` tranche. **Invariant : le DERNIER candidat reproduit
  l'ancien `parseLine` telle quelle** (quantité en tête seulement, rien retiré en fin de
  chaîne) — c'est ce qui a laissé `test/importDeck.test.js` passer sans une seule modification
  pendant tout le refactor.
- **`vocabulary.js`** — reconnaît un titre par son **contenu normalisé, jamais par le niveau
  markdown** (`## Talon`, `### Talon`, `Talon :`, `**Talon**` sont un seul titre), en quatre
  familles : zone / groupe / notes / métadonnées. Les mots qui traduisent un concept déjà
  dans l'UI (noms de zone, de groupe, de champ de note) viennent de `i18n.js`
  (`zones.*`/`zoneShort.*`/`panel.group.*`/`notes.*`), jamais réécrits à la main, pour que le
  vocabulaire du parseur et celui de l'interface ne puissent pas diverger. Les alias
  communautaires (Description, Strategy, Overview…) n'ont pas d'équivalent UI et sont ajoutés
  à la main, délibérément, pour comprendre un post de forum ou une liste générée par un LLM.
  **Un titre de zone peut porter en plus un indice de type** : « Sites » et « Regions » sont
  des titres de *zone* (`quantities`) qui posent aussi leur type, parce que ces deux mots
  ouvrent une section dans la moitié des listes écrites à la main (`## Talon … ## Sites …`)
  et ne sont un sous-groupe que dans nos propres exports (`## Locations / ### Sites (12)`).
  Lus comme de simples groupes — leur état d'avant le 2026-08-03 — ils ne fermaient pas la
  section précédente et **tous les sites atterrissaient dans le talon**. C'est sans risque
  parce que leur type ne peut vivre que dans une seule zone : c'est précisément pourquoi
  Characters / Resources / Hazards, eux, restent de simples groupes.
- **En-têtes reconnus pour `pool` (2026-08-05).** `Starting`, `Starting company`, `Starting
  deck` et leurs équivalents FR/ES (`Compagnie de départ`, `Compañía inicial`) pointent vers la
  même entrée `zone('pool')` que `Pool`/`Réserve` — alias communautaire courant, distinct de
  `NOTE_TITLES.starting` (« Starting notes »/« Notes de départ »), qui sélectionne un champ de
  note et non une zone ; les deux ne peuvent pas collisionner puisque leurs libellés diffèrent
  (« Starting » vs « Starting notes »).
- **En-tête reconnu pour refermer `pool` (2026-08-05).** `Other characters`, `Additional
  characters`, `Non-starting characters`, `Autres personnages`, `Otros personajes` sont une
  entrée `zone('quantities', 'Character')`, au même titre que Sites/Regions plus haut, et pas
  un simple `group('Character')` comme la ligne `Characters` juste en dessous. Un groupe ne
  change pas la zone, et un titre NON reconnu la laisse intacte aussi (`document.js`) : sans
  cette entrée, une liste qui ouvre « ## Starting » puis « ## Other characters » aurait
  silencieusement continué de router ses personnages vers la réserve — la section même que ce
  titre est censé refermer. Distinct du groupe `Characters` (qui ne fait que poser un indice de
  type, sans changer de zone) précisément parce que son sens communautaire est l'inverse : il
  ferme une section, il ne la prolonge pas.
- **En-têtes reconnus pour `sideboardFw` (2026-08-03).** `Sideboard vs FW`, `Sideboard vs.
  FW`, `Sideboard vs Fallen-wizard`, `FW sideboard`, `Fallen-wizard opponent sideboard`,
  `Anti-FW sideboard`, `SB vs FW`, `Talon vs SD`, `Talon contre Sorcier déchu`, `SB vs MC`,
  et le titre canonique de l'export (`Sideboard vs FW`, §7) pointent tous vers la même entrée
  de la `TABLE` de `vocabulary.js`. Chacun **contient** le mot « Sideboard », ce qui ne
  collisionne jamais avec le talon ordinaire parce que le repérage matche un **en-tête
  normalisé entier**, jamais un préfixe — un `## Sideboard` nu reste le talon ordinaire. Un
  test épingle les deux sens.
- **`document.js`** — `parseDocument(text)` tient deux garanties : le **mode notes est
  absolu** (aucune ligne n'y est jamais lue comme une carte, même « 3x Gandalf »), et **un
  titre inconnu part en notes et laisse la zone intacte** — l'ancienne implémentation
  réinitialisait la cible vers le deck principal sur tout `##` non reconnu, si bien qu'un
  « Plan de jeu » écrit dans le talon renvoyait toutes les cartes suivantes dans la pioche.
  Ne sépare pas la prose des cartes (ça a besoin de l'index de cartes, que ce module n'a pas
  et ne doit pas avoir) : `resolve.js` le fait.
- **`resolve.js`** — `resolveLines(lines, ctx)` applique une pile de désambiguïsation à
  **quatre rangs** — lecture candidate, parenthèse, type de sous-section, camp — où **chaque
  rang réduit l'ensemble et est ignoré s'il le viderait** (un mauvais indice ne doit jamais
  faire disparaître une carte qui existe), et **la parenthèse est souveraine sur le camp** :
  ce qui est écrit l'emporte sur ce qui est déduit, même quand le résultat est illégal pour le
  camp — la carte est importée et marquée, jamais silencieusement substituée. Une ligne sans
  quantité explicite qui ne matche rien est de la prose, pas un miss ; une ligne marquée
  (quantité, ou parenthèse `id`/`set`/`alignment`) reste un miss signalé même sans match.
  **Ligne de pure décoration (2026-08-05).** `DECORATION_ONLY = /^[#\-=*_~.]+$/` intercepte
  avant `prose` : un séparateur de forum (`----`, `#####`, `====`…) coche toutes les cases
  d'`isMarked` — pas de chiffre, pas de `qty>1`, pas d'indice — et rejoignait `prose` comme une
  vraie remarque, polluant les notes de tout import copié d'un forum. Testé sur `line.raw`
  (le texte original, avant que `stripDecoration` ne rogne les marqueurs markdown), donc une
  ligne qui *commence* par de la décoration mais contient du texte (`-- Contrôler les havres
  tôt`) reste de la prose normale.
- **`target.js`** — `targetForCard(card, target)` / `bucketFor(card, target, ctx)` ont **le
  dernier mot sur la zone** : `parseDocument` lit la *section écrite*, ce module décide de la
  *zone permise*. **La légalité n'est pas re-dérivée ici** — elle est demandée à
  `zoneTargets()` (§6), qui la possède déjà pour le glisser-déposer du panneau et son menu
  « déplacer vers ». Un import ne peut donc pas construire un deck que l'interface refuserait
  de construire à la main : **le talon ne contient jamais de site**, la réserve non plus, et
  ainsi de suite pour toute règle que `zoneTargets` connaît. Une zone refusée retombe sur le
  deck principal plutôt que de perdre la carte : le joueur a bien écrit la carte, seule la
  section était fausse. **Les deux appelants passent par là** (`importDeckList` et la
  prévisualisation d'`ImportDialog`), sinon le deck compté dans la fenêtre ne serait pas le
  deck reçu par l'application.
- **`importDeck.js`** (139 lignes, contre 263 avant) devient une **façade** : ré-exporte les
  fonctions ci-dessus et garde `parseDeckList`, `parseDeckListDocument`, `resolveDeckList`,
  `importDeckList` sous leur forme d'origine, pour que les appelants existants et
  `test/importDeck.test.js` n'aient rien à changer.

### `localStorage`

| Clé | Contenu | Écrit par |
|---|---|---|
| `meccg.decks.v1` | tous les decks (tableau JSON) | [`deckStore.js`](../web/src/lib/deckStore.js) |
| `meccg.proxyMode` | `'1'` / `'0'` — défaut **activé** | `App.jsx` |
| `meccg.cardZoom` | **orpheline** (§14 n°7) — plus rien ne l'écrit ni ne la lit | — |

- **Quota (~5 Mo) :** les dos personnalisés sont des data URL JPEG et sont volumineux.
  `deckStore.writeAll` relance une erreur explicite `storage-full` sur `QuotaExceededError`,
  que `DeckManager` affiche (clé i18n `decks.storageFull`).
- **Toute valeur lue de `localStorage` est validée**, car l'utilisateur peut l'écrire et
  d'autres onglets la partagent — `normalizeDeck` (ci-dessus) pour chaque deck,
  `proxyMode` par comparaison stricte à `'0'`. L'exemple historique de cette règle était le
  zoom du panneau (une valeur aberrante retombait sur le défaut plutôt que d'être *clampée*,
  pour ne pas présenter une donnée corrompue comme une préférence) ; le curseur a disparu
  (§10, §12) et cette validation-là avec lui — la clé qui la déclenchait est maintenant
  la ligne orpheline ci-dessus.
- **Pas de synchronisation multi-onglets.** Deux onglets ouverts peuvent s'écraser
  mutuellement. Connu, non traité (voir §14).

---

## §5 — État du front et flux de données

Pas de Redux, pas de Zustand, pas de `useReducer` global : **`App.jsx` détient l'état et le
descend en props**. Le seul contexte React est `I18nContext`.

**États principaux de `App.jsx` :** `cards`, `facets`, `defaultBacks`, `deck`, `quantities`,
`zones`, `filters`, `uiLang`, `proxyMode`, `panelCollapsed`, `panelWidth`,
`previewCard`, `deckSheetOpen`, `savedSignature`, `saveState`, les booléens de modales
(`showManager`, `showSetup`, `showExport`, `showImport`, `showDocs`) et `error`. (`cardZoom` a
disparu avec le curseur de zoom, §10/§12 ; la clé `localStorage` correspondante reste
orpheline, §4/§14.)

**Dérivés (`useMemo`) :** `cardsById`, `derivedFacets`, `capCtx` (contexte de plafonds de
copies, `null` hors mode deckbuilding), `ruleWarnings`.

**Mutations :** définies dans `App.jsx`, descendues en callbacks
(`onChangeQty`, `changeZoneQty`, `moveCopy`, `onToggleRule`, `onChangeNote`…). La logique
pure vit dans [`deckMutations.js`](../web/src/lib/deckMutations.js) (`applyDelta`,
`applyToggle`, `applySelectAll`), qui consulte systématiquement `roomFor` avant d'appliquer.

**`importDeckData({ quantities, zones, notes, name, mode, ruleset, target })`** (2026-08-03)
remplace la sélection courante (jamais de fusion — sémantique héritée de l'ancien
`importQuantities`) et pilote deux cibles : `target: 'replace'` (défaut) garde `id`, `name` et
`backAssignments` du deck ouvert ; **`target: 'new'` met `id` à `null`**, `backAssignments` à
`{}` et prend `name` (ou `app.newDeck` à défaut), pour que la sauvegarde crée un enregistrement
au lieu d'écraser celui en cours — coller une liste de forum, c'est en général « fais-moi un
deck avec ça », et un import raté ne doit pas détruire un travail en cours.

### `savedSignature` et `saveState` (2026-08-04)

`savedSignature` est la signature (§4) de **ce qui est sur le disque** pour le deck ouvert.
`dirty = deckSignature({ deck, quantities, zones }) !== savedSignature` est recalculé à chaque
rendu et pilote le bouton Enregistrer du panneau (§10). `saveState` vaut `'idle'`, `'saving'`,
`'saved'` ou **le message d'erreur lui-même** — c'est une chaîne, pas un énuméré fermé, ce qui
évite un second état parallèle pour porter l'erreur.

**`savedSignature` n'est réécrite qu'à quatre moments**, et la liste est fermée :

1. **au montage** (l'initialiseur du `useState`, sur le deck neuf par défaut) ;
2. dans **`loadDeckIntoState`** — on vient de lire l'enregistrement, la mémoire *est* le disque ;
3. dans **`newDeck`** — un deck vide n'a rien à enregistrer ;
4. après une **sauvegarde réussie**, ce qui recouvre deux sites d'appel : `saveDeck()`
   (le bouton de l'en-tête) et `DeckManager.onSaved` (le formulaire de la fenêtre « Mes decks »).

**Un import n'en fait délibérément pas partie.** `importDeckData` remet `saveState` à `'idle'`
mais **ne touche pas** `savedSignature` : le travail importé n'est pas sur le disque, donc le
deck doit rester *dirty* et le bouton allumé. C'est l'invariant à protéger — **un cinquième
site de réécriture désarme silencieusement le bouton Enregistrer**, et le symptôme (« j'ai
cliqué Enregistrer, il était déjà gris ») ne pointe vers rien dans la pile.

**Le piège du renommage (trouvé en revue, 2026-08-04).** `DeckManager.commitRename` écrit le
nouveau nom **directement dans le stockage** (`api.updateDeck(id, { name })`), sans rien
déplacer dans `App`. Avant le correctif, renommer le deck ouvert laissait donc l'en-tête
afficher **l'ancien** nom avec le bouton **grisé** — c'est-à-dire l'application affirmant que
disque et mémoire concordaient alors qu'ils divergeaient — et la sauvegarde suivante réécrivait
`deck.name`, **écrasant le renommage**. Le correctif ajoute le callback `onRenamed(saved)`, qui
met à jour le nom *et* refait la ligne de base.

> **Cette ligne de base est reconstruite depuis l'enregistrement rendu par le stockage,
> jamais depuis l'état vivant.** `onRenamed` lit `saved.quantities` et
> `normalizeDeck(saved).zones`, pas les `quantities`/`zones` de `App`. Repartir de l'état
> vivant aurait certifié comme enregistrées des **modifications de cartes non sauvegardées** —
> un bug pire que celui qu'on corrigeait, parce qu'il fait perdre du travail au lieu
> d'afficher un mauvais nom. Un renommage est une écriture disque partielle : seule la partie
> réellement écrite a le droit d'entrer dans la ligne de base.

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
| `dropTargets.js` | Légalité d'un drop sur un onglet (zone **et** onglet qui l'affiche) | `isDropAllowed`, `resolveDropTarget` |
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

**État au 2026-08-03 : les 31 règles sont `status: 'verified'`.** L'avertissement du README
sur des « valeurs stubs désactivées par défaut » décrit un état antérieur (voir §14).

**Les 31 règles :** `AVATAR-PRESENT`, `AVATAR-COPIES`, `AVATAR-SIDEBOARD`, `AVATAR-COUNT`,
`AVATAR-MULTIPLES`, `AVATAR-SIDE`, `ALIGN-LEGAL`, `BANNED`, `SPECIFIC-AVATAR`,
`SPECIFIC-SIDE`, `AGENT-MIND`, `COPIES-LIMIT`, `UNIQUE-LIMIT`, `SITE-COPIES`,
`REGION-EXCLUDED`, `SITE-SIDE`, `SITE-BALROG-VERSION`, `BALROG-RACE`, `BALROG-MIND`,
`FACTION-RACE`, `DECKSIZE-RESOURCES`, `DECKSIZE-HAZARDS`, `DECKSIZE-CHARS`, `CREATURE-MIN`,
`DECKSIZE-LOCATION`, `SIDEBOARD-MAX`, `SIDEBOARD-FW-MAX`, `POOL-CHARS`, `POOL-ITEMS`,
`POOL-ELIGIBLE`, `POOL-STAGE`.

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

Quatre zones logiques : **`deck`**, **`pool`**, **`sideboard`**, **`sideboardFw`** (règle
1.6.1, 2026-08-03 — les dix cartes préselectionnées contre un adversaire Sorcier déchu, en
plus du talon ordinaire ; §4). `zonesFor(card)` renvoie `{ primary, extra[] }` — la forme
dont parle le texte des règles, et `sideboardFw` y arrive **toujours en dernier** dans
`extra` : cet ordre pilote celui des compteurs de zone affichés sur une tuile du navigateur,
et la zone la plus rare va après les zones courantes. **Site et Region gardent un `extra`
vide** : c'est ce qui rend `sideboardFw`, comme les deux autres zones `extra`, inatteignable
pour eux sur les **trois** surfaces à la fois — glisser-déposer, menu « déplacer vers » et
import — puisque toutes trois interrogent `zoneTargets()` plutôt que de décider chacune de
son côté. `zoneTargets(card)` aplatit en une liste ordonnée avec `'deck'` toujours ajouté en
queue (toute carte peut rejoindre le play deck), dédoublonnée. **`isDropAllowed` est
construit sur `zoneTargets`, pas sur une dérivation parallèle** : l'UI tactile et le
drag-and-drop ne doivent pas pouvoir diverger sur la destination autorisée. **L'import aussi
passe par `zoneTargets`** (`import/target.js`, §4) : trois chemins, une seule table de vérité
sur « où une carte a le droit d'aller ».

**`dropTargets.js` n'a pas été touché par l'ajout de `sideboardFw`.** Il consomme
`zoneTargets()` sans jamais énumérer de noms de zone lui-même, donc la nouvelle zone lui
arrive par construction. Ce n'est pas une supposition : c'est la preuve que la garantie que
son propre commentaire d'en-tête revendique — un dépôt et un « déplacer vers » ne peuvent
jamais se contredire — tient réellement, puisqu'un ajout de zone n'a rien exigé de ce
fichier.

Rappel : `deck` couvre à la fois le play deck et le location deck ; les onglets UI `'play'`,
`'location'` et `'cards'` se résolvent tous vers la zone logique `'deck'`.

**Un dépôt légal par la zone peut rester illégal par l'onglet.** `isDropAllowed` pose donc
*deux* questions, et il faut deux oui : (1) la carte peut-elle occuper la zone visée
(`zoneTargets`) ; (2) l'onglet visé **affichera-t-il** la carte (`backGroupForType`, le même
filtre que `DeckPanel` applique à ses entrées). La seconde n'est pas une règle du jeu mais
une règle d'interface, et l'avoir omise était un vrai bug : `play` et `location` étant deux
vues d'une seule zone, glisser un personnage de la réserve vers l'onglet **Sites** comptait
comme un dépôt légal sur `deck` — et le personnage atterrissait dans la **pioche**, un
onglet plus loin que là où le joueur avait lâché, sans rien pour expliquer le saut. Un dépôt
que la destination ne sait pas montrer est une erreur de visée, et une erreur de visée
laisse la carte où elle était. L'onglet `cards` du mode impression libre montre tout le
deck : il ne refuse rien.

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

`SIDEBOARD_FW_MAX = 10` (`formats.js`, 1.6.1, 2026-08-03) plafonne `sideboardFw` séparément
de `sideboardMax` — cette allocation est **additionnelle**, jamais soustraite du talon
ordinaire. C'est une **constante à plat**, pas une cinquième colonne de `LENGTHS` : 1.6.1
accorde les dix cartes telles quelles, sans jamais varier avec la longueur de partie, à la
différence de `sideboardMax`. `SIDEBOARD-FW-MAX` (le validateur) et `AVATAR-SIDEBOARD` (le
plafond de copies, ci-dessous) sont deux règles distinctes sur les mêmes zones : la première
compte des cartes, la seconde des exemplaires d'un même avatar.

**`isLegalForSide` — la passe `specific` (2026-08-03).** Une carte dont `attributes.specific`
nomme un avatar est illégale pour tout camp qui ne peut pas déclarer cet avatar
(`SPECIFIC_TO_SIDES`, table de `sides.js`) : sans cette passe, les 46 cartes BA
`specific: "Balrog"` restaient visibles (légales) dans un navigateur Spectre de l'Anneau.
**Volontairement au niveau du camp, pas de l'avatar** : le navigateur ne sait pas quel avatar
précis le deck a déclaré, et un camp Sorcier autorise trois avatars distincts — le cas plus
fin (une carte spécifique à Gandalf dans un deck Saruman) reste à la règle `SPECIFIC-AVATAR`,
qui a ce contexte. Une valeur de `specific` non répertoriée dans `SPECIFIC_TO_SIDES` ne
restreint rien : une donnée inconnue ne doit jamais cacher une carte silencieusement. Cette
passe **absorbe l'ancien cas spécial** `if (sideId === 'balrog' && a.specific === 'Balrog')
return true`, qui ne faisait que garder les cartes Balrog visibles pour ce seul camp ; la
nouvelle passe généralise à tout `specific` connu et à tout camp. `specificMode:
'balrog-exempt'` (`SIDES.balrog`) reste utilisé ailleurs, dans `validate.js`, pour
l'exemption de race/mind du pool — sans rapport avec cette passe du navigateur.

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
- **La forme du `scope` d'un plafond de copies zoné a changé (2026-08-03) :**
  `{ zone: 'sideboard' }` → `{ zones: ['sideboard', 'sideboardFw'] }`, pour que
  `AVATAR-SIDEBOARD` compte les deux talons ensemble (§12, ruling 1.6.2). **`copies.js` et
  `validate.js` lisent tous les deux cette forme** — `remainingCopies` (le bouton `+`) et
  `validateDeck` (les avertissements) recalculent chacun leur propre total sur `cap.scope.zones`
  plutôt que de partager un total. Ne mettre à jour que l'un des deux produirait un plafond
  silencieusement ignoré par l'autre : rien ne les recouple automatiquement.

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
| `deckListZip.js` | `safeFileName`, `buildDeckListZip` — une deck list texte par deck, en une archive |
| `pdf.js` | `buildSheetPdf` — planches pdf-lib |
| `sheetLayout.js` | `PAGE_SIZES`, `sheetLayout`, `backColumnIndex`, `chunk` |
| `backGroups.js` | `backGroupForType`, `slug` |
| `proxyDraw.js` | `drawProxyOnFace`, `loadPatchBitmaps`, `closePatchBitmaps` |
| `selection.js` | Sélection à l'export : slots par exemplaire, et **les deux projections** |

### Ordre d'export — invariant

`deckSections()` produit **Pool → Play deck → Locations → Sideboard → Sideboard vs FW**
(1.6.1, 2026-08-03), et à l'intérieur de chaque section un ordre de groupes fixe (play :
avatars → characters → resources → hazards). `sideboardFw` groupe **exactement comme**
`sideboard` — même liste `SIDEBOARD_GROUPS`, partagée plutôt que recopiée pour ne pas tenir
deux définitions du même regroupement synchronisées pour une seule règle — mais reste une
**section à part** : c'est une allocation de dix cartes distincte de `sideboardMax`, que le
joueur doit pouvoir compter séparément. `SECTION_TITLES.sideboardFw = 'Sideboard vs FW'` en
est le titre anglais canonique, celui que le vocabulaire de l'import reprend tel quel (§4)
pour que l'écriture et la lecture ne puissent pas diverger. Les trois formats consomment
`deckSections()`, donc ils **ne peuvent pas** diverger. Cet ordre s'applique **aussi en mode
freeform** (décision propriétaire du 2026-07-26), pour qu'il n'y ait qu'un seul ordre
d'export à expliquer.

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

- **Le chemin dépend de `stampFor(card)`, pas directement de `proxyMode`** — fr, proxy
  éteint : `stampFor` renvoie `null`, les octets CDN bruts sont embarqués tels quels ;
  pdf-lib met à l'échelle vectoriellement vers 2,5×3,5 po, donc aucun rééchantillonnage.
  Pour tout le reste (en/es dans tous les cas, fr proxy allumé), `stampFor` renvoie un
  tampon et `toStampedJpeg` produit une face à la taille de coupe, rééchantillonnée et
  ré-encodée en JPEG avec le tampon cuit dedans.
- **Conséquence pour en/es : l'export PDF perd la propriété « pas de rééchantillonnage »
  même proxy éteint**, puisque le masquage du copyright exige de repeindre des pixels. Le
  mode proxy est actif par défaut, donc la plupart des utilisateurs étaient déjà sur le
  chemin tamponné — mais c'est un changement de fidélité d'image réel et jusqu'ici non
  documenté.
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
## Metadata         (toujours émis, y compris en freeform)
- Mode: Deckbuilding
- Side: Balrog        (seulement en mode deckbuilding)
- Game length: Standard
## Notes            (seulement si au moins une note est non vide)
### <titre de note>
<contenu>
## Pool | Play deck | Locations | Sideboard | Sideboard vs FW
### <Groupe> (<total>)
<N>x <nom de carte dans `lang`>
```

**Les titres de section et de groupe sont en anglais canonique**, quelle que soit la langue
choisie, **parce que l'import les reparse**. Seuls les noms de cartes suivent `lang`.
Casser cette asymétrie casse le cycle export → import.

**Le bloc `## Metadata`** (2026-08-03) est **toujours émis**, y compris en freeform
(« Mode: Freeform » à lui seul referme le round-trip) : un bloc parfois absent est un
conditionnel que le lecteur doit reconstruire. `Side` et `Game length` ne sortent qu'en mode
deckbuilding. Les valeurs sont l'anglais canonique (`META_MODE`/`META_SIDE`/`META_LENGTH`
dans `deckList.js`), comme tout titre ici, parce que l'import les relit. **`tournament` en
est délibérément absent** : la fenêtre d'import ne propose aucun réglage tournoi/casual, et
un champ exporté que l'import ne peut pas restaurer est une asymétrie — le round-trip ne doit
promettre que ce qu'il tient vraiment. **Le titre est « Metadata » et non « Deck »** : le
vocabulaire de l'import (`lib/import/vocabulary.js`) lit déjà le mot nu « deck » comme visant
le play deck (voir §4), et une seule lecture par mot est ce qui garde ce vocabulaire une table
plate plutôt qu'une résolution contextuelle.

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

### Export massif de deck lists (`deckListZip.js`, 2026-08-04)

`buildDeckListZip(entries)` empaquette un `.txt` par deck, chacun produit par
`buildDeckListText` (§7 ci-dessus) — **réutilisé, jamais réécrit** : un second sérialiseur
divergerait du premier sans que rien ne le signale, et ces `.txt` se recollent tels quels dans
la fenêtre d'import, donc l'export massif fait aussi office de sauvegarde.

**Texte seulement, pas d'images.** Plusieurs decks tirant leurs images en même temps est un
problème de mémoire navigateur, pas une version plus grosse du même bouton. L'archive massive
n'est donc **pas** une généralisation de l'export ZIP MPC.

**Le piège qui justifie tout ce module : `zip.file()` sur un chemin déjà présent l'écrase
sans un mot.** Deux decks dont les noms s'assainissent vers la même base partiraient donc
comme **un seul fichier**, et l'utilisateur n'aurait aucun moyen de s'en apercevoir — pas
d'erreur, pas d'avertissement, une archive plus courte que la sélection. D'où la passe de
déduplication (`used`, base assainie → nombre de prétendants ; le premier garde le nom nu, les
suivants prennent `-2`, `-3`…).

**La déduplication se fait *après* l'assainissement, et c'est l'ordre correct** :
l'assainissement est ce qui **crée** la plupart des collisions. « Deck #1 » et « Deck/1 » sont
deux noms distincts à l'écran et un seul fichier une fois passés par le remplacement des
caractères hors `[a-zA-Z0-9_-]`. Dédupliquer sur les noms d'origine ne verrait pas la collision.

**`safeFileName` doit rester caractère pour caractère identique à l'assainissement de l'export
d'un deck seul** (`ExportDialog.jsx`, `replace(/[^a-zA-Z0-9_-]+/g, '_')`), pour qu'un deck
exporté seul et le même deck exporté dans un lot atterrissent sur le même nom de fichier. Une
version qui retirait en plus les tirets bas de fin a brièvement cassé cette parité et a été
annulée. **L'invariant est maintenant épinglé par un test :**
`safeFileName('Deck (1)') === 'Deck_1_'` — c'est le tiret bas final, celui qu'on est tenté de
trouver laid, qui prouve la parité. Ce n'est pas partagé dans un helper commun : la parité
tient par ce test, pas par la structure (§14).

**Le deck ouvert s'exporte depuis l'écran, pas depuis le disque** (trouvé à la revue finale de
branche). La boucle lit chaque deck par `api.getDeck`, sauf la ligne dont l'`id` est celui du
deck ouvert : celle-là est construite depuis les `quantities`/`zones` vivants de `App`. Sans
cette exception, un deck aux modifications non enregistrées partait dans l'archive dans son
état **d'avant les modifications**, en silence. Deux raisons, et la seconde est la vraie :
c'est le deck qu'on coche le plus distraitement, et surtout **l'export d'un seul deck en texte
lit déjà l'état vivant** (`ExportDialog`) — un lot qui lirait le disque mettrait deux listes
différentes sous un même nom de deck selon le bouton employé, ce que la réutilisation de
`buildDeckListText` existe précisément pour empêcher. La comparaison est sûre parce qu'un deck
jamais enregistré a `id === null` et qu'un `id` en stockage est toujours une chaîne `d_…`.

**Un deck disparu en cours de lot est sauté, pas fatal.** `api.getDeck` **lève** au lieu de
rendre `undefined`, donc une lecture non gardée dans la boucle jetait **tous les decks déjà
rassemblés** à cause d'un seul deck supprimé entre le clic et son tour. Le `try`/`catch` autour
de chaque lecture fait coûter à l'utilisateur ce deck-là et rien d'autre. Si *toutes* les
lectures échouent, la fonction s'arrête sans rien télécharger : une archive vide serait un
mensonge sur ce qui a été exporté.

### Cibles d'impression

Tout est dans [`constants.js`](../web/src/lib/constants.js) : `DPI = 300`, `BLEED_PX = 36`,
`CARD_W_BLEED = 822`, `CARD_H_BLEED = 1122`, coupe dérivée 750×1050.
**À vérifier contre le gabarit MPC réel avant une vraie commande** — un seul endroit à
changer. Les images source font 570×796 @72 DPI, soit un agrandissement d'environ 1,4× :
correct pour des proxies, pas parfaitement net. C'est inhérent aux fichiers source.

---

## §8 — Le tampon Proxy

**Pourquoi :** MPC exige que les cartes proxy ne portent pas la mention de copyright.
L'app **repeint** la zone avec le cadre vierge du type de carte, puis écrit un libellé par-dessus.

**En/es : le masque est inconditionnel.** Le `©19xx Tolkien Enterprises` de ces deux langues
ne doit **jamais** atteindre un envoi d'impression (sauf les Régions, voir plus bas), que
l'utilisateur ait pensé ou non à activer le mode Proxy — l'interrupteur ne décide donc plus
*si* la zone est repeinte pour en/es, seulement *quel texte* y est écrit : « Proxy » en mode
proxy, sinon le nom (traduit) du set, qui est de toute façon ce que les cartes FR impriment
déjà à cet endroit-là.
**Fr garde son ancien comportement** (rien tant que le mode Proxy est éteint) : les images FR
portent le nom du set à cet emplacement au lieu d'une mention de copyright, donc il n'y a
rien à masquer.

**Interrupteur activé par défaut** (`meccg.proxyMode`, §4).

### Point de décision unique — `proxyStampFor`

`proxyStampFor(card, lang, proxyMode, setNames)` (dans `proxy.js`) est le **seul** endroit
qui décide ce qu'affiche le tampon d'une carte — clé de cadre, texte, couleur — ou `null`
pour ne rien afficher. **Invariant : aucun chemin de rendu ne doit réimplémenter cette
décision**, seulement appeler `proxyStampFor` et peindre le résultat — c'est ce qui garantit
que tous s'accordent, y compris après un futur changement de règle qui ne touchera que
cette fonction. Les trois chemins l'appellent désormais : `ProxyStamp.jsx` (overlay CSS des
grilles/modales), l'aperçu au survol (`CardPreview.jsx`, chemin DOM impératif), et le canvas
d'export (`api.js` → `makeStampFor`, qui passe le résultat à `drawProxyOnFace` dans
`proxyDraw.js`). `drawProxyOnFace(ctx, w, h, patchBmp, text, color)` ne connaît plus ni le
texte ni la couleur du libellé : il peint ce qu'on lui donne, `proxyStampFor` a déjà tranché.

**Le portier de `makeStampFor` (`api.js`) teste `lang`, pas seulement `proxyMode`** — c'est
la même asymétrie en/es vs fr qu'ailleurs dans cette section, mais appliquée à la décision de
*charger les patchs du tout* plutôt qu'à ce qu'affiche un tampon donné : `lang === 'fr' &&
!proxyMode` court-circuite tout l'export (aucun fetch de patch), alors qu'en/es passent
toujours par `proxyStampFor` même mode Proxy éteint, puisqu'il leur reste le nom du set à
peindre. Un futur appelant qui testerait seulement `proxyMode` avant d'appeler `makeStampFor`
réintroduirait le copyright non masqué sur les exports en/es.

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

`PROXY_LABEL_FONT_FRAC = 0.021` (2026-08-05, était `0.0155`) — le calibrage de juillet
dérivait la taille de police de la **hauteur de capitale** mesurée sur « Remastérisé -
Traduction non officielle » (≈6.2 px à 570 px de large), mais l'œil compare l'**étendue
pleine du glyphe** (accents, apostrophe) sur la vraie carte, qui mesure plutôt 9-11 px à
cette échelle — d'où un rendu perceptiblement plus petit que l'imprimé une fois comparé
côte à côte avec le vrai nom de set FR. Vérifié à l'écran (`getBoundingClientRect` +
`getComputedStyle` sur `.proxy-stamp span`, la taille de police calculée correspond
exactement à `PROXY_LABEL_FONT_FRAC × largeur de l'image`) : la formule était juste, la
constante était trop petite. Le nom traduit le plus long (« Servidores de la Oscuridad »,
es) reste dans `PROXY_PATCH_RECT` avec 24 px de marge à cette taille — vérifié avant de
committer, comme pour la taille d'origine.

`PROXY_LABEL_COLOR` est généré par le script (voir `scripts/proxy-patch-colors.txt`) et
committé en littéraux pour que CSS et canvas rendent identiquement. La couleur vient
maintenant des pixels réels des cartes FR, pas d'un choix synthétique noir/blanc : le
générateur isole l'encre du nom de set en différenciant chaque carte FR avec son patch
`-fr` (qui EST le cadre vide reconstruit), moyenne les pixels qui diffèrent, puis pousse
cette teinte (même teinte/saturation, luminosité seule) jusqu'à ce qu'elle passe un plancher
de contraste de 80 face aux **deux** variantes du patch — nécessaire parce que « Proxy » est
une information fonctionnelle à la lecture d'une planche, contrairement au nom de set que le
masque cache de toute façon. Deux pièges :
- **Un seuil luminance-vs-fond local ne marche pas** : les 4 cadres Site ont un coin
  bas-gauche déchiré dont le bord sombre l'emporte sur les glyphes (il ressortait presque
  noir pour `minion-site`, dont « Contre l'Ombre » est pourtant clairement blanc). D'où la
  différenciation contre le patch, insensible à la polarité (l'encre est claire sur les
  cadres sombres, sombre sur les cadres clairs).
- **7 des 16 clés sont poussées (« floored »), pas fidèles** à la teinte FR : `hero-character`,
  `fw-site`, `alatar`, `gandalf`, `pallando`, `radagast`, `saruman` — la teinte FR y était
  mesurée illisible (contraste aussi bas que 2 pour `radagast`) une fois isolée. Les 9 autres
  clés gardent leur teinte FR exacte. `scripts/proxy-patch-colors.txt` (3e colonne) garde la
  teinte non poussée, la 4e colonne indique `sampled`/`floored`.
- **Le bisecteur doit viser au-delà du plancher, pas pile dessus** (`BISECT_MARGIN = 2`,
  2026-08-05) : `label_colour` bissecte la luminosité HLS jusqu'à la frontière exacte du
  plancher de contraste, puis arrondit en RVB 8 bits — cet arrondi peut repousser la
  luminance finale sous le plancher de ~1 unité. Repéré par l'assertion de plancher (ajoutée
  en revue finale) qui a échoué pour `fw-site` après le recalibrage de police ci-dessus (la
  taille de police change l'empreinte échantillonnée par `patch_label_lum`, donc les couleurs
  doivent être régénérées à chaque changement de `PROXY_LABEL_FONT_FRAC`).

Avec les noms de sets, le libellé peut être bien plus long que « Proxy » (ex. « Servidores
de la Oscuridad »). `.proxy-stamp span` porte donc `white-space: nowrap` dans `styles.css` :
le chemin canvas ne peut **jamais** faire retour à la ligne (une seule ligne de texte,
position fixe), donc si le CSS le pouvait, ce serait la seule façon dont les deux chemins
pourraient visuellement diverger.

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

**Autres termes arrêtés :** « Ruins & Lairs » se dit **« Ruines & Antres »** (2026-08-04, il
disait « Ruines & Repaires »). Ce terme-là n'entre pas dans la liste des mots bannis : il n'a
jamais désigné autre chose, ce n'est pas une rotation de sens — juste une occurrence à
corriger. Les textes de carte de `cards.json` ne sont pas touchés : c'est une donnée
d'entrée, pas de la traduction d'interface.

#### Le garde n'a plus aucune exemption (2026-08-04)

Jusqu'ici, six clés — la section « Vocabulaire » de la page « ? » — étaient les seules
autorisées à citer un terme anglais retiré, entre guillemets (« en anglais *sideboard* »).
C'était la raison d'être d'un glossaire : les cartes MECCG sont imprimées en anglais, et le
joueur avait besoin de la correspondance. **Cette section a été retirée de la page d'aide sur
demande du propriétaire** (elle se lisait comme une note de développeur), et l'exemption est
partie avec elle : `GLOSSARY_KEYS` est **supprimé**, pas vidé — un `Set` vide aurait été une
référence vivante vers une section morte — et le test qui l'itérait a disparu. Le garde
restant parcourt **toutes** les chaînes `fr` sans `continue` ni liste d'autorisation.

> **Ajouter une exemption pour faire taire un échec futur est le mauvais geste.** Le message
> d'échec nomme la clé et le mot : c'est la **chaîne française** qu'il faut corriger. Le seul
> effet de bord assumé est que l'application ne donne plus nulle part la correspondance
> FR↔EN — c'est le prix de la demande, pas un oubli.

**Trois choses portent le nom de « vocabulaire » dans ce dépôt et une seule a bougé :**

| | quoi | sort |
|---|---|---|
| `lib/import/vocabulary.js` | la table qui reconnaît « Pioche » / « Playdeck » / « Mazo de juego » comme une même section quand on colle une liste | **intacte** |
| `RETIRED_FR` (`test/i18n.test.js`) | les *règles* de vocabulaire FR | **conservées, rendues inconditionnelles** |
| `docs.glossary.*` + le `<dl>` de `RulesDoc.jsx` | la *section texte* de la page d'aide | **supprimée** |

### Les libellés des filtres viennent de deux sources

`optionLabel()` dans `FilterBar.jsx` décide, par facette, comment une valeur brute de
`cards.json` devient ce que le menu affiche :

| Facette | Source du libellé |
|---|---|
| types, alignments, races | le **dictionnaire** (`FACET_PREFIX` → `panel.group.` / `alignment.` / `race.`) : vocabulaires fermés |
| sets | les **données** (`setNames`, §3) via `setLabel()` — « Contre l'Ombre (AS) » |
| artists, rarities, subtypes, skills, keywords | **valeur brute** — noms propres, à ne pas traduire |

Le code du set est conservé entre parenthèses : c'est lui qu'emploient les ids de cartes
(`AS-1`) et les exports texte, donc le retirer couperait le lien entre le filtre et tout le
reste. Les filtres stockent les **codes**, jamais les libellés — changer de langue ne perd
donc aucune sélection (vérifié). Le tri se fait sur le libellé affiché, comme pour les
autres facettes, donc l'ordre du menu change avec la langue ; le champ `order` des données
(ordre de sortie : TW, TD, DM, LE, AS, WH, BA) existe si un tri chronologique est un jour
préféré.

**Exception : le filtre Type (2026-08-03).** Son tri n'est plus alphabétique sur le libellé
mais **fixé sur l'ordre de jeu**, identique dans les trois langues : `TYPE_ORDER` dans
`constants.js` (`Character, Resource, Hazard, Site, Region`). `sortFacetOptions()`
(`lib/filter.js`) prend un `order` optionnel ; sans lui elle trie par libellé comme les
autres facettes, avec lui elle range par rang dans `order` puis par libellé pour départager,
et **place en queue toute valeur absente de `order`** plutôt qu'en tête, pour qu'une valeur
de donnée ajoutée reste visible sans sauter au sommet du menu. `FacetDropdown` ne reçoit ce
prop que pour Type.

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

### Nouvelles clés `import.*` (2026-08-03)

`import.step2`, `import.target`/`.target.new`/`.target.replace`, `import.mode`,
`import.defaultName`, `import.summaryProse`, `import.illegal`, `import.prose` habillent le
second temps de la fenêtre d'import (§10) : cible, mode, résumé des lignes gardées en notes,
marque d'illégalité. `import.alignPref.*` existait déjà (branche précédente).

**Le vocabulaire du parseur (`lib/import/vocabulary.js`) reprend les libellés de `i18n.js`,
il ne les réécrit pas.** Les noms de zone, de groupe et de champ de note que le parseur
reconnaît viennent de `zones.*`/`zoneShort.*`/`panel.group.*`/`notes.*`, jamais recopiés à la
main — voir §4. Seuls les alias communautaires (Description, Strategy, Overview…), qui
n'ont pas d'équivalent dans l'UI, sont écrits en dur.

**Piège « réserve ».** Le tableau du parseur ne connaît que le sens **courant** du mot —
pool, depuis le 2026-07-29 (glossaire ci-dessus) — jamais l'ancien (sideboard). Un texte
collé qui écrit « Réserve » en pensant au sideboard sera lu comme visant le pool, sans
avertissement : c'est une décision (aucune liste écrite à la main n'utilise plus l'ancien
sens), pas un oubli à corriger en ajoutant l'ancienne entrée.

### Zone `sideboardFw` et en-tête du panneau (2026-08-03)

`zones.sideboardFw` porte le libellé court de l'onglet (`Talon vs SD` en FR, `SB vs FW` en
EN, `SB vs MC` en ES) ; `zones.sideboardFwFull` porte le nom long, celui que lit un lecteur
d'écran (`Talon contre un adversaire Sorcier déchu` en FR — voir §10, l'`aria-label`
composé). `zoneShort.sideboardFw` porte l'abréviation à trois-quatre lettres du menu
« déplacer vers » (`T.SD` / `SBFW` / `SBMC`). **`SD` = Sorcier déchu** — l'abréviation FR
retenue pour tenir le libellé court dans la largeur d'une pastille de zone. `panel.titleNamed`
(`Deck « {name} »`) habille l'en-tête refondu du panneau (§10).

L'ES a d'abord porté `Reserva` pour `zones.sideboardFwFull` — collision avec `zones.pool`
dans le même dictionnaire, le libellé se lisait comme visant la réserve plutôt que le talon.
Corrigé (`6052c63`) en laissant `Sideboard` non traduit, comme le fait déjà `zones.sideboard`.

**Clé retirée : `panel.zoom`.** Le curseur de zoom du panneau a disparu (§10) ; la clé
n'habille plus aucun bouton et a été retirée des trois dictionnaires ensemble — un retrait
symétrique, donc la parité de clés `fr`/`en`/`es` qu'`i18n.test.js` vérifie tient toujours.

---

## §10 — Couche UI, responsive, accessibilité

### Composition

```
App
├── FilterBar          (facettes, recherche, LangPicker, ProxyToggle, bouton « ? »,
│                       lien « Suggérer une amélioration »)
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
             · RulesDoc → FeaturesDoc · CardPreviewModal
```

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

### Mobile

**Un seul breakpoint, basé sur la largeur :** `MOBILE_QUERY = '(max-width: 768px)'`
dans [`mobile.js`](../web/src/lib/mobile.js), consommé par le hook
[`useIsMobile`](../web/src/lib/useIsMobile.js) (`matchMedia`, abonné aux changements).
Il n'y a **pas** de détection d'agent utilisateur — délibérément.

Différences de forme :

- `DeckPanel` passe en feuille plein écran (`asSheet`) ; le panneau latéral disparaît.
- `CardBrowser` rend les `ZoneCtrls` en lecture seule ; l'ajout passe par
  `CardPreviewModal`, qui porte un sélecteur de zone.
- `MiniCard` réduit `− / count / +` à un simple compteur, et **le bouton `⇄` (déplacer)
  disparaît (2026-08-05)** — voir « Une seule modale… » ci-dessous.
- `FilterBar` replie les facettes derrière un bouton « Filtres », icône seule (🔻) + flèche de
  pli en mobile (texte visible sur desktop, où le bouton n'existe même pas -- voir plus bas).
- `DeckDrawer` affiche d'abord « voir le deck » avec le total, puis **des icônes seules**.
- **Ligne du logo (2026-08-05).** Logo + Proxy + langue + `?` + `💡` doivent tenir sur une
  seule ligne à 375 px, sans les boîtes de recherche (qui passent en dessous via `order: 1`,
  voir `styles.css`). `gap` de `.filterbar-top` réduit à 4px, marge droite du logo à 2px, et la
  marge droite de 10px du bouton Proxy (utile seulement sur desktop, pour le séparer des
  boîtes de recherche qui partagent alors sa ligne) mise à 0 en mobile — les cinq éléments
  tiennent avec 77 px de marge (288 px occupés sur 355 px disponibles à 375 px de large,
  mesuré dans le navigateur réel).
- **Ligne de recherche : boîtes + bouton Filtres icône seule (2026-08-05).** Les deux boîtes de
  recherche affichent un texte plus court en mobile (`filter.searchShort`/`filter.searchTextShort`
  -- « Titre »/« Texte », un mot au lieu de la phrase desktop) et partagent leur ligne avec le
  bouton Filtres, réduit à 🔻 + la flèche de pli (`aria-expanded` porté par le bouton, « Filtres »
  reste son nom accessible via un `<span className="sr-only">`, jamais affiché).
  **L'icône est 🔻 et non le `▽` géométrique d'origine (2026-08-05) : Unicode n'a pas d'emoji
  entonnoir**, et c'est le plus proche qui existe — même silhouette effilée vers le bas que
  l'icône « filtre » universelle, mais peinte par la police emoji du système, donc lue comme
  une icône et non comme un caractère égaré. La flèche de pli à côté reste monochrome : c'est
  ce qui empêche de lire les deux triangles comme un seul contrôle. Vérifié dans le navigateur
  réel (glyphe rendu en couleur — 321 pixels opaques, tous saturés — et non en tofu ; le bouton
  passe de 48 à 51 px, la ligne tient toujours à 375 px). **Piège flexbox
  contourné par un `.search-row` intercalaire, `display: contents` sur desktop** (transparent :
  `search-group`, son seul enfant là, se comporte comme avant) **et un vrai conteneur flex en
  mobile** (`flex: 1 0 100%; order: 1`, exactement l'ancienne règle de `search-group` seul).
  Donner directement ce `flex: 1 0 100%` à `search-group` -- comme avant cette tâche -- empêche
  structurellement `filters-toggle` de jamais partager sa ligne : l'algorithme de retour à la
  ligne place les éléments selon leur taille hypothétique (le `flex-basis`) **avant** que
  `flex-grow`/`flex-shrink` ne s'exécutent, donc un enfant forcé à 100% se retrouve seul sur sa
  ligne dès cette étape, et aucun redimensionnement ultérieur ne peut plus y faire entrer un
  voisin. L'intercalaire déplace ce point de décision : c'est LUI qui est forcé à 100%, et
  `search-group`/`filters-toggle` ne négocient la largeur qu'entre eux, à l'intérieur d'une ligne
  dont l'existence est déjà tranchée. Mesuré dans le navigateur réel à 375 px : logo/Proxy/
  langue/`?`/`💡` sur la première ligne (jusqu'à 288 px), boîtes de recherche (148 px chacune) +
  bouton Filtres (48 px) sur la seconde (jusqu'à 365 px) ; à 1280 px, layout desktop identique à
  avant (largeurs, placeholders complets, bouton Filtres absent du DOM).

### Une seule modale pour les zones en mobile (`CardPreviewModal`, 2026-08-05)

**Une seule instance de `CardPreviewModal` vit dans `App`**, pilotée par l'état `previewCard`,
et **les deux écrans mobiles y poussent la même carte** : la tuile du navigateur
(`CardBrowser`, `onPreview`) comme la vignette du deck (`MiniCard` → `DeckPanel` → `onPreview`).
Ses `rows` viennent de `zoneTargets(card)` — la liste que le glisser-déposer valide déjà (§6) —
donc la modale ne peut pas proposer une zone qu'un dépôt refuserait, et elle expose un
`− / compteur / +` par zone légale.

**Le bouton `⇄` de la vignette a donc été supprimé en mobile.** Il offrait exactement les
mêmes destinations, mais à travers un calque de boutons de zone écrasés dans une vignette de
~105 px ; la modale atteint les mêmes zones avec des cibles de 44 px et la place d'expliquer
pourquoi un `+` est bloqué. Un déplacement s'y fait en `−1` ici, `+1` là. **Sur desktop il
reste** : le glisser-déposer y est la route principale et `⇄` son repli pour qui préfère ne
pas glisser ; la modale, elle, n'y est pas le modèle d'interaction (survol + glisser).
Conséquence CSS : les règles mobiles qui grossissaient `⇄` à 44 px ont été supprimées avec
lui, **dette n°9 comprise** (le point de rupture `@container (min-width: 80px)` qui l'empêchait
de chevaucher la pile `qty` sur les tuiles les plus étroites — une collision que la modale n'a
tout simplement pas).

**Les avertissements de plafond sont dédupliqués (`capNotices`).** Presque tous les plafonds
comptent les exemplaires **toutes zones confondues** (une carte unique, c'est un exemplaire
dans tout le deck), donc une carte saturée l'est partout pour la même raison — et la phrase
était imprimée sous *chaque* ligne : trois copies de « Carte unique — un seul exemplaire dans
tout le deck. (CoE §1.3.1) » coûtaient 58 px d'une barre qui partage l'écran avec l'image
qu'elle commente (mesuré : barre 231 → 289 px, image 581 → 523 px). `capNotices` regroupe
désormais les zones **par raison** et la barre imprime une ligne par raison *distincte*, en
pied de barre (mesuré après : 289 → 257 px, image rendue à 555 px). Ce n'est **pas** réduit à
une seule chaîne parce qu'un sous-plafond par zone existe bel et bien (1.6.2, un exemplaire
d'avatar par talon) : deux zones peuvent être bloquées pour des raisons différentes, et
chaque entrée n'est préfixée de ses zones que lorsqu'il y en a plus d'une à distinguer.
Fonction pure exportée et testée (`test/cardPreviewModal.test.js`), même idiome que
`tabPresentation` — ce dépôt ne monte jamais un composant dans un test (§11).

> **Le verrou `deck.mode === 'deckbuilding'` sur les `rows` est délibéré et conservé.** En
> *Impression libre*, la modale n'offre que la pioche : ce mode n'a pas de zones (il imprime,
> il ne construit pas), et lui en proposer inviterait un deck freeform à faire grossir des
> données de zone qui ne veulent rien dire pour lui. C'est ce qui explique l'impression
> « la modale ne propose que la pioche » : elle propose bien toutes les zones légales, mais
> seulement en *Construction de deck*. Retirer `⇄` en mobile a d'ailleurs supprimé
> l'incohérence inverse, où ce bouton offrait pool/talon **même en freeform**.

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

### Fenêtre d'import en deux temps (`ImportDialog.jsx`, 2026-08-03)

Coller-puis-**Analyser** précède les réglages : `target`/`mode`/`side`/`length` ne sont
montés qu'après que `analyze()` a produit un `doc` (`parseDocument`). **C'est ce qui élimine
tout message « ceci contredit cela » nulle part dans l'écran** : un réglage manuel ne peut
pas contredire le texte collé s'il n'existe pas encore au moment où le texte est lu.
`analyze()` amorce les valeurs dans cet ordre de préséance : métadonnées collées
(`## Metadata`, §7) > deck ouvert (`deck.mode`/`deck.ruleset`) > défauts (`freeform` /
`wizard` / `standard`).

Tout changement de camp ou de longueur après l'analyse relance `resolveLines` (le `useMemo`
dépend d'`effectiveSide`), donc la désambiguïsation et les marques de légalité restent
synchronisées avec le réglage courant plutôt que figées sur l'état de l'analyse initiale. Un
choix manuel de carte ambiguë **survit** à ce changement, sauf si la carte choisie n'est plus
parmi les candidats. Les marques de légalité réutilisent `isLegalForSide` avec les mêmes
`openBalrog`/`bannedIds` que `CardBrowser`, sous la même garde `isRuleEnabled('BANNED', …)`,
pour que les deux écrans ne puissent jamais se contredire sur ce qui est légal.

### En-tête et grille du panneau (`DeckPanel.jsx`, 2026-08-03/04)

**En-tête.** Nom du deck (`panel.titleNamed`), pastille de camp (`.side-badge` — même
dérivation et même classe CSS que `DeckManager`, réutilisée plutôt que réinventée, pour
qu'un deck ne porte jamais deux styles de pastille selon l'écran qui l'affiche) et total réel
(`totalCopies`, §5). Les trois pastilles `Total / Pioche / Sites` qui occupaient l'en-tête
sont retirées : la pastille « Total » répétait un total **partiel** (`counts.total`, le
**deck principal** — `quantities`, pioche et lieux réunis (§4) — jamais les quatre zones que
`totalCopies` additionne) sous le mot « Total », juste à côté d'onglets de zone qui, eux,
rapportent chacun leur propre compte — deux nombres différents affichés sous un même mot est
ce qui les a fait retirer. Le badge de la barre repliée (`.deckpanel-badge`) affiche désormais
ce même `totalCopies` : un deck ne montre jamais deux nombres différents selon qu'il est
ouvert ou replié.

**Bouton Enregistrer (2026-08-04).** Dans l'en-tête, après le total, dans les **deux**
variantes du panneau — latéral desktop et feuille mobile (`asSheet`) : le manquer dans l'une
des deux fait simplement disparaître la fonctionnalité sur téléphone. Grisé tant que
`dirty` est faux (§5). Si le deck a déjà un `id`, il écrit directement et affiche
« ✓ Enregistré » pendant 2 s ; **sinon il ouvre « Mes decks »** — créer un enregistrement est
l'endroit où le nom et les réglages exacts se décident, et ce formulaire y existe déjà. Un
échec s'affiche sous l'en-tête (`.deckpanel-save-error`), pas dans une alerte : le bouton qui
a échoué est juste au-dessus.

> **Le panneau ne se monte pas tant que le deck est vide** (`hasSelection` conditionne les
> deux instances dans `App.jsx`). Le bouton n'est donc pas *grisé* pour un deck sans cartes :
> il est **inatteignable**. C'est cohérent — il n'y a rien à enregistrer — mais cela signifie
> que le scénario « deck vide, bouton grisé » ne s'observe pas, et qu'un test manuel qui le
> cherche cherche quelque chose qui n'existe pas.

**Grille (`lib/cardGrid.js`, remplace `lib/zoom.js`).** Le curseur de zoom a disparu ; la
grille du panneau porte la classe `.grid` littérale, la même règle CSS que le navigateur de
cartes (`repeat(auto-fill, minmax(120px, 1fr))`, §3) — une seule règle à tenir plutôt que deux
gardées numériquement synchronisées (décision propriétaire, §12). **Le CSS possède la mise en
page ; rien en JS ne fixe plus de largeur de colonne.** `deckCardWidth()` survit uniquement
pour **prédire** la largeur que le navigateur va calculer, parce que `deckThumbWidth()` doit
encore choisir une vignette proxy et qu'une colonne `1fr` n'a pas de largeur côté JavaScript
avant le rendu.

**Vérifié en direct :** `deckCardWidth(360)` prédit 163 px quand la colonne réelle mesure
155 px — environ 6 px de bordure/scrollbar que la prédiction ne modélise pas. Les deux
quantifient sur la même vignette 200 px (`deckThumbWidth`), donc sans conséquence visible :
c'est le compromis assumé « la prédiction peut dériver, la mise en page jamais », pas un bug.

### Onglets de zone : pastilles élargies, survol de dépôt, zone optionnelle (`ZoneTabs.jsx`, 2026-08-03)

Pastilles élargies (`4px 10px` → `8px 14px`, hauteur mini `34px`) : ce sont des cibles de
dépôt avant d'être des étiquettes, et 24 px de haut est difficile à viser avec une carte en
train d'être glissée. `.ztab.drop-over` donne à la bande le premier retour visuel de survol
de dépôt qu'elle ait jamais eu — état interne à `ZoneTabs` (pas remonté au panneau : rien
d'autre n'a besoin de le savoir), effacé par tout dépôt ou tout `dragleave`, donc jamais
bloqué allumé.

**Onglets optionnels — les deux talons depuis le 2026-08-04.** Tant qu'elle est
vide, la zone se propose en **invitation** : bordure en tirets, texte atténué, préfixée
`+`, sans compteur (`0 / 10` réclamerait un budget que le joueur n'a jamais choisi). Elle
redevient un onglet ordinaire, compteur compris, dès qu'elle contient une carte — piloté par
le prop `optional` (le `Set` que `DeckPanel` lui passe), pas codé en dur dans `ZoneTabs`. En
freeform, la zone n'apparaît d'ailleurs pas du tout tant qu'elle est vide, comme `pool` et
`sideboard` déjà.

`sideboardFw` fut la première ; **`sideboard` l'a rejointe** — l'argument valait mot pour mot
pour lui, un deck peut parfaitement n'avoir aucun talon. Les deux sont dans
`OPTIONAL_TABS` (exporté au niveau module par `DeckPanel.jsx`). La pioche, le deck de sites
et la réserve n'y sont **pas** : les deux premiers sont ce qu'un deck *est*, et la réserve
est dictée par le camp.

**`tabPresentation({ count, cap, optional })` (`ZoneTabs.jsx`) porte toute la règle
d'affichage d'une pastille**, extraite du rendu pour être testable : ce dépôt n'a **ni jsdom
ni `@testing-library`** et ne monte jamais un composant dans un test — la façon d'y couvrir un
composant est de tester la fonction pure d'où il rend (même idiome que
`test/i18n-rules-contract.test.js`, qui importe `warningKey` de `DeckPanel.jsx`).

> **Le test strict `count === 0`, pas `!count`.** `count === null` signifie « cet onglet ne
> porte aucun compteur » — c'est le cas de l'onglet Notes — et ne doit **jamais** se lire
> comme une zone vide : un test de fausseté afficherait « + Notes » sur un onglet qui n'a
> rien à proposer. La distinction est épinglée par un test qui échoue si l'on revient à
> `!count`, et c'est le seul intérêt réel de ce fichier de test.

**Suffixe `(+n)` sur la pastille Réserve (2026-08-05).** La réserve peut contenir jusqu'à deux
objets mineurs/événements de stage en plus de ses personnages (règle 1.7, `zones.js` §6), mais
le plafond `n / max` de la pastille ne compte que les personnages (`poolCharCount`,
`DeckPanel.jsx`) — mélanger les deux ferait dire au joueur qu'il approche un plafond de
personnages alors qu'un objet compte pour autre chose. `poolExtraCount` (complément de
`poolCharCount` : tout ce qui n'est **pas** un personnage) alimente un prop `extras` séparé sur
`ZoneTabs`, rendu en `(+n)` après le `n / max` — jamais mélangé au compte principal, jamais
soumis au plafond `cap`. `extras` est optionnel et undefined partout sauf sur l'onglet `pool` ;
un onglet sans entrée dans `extras` n'affiche aucun suffixe.

**Nom accessible composé (`2942873`).** `aria-label` colle le libellé court au nom long
(`` `${labels[id]} — ${titles[id]}` ``) plutôt que de le remplacer : le nom accessible doit
**contenir** le libellé visible ou la commande vocale cesse de reconnaître ce que
l'utilisateur lit sur la pastille — c'est WCAG 2.5.3 (Label in Name). `title` seul
(l'infobulle) n'atteint ni le tactile ni les lecteurs d'écran, d'où la duplication
délibérée dans `aria-label` plutôt qu'un simple renvoi vers `title`.

### Page d'aide en deux parties (`FeaturesDoc.jsx` + `RulesDoc.jsx`, 2026-08-04)

La page « ? » était une référence de règles titrée « Règles et modes ». Elle est désormais
titrée **« Aide »** et se lit en deux parties :

- **Partie 1 — « Utiliser l'application ».** `FeaturesDoc.jsx`, qui rend **des sections
  seulement**, sans coquille de modale. Les rubriques sont pilotées par une liste
  (`TOPICS = ['search', 'decks', 'import', 'export', 'proxy', 'lang']`) plutôt qu'écrites en
  JSX une par une : une fonctionnalité nouvelle coûte une entrée et deux clés i18n
  (`docs.feat.<sujet>Title` / `docs.feat.<sujet>`), et rien ne peut afficher un titre sans son
  corps.
- **Partie 2 — « Règles ».** Inchangée : tableau des règles avec cases à cocher par deck,
  lacunes connues, camps, longueurs, cartes bannies.

`RulesDoc.jsx` **reste propriétaire de la modale**, de son titre et de son bouton Fermer, et
n'a pas été renommé. La section « Vocabulaire » et sa constante `GLOSSARY` ont disparu — voir
§9 pour ce que cela entraîne côté garde de terminologie, qui est la partie non évidente.

### Lien « Suggérer une amélioration » (`FilterBar.jsx`, 2026-08-04)

Dans la rangée du logo, à droite du `?`. C'est un **`<a target="_blank" rel="noreferrer">`,
pas un `<button>`** : la destination est une URL, donc le lien s'ouvre dans un nouvel onglet,
se copie et s'annonce correctement. Il vise
`${REPORT_ISSUES_URL}?labels=enhancement&title=…&body=…`, chaque valeur passée séparément
dans `encodeURIComponent` — même mécanique que `reportRuleUrl` dans `RulesDoc.jsx`. Le
contenu visible est une seule émoji, donc `title` **et** `aria-label` portent le libellé
traduit : sans eux un lecteur d'écran n'annoncerait qu'une ampoule.

### Sélection multiple dans « Mes decks » (`DeckManager.jsx`, 2026-08-04)

Une case par ligne, une barre « Tout sélectionner » + « Exporter la sélection (n) ».
**Cocher n'est pas saisir :** les lignes restent glissables pour la réorganisation manuelle
pendant qu'une sélection se construit, et réordonner ne vide pas la sélection — elle est
indexée par `id`, pas par position.

`refresh()` purge la sélection des `id` disparus, sinon supprimer un deck coché laisserait un
fantôme dans le compteur du bouton. Le test d'identité (`next.size === prev.size ? prev :
next`) est sûr parce que `next` est **filtré depuis `prev`** : `next ⊆ prev` toujours, donc
une taille égale implique des ensembles égaux. Il évite un rendu inutile à chaque
rafraîchissement.

### Conventions de style

- Les unités **`cqw`/`cqh`** (container queries) servent aux overlays dimensionnés
  relativement à leur conteneur — notamment `ProxyStamp`.
- Classes d'état : `.on`, `.over`, `.selected`, `.illegal`.
- `user-select: none` pendant drag et redimensionnement.
- Tout le CSS est dans un fichier unique, [`styles.css`](../web/src/styles.css) (38 Ko).
  Pas de CSS-in-JS, pas de modules CSS.

---

## §11 — Tests

`npm test` → Vitest, **37 fichiers, 678 tests**. Node pur, pas de DOM : les composants ne
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
- `parseCards.test.js` — aplatissement, facettes, et **le contrat des noms de sets** :
  chaque set offert par la facette porte un nom dans les trois langues. Sans lui, un set
  ajouté sans nom s'afficherait en code nu, dans toutes les langues, sans rien casser.
- `importDeck.test.js`, `deckList.test.js`, `deckSections.test.js` — le cycle
  export texte → import. `importLine.test.js`, `importVocabulary.test.js`,
  `importDocument.test.js`, `importResolve.test.js`, `importDeckSetCode.test.js`,
  `importTarget.test.js` (2026-08-03)
  testent chaque module du pipeline d'import (§4) séparément ; `importDeck.test.js` reste le
  test de la façade et pins la forme pré-refactor. `importTarget.test.js` épingle
  l'invariant « le talon ne contient jamais de site », et `importDeck.test.js` le vérifie
  une seconde fois de bout en bout — l'invariant vaut la double garde.
- `exportSelection.test.js` — le module pur `lib/export/selection.js` (identité des clés de
  slot, mutations tri-state, plage) et le test qui vérifie qu'à sélection égale
  `selectedCardIds` et `selectedQuantitiesZones` décrivent le même multi-ensemble de cartes
  (§7).
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

`formats.js` portait `fwExtra: 10` (« +10 cartes de talon contre un adversaire Sorcier
déchu »). **Rien ne le lisait**, et l'allocation dépend du camp de l'*adversaire*, que
l'app ne modélise pas (il n'y a pas de second joueur dans le périmètre). Retiré plutôt que
recâblé. Si un adversaire est un jour modélisé, il faudra le sourcer et le câbler
proprement, pas restaurer un champ que personne ne consommait.

### 2026-08-03 — La grille du panneau de deck adopte celle du sélecteur

Le panneau de deck calculait la largeur de ses cartes depuis un pourcentage de zoom persisté,
avec un curseur dans l'en-tête (`lib/zoom.js`, retiré). Il porte désormais la classe `.grid`
du sélecteur de cartes **verbatim** — une seule règle CSS pour les deux surfaces au lieu de
deux valeurs à garder synchronisées numériquement, et la densité visuelle se règle en
élargissant ou en rétrécissant le panneau, exactement le levier qu'a toujours eu le
sélecteur. **Le CSS possède la mise en page maintenant ; rien en JS ne fixe plus de largeur
de colonne.** `deckCardWidth()` (`lib/cardGrid.js`) survit seulement pour *prédire* la
largeur que le navigateur calculera, parce que `deckThumbWidth()` doit encore choisir une
vignette proxy avant que le DOM existe. Voir §10.

### 2026-08-03 — 1.6.2 : la sous-limite d'avatar au talon se lit combinée sur les deux talons

Le catalogue plafonne à un exemplaire d'un avatar donné « au talon » (`AVATAR-SIDEBOARD`,
1.6.2). Avec deux talons désormais — l'ordinaire et celui de 1.6.1 contre un Sorcier déchu —
la lettre du texte ne tranche pas si le plafond porte sur chaque talon séparément ou sur les
deux réunis. **Lecture retenue, propriétaire, 2026-08-03 : un exemplaire au total entre les
deux talons**, pas un par talon — une carte unique qu'une règle d'unicité interdit en double
ne devrait pas redevenir doublable simplement parce qu'elle se répartit sur deux zones. C'est
une **interprétation**, pas la lettre de la source. `copies.js` le documente comme tel dans
son en-tête, et le passage de `scope: { zone: 'sideboard' }` à
`scope: { zones: ['sideboard', 'sideboardFw'] }` (dans `copyCaps`/`remainingCopies` **et**
`validate.js`, §6) est ce qui porte cette lecture dans le code.

---

## §13 — État des fonctionnalités

| Fonctionnalité | État |
|---|---|
| Grille + facettes, recherche insensible aux accents | **Livré** |
| Quantités (`−`/`+`, clic image = bascule), « Tout sélectionner (N) » | **Livré** |
| Modes de deck (freeform / deckbuilding) + migration transparente | **Livré** |
| Zones : play deck, location deck, réserve, pool de départ | **Livré** |
| Talon contre Sorcier déchu (règle 1.6.1) : quatrième zone, dix cartes préselectionnées en plus du talon ordinaire | **Livré** — 2026-08-03 |
| Moteur de règles — 31 règles, toutes `verified` | **Livré** |
| Ignorer une règle par deck / signaler une règle (ticket GitHub pré-rempli) | **Livré** |
| Filtre de légalité dans le navigateur de cartes | **Livré** |
| Page d'aide en deux parties — « Utiliser l'application » puis « Règles », ces dernières générées depuis les mêmes données que le validateur | **Livré** — 2026-08-04 (ex-« Règles et modes ») |
| Bouton Enregistrer dans l'en-tête du panneau de deck, grisé quand rien n'a changé | **Livré** — 2026-08-04 |
| Export massif : plusieurs decks cochés dans « Mes decks » → une archive de deck lists texte | **Livré** — 2026-08-04 |
| Lien « Suggérer une amélioration » (ticket GitHub pré-rempli) | **Livré** — 2026-08-04 |
| Notes de deck (4 champs) + reprises dans l'export texte | **Livré** |
| Sauvegarde `localStorage`, duplication, réordonnancement par glisser-déposer | **Livré** |
| Import de liste : sections en tout ordre (markdown ou texte brut, FR/EN/ES), quantité aux quatre positions, désambiguïsation, restauration des zones, zone de destination arbitrée par les règles | **Livré** |
| Export ZIP MPC (822×1122 @300 DPI, bleed, manifeste) | **Livré** |
| Export planches PDF (letter / a4 / a3 paysage, dos en miroir) | **Livré** |
| Export deck list texte, ré-importable, 5 langues | **Livré** |
| Export partiel : case dans `ExportDialog` ouvrant une grille de sélection par exemplaire, sur les trois formats (ZIP, PDF, texte) | **Livré** — 2026-08-05 |
| Dos par défaut + dos personnalisé par groupe | **Livré** |
| Mode Proxy (écran + exports), 16 cadres × 2 variantes | **Livré** |
| i18n complète FR / EN / ES (chrome, noms, images) | **Livré** |
| UI mobile (feuille de deck, modale de carte, barre d'icônes) | **Livré** |
| Passe accessibilité / polish | **Livré** — branche `polish-ui-a11y` fusionnée en `84304fe` |
| Curseur de zoom du panneau de deck | **Retiré** — 2026-08-03, remplacé par la largeur du panneau elle-même, alignée sur la grille du sélecteur (§10, §12) |
| Pastilles `Total / Pioche / Sites` en en-tête du panneau | **Retiré** — 2026-08-03, remplacées par le nom du deck, sa pastille de camp et le total réel (§10) |
| Section « Vocabulaire » de la page d'aide | **Retiré** — 2026-08-04, sur demande du propriétaire (elle se lisait comme une note de développeur). Le garde de terminologie FR, lui, reste et perd sa dernière exemption (§9) |

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

7. **`meccg.cardZoom` reste orpheline dans `localStorage`.** Le curseur de zoom du panneau a
   disparu (§10, §12) mais la clé n'a jamais été purgée : elle survit chez les joueurs qui
   l'avaient déjà écrite, sans plus rien qui la lise. Inoffensive — vérifiée toujours présente
   dans le navigateur après le changement — mais sans migration, comme les autres clés de ce
   tableau (§4).

8. **Le compteur de la liste des decks ne compte pas comme l'en-tête du panneau ouvert.**
   `deckStore.list()` (consommé par `DeckManager`) ne totalise que `quantities` — pioche
   **et** lieux (§4), pas la pioche seule ; l'en-tête du panneau affiche `totalCopies()`, les
   quatre zones réunies (§5, §10), donc l'écart entre les deux est précisément le talon, la
   réserve et le talon FW. **Vérifié en direct :** un même deck affichait « 2 cartes » dans la
   liste et « (9) » une fois ouvert. Hors périmètre de ce lot ; consigné pour ne pas être
   redécouvert de zéro à la prochaine session.

9. ~~**Le point de rupture `@container (min-width: 80px)` sur `.deck-mini-move-btn` est
   peut-être devenu du code mort.**~~ **Réglée le 2026-08-05**, et sans avoir eu à trancher la
   question : le bouton `⇄` n'existe plus en mobile (la modale le remplace, §10), donc la règle
   `@container` qui lui donnait sa cible tactile de 44 px a été supprimée avec lui. Le bouton
   compact desktop, seul survivant, n'a jamais dépendu de ce seuil.

11. **`DeckManager.duplicate()` construit encore son payload à la main**, et omet `order`
    volontairement (une copie ne doit pas revendiquer la position de l'original). `deckPayload`
    (§4) est donc à un chemin près d'être la source unique : un champ persisté ajouté demain
    atteindrait les deux chemins de sauvegarde et **pas** la duplication. Repéré en revue, hors
    du périmètre de la tâche qui l'a créé.

12. **Confirmations « ✓ Enregistré » qui se chevauchent.** Deux sauvegardes rapprochées : le
    minuteur de la première éteint la confirmation de la seconde au bout de son propre délai,
    qui affiche donc ~500 ms au lieu de 2 s. Cosmétique — le minuteur est un `setState`
    fonctionnel, il ne peut pas laisser le bouton bloqué.

13. **Panneau replié : pas de bouton Enregistrer, et l'erreur de sauvegarde disparaît.** La
    variante repliée du panneau desktop retourne avant l'en-tête (§10). L'état est conservé,
    donc le message revient en dépliant — mais un échec de sauvegarde suivi d'un repli donne
    l'impression que l'erreur s'est effacée d'elle-même.

14. **`.deckpanel-head` est en `flex-wrap: wrap`** et le libellé du bouton s'élargit de
    « Enregistrer » à « ✓ Enregistré » : dans un panneau étroit ou la feuille mobile,
    l'en-tête peut passer sur deux lignes pendant les 2 s de la confirmation. Non mesuré.

15. **Le test d'`OPTIONAL_TABS` s'affirme contre lui-même.** Il vérifie que la constante
    contient les deux talons, mais rien ne vérifie qu'elle est bien celle passée en prop
    `optional` à `ZoneTabs` — sans environnement de test DOM (dette n°2), il n'y a pas de
    façon évidente de le fermer.

16. **`web/public/meccg-logo.png` est orphelin.** Non référencé par `index.html` ni par
    aucun composant — `web/public/favicon.png` (favicon d'onglet, ajouté le 2026-08-04) est
    un fichier distinct, pas un remplacement. À utiliser quelque part (en-tête ?) ou à
    supprimer.

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
| 2026-08-02 | §3 : `parseCards` rend `setNames` (les noms de sets sont dans les données, en fr/en/es). §9 : nouveau tableau des deux sources de libellés de facettes ; le filtre Set affiche « Contre l'Ombre (AS) », les filtres continuent de stocker les codes. §11 : contrat « chaque set a un nom dans les trois langues ». 504 tests. |
| 2026-08-03 | Trois fonctionnalités, onze commits (`523beb7..40e1c84`). §9 : filtre Type trié sur l'ordre de jeu (`TYPE_ORDER`/`sortFacetOptions`), plutôt que sur le libellé — exception à la règle générale du paragraphe Sets, corrigée en conséquence ; nouvelles clés `import.*` ; piège « réserve » pour le vocabulaire du parseur. §6 : `isLegalForSide` gagne la passe `specific` au niveau camp (46 cartes BA `specific: "Balrog"` quittent un navigateur Spectre de l'Anneau) et absorbe l'ancien cas spécial balrog-only. §7 : bloc `## Metadata` toujours émis à l'export texte, `tournament` volontairement absent. §4 : nouvelle sous-section décrivant le pipeline d'import en cinq modules (`normalize → line → vocabulary → document → resolve`, façade `importDeck.js` réduite à 137 lignes) et ses deux invariants. §10 : fenêtre d'import en deux temps (analyser avant de régler), pourquoi ça élimine tout conflit affiché. §13 : ligne import réécrite, passe accessibilité `polish-ui-a11y` marquée Livrée (déjà fusionnée en `84304fe`, la ligne était restée « En cours »). §2/§11 : compte de tests à jour (32 fichiers, 584 tests) et nouveaux fichiers de test du pipeline d'import listés — stale depuis le 2026-08-02, corrigé en marge de cette tâche. |
| 2026-08-03 | Deux bugs signalés par le propriétaire, corrigés. §6 : `isDropAllowed` pose désormais **deux** questions au lieu d'une — la zone (`zoneTargets`) *et* l'onglet qui affichera la carte (`backGroupForType`) ; `play` et `location` étant deux vues d'une seule zone, un personnage glissé de la réserve vers l'onglet **Sites** comptait comme un dépôt légal et atterrissait dans la **pioche**. §4/§9 : « Sites » et « Regions » deviennent des titres de **zone** portant leur indice de type, au lieu de simples indices de groupe qui ne fermaient pas la section précédente — c'est ce qui envoyait dans le talon tous les sites d'une liste écrite à la main. §4 : nouveau module `import/target.js` (`targetForCard`/`bucketFor`), sixième étage du pipeline, qui fait arbitrer la zone de destination par `zoneTargets` pour les **deux** appelants (`importDeckList` et la prévisualisation d'`ImportDialog`) : un import ne peut plus construire un deck que l'interface refuserait de construire à la main. §11 : `test/importTarget.test.js`, 33 fichiers / 594 tests. |
| 2026-08-04 | Deux lots indépendants, dix commits (`103737f..bc07b80`). **Talon contre Sorcier déchu (règle 1.6.1) :** quatrième zone `sideboardFw` garantie par `normalizeDeck`, comptée par `totalCopies` (§4) ; offerte partout où le talon ordinaire l'est, toujours en dernier dans `extra`, jamais aux sites — `dropTargets.js` non touché, ce qui prouve que sa garantie tient par construction (§6) ; plafond `SIDEBOARD_FW_MAX = 10` en constante à plat, hors de `LENGTHS`, plus la règle `SIDEBOARD-FW-MAX` (31 règles au total) ; la sous-limite d'avatar 1.6.2 relue **combinée** sur les deux talons, une interprétation datée (§12), qui a fait passer le `scope` d'un plafond de `{ zone }` à `{ zones }` dans `copies.js` **et** `validate.js` (§6) ; export en cinq sections (`Sideboard vs FW` en queue, §7) et alias d'import associés (§4) ; onglet dédié, invitation en tirets tant qu'il est vide, `aria-label` composé pour WCAG 2.5.3 (§9, §10). **Panneau de deck refondu :** en-tête devenu nom + pastille de camp + total réel au lieu de trois pastilles répétant un total partiel ; curseur de zoom retiré, la grille du panneau reprenant la règle `.grid` du sélecteur de cartes — le CSS possède désormais la mise en page, `deckCardWidth()` ne fait plus que la prédire pour choisir une vignette (§10, §12). §14 : trois dettes consignées (`meccg.cardZoom` orpheline, `deckStore.list()` vs en-tête du panneau — deux nombres vérifiés pour un même deck —, point de rupture CSS peut-être mort). Quatre commentaires de `styles.css`/`MiniCard.jsx` décrivant encore le curseur de zoom disparu, réécrits. |
| 2026-08-04 | Revue finale de branche avant merge, cinq trouvailles Critical (une seule cause) + quatre Important + cinq Minor. **§4 : `emptyZones()`** — huit endroits construisaient un `zones` en mémoire sans passer par `normalizeDeck`, quatre sur un chemin de production réel, tous ne nommant que `sideboard`/`pool` ; `bucketFor(card, 'sideboardFw', …)` y rendait `undefined`, et l'écriture suivante plantait — pendant un rendu React côté fenêtre d'import (`ImportDialog.jsx`, dans un `useMemo`, sans error boundary dans `web/src`) et dans `changeZoneQty`/`bumpCount` (`App.jsx`) au premier glisser-déposer sur un deck neuf. `normalizeDeck` construit désormais son `zones` à partir des clés d'`emptyZones()` au lieu de les re-lister. `App.importDeckData` reconstruit tout l'objet `zones` importé via `normalizeDeck({ zones: importedZones }).zones` plutôt que de lister `sideboard`/`pool` à la main — c'est ce qui avait fait disparaître silencieusement, sans avertissement, les cartes qu'un import routait vers `sideboardFw`. `ImportDialog.jsx` : `importCount` (bouton d'envoi) utilise désormais `totalCopies`, pas un trio de maps codé en dur — une importation résolue entièrement dans `sideboardFw` affichait `0` et bloquait le bouton. **§9/§10 : `ZoneTabs.jsx`** — l'`aria-label` composé de l'onglet `sideboardFw` (WCAG 2.5.3, ajouté le 2026-08-03) remplaçait tout le nom accessible, y compris le compteur porté par le texte des autres onglets ; le compteur est maintenant réinjecté dans le label composé. **§6 : `formats.js`** — la note au-dessus de `LENGTHS` qui disait l'allocation « +10 » délibérément non modélisée est réécrite : elle l'est, comme zone dédiée, et la note explique maintenant pourquoi une constante à plat plutôt qu'une cinquième colonne. **Documentation :** cette table de `localStorage` et la liste des états d'`App.jsx` (ci-dessus) créditaient encore `meccg.cardZoom` d'être vivante ; le spec `2026-08-03-deck-panel-fw-sideboard-design.md` (§3, §5) affirmait que la compatibilité ascendante ne dépendait que de `normalizeDeck` et que `target.js` n'avait pas été touché — les deux corrigés pour que la prochaine zone ajoutée ne reproduise pas cette lacune. `README.md` : conjonction manquante restaurant le rattachement de « pour les camps qui en utilisent un » à la réserve, pas au talon. **Tests :** `test/deckModel.test.js` gagne un test qui dérive l'ensemble des zones attendues de `zoneTargets()` plutôt que de le re-lister, et `test/importDeck.test.js` gagne le round-trip export → import de `sideboardFw` plus un test direct « n'explose pas » — les deux échouaient contre le code d'avant cette entrée, preuve que C1-C4 étaient réels. §11 : 33 fichiers, 619 tests (33 fichiers / 594 tests, cité en deux endroits de ce document depuis le 2026-08-03, était déjà périmé par rapport aux 616 tests d'avant cette tâche — corrigé en marge). |
| 2026-08-04 | Six améliorations de confort demandées par le propriétaire, branche `qol-minor-features` (`8cf904e..2e4ab4a`). **§4 :** `deckPayload` comme définition unique d'un enregistrement, et `deckSignature` — clés triées **à tous les niveaux** (l'ordre d'insertion ferait lire comme modifié un deck qu'on n'a pas touché), `id`/`order`/`updatedAt` exclus pour qu'une sauvegarde réussie n'allume pas le bouton qu'elle vient d'éteindre. **§5 :** `savedSignature` et `saveState` ; la **liste fermée des quatre moments** où la ligne de base est réécrite, et le fait qu'un import n'en est délibérément pas un — un cinquième site désarme silencieusement le bouton. Plus le piège trouvé en revue : renommer le deck ouvert depuis « Mes decks » écrivait sur le disque sans rien déplacer dans `App`, laissant le bouton **grisé sur un désaccord disque/mémoire**, et la sauvegarde suivante écrasait le renommage ; le correctif (`onRenamed`) reconstruit la ligne de base **depuis l'enregistrement rendu par le stockage, jamais depuis l'état vivant** — repartir du vivant aurait certifié des modifications de cartes non sauvegardées, un bug pire que celui corrigé. **§7 :** `deckListZip.js` — `zip.file()` écrase silencieusement un chemin dupliqué, d'où la déduplication, faite **après** l'assainissement parce que c'est l'assainissement qui crée les collisions ; parité caractère pour caractère avec l'export d'un deck seul, brièvement cassée par un défaut du plan puis annulée, désormais épinglée par `safeFileName('Deck (1)') === 'Deck_1_'` ; un deck disparu en cours de lot est sauté, `api.getDeck` levant au lieu de rendre `undefined`. **§9 :** « Ruines & Antres » ; la section « Vocabulaire » quitte la page d'aide et **le garde de terminologie perd sa dernière exemption** — `GLOSSARY_KEYS` supprimé et non vidé, toute chaîne FR y est soumise, et le tableau des trois « vocabulaires » du dépôt dit lequel n'a pas bougé (`lib/import/vocabulary.js`). **§10 :** bouton Enregistrer dans les deux variantes du panneau, et la note que le panneau ne se monte pas sur un deck vide — le bouton n'y est pas grisé, il est inatteignable ; `OPTIONAL_TABS` (les deux talons) et `tabPresentation`, dont le `count === 0` strict distingue une zone vide d'un onglet sans compteur ; page d'aide en deux parties (`FeaturesDoc.jsx`) ; lien de suggestion ; sélection multiple de `DeckManager` et pourquoi son test d'identité sur la taille est sûr. **§13/§14 :** quatre lignes livrées, une retirée, cinq dettes consignées (n°11-15). **§11 :** 35 fichiers, 637 tests. |
| 2026-08-04 | Favicon d'onglet ajouté (même branche `qol-minor-features`), fourni par le propriétaire (pas d'entrée §12 dédiée — pas de décision technique, juste un fichier statique et un `<link>`). `web/public/favicon.png` + `<link rel="icon" type="image/png" href="/favicon.png">` dans `web/index.html`, qui n'avait jusqu'ici aucune balise favicon. `web/public/meccg-logo.png` reste orphelin, toujours référencé nulle part (§14). |
| 2026-08-04 | Masque en/es inconditionnel du copyright, branche `proxy-setname-mask`, tâche 2/4 (`c0b7f67..HEAD`, la tâche 1 avait ajouté `proxyStampFor`). §8 : le « Pourquoi » distingue désormais en/es (masque toujours peint, l'interrupteur ne choisit que le texte : « Proxy » ou le nom du set traduit) de fr (comportement inchangé, rien tant que le mode Proxy est éteint, puisque les images FR portent déjà le nom du set à cet endroit). Nouvelle sous-section « Point de décision unique » : `proxyStampFor` est le seul endroit qui décide quoi peindre ; `ProxyStamp.jsx` et l'aperçu au survol (`CardPreview.jsx`) l'appellent déjà, le canvas d'export (`proxyDraw.js`) pas encore — migration prévue à la tâche 3, l'export affiche pour l'instant toujours « Proxy » sans condition. `white-space: nowrap` ajouté sur `.proxy-stamp span` (des libellés comme « Servidores de la Oscuridad » sont bien plus longs que « Proxy », et le chemin canvas ne peut jamais retourner à la ligne). `setNames` enfilé de `App.jsx` jusqu'aux quatre points d'affichage (`CardBrowser`, les deux `DeckPanel`, `CardPreviewModal`) et jusqu'à `useCardPreview`/`MiniCard`, sans changer `on` (toujours le flag proxy). Vérifié dans un navigateur réel (pas seulement en test) : en/es hors mode Proxy affichent le nom du set sur les quatre chemins de rendu (grille, survol, modale, panneau de deck) ; fr hors mode Proxy n'affiche rien ; les Régions n'affichent jamais rien, même en mode Proxy. §11 : 35 fichiers, 644 tests (7 de plus qu'à la tâche 1, ajoutés par `proxy.test.js`). |
| 2026-08-04 | Pipeline d'export (ZIP/PDF) aligné sur `proxyStampFor`, branche `proxy-setname-mask`, tâche 3/4. §8 : troisième et dernier chemin migré — `drawProxyOnFace(ctx, w, h, patchBmp, text, color)` reçoit désormais `text`/`color` de l'appelant au lieu de recalculer `PROXY_LABEL_COLOR[key]` et d'afficher « Proxy » en dur ; `bleedCanvas.js` propage `stamp.text`/`stamp.color` sans les interpréter. `api.js` : `_setNames` mis en cache à côté de `_index` (les libellés du tampon en ont besoin), `makeStampFor` appelle `proxyStampFor(card, lang, proxyMode, _setNames)` par carte plutôt que `swatchKeyForCard` + libellé fixe, et son court-circuit devient **par langue** (`lang === 'fr' && !proxyMode`) au lieu de global (`!proxyMode`) — nouveau paragraphe consacré à ce piège, un futur appelant qui ne testerait que `proxyMode` referait fuiter le copyright en/es. `exportDeck`/`exportPdf` inchangés (même signature d'appel à `makeStampFor`). §11 : `npm test` — 35 fichiers, 644 tests, 0 échec (aucun test n'exerçait directement `drawProxyOnFace`/`makeStampFor`, donc le compte ne bouge pas ; couverture par lecture de code + vérification navigateur, voir ci-dessous). Vérifié dans l'app réelle : export ZIP et PDF, mode Proxy éteint, langue EN — le copyright a disparu du PNG/JPEG exporté, remplacé par le nom du set ; même vérification en FR, images inchangées (pas de tampon). §14 : aucune dette nouvelle. |
| 2026-08-04 | Couleurs de `PROXY_LABEL_COLOR` régénérées à partir des cartes FR réelles, branche `proxy-setname-mask`, tâche 4/4 (dernière). §8 : `scripts/make_proxy_patches.py` — `label_colour` ne choisit plus entre deux aplats noir/blanc synthétiques ; `fr_tint(key)` isole l'encre du nom de set en différenciant jusqu'à 12 cartes FR par clé contre leur propre patch `-fr` (le cadre vide reconstruit), garde la moitié des pixels différents la plus éloignée du ton du cadre (le cœur du glyphe, pas son anti-crénelage), puis moyenne. Piège qui a fait écarter un seuil luminance-vs-fond local plus simple : les 4 cadres Site ont un coin bas-gauche déchiré dont le bord sombre l'emportait sur les glyphes (lu quasi noir pour `minion-site`, dont « Contre l'Ombre » est pourtant blanc) — la différenciation contre le patch est insensible à la polarité, ce qui compte aussi parce que l'encre est claire sur les cadres sombres et sombre sur les clairs. `label_colour(key)` garde ensuite cette teinte telle quelle si elle passe un plancher de contraste (`MIN_CONTRAST = 80`) face aux **deux** variantes du patch (en/es et fr), sinon la pousse en luminosité HLS (teinte/saturation inchangées) par bissection jusqu'au plancher — nécessaire parce que « Proxy » reste une information fonctionnelle à la lecture d'une planche d'impression, contrairement au nom de set que le masque cache de toute façon. **7 des 16 clés sont poussées** (`hero-character`, `fw-site`, `alatar`, `gandalf`, `pallando`, `radagast`, `saruman` — teinte FR mesurée illisible une fois isolée, jusqu'à un contraste de 2 pour `radagast`) ; les 9 autres gardent leur teinte FR exacte. `scripts/proxy-patch-colors.txt` gagne deux colonnes (teinte FR non poussée, `sampled`/`floored`) ; `_qa()` peint désormais les deux légendes possibles (« Proxy » et un nom de set) pour chaque clé × langue, doublant la planche à 64 panneaux. Les 32 patchs PNG sont régénérés à l'identique (aucun octet ne change) — seule la table de couleurs bouge. Planche `proxy-patch-qa.png` relue : les 16 clés sont lisibles dans les deux langues et les deux légendes, aucune couture visible ; `hero-site`, `fw-site` et `saruman` ont un contraste plus doux que les 13 autres clés (fond texturé/clair) mais restent lisibles au-dessus du plancher. §11 : `test/proxy.test.js` réécrit (le test vérifiait auparavant que chaque clé valait l'un des deux aplats fixes ; il vérifie maintenant 16 teintes distinctes, aucune retombée sur les deux anciens aplats) — 35 fichiers, 644 tests, 0 échec. |
| 2026-08-04 | Revue finale de branche `proxy-setname-mask` avant merge, un tour de correctifs (`b3280a4..28bb2c6`). §7 : les deux puces sur le rééchantillonnage PDF affirmaient encore un invariant faux (« Proxy éteint = octets bruts, la seule différence entre les deux chemins ») — le chemin dépend en réalité de `stampFor(card)`, pas de `proxyMode` directement, donc en/es sont **toujours** rééchantillonnés en JPEG même mode Proxy éteint (perte de fidélité réelle et jusque-là non documentée, sauf pour les Régions — jamais tamponnées, seul cas restant sur octets bruts en en/es). Commentaire équivalent dans `api.js` corrigé. `web/src/lib/i18n.js` : six chaînes (`proxy.tooltip` + `docs.feat.proxy`, ×3 langues) décrivaient encore l'ancien comportement (« recouvre le copyright par Proxy ») alors que pour en/es le copyright est maintenant toujours couvert et la case ne choisit que la légende — réécrites, gardent la garde de terminologie FR. §8 : la formule absolue « ne doit jamais atteindre un envoi d'impression » gagne l'exception Régions. `scripts/make_proxy_patches.py` : `fr_tint` ouvrait le patch `-fr` en RGB, perdant son canal alpha — sur les cadres Site déchirés, ça laissait le résidu du template (pas de l'encre) participer à l'échantillonnage, exactement le piège que la différenciation est censée éviter ; corrigé avec le même garde `a > 200` que `patch_label_lum`. Assertion de plancher ajoutée en fin de `label_colour` (l'invariant n'était vérifié qu'à l'œil sur la planche QA). `docs/superpowers/specs/2026-08-04-proxy-setname-mask-design.md` : comptage des clés poussées corrigé (10/6 → 9/7, cohérent avec `proxy-patch-colors.txt`), et la fausse mention d'un test JS pour le plancher redirigée vers cette nouvelle assertion. `proxyDraw.js` : fallback défensif `color \|\| '#F0F0EA'` restauré. En-tête de ce document réécrit (résumait encore la branche `qol-minor-features`). §11 : 35 fichiers, 644 tests, 0 échec. |
| 2026-08-05 | `PROXY_LABEL_FONT_FRAC` recalibré (`0.0155` → `0.021`) sur signalement du propriétaire : le rendu en/es hors mode Proxy paraissait nettement plus petit que le vrai nom de set imprimé sur les cartes FR. Diagnostic : le calibrage de juillet dérivait la taille de police de la hauteur de capitale (juste les majuscules) de « Remastérisé… », mais l'œil compare l'étendue pleine du glyphe (accents, apostrophe), plus grande — vérifié en mesurant les lignes de pixels actives de « Contre l'Ombre » et « Remastérisé… » sur `cards/fr/as/Burat.jpg` (9-11 px de haut à 570 px de large, contre 6.2 px de hauteur de capitale utilisés jusque-là), puis confirmé à l'écran (`getBoundingClientRect`/`getComputedStyle` sur `.proxy-stamp span` : la taille de police calculée correspondait exactement à `PROXY_LABEL_FONT_FRAC × largeur affichée` — la formule était juste, la constante trop petite). Le nom traduit le plus long garde 24 px de marge dans `PROXY_PATCH_RECT` à la nouvelle taille (vérifié comme pour la taille d'origine). Ce recalibrage a exposé un bug latent dans le bisecteur de `label_colour` : `fw-site` échouait la nouvelle assertion de plancher, l'arrondi RVB 8 bits repoussant la luminance finale ~0.8 sous le plancher — corrigé par `BISECT_MARGIN = 2`, une marge de sécurité sur la cible de recherche du bisecteur (pas sur l'assertion elle-même, qui reste stricte). Couleurs régénérées (la taille de police change l'empreinte que `patch_label_lum` échantillonne) ; les 32 patchs PNG restent identiques. §11 : 35 fichiers, 644 tests, 0 échec. |
| 2026-08-05 | Export d'un sous-ensemble du deck. Nouvelle case « Export partiel » dans `ExportDialog`, qui ouvre une grille de choix des cartes, par exemplaire. L'export complet reste le défaut et son chemin est inchangé. La découverte qui a façonné le design : ZIP/PDF et liste texte ne consomment pas la même donnée, donc la sélection est projetée dans deux formes plutôt qu'une (§7). §11 : 36 fichiers, 661 tests, 0 échec. |
| 2026-08-05 | Trois améliorations de confort demandées par le propriétaire. **§4 :** lignes de pure décoration (`----`, `#####`, `====`…) désormais ignorées plutôt que collectées en notes — `DECORATION_ONLY` dans `resolve.js`, testée sur `line.raw` avant que la ligne ne rejoigne `prose`, en amont d'`isMarked` (une ligne qui commence par de la décoration mais contient du texte reste de la prose normale). Nouveaux alias d'en-tête pour la réserve : `Starting`/`Starting company`/`Starting deck` (+ FR/ES), distincts de `NOTE_TITLES.starting` (« Starting notes », un champ de note, pas une zone). **§10 :** la pastille Réserve du panneau de deck gagne un suffixe `(+n)` pour les objets mineurs/événements de stage qu'elle contient, en plus du `n / max` qui ne compte que les personnages (règle 1.7) — `poolExtraCount` (`DeckPanel.jsx`, complément de `poolCharCount`) alimente un nouveau prop `extras` sur `ZoneTabs`, optionnel et vide partout sauf sur l'onglet `pool`, jamais mélangé au compte principal ni au plafond. Vérifié dans l'app réelle (import d'une liste avec séparateurs de forum et en-tête « Starting » contenant un personnage + un objet mineur légal pour la réserve : « Réserve 1 / 10 (+1) »). §11 : `test/importResolve.test.js` (lignes de décoration), `test/importVocabulary.test.js` (alias `Starting`), `test/zoneTabs.test.js` (`poolExtraCount`) — 36 fichiers, 672 tests, 0 échec. |
| 2026-08-05 | Bug signalé par le propriétaire juste après la tâche précédente : la clé « Other characters » ne refermait pas la section réserve/starting, laissant ses personnages fuiter dans la réserve. **§4 :** nouvelle entrée `zone('quantities', 'Character')` pour `Other characters`/`Additional characters`/`Non-starting characters` (+ FR/ES) dans `vocabulary.js`, au même titre que Sites/Regions — pas un `group('Character')` comme la ligne `Characters` juste en dessous, parce qu'un groupe ne change pas la zone et qu'un titre inconnu la laisse intacte aussi (`document.js`), les deux lisant silencieusement la section suivante comme une continuation du starting company plutôt que sa clôture. Vérifié dans l'app réelle : `## Starting` (Bûrat) puis `## Other characters` (Angmarim) importés en freeform donnent « Réserve 1 » + « Cartes 1 », pas « Réserve 2 ». §11 : nouveaux tests dans `test/importVocabulary.test.js` (la table) et `test/importResolve.test.js` (le pipeline complet, second personnage en `target: 'quantities'`) — 36 fichiers, 674 tests, 0 échec. |
| 2026-08-05 | Régression mobile signalée par le propriétaire : la ligne du logo (logo, Proxy, langue, `?`, `💡`) ne tenait plus sur une seule ligne à 375 px. §10 : dans le bloc `@media (max-width: 768px)` de `styles.css`, `gap` de `.filterbar-top` ramené de 8px à 4px, marge droite du logo de 4px à 2px, et la marge droite de 10px + le `margin-left: auto` du bouton Proxy (utiles seulement sur desktop, où le bouton partage sa ligne avec les boîtes de recherche) mis à 0 en mobile, plus son padding horizontal resserré à 6px (contre 10px hérité de `.chip-toggle`). Purement des joints de mise en page desktop devenus inutiles en mobile depuis que les boîtes de recherche passent sur leur propre ligne (`order: 1`, déjà en place) — aucune règle desktop touchée. Vérifié dans le navigateur réel aux deux largeurs (mesure `getBoundingClientRect`) : à 375 px les cinq éléments tiennent sur une ligne (288 px occupés sur 355 disponibles) ; à 1280 px le bouton Proxy reste poussé à droite comme avant. §11 : aucun test (mise en page pure, aucun module JS testable) — 36 fichiers, 674 tests, 0 échec (inchangé). |
| 2026-08-05 | Suite immédiate de la tâche précédente, deux demandes du propriétaire une fois la ligne du logo réglée. **§9 :** nouvelles clés `filter.searchShort`/`filter.searchTextShort` (FR « Titre »/« Texte », EN « Title »/« Text », ES « Título »/« Texto ») — un mot au lieu de la phrase desktop (`filter.search`/`filter.searchText`), choisies par `FilterBar` selon `isMobile`, seulement pour le `placeholder` des deux boîtes ; le desktop garde le texte complet. **§10 :** le bouton « Filtres » perd son texte visible en mobile pour une icône `▽` + la flèche de pli déjà là (`aria-expanded` ajouté sur le bouton ; « Filtres » reste son nom accessible via un `<span className="sr-only">`, jamais affiché — même idiome que `.drawer .lbl`, généralisé au `.sr-only` déjà global plutôt que dupliqué). Les deux boîtes de recherche partagent maintenant leur ligne avec ce bouton compact. **Piège flexbox rencontré et documenté (§10) :** donner directement `flex: 1 0 100%` à `search-group` (comme avant cette tâche) empêche structurellement `filters-toggle` de jamais rejoindre sa ligne — l'algorithme de retour à la ligne assigne les éléments par leur taille hypothétique (`flex-basis`) AVANT que `flex-grow`/`flex-shrink` ne s'exécutent, donc un enfant forcé à 100% se retrouve seul sur sa ligne dès cette étape et rien ne peut plus y faire entrer un voisin ensuite ; `flex-basis: 0` sur `search-group` a d'abord semblé résoudre ça mais a fusionné les DEUX lignes en une seule bien trop chargée pour la même raison inversée (taille hypothétique trop petite pour forcer un nouveau retour à la ligne). Résolu par un intercalaire `.search-row` : `display: contents` sur desktop (transparent — `search-group`, son seul enfant là, se comporte exactement comme avant), un vrai conteneur flex forcé à 100% en mobile (reproduisant fidèlement l'ancienne règle de `search-group`), à l'intérieur duquel `search-group` et `filters-toggle` ne négocient la largeur qu'entre eux, sur une ligne dont l'existence est déjà tranchée. Vérifié dans le navigateur réel : à 375 px, ligne 1 = logo/Proxy/langue/`?`/`💡` (jusqu'à 288 px), ligne 2 = boîtes (148 px chacune) + bouton Filtres (48 px, jusqu'à 365 px) ; à 1280 px, layout et placeholders desktop identiques à avant, bouton Filtres absent du DOM (toujours `isMobile`-gated). §11 : aucun nouveau test (mise en page pure) mais le test de parité des clés i18n couvre les deux nouvelles — 36 fichiers, 674 tests, 0 échec (inchangé). |
| 2026-08-05 | Trois demandes du propriétaire sur l'ergonomie tactile des zones. **§10, nouvelle sous-section « Une seule modale pour les zones en mobile ».** (1) *Constat, pas correctif :* la modale du navigateur de cartes proposait **déjà** toutes les zones légales (`rows` ← `zoneTargets`, une seule instance de `CardPreviewModal` dans `App` partagée par les deux écrans) — l'impression contraire vient du verrou `deck.mode === 'deckbuilding'`, et le deck par défaut est en *Impression libre*. Vérifié dans le navigateur : freeform → « Pioche » seule ; construction de deck → « Pioche / Talon / Talon vs SD ». Verrou **conservé délibérément** (le mode freeform n'a pas de zones), la note du §10 explique pourquoi et signale que retirer `⇄` supprime l'incohérence inverse, où ce bouton offrait pool/talon même en freeform. (2) **Bouton `⇄` supprimé en mobile** (`!isMobile` dans `MiniCard`) : il offrait exactement les mêmes destinations que la modale, mais via un calque de boutons écrasés dans une vignette de ~105 px ; la modale les atteint avec des cibles de 44 px et la place d'expliquer un `+` bloqué (déplacement = `−1` ici, `+1` là). Desktop inchangé — le glisser-déposer y reste la route principale et `⇄` son repli. Les règles CSS mobiles du bouton meurent avec lui, **dette §14 n°9 réglée sans avoir eu à trancher sa question** (le `@container (min-width: 80px)` existait pour éviter un chevauchement avec la pile `qty`, collision que la modale n'a pas). (3) **Avertissements de plafond dédupliqués** — `capNotices` (fonction pure exportée de `CardPreviewModal.jsx`) regroupe les zones **par raison** et la barre imprime une ligne par raison *distincte*, en pied de barre au lieu d'une sous chaque zone : presque tous les plafonds comptent les exemplaires toutes zones confondues, donc la même phrase était répétée autant de fois qu'il y a de zones. **Pas** réduit à une chaîne unique : le sous-plafond 1.6.2 (un avatar par talon) permet deux raisons différentes, et chaque entrée n'est préfixée de ses zones que s'il y en a plusieurs. Mesuré dans le navigateur réel sur une carte unique saturée : 3 phrases → 1, barre 289 → 257 px, image 523 → 555 px. Parcours complet revérifié en 375 px (tuile du navigateur *et* vignette du deck ouvrent la même modale ; déplacement Pioche→Talon effectif, `⇄` absent) et en 1280 px (`⇄` toujours là, 20×18 px). §11 : `test/cardPreviewModal.test.js` (4 tests sur `capNotices`) — 37 fichiers, 678 tests, 0 échec. **Note de tenue de ce document :** un `replace_all` du compte de tests avait écrasé quatre entrées historiques de ce journal (elles consignent le compte *de leur époque*, pas le compte courant) ; restaurées depuis `git show HEAD`, et l'entrée « Trois améliorations » corrigée à ses 672 tests réels — une inexactitude que le même réflexe avait déjà introduite au commit précédent. |
| 2026-08-05 | Icône du bouton Filtres : `▽` → 🔻, sur demande du propriétaire (« un vrai emoticon d'entonnoir »). §10 : **Unicode n'a pas d'emoji entonnoir** — 🔻 est le plus proche qui existe, même silhouette effilée vers le bas que l'icône « filtre » universelle, et peinte par la police emoji du système, donc lue comme une icône plutôt que comme un caractère égaré ; la flèche de pli reste monochrome pour que les deux triangles ne se lisent pas comme un seul contrôle. Vérifié dans le navigateur réel plutôt que supposé : le glyphe est rendu en **couleur** (rendu sur canvas, 321 pixels opaques, tous saturés) et non en tofu (largeur 55 px contre 26 px pour un tofu de référence `U+FFFF`) ; le bouton passe de 48 à 51 px et la ligne de recherche tient toujours à 375 px (boîtes 146 px chacune, aucun débordement horizontal) ; bascule 🔻▾ ⇄ 🔻▴ avec `aria-expanded` et l'affichage des facettes ; desktop inchangé (bouton toujours absent du DOM). §11 : aucun test (glyphe pur) — 37 fichiers, 678 tests, 0 échec (inchangé). |
