# Refonte en SPA statique CDN-first — Design

**Date :** 2026-07-10
**Statut :** validé (design), en attente de plan d'implémentation

## Contexte

Le MECCG deck builder est aujourd'hui une application Node : un serveur Fastify
sert le front React (Vite), une API `/api/cards`, un stockage de decks sur
disque (`data/decks`), l'upload d'images de dos (`data/backs`), et l'export
ZIP/PDF côté serveur (`sharp` + `archiver` + `pdfkit`). Les images de cartes
sont servies depuis des arbres locaux (`cards/fr`, `cards/remastered-all`) avec
un repli sur le CDN jsDelivr déjà câblé dans `cards.json` (`imageBaseUrl` par
set et par langue).

**Objectif :** mettre l'application en ligne pour un accès public, avec une
architecture la plus simple possible à pousser et à maintenir.

### Constats déterminants issus de l'exploration

- Le **CDN jsDelivr sert déjà 100 % des images** en structure plate
  (`.../en-remaster/as/Burat.jpg`, `.../meccg-fr/as/Burat.jpg`). Vérifié :
  couverture upstream complète, 0 image manquante par rapport aux 1683 cartes
  référencées.
- Les arbres d'images locaux ne servent que le cas **local/hors-ligne**. En
  ligne, les bundler serait du poids mort.
- Le stockage de decks actuel est **global et sans authentification** : en
  public, tout visiteur verrait/éditerait les decks de tous.
- L'export dépend de `sharp` (binaire natif), ce qui imposerait un conteneur
  toujours actif.
- Les specs d'export (dimensions, DPI, bleed) sont centralisées dans
  `src/constants.js` — de simples nombres, réutilisables tels quels dans le
  navigateur.
- `src/cards.js` n'utilise Node que pour `readFile` ; sa transformation
  cartes→facettes est pure et extractible.

## Décisions

| Sujet | Décision |
|---|---|
| Persistance des decks | **Côté navigateur** (localStorage) + import/export JSON. Aucun compte, aucune base. |
| Moteur d'export | **Dans le navigateur** → application 100 % statique. |
| Migration submodules (demande initiale) | **Abandonnée.** Prod et dev utilisent les URLs CDN. `relativePath` devient obsolète. |
| Source des images | **CDN jsDelivr uniquement.** |
| Hébergement | **Cloudflare Pages** (gratuit, CI git, domaine custom, fallback SPA). |
| Mode hors-ligne | **Abandonné** (acceptable pour une cible publique). |
| Dossier `MECCG/` | **Hors périmètre.** Non touché ; l'utilisateur le gère manuellement. |

## Non-objectifs (YAGNI)

- Pas de comptes utilisateurs, pas de base de données, pas d'authentification.
- Pas de partage de deck par URL (amélioration future possible).
- Pas de submodules git.
- Pas de mode hors-ligne / PWA.

## Architecture cible

Application **statique** buildée par Vite, déployée sur Cloudflare Pages.

| Aspect | Aujourd'hui | Cible |
|---|---|---|
| Serveur | Fastify (Node) | aucun |
| Images | trees locaux + CDN fallback | CDN jsDelivr uniquement |
| `cards.json` | lu serveur | asset statique `web/public/cards.json`, `fetch()` au runtime |
| Transform cartes→facettes | `src/cards.js` (serveur) | fonction pure côté navigateur |
| Decks | `data/decks/*.json` (global) | localStorage + import/export |
| Dos personnalisés | upload → `data/backs/` | fichier lu en mémoire (dataURL), stocké avec le deck |
| Export ZIP | `archiver` | JSZip |
| Export PDF | `pdfkit` | pdf-lib |
| Bleed / redimensionnement | `sharp` | canvas |
| Déploiement | process Node | push git → Cloudflare Pages |

**Dépendances retirées :** `fastify`, `@fastify/static`, `@fastify/multipart`,
`sharp`, `archiver`, `pdfkit`.
**Dépendances ajoutées :** `jszip`, `pdf-lib` (pures JS, navigateur).
**Supprimé :** dossier `data/` (non tracké de toute façon).

## Composants

### 1. Données & images

- `cards.json` devient l'asset statique `web/public/cards.json` (source unique,
  versionnée). Servi tel quel, récupéré par `fetch('/cards.json')` au démarrage.
- Extraire de `src/cards.js` une fonction **pure** `parseCards(json)` produisant
  `{ cards, facets, index }`, exécutée dans le navigateur. La couche
  `loadCards(path)` (IO Node) est supprimée.
- `src/constants.js` est déplacé sous `web/src/lib/` et réutilisé à l'identique.
- `web/src/lib/lang.js` construit les URLs d'images **directement sur le CDN** :
  `imageBaseUrl[setCode][lang] || imageBaseUrl[setCode].en`, concaténé à
  `card.image`. Les routes `/images` et `/images-fr` disparaissent. Le champ
  `relativePath` n'est plus utilisé pour résoudre un chemin (conservé dans les
  données mais inerte ; peut être purgé ultérieurement).

### 2. Decks (sans serveur)

- Réécrire le store en module localStorage exposant la même API que
  `src/deckStore.js` (`list/get/create/update/remove`) et conservant la même
  forme de deck (`id, name, cardIds, quantities, backAssignments, createdAt,
  updatedAt`).
- **Import :** upload d'un fichier `.json` de deck (validation de forme).
- **Export :** téléchargement du deck courant en `.json`.

### 3. Dos de cartes

- Les dos par défaut (`card-backs/CardBack300dpi.png`,
  `card-backs/SiteCardBack300dpi.png`) deviennent des assets statiques dans
  `web/public/card-backs/`.
- Un dos personnalisé est lu côté navigateur (file input → dataURL), rattaché au
  deck (`backAssignments`) et stocké en localStorage. Plus aucun upload serveur.

### 4. Port de l'export (chantier principal)

Réutiliser `web/src/lib/constants.js` pour garantir un rendu **identique** à
l'actuel.

- **Bleed (canvas) :** `fetch` de l'image CDN (CORS jsDelivr permissif) →
  dessin redimensionné à la taille de coupe (300 DPI) → extension du bleed par
  réplication des pixels de bord → export en blob. Reproduit le comportement de
  `src/imageProcessor.js`.
- **ZIP (JSZip) :** une image bleedée par carte, respect des quantités, dos
  inclus. Remplace `src/exporter.js`.
- **PDF (pdf-lib) :** grille 3×3 de cartes poker 2.5″×3.5″, marges centrées,
  traits de coupe, formats letter/A4, pages de dos en miroir optionnelles pour
  l'impression recto-verso. Remplace `src/sheetPdf.js`. La logique de layout
  (`sheetLayout`, `gridFor`) est portée telle quelle (maths pures).

### 5. Repo, build & déploiement

- **Supprimer** : `src/server.js`, `src/deckStore.js`, `src/exporter.js`,
  `src/imageProcessor.js`, `src/imageSource.js`, `src/sheetPdf.js`.
- **Migrer sous `web/src/lib/`** : la fonction pure `parseCards` (depuis
  `src/cards.js`) et `constants.js`. Le dossier `src/` disparaît une fois vidé.
- `package.json` : scripts réduits à `dev` (vite), `build` (`vite build`),
  `test` (vitest). Retrait des dépendances serveur, ajout de `jszip` + `pdf-lib`.
- `.claude/launch.json` : pointer sur le serveur de dev Vite.
- **Config déploiement** : `web/public/_redirects` contenant `/* /index.html 200`
  pour le routing SPA. Build Cloudflare Pages : commande `npm run build`, dossier
  de sortie `web/dist`.
- `README.md` mis à jour (architecture statique, procédure de déploiement).

### 6. Cleanup (fichiers devenus inutiles)

- Code serveur listé au §5.
- Tests obsolètes : `test/server.test.js`, `test/imageSource.test.js`,
  `test/imageProcessor.test.js`, `test/exporter.test.js`, `test/sheetPdf.test.js`,
  `test/deckStore.test.js` — supprimés ou réécrits pour les modules navigateur
  (voir §Tests).
- `data/` (decks, backs, imgcache) : supprimé.
- `meccg-logo.png` à la racine : candidat à suppression si non référencé (l'app
  utilise `web/public/meccg-logo.png`) — à vérifier avant suppression.
- **Non touché** : dossier `MECCG/` (géré manuellement par l'utilisateur),
  `docs/`, `card-backs/` (déplacé, pas supprimé).

## Stratégie de tests

- **Conservés** (testent des modules `web/src/lib`) : `deck`, `deckList`,
  `filter`, `i18n`, `importDeck`, `tags`, `constants`.
- **Réécrits** :
  - `parseCards` : facettes/index à partir d'un `cards.json` d'exemple.
  - deck store localStorage : CRUD (avec un mock de localStorage).
  - layout PDF : `sheetLayout`/`gridFor` (maths pures, sans rendu).
  - calcul des dimensions de bleed : vérifie la géométrie sans pixels réels.
- **Vérification manuelle** : un export ZIP et un export PDF échantillons,
  comparés visuellement à la sortie actuelle (rendu canvas/PDF pixel-exact).

## Ordre d'implémentation suggéré

1. **Rendre l'app consultable sans serveur** : extraire `parseCards` pur,
   déposer `cards.json` en asset statique, câbler le front pour `fetch` +
   affichage des images via CDN. Supprimer les routes/serveur d'images.
2. **Decks en localStorage** + import/export.
3. **Port de l'export** : bleed canvas → ZIP → PDF (+ dos).
4. **Nettoyage & déploiement** : suppression du code serveur mort et des deps,
   config Cloudflare Pages, mise en ligne.

Chaque étape laisse l'application fonctionnelle et testable.

## Risques

- **Fidélité de l'export** : le port `sharp`/`pdfkit` → canvas/pdf-lib doit
  reproduire exactement dimensions, DPI et bleed. Mitigation : réutilisation de
  `constants.js` et vérification manuelle par comparaison.
- **CORS CDN** : dépend des en-têtes permissifs de jsDelivr (constatés OK) pour
  lire les pixels au canvas lors de l'export.
- **Perte de l'offline** : accepté explicitement.
