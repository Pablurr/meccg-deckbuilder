# MECCG Deck Builder — Design

**Date:** 2026-07-04
**Status:** Approved

## Objectif

Application web **locale et minimaliste** pour construire des decks de MECCG (Middle-earth
Collectible Card Game) à partir d'une collection de 1683 cartes, puis exporter des images
prêtes à imprimer chez **MPC (MakePlayingCards)**.

## Contraintes & décisions

| Décision | Choix retenu |
|---|---|
| Déploiement | 100 % local, un seul processus Node (`localhost`). Rien ne sort de la machine. |
| Front-end | Vite + React |
| Back-end | Node + Fastify |
| Traitement image | `sharp` (retaille + bleed) |
| Archive | `archiver` (ZIP) |
| Validation des règles | Informative uniquement (compteurs + avertissements non bloquants) |
| Quantités | 1 carte = 1 exemplaire (pas de sélecteur de quantité) |
| Decks sauvegardés | Plusieurs projets nommés, persistés en fichiers JSON sur disque |
| Dos de carte | 2 groupes par type (play deck / location deck), mapping éditable |
| Format de sortie | Images individuelles retaillées au format MPC, packagées en ZIP |

## Données source

- `remastered-all/cards.json` : objet `{ SET_CODE: { ..., cards: { "AS-1": {...} } } }`
  pour 7 sets : **AS, BA, DM, LE, TD, TW, WH**. Total **1683 cartes**.
- Chaque carte : `id`, `set`, `name` (multi-langue en/es/fr/de/…), `type`, `alignment`,
  `attributes` (objet), `text`, `quote`, `image`, `rarity`, `artist`, **`relativePath`**.
- `relativePath` pointe directement vers l'image (ex. `as/minions/Burat.jpg`), relative à
  `remastered-all/`. Correspondance 1:1 avec l'arborescence des dossiers.
- **Images source : 570×796 px @ 72 DPI** (~140 KB, JPG). Ratio 0.716 ≈ carte poker.
  Pas de bleed intégré (c'est la face de carte pleine).

### Distributions clés (candidats filtres)

- `type` (5) : Resource 767, Hazard 450, Site 220, Character 194, Region 52
- `alignment` (7) : Hero, Minion, Neutral, Stage, Balrog, Fallen-wizard, Dual
- `rarity` (28) : R, U, U2, C2, …
- `attributes.race` (40), `attributes.subtype` (17), `attributes.skills` (32),
  `attributes.keywords` (27), `attributes.unique` (bool)

## Architecture

Un seul processus Node local.

```
meccg-deckbuilder/
├── server.js                → Fastify : sert front + cards.json + images, API decks/export
├── lib/
│   ├── cards.js             → charge/aplatit cards.json en tableau + index par id
│   ├── imageProcessor.js    → source 570×796 → image MPC avec bleed (sharp)
│   └── exporter.js          → assemble le ZIP (fronts par groupe + dos + manifest)
├── data/
│   ├── decks/*.json         → decks sauvegardés (1 fichier par deck)
│   └── backs/*.png          → images de dos importées par l'utilisateur
├── web/                     → front Vite + React (source)
│   └── dist/                → build servi par Fastify en prod
└── remastered-all/          → images + cards.json (existant)
```

**Modes d'exécution :**
- `npm run dev` — Vite dev server (HMR) + serveur Fastify API ; Vite proxifie `/api`,
  `/images`, `/cards.json` vers Fastify.
- `npm start` — build Vite une fois, puis Fastify sert le tout sur un seul port
  (`http://localhost:3000`).

### Composants

**Backend**

| Unité | Rôle | Dépend de |
|---|---|---|
| `cards.js` | Lire `cards.json`, produire un tableau plat de cartes + index `id → card` + listes de valeurs de facettes | fichier JSON |
| `imageProcessor.js` | `(cheminSource) → Buffer PNG` au format MPC avec bleed | `sharp` |
| `exporter.js` | `(deck, backs) → Buffer ZIP` structuré | `imageProcessor`, `archiver` |
| `server.js` | Routes HTTP, statique, CRUD decks | Fastify, les 3 ci-dessus |

**Frontend**

| Composant | Rôle |
|---|---|
| `CardBrowser` | Grille de cartes (lazy-load images) + barre de filtres + recherche |
| `FilterBar` | Facettes (Set, Type, Alignment, Rarity, Race, Subtype, Skills, Keywords, Unique) + champ recherche |
| `DeckDrawer` | Tiroir bas : compteurs live, avertissements, actions (sauver, exporter) |
| `DeckManager` | Liste des decks sauvegardés : charger / dupliquer / renommer / supprimer |
| `ExportDialog` | Choix/import des dos par groupe + lancement export + progression |

## API HTTP

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/cards` | Tableau plat des cartes + facettes disponibles |
| GET | `/api/decks` | Liste des decks `{id, name, count, updatedAt}` |
| GET | `/api/decks/:id` | Un deck complet |
| POST | `/api/decks` | Créer un deck `{name, cardIds, backAssignments}` |
| PUT | `/api/decks/:id` | Mettre à jour un deck |
| DELETE | `/api/decks/:id` | Supprimer un deck |
| POST | `/api/backs` | Importer une image de dos (multipart) → renvoie un id/chemin |
| POST | `/api/export` | Corps `{cardIds, backAssignments}` → renvoie un ZIP (stream) |
| GET | `/images/*` | Images source statiques (depuis `remastered-all/`) |
| GET | `/cards.json` | Fichier brut (fallback) |

## Modèle de données — Deck

```json
{
  "id": "d_1a2b3c",
  "name": "Minion Balrog v1",
  "cardIds": ["AS-1", "TW-44", "..."],
  "backAssignments": {
    "playdeck": "backs/play-back.png",
    "locationdeck": "backs/site-back.png"
  },
  "createdAt": "2026-07-04T10:00:00Z",
  "updatedAt": "2026-07-04T10:30:00Z"
}
```

- `cardId` = `id` du JSON. Une carte = un exemplaire (unicité dans `cardIds`).
- **Groupes de dos** (mapping par défaut, éditable) :
  - `playdeck` ← types `Character`, `Resource`, `Hazard`
  - `locationdeck` ← types `Site`, `Region`

## Pipeline d'export MPC

Constantes cible (format US Game / Poker, **à vérifier sur le template MPC téléchargé**) :

```
CARD_W_BLEED = 816   # px  (2.72 in @ 300 DPI)
CARD_H_BLEED = 1110  # px  (3.70 in @ 300 DPI)
BLEED_PX     = 36    # px  (0.12 in) par bord
DPI          = 300
```

Ces valeurs sont regroupées dans un module de constantes unique pour ajustement facile.

**Pour chaque carte :**
1. Charger la source (570×796, sans bleed).
2. `sharp.resize` → taille de coupe finale à 300 DPI (`CARD_W_BLEED - 2*BLEED`, idem hauteur),
   `fit: fill` (léger étirement < 3 %, ratio quasi identique).
3. Ajouter le bleed par extension des bords (`extend` avec `background` ou stratégie
   edge-replicate via `extractChannel`/`composite` selon rendu) → `816×1110`.
4. Écrire densité 300 DPI, encoder **PNG**.

**Structure du ZIP :**
```
<deck-name>_MPC.zip
├── playdeck/
│   ├── fronts/         (Character, Resource, Hazard — retaillés, nommés <id>_<slug>.png)
│   └── back.png
├── locationdeck/
│   ├── fronts/
│   └── back.png
└── manifest.txt        (liste des cartes + comptes par groupe + rappel format MPC)
```

Prêt pour glisser-déposer dans l'outil MPC en ligne ou dans MPC Autofill.

## Garde-fous (informatif, non bloquant)

- Compteurs live : total, par type, par alignement, par groupe de dos.
- Avertissements affichés mais non bloquants :
  - image source introuvable pour une carte,
  - même carte `unique` sélectionnée en doublon (impossible ici car set unique, mais on
    signale si un dos manque),
  - dos manquant pour un groupe utilisé au moment de l'export,
  - deck vide au moment d'exporter.
- Export : barre de progression + message clair si `sharp` échoue sur une image (on continue
  et on liste les échecs dans le manifest).

## Limite connue

Sources 570×796 @72 DPI → upscale ~1,4× vers 816×1110. Qualité **« proxy » correcte** mais
non parfaitement nette. Inhérent aux fichiers source, pas à l'app.

## Hors périmètre (YAGNI)

- Validation stricte des règles officielles de deckbuilding.
- Quantités multiples par carte.
- Multi-utilisateurs / comptes / accès distant.
- Planches assemblées (grille N×N) — MPC fait l'imposition côté serveur.
- Édition/retouche d'image dans l'app.
```
