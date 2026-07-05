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
   Compétences, Mots-clés, Unique + recherche par nom en/fr). La **recherche ignore les
   accents** (« burat » trouve « Bûrat »).
2. **Sélectionner (quantités)** : **1er clic** sur l'image = ajoute la carte, **2e clic** =
   la retire. Les boutons **− / +** en bas de la carte ajustent la quantité. Limites de copies :
   **3 max** par défaut, **1** pour les cartes **Unique** et pour tous les **Sites**, mais **3**
   pour les **avatars** (magiciens, Nazgûl, magiciens déchus, Balrog) bien qu'ils soient uniques.
   Le tiroir du bas affiche les compteurs live (les copies sont comptées).
3. **Importer une liste** : bouton « Importer » → colle une liste `Nx nom de carte`
   (accents ignorés, nom complet). L'écran d'analyse signale les cartes introuvables et, quand
   un nom correspond à plusieurs cartes (ex. version héros / serviteur), propose un menu pour
   choisir la bonne. L'import **remplace** la sélection courante.
4. **Sauvegarder** : « Mes decks » → nommer et enregistrer. Les decks sont stockés en
   `data/decks/*.json` et rechargeables plus tard.
5. **Exporter** : « Exporter » ouvre la fenêtre d'export, avec deux formats au choix
   (voir ci-dessous). Les dos sont pré-remplis avec les défauts du projet (`card-backs/`).

## Deux formats d'export

### Langue des images (ZIP et PDF)

Les exports ZIP et PDF proposent une **langue d'images** : **English, Español, Français** — les
3 langues pour lesquelles des images existent (`imageBaseUrl` dans `cards.json`). Les images sont
téléchargées à la demande depuis le CDN (`imageBaseUrl[langue] + image`) et mises en cache dans
`data/imgcache/`. *(Les noms existent aussi en de/nl, mais sans images — d'où seulement 3 langues
ici, contre 5 pour la deck list texte.)*

### 1. Images individuelles MPC (ZIP) — pour commander chez MPC

Chaque carte est agrandie puis complétée d'un bleed (extension des bords) pour produire un
PNG **822 × 1122 px @ 300 DPI** (format US Game / Poker avec bleed, valeur MPC officielle :
coupe 750×1050 + 36 px de bleed par bord). Chaque exemplaire d'une carte en plusieurs copies
est exporté comme un fichier distinct (`..._c1.png`, `..._c2.png`, …). Le ZIP est organisé :

```
<deck>_MPC.zip
├── playdeck/fronts/*.png     (Character, Resource, Hazard)
├── playdeck/back.png
├── locationdeck/fronts/*.png (Site, Region)
├── locationdeck/back.png
└── manifest.txt
```

Prêt pour un glisser-déposer dans l'outil MPC en ligne ou dans
[MPC Autofill](https://mpcautofill.github.io/). MPC attend les **fichiers de dos distincts**
(ici 2) que tu assignes ensuite aux emplacements — c'est exactement ce que produit le ZIP
(`playdeck/back.png` + `locationdeck/back.png`).

**Dos par défaut** (mapping demandé) : Site / Region → `card-backs/SiteCardBack300dpi.png`,
toutes les autres cartes → `card-backs/CardBack300dpi.png`. On peut surcharger un dos par
groupe dans la fenêtre d'export.

### 2. Planches PDF — pour impression maison / autre imprimeur

Génère un PDF avec les cartes **à taille réelle** (2,5 × 3,5 po) et des traits de coupe aux
coins. Trois formats de page, la grille s'adapte automatiquement :

| Format | Grille | Cartes / page |
|---|---|---|
| US Letter | 3 × 3 | 9 |
| A4 | 3 × 3 | 9 |
| A3 (paysage) | 6 × 3 | **18** |

L'A3 est en **paysage** pour tenir 18 cartes (l'équivalent de deux A4) et économiser du papier.

Option « inclure les planches de dos » : ajoute après chaque page de faces une page de dos en
**miroir** (colonnes inversées) pour une impression **recto-verso** (retournement bord long).
Le mapping des dos par type est le même qu'en export MPC.

### 3. Deck list (texte)

Télécharge un fichier `.txt` listant les cartes **triées par type** (Characters, Resources,
Hazards, Sites, Regions) avec les quantités, au format `Nx nom` — directement ré-importable
via le bouton « Importer ». La **langue** de la liste est réglable (English, Français, Español,
Deutsch, Nederlands — les langues complètes du JSON).

## Langue de l'interface

Le sélecteur **FR / EN** en haut à droite change la langue de **toute l'interface** (boutons,
filtres, dialogues, avertissements) **et** des noms de cartes.

Les textes sont centralisés dans [`web/src/lib/i18n.js`](web/src/lib/i18n.js) (un dictionnaire
par langue, clés partagées). Pour ajouter une langue, ajouter un bloc avec les mêmes clés et
l'inscrire dans `UI_LANGUAGES` ([`web/src/lib/lang.js`](web/src/lib/lang.js)). Un test vérifie
que les dictionnaires `fr`/`en` ont exactement les mêmes clés.

## Sélection en masse

Le bouton **« Tout sélectionner (N) »** au-dessus de la grille ajoute une copie de chaque carte
actuellement affichée par les filtres. « Nouveau » (tiroir du bas) vide la sélection.

### ⚠️ À vérifier avant une vraie commande

Les dimensions cible (822 × 1122 px avec bleed) sont dans [`src/constants.js`](src/constants.js).
**Vérifie-les contre le template exact que MPC te fait télécharger** pour ton produit avant de
commander, et ajuste-les si besoin (un seul endroit à changer).

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
