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
   la retire. Les boutons **− / +** en bas de la carte ajustent la quantité, et le tiroir du
   bas affiche les compteurs live. **Les limites de copies dépendent du mode du deck** (voir
   « Modes de deck » plus bas) : en **impression libre**, il n'y en a aucune ; en
   **construction de deck**, le bouton **+** refuse de dépasser le plafond de la carte —
   **1** exemplaire pour une carte **unique** ou un **site** ordinaire, **3** pour un
   **avatar** (les avatars échappent à la règle d'unicité), **3** pour le reste (2 pour les
   personnages et les ressources héros/séide quand tu joues **sorcier déchu**), et **aucune
   limite** pour les **havres** ni pour les sites de sorcier déchu de ce même camp. Ces
   plafonds se comptent sur **l'ensemble des zones** réunies, pas zone par zone.
3. **Importer une liste** : bouton « Importer » → colle une liste, puis « Analyser ». Les
   sections (pioche, talon, talon contre Sorcier déchu, réserve, lieux, sites, régions, notes)
   sont reconnues **dans n'importe quel ordre**, en markdown ou en texte brut, et en
   **français, anglais ou espagnol** ; une carte finit toujours dans une zone où elle a le
   droit d'être, même si
   la liste collée la range ailleurs (un site listé sous « Talon » rejoint les sites). La
   quantité peut se lire **devant ou derrière** le nom (`3x Bûrat`, `Bûrat - 3`, `Bûrat
   (3)`) ; une parenthèse après le nom sert aussi à désambiguïser (`Angmarim (Hero)`,
   `Bûrat (AS)`) quand plusieurs cartes portent le même nom (accents ignorés, nom complet
   requis). Tout ce qui n'est ni un titre de section ni une ligne de carte est conservé
   comme note. Une fois l'analyse faite, choisis la **cible** (nouveau deck ou remplacement
   du deck ouvert), le **mode** et, en construction de deck, le **camp** et la **longueur de
   partie** — préremplis depuis le bloc `## Metadata` du texte collé s'il y en a un, sinon
   depuis le deck ouvert. Les cartes ambiguës proposent un menu de choix, et les cartes
   illégales pour le camp choisi sont marquées (jamais bloquées).
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

Un deck a jusqu'à cinq zones : la **pioche** (Personnage/Ressource/Péril), le **deck de
sites** (Site/Région), un **talon** (sideboard) optionnel, pour les camps qui en utilisent
un, une **réserve** de personnages et d'objets mineurs mis de côté avant la partie (le pool de
départ), et un **talon contre Sorcier déchu** optionnel — jusqu'à 10 cartes supplémentaires,
en plus du talon normal, préselectionnées pour un adversaire jouant Sorcier déchu (règle
1.6.1). Cette dernière n'apparaît dans le panneau de deck que comme un onglet d'invitation
(`+ Talon vs SD`) tant qu'elle est vide, et devient un onglet normal avec compteur dès qu'une
carte y est ajoutée ; en construction de deck, son plafond de 10 s'applique quelle que soit la
longueur de partie choisie. Le panneau affiche des onglets par zone avec compteurs et
plafonds (ex. `Réserve 3 / 10`), et déposer une carte sur un onglet l'y déplace. Dans le
navigateur de cartes, chaque carte affiche un compteur par zone ; en mode Construction de
deck, un filtre de **légalité** (activé par défaut) masque les cartes non éligibles au camp
choisi (la longueur de partie n'affecte que la limite de talon, pas la légalité d'une carte)
— bascule « Afficher les cartes illégales » pour tout voir quand même.

Le panneau de deck (volet à droite sur ordinateur, feuille plein écran sur mobile) affiche les
cartes sélectionnées dans une grille dont la largeur du panneau détermine la densité : plus il
est large — fais glisser son bord, ou agrandis-le en plein panneau —, plus il montre de
cartes par rangée, exactement comme la grille du navigateur de cartes au-dessus.

### Avertissements de règles

En mode Construction de deck, chaque règle vérifiée signale les problèmes en direct (trop
d'exemplaires d'une carte, taille de talon hors plage, réserve hors limites, etc.) en
nommant la carte concernée. **Rien n'est jamais bloqué.** Par deck, tu peux **ignorer une règle**
(elle ne sera plus signalée pour ce deck précis) ou **la signaler** (ouvre un ticket GitHub
pré-rempli si tu penses qu'elle est fausse).

**Les 30 règles ont été vérifiées** contre la section 1 du
[Council of Elrond](https://www.councilofelrond.org/rules/#Section1), et chacune cite la clause
dont elle vient. Elles sont donc **toutes actives par défaut**. Quelques-unes sont explicitement
marquées comme des **interprétations** (une lecture plus stricte que la lettre du texte) ou comme
des **avis maison** — ces derniers n'affichent aucune citation, justement parce qu'ils ne
viennent pas de la source. La page **Règles et modes** (bouton `?` en haut) documente chaque
règle — description, sévérité, statut, clause citée — à partir des mêmes données que le
validateur, et la case à cocher de chaque ligne permet d'en **désactiver** une pour ce deck si tu
n'es pas d'accord avec elle.

### Notes

Chaque deck a quatre champs de notes libres (notes de départ, stratégie ressources, stratégie
périls, autres notes), sauvegardés avec le deck et repris en tête de l'export « Deck list
(texte) ».

## Formats d'export

Tous les exports (ZIP, PDF) tournent **entièrement dans le navigateur** : les images de cartes
sont récupérées depuis le CDN puis composées côté client (canvas pour le bleed MPC, `pdf-lib`
pour les planches PDF, `jszip` pour l'archive), sans passer par aucun serveur.

### Mode Proxy

L'interrupteur **« Proxy »** (à côté du sélecteur de langues, **activé par défaut**) efface la
mention « ©19xx Tolkien Enterprises » — ou le nom d'extension sur les cartes FR — en **repeignant
la zone avec le cadre vierge du type de carte**, puis écrit « Proxy » par-dessus en Arial Bold.
C'est une exigence de MPC pour les cartes proxy. Les 16 cadres sources sont dans
`assets/card-templates/` ; les 32 patchs de `web/public/proxy-patches/` s'en régénèrent avec
`python scripts/make_proxy_patches.py`. Les cartes FR utilisent la variante `-fr` (leurs images
viennent d'une autre source, à la colorimétrie différente). Le tampon apparaît **à l'écran et dans
les exports ZIP/PDF** ; désactive l'interrupteur pour retrouver les images d'origine. Les cartes
**Région** et les **dos** ne sont jamais tamponnés.

Régénérer les patchs demande le corpus de cartes local sous `cards/` (gitignoré, absent d'un clone
frais), Pillow et une police Windows Arial Bold. Avant de committer des patchs régénérés, relire
`scripts/proxy-patch-qa.png` (planche de contrôle visuelle, non committée).

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
zone (pool, réserve, talon contre Sorcier déchu) contient des cartes, elle apparaît en section
(`## Pool`, `## Play deck`, `## Locations`, `## Sideboard`, `## Sideboard vs FW`, dans cet
ordre — le même ordre que le ZIP et le PDF) et les notes
sont reprises en tête du fichier sous `## Notes` ; ré-importer ce fichier restaure les cartes
**dans leurs zones d'origine** ainsi que les notes.

Juste sous le titre, un bloc `## Metadata` indique le **mode** du deck (Freeform ou
Deckbuilding) et, en construction de deck, le **camp** et la **longueur de partie** — ces
valeurs préremplissent la fenêtre d'import quand ce fichier est recollé. La sévérité
(tournoi/casual) n'y figure pas : la fenêtre d'import ne propose aucun réglage pour la
restaurer.

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
- `web/src/lib/rules/` — moteur de règles pur (validation en mode Construction de deck) ;
  chaque règle cite sa clause, voir la page « Règles et modes » dans l'app
- `web/public/` — assets statiques servis tels quels : `cards.json`, `card-backs/`,
  `proxy-patches/`, `_redirects`
- `docs/superpowers/` — specs et plans d'implémentation, datés
- `scripts/` — outillage hors build (génération des patchs proxy)

### Pour contribuer (ou pour un assistant IA)

- [`CLAUDE.md`](CLAUDE.md) — conventions du projet et table de routage vers la doc technique.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **la mémoire technique du projet** :
  architecture, décisions datées, invariants, pièges, état des fonctionnalités, dettes
  connues. À lire avant de modifier quoi que ce soit, et **à mettre à jour dans le même
  commit** que le changement.
