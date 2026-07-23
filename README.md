# MECCG Deck Builder

App web **statique** pour construire des decks MECCG à partir de la collection Remastered
(1683 cartes, 7 sets) et exporter des images prêtes à imprimer chez **MPC (MakePlayingCards)**
ou en planches PDF. Aucun serveur : c'est une SPA Vite/React, les données de cartes sont un
fichier `cards.json` statique et les images sont servies par un CDN (jsDelivr).

## Prérequis

- Node.js 18+ (testé sur Node 24) — uniquement pour builder/développer, pas pour faire tourner l'app

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Lance le serveur de dev Vite (HMR) sur **http://localhost:5173**.

## Build & preview

```bash
npm run build     # build statique → web/dist
npm run preview   # sert web/dist en local pour vérifier le build
```

## Déploiement (Cloudflare Pages)

- Build command : `npm run build`
- Output directory : `web/dist`
- Le fichier [`web/public/_redirects`](web/public/_redirects) (copié tel quel dans `web/dist`)
  fournit le fallback SPA (`/* /index.html 200`) nécessaire pour que les routes côté client
  fonctionnent sur Cloudflare Pages.

Déploiement direct alternatif (sans passer par un dépôt Git connecté à Pages) :

```bash
npx wrangler pages deploy web/dist
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
4. **Sauvegarder** : « Mes decks » → nommer et enregistrer. Les decks sont stockés dans le
   `localStorage` du navigateur (pas de compte, pas de synchronisation entre appareils). Pour
   sauvegarder/transférer un deck, utilise l'export « Deck list (texte) » (voir plus bas) : le
   fichier `.txt` produit est ré-importable via « Importer ».
5. **Exporter** : « Exporter » ouvre la fenêtre d'export, avec les formats ci-dessous. Les dos
   sont pré-remplis avec les défauts du projet (voir `web/public/card-backs/`) et peuvent être
   remplacés par une image perso (stockée avec le deck, en `localStorage`).

## Formats d'export

Tous les exports (ZIP, PDF) tournent **entièrement dans le navigateur** : les images de cartes
sont récupérées depuis le CDN puis composées côté client (canvas pour le bleed MPC, `pdf-lib`
pour les planches PDF, `jszip` pour l'archive), sans passer par aucun serveur.

### Mode Proxy

L'interrupteur **« Proxy »** (à côté du sélecteur de langues, **activé par défaut**) recouvre la
mention « ©19xx Tolkien Enterprises » — ou le nom d'extension sur les cartes FR — par un tampon
« Proxy » assorti à la **texture du cadre de chaque type de carte** (16 fonds : par type/camp, un
rouge pour Nazgûl/Balrog, un par wizard). C'est une exigence de MPC pour les cartes proxy. Le
tampon apparaît **à l'écran et dans les exports ZIP/PDF** ; désactive l'interrupteur pour
retrouver les images d'origine. Les cartes **Région** et les **dos** ne sont jamais tamponnés.

### Langue des images (ZIP et PDF)

Les exports ZIP et PDF proposent une **langue d'images** : **English, Español, Français** — les
3 langues pour lesquelles des images existent sur le CDN (`imageBaseUrl[lang]` dans
`cards.json`). Si l'image dans la langue demandée est absente, l'export retombe automatiquement
sur la version anglaise. *(Les noms existent aussi en de/nl, mais sans images — d'où seulement 3
langues ici, contre 5 pour la deck list texte.)*

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

**Dos par défaut** (mapping demandé) : Site / Region → `SiteCardBack300dpi.png`,
toutes les autres cartes → `CardBack300dpi.png` (servis depuis `web/public/card-backs/`). On
peut surcharger un dos par groupe dans la fenêtre d'export (image perso stockée avec le deck).

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
filtres, dialogues, avertissements), des **noms de cartes** **et** des **images de cartes** : les
visuels sont chargés depuis le CDN dans la langue choisie (`imageBaseUrl[fr|en]` + nom de
fichier). Si l'image dans la langue choisie manque, l'affichage retombe automatiquement sur la
version anglaise.

Les textes sont centralisés dans [`web/src/lib/i18n.js`](web/src/lib/i18n.js) (un dictionnaire
par langue, clés partagées). Pour ajouter une langue, ajouter un bloc avec les mêmes clés et
l'inscrire dans `UI_LANGUAGES` ([`web/src/lib/lang.js`](web/src/lib/lang.js)). Un test vérifie
que les dictionnaires `fr`/`en` ont exactement les mêmes clés.

## Sélection en masse

Le bouton **« Tout sélectionner (N) »** au-dessus de la grille ajoute une copie de chaque carte
actuellement affichée par les filtres. « Nouveau » (tiroir du bas) vide la sélection.

### ⚠️ À vérifier avant une vraie commande

Les dimensions cible (822 × 1122 px avec bleed) sont dans
[`web/src/lib/constants.js`](web/src/lib/constants.js). **Vérifie-les contre le template exact
que MPC te fait télécharger** pour ton produit avant de commander, et ajuste-les si besoin (un
seul endroit à changer).

### Qualité d'image

Les images source font 570 × 796 px @ 72 DPI. L'export les agrandit d'environ 1,4× pour
atteindre le format d'impression : le rendu est correct pour des **proxies** mais pas
parfaitement net. C'est inhérent aux fichiers source.

## Tests

```bash
npm test
```

## Structure

- `web/` — front Vite + React (toute l'app, y compris la logique d'export en `web/src/lib/export/`)
- `web/public/` — assets statiques servis tels quels : `cards.json`, `card-backs/`, `_redirects`
- `docs/superpowers/` — spec et plan d'implémentation
