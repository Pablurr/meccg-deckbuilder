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

## Modes de deck

Chaque deck a un **mode**, choisi à sa création et modifiable ensuite via « Réglages » :

- **Impression libre** : aucune règle, aucune limite de copies — imprime n'importe quelle carte,
  en n'importe quelle quantité. C'est le mode de tous les decks créés avant cette fonctionnalité
  (migration automatique et transparente : un ancien deck se rouvre en impression libre).
- **Construction de deck** : choisis un **camp** (Sorcier, Spectre de l'Anneau, Sorcier déchu,
  Balrog — jamais « faction », qui désigne une catégorie de carte MECCG), une **longueur de
  partie** (Starter, Standard, Longue, Campagne) et une **sévérité** (tournoi ou casual), puis le
  deck est vérifié **en direct** pendant que tu le construis.

### Zones

Un deck a jusqu'à quatre zones : le **talon** (Personnage/Ressource/Péril), le **deck de sites**
(Site/Région), une **réserve** (sideboard) optionnelle et, pour les camps qui en utilisent un, un
**pool de départ** de personnages et d'objets mineurs mis de côté avant la partie. Le tiroir du
bas affiche des onglets par zone avec compteurs et plafonds (ex. `Pool 3 / 10`), et déposer une
carte sur un onglet l'y déplace. Dans le navigateur de cartes, chaque carte affiche un compteur
par zone ; en mode Construction de deck, un filtre de **légalité** (activé par défaut) masque les
cartes non éligibles au camp choisi (la longueur de partie n'affecte que la limite de réserve, pas
la légalité d'une carte) — bascule « Afficher les cartes illégales » pour tout voir quand même.

### Avertissements de règles

En mode Construction de deck, chaque règle vérifiée signale les problèmes en direct (trop
d'exemplaires d'une carte, taille de talon hors plage, pool de départ hors limites, etc.) en
nommant la carte concernée. **Rien n'est jamais bloqué.** Par deck, tu peux **ignorer une règle**
(elle ne sera plus signalée pour ce deck précis) ou **la signaler** (ouvre un ticket GitHub
pré-rempli si tu penses qu'elle est fausse).

**Important — les valeurs des règles sont des stubs.** Elles viennent d'une base de connaissances
utilisée comme piste de départ, pas comme source faisant autorité : la vérification contre une
source officielle est encore en cours. Toute règle non confirmée démarre **désactivée** et ne
produit aucun avertissement. La page **Règles et modes** (bouton `?` en haut) documente chaque
règle — description, sévérité, source — à partir des mêmes données que le validateur, et permet
de cocher, deck par deck, celles que tu veux appliquer quand même une fois vérifiées de ton côté.

### Notes

Chaque deck a quatre champs de notes libres (notes de départ, stratégie ressources, stratégie
périls, autres notes), sauvegardés avec le deck et repris en tête de l'export « Deck list
(texte) ».

## Formats d'export

Tous les exports (ZIP, PDF) tournent **entièrement dans le navigateur** : les images de cartes
sont récupérées depuis le CDN puis composées côté client (canvas pour le bleed MPC, `pdf-lib`
pour les planches PDF, `jszip` pour l'archive), sans passer par aucun serveur.

### Mode Proxy (variant self-clone)

> ⚠️ Branche **`proxy-card-stamp-selfclone`** — variante expérimentale du mode Proxy pour
> comparer rendu et performance. La branche `proxy-card-stamp` implémente la même feature avec
> une **bibliothèque de 16 swatches** ; celle-ci utilise un **auto-clonage** sans aucun asset.

L'interrupteur **« Proxy »** (à côté du sélecteur de langues, **activé par défaut**) recouvre la
mention « ©19xx Tolkien Enterprises » — ou le nom d'extension sur les cartes FR — par un tampon
« Proxy ». La zone est remplie en **clonant une bande propre du cadre de la carte elle-même**
(un segment adjacent, étiré sur la zone) : la couleur et la texture s'adaptent automatiquement à
chaque carte, y compris chaque wizard, **sans aucun fichier de texture** (ni asset à charger à
l'écran, ni fetch à l'export). C'est une exigence de MPC pour les cartes proxy. Le tampon apparaît
**à l'écran et dans les exports ZIP/PDF** ; désactive l'interrupteur pour retrouver les images
d'origine. Les cartes **Région** et les **dos** ne sont jamais tamponnés.

À l'écran, l'overlay réutilise la **même URL d'image** que la vignette déjà chargée (pas de
téléchargement supplémentaire) ; il l'affiche en fond, mise à l'échelle pour étirer la bande
source sur la zone. Compromis vs les swatches : zéro asset et adaptation automatique, mais le
rendu peut être légèrement plus « étiré » et l'overlay écran met à l'échelle l'image de la carte
plutôt qu'un petit PNG mis en cache.

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
Deutsch, Nederlands — les langues complètes du JSON). Quel que soit le mode du deck, dès qu'une
zone (pool, réserve) contient des cartes, elle apparaît en section (`## Pool`, `## Play deck`,
`## Locations`, `## Sideboard`, dans cet ordre — le même ordre que le ZIP et le PDF) et les notes
sont reprises en tête du fichier sous `## Notes` ; ré-importer ce fichier restaure les cartes
**dans leurs zones d'origine** ainsi que les notes.

## Langue de l'interface

Le sélecteur **FR / EN / ES** en haut à droite change la langue de **toute l'interface**
(boutons, filtres, dialogues, avertissements de règles, page de documentation), des **noms de
cartes** (y compris dans les avertissements) **et** des **images de cartes** : les visuels sont
chargés depuis le CDN dans la langue choisie (`imageBaseUrl[fr|en|es]` + nom de fichier). Si
l'image dans la langue choisie manque, l'affichage retombe automatiquement sur la version
anglaise.

Les textes sont centralisés dans [`web/src/lib/i18n.js`](web/src/lib/i18n.js) (un dictionnaire
par langue, clés partagées). Pour ajouter une langue, ajouter un bloc avec les mêmes clés et
l'inscrire dans `UI_LANGUAGES` ([`web/src/lib/lang.js`](web/src/lib/lang.js)). Des tests vérifient
que les dictionnaires `fr`/`en`/`es` ont exactement les mêmes clés, et qu'aucune chaîne liée aux
camps n'emploie « faction » (qui désigne autre chose sur les cartes MECCG — voir « Modes de
deck » plus haut).

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
- `web/src/lib/rules/` — moteur de règles pur (validation en mode Construction de deck) ; les
  valeurs sont des stubs à vérifier, voir la page « Règles et modes » dans l'app
- `web/public/` — assets statiques servis tels quels : `cards.json`, `card-backs/`, `_redirects`
- `docs/superpowers/` — spec et plan d'implémentation
