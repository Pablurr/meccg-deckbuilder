# MECCG Deck Builder

App web **locale** et minimaliste pour construire des decks MECCG à partir de la collection
`remastered-all/` (1683 cartes, 7 sets) et exporter des images prêtes à imprimer chez
**MPC (MakePlayingCards)**.

## Prérequis

- Node.js 18+ (testé sur Node 24)
- Le dossier `remastered-all/` (images + `cards.json`) à la racine du projet

## Installation

```bash
npm install
```

## Lancer l'app

```bash
npm start
```

Cela build le front puis démarre le serveur sur **http://localhost:3000**.
Tout reste sur ta machine — rien n'est envoyé sur Internet.

### Mode développement (rechargement à chaud)

Deux terminaux :

```bash
npm run dev       # API Fastify sur :3000
npm run dev:web   # Vite (HMR) sur :5173  → ouvre http://localhost:5173
```

## Utilisation

1. **Filtrer / rechercher** : barre du haut (Set, Type, Alignement, Rareté, Race, Sous-type,
   Compétences, Mots-clés, Unique + recherche par nom en/fr).
2. **Sélectionner** : clique sur une carte pour l'ajouter/retirer du deck. Le tiroir du bas
   affiche les compteurs live et des avertissements (informatifs, non bloquants).
3. **Sauvegarder** : « Mes decks » → nommer et enregistrer. Les decks sont stockés en
   `data/decks/*.json` et rechargeables plus tard.
4. **Exporter MPC** : « Exporter MPC » → choisir un dos par groupe → « Générer le ZIP ».

## Export MPC

Chaque carte est agrandie puis complétée d'un bleed (extension des bords) pour produire un
PNG **816 × 1110 px @ 300 DPI** (format US Game / Poker avec bleed). Le ZIP est organisé :

```
<deck>_MPC.zip
├── playdeck/fronts/*.png     (Character, Resource, Hazard)
├── playdeck/back.png
├── locationdeck/fronts/*.png (Site, Region)
├── locationdeck/back.png
└── manifest.txt
```

Prêt pour un glisser-déposer dans l'outil MPC en ligne ou dans
[MPC Autofill](https://mpcautofill.github.io/).

### ⚠️ À vérifier avant une vraie commande

Les dimensions cible sont dans [`src/constants.js`](src/constants.js). **Vérifie-les contre le
template exact que MPC te fait télécharger** pour ton produit avant de commander, et ajuste-les
si besoin (un seul endroit à changer).

### Qualité d'image

Les images source font 570 × 796 px @ 72 DPI. L'export les agrandit d'environ 1,4× pour
atteindre le format d'impression : le rendu est correct pour des **proxies** mais pas
parfaitement net. C'est inhérent aux fichiers source.

## Tests

```bash
npm test
```

## Structure

- `src/` — backend (Fastify, chargement cartes, traitement image `sharp`, export ZIP, store decks)
- `web/` — front Vite + React
- `data/` — decks sauvegardés + dos importés (non versionné)
- `docs/superpowers/` — spec et plan d'implémentation
