# 03. Déroulement d'une partie (base pédagogique pour débutant)

Cette section condense la logique du jeu en 2 decks (longueur "Short/Standard", la référence pour apprendre), à partir du "MECCG Rules Summary" et des règles officielles CoE. Objectif : donner une structure mentale claire ; les règles officielles ajoutent ensuite des centaines de cas particuliers (voir fichier 04) mais **la charpente ci-dessous ne change pas**.

## Objectif du jeu

Chaque joueur incarne un camp (fichier 02) et gagne des **marshalling points (MP)** en jouant des ressources (items, alliés, factions...) ou en tuant des créatures/personnages adverses ("kill MPs"). Le jeu se termine quand :
1. L'avatar d'un joueur (son Mage ou son Ringwraith) est **éliminé** → victoire automatique de l'adversaire (en tournoi : la partie continue mais le joueur éliminé perd 5 MP et ne peut plus révéler d'avatar) ; **ou**
2. Un joueur **convoque le conseil** (le "Free Council" pour un Wizard, l'"Audience with Sauron" pour un Ringwraith) après avoir épuisé son play deck une ou deux fois, avec au moins 25 MP si convoqué après le premier épuisement ; **ou**
3. Un joueur gagne en **détruisant l'Anneau Unique** (Cracks of Doom, A New Ringlord...) côté Hero, ou en l'apportant à Sauron côté Minion — victoire alternative indépendante du score de MP.

Au décompte, si l'adversaire n'a aucun point dans une catégorie (hors kill/divers), on peut doubler ses propres points dans cette catégorie — mais pas plus de la moitié du total ne peut venir d'une seule catégorie.

## Les 4 types de cartes

- **Sites** — cartes de lieu (fond de carte de Middle-earth au dos). Elles ne se piochent pas au hasard : on les choisit dans son "location deck". Les Havens/Darkhavens sont des sites spéciaux (icône étoile) où l'on soigne les personnages et stocke des items.
- **Characters** — personnages (hero pour un Wizard, minion pour un Ringwraith/Balrog).
- **Resources** — ressources : items, alliés (allies), factions, informations... Elles rapportent des MP.
- **Hazards** — créatures et événements que l'adversaire joue contre vos compagnies pendant votre tour.

## Mise en place

1. Séparer ses cartes en 4 paquets : **location deck** (sites), **play deck** (ressources/hazards/personnages, mélangé, pioché au hasard), **sideboard** (réserve consultable en cours de partie), **pool** (jusqu'à 10 personnages de départ + 2 items mineurs).
2. Déclarer son camp, puis (pour Fallen-wizard) l'avatar précis.
3. **Draft de personnages** : chaque joueur révèle secrètement un personnage de son pool à tour de rôle ; s'ils sont identiques, on les écarte ; sinon chacun le joue. On s'arrête à 5 personnages de départ (6 pour Ringwraith/Balrog) ou 20 points de "mind" cumulés, ou pool épuisé.
4. Placer son site de départ (Rivendell pour un Wizard ; Minas Morgul et/ou Dol Guldur pour un Ringwraith ; Moria et/ou Under-gates pour un Balrog).
5. Mélanger le play deck, le faire couper par l'adversaire, piocher une main de 8 cartes.
6. Chaque joueur lance 2D6 ; le plus haut score commence.

## La séquence de tour (6 phases)

À votre tour, vous êtes le **resource player** (vous jouez ressources/personnages) ; votre adversaire est le **hazard player** (il ne peut jouer que des hazards, et seulement pendant votre phase Movement/Hazard). Les rôles s'inversent au tour suivant.

### 1. Untap Phase
- Dégagez ("untap") vos personnages et cartes tapées.
- Un personnage blessé ("wounded") présent sur un Haven/Darkhaven guérit : il passe de "blessé" à "tapé" (il redeviendra utilisable au tour suivant).
- Les sites ne se dégagent jamais tant qu'ils restent en jeu.
- Si votre avatar est en jeu, l'adversaire peut ici piocher dans son sideboard (jusqu'à 5 hazards vers sa défausse, ou 1 directement dans son play deck) — mais cela **divise par deux** la limite de hazards qu'il pourra jouer contre vous ce tour.

### 2. Organization Phase
Dans l'ordre de votre choix :
- Jouer un nouveau personnage (à un Haven/site d'origine) ou révéler votre avatar (à Rivendell/site d'origine, ou Minas Morgul/Dol Guldur pour un Ringwraith).
- Réorganiser vos compagnies (une **company** = un groupe de personnages qui bouge comme une unité ; taille max 7 hors Haven, illimitée sur un Haven).
- Transférer ou stocker des items (nécessite un **corruption check** réussi par le porteur).
- Placer une nouvelle carte de site (face cachée) pour chaque compagnie qui va se déplacer.

Chaque personnage est contrôlé soit par la **general influence** (20 points au départ, moins le "mind" cumulé des personnages contrôlés ainsi), soit par la **direct influence** d'un autre personnage (il devient alors son "follower").

**Déplacement** : deux méthodes principales — *Starter Movement* (entre un Haven et le site le plus proche listé sur la carte, ou entre deux Havens reliés) et *Region Movement* (jusqu'à 4 régions consécutives). Les Ringwraiths ne peuvent pas utiliser Region Movement ni traverser de région maritime.

### 3. Long-event Phase
- Défausser ses propres resource long-events en jeu.
- Jouer de nouveaux resource long-events (c'est le seul moment où on peut les jouer).
- L'adversaire défausse ses hazard long-events en jeu.

### 4. Movement/Hazard Phase (une fois par compagnie)
Pour chaque compagnie, dans l'ordre choisi :
1. Révéler le nouveau site (s'il y a déplacement) ; sinon la compagnie reste sur place mais effectue quand même cette phase.
2. Déterminer la **hazard limit** de la compagnie = taille de la compagnie ou 2, le plus grand des deux (arrondi ; divisé par deux si l'adversaire a pioché son sideboard à l'Untap Phase).
3. Les deux joueurs peuvent piocher des cartes selon les chiffres indiqués sur le site (au moins 1 chacun si un personnage de "mind" ≥ 3 ou l'avatar est présent).
4. Le **hazard player** joue des hazards contre la compagnie, jusqu'à atteindre la hazard limit :
   - **Créatures**, "keyed" (associées) à un type de région/site du trajet ou du site d'arrivée.
   - **Événements hazard** (short/long/permanent-event).
   - Une carte posée **"on-guard"** (face cachée sur le site d'arrivée, n'importe quel type de carte), qui pourra être révélée plus tard (avant un automatic-attack, ou quand une ressource va taper le site).
5. Fin de la phase : si la compagnie a bougé, son site d'origine retourne au location deck (ou est défaussé s'il était tapé) ; les deux joueurs réajustent leur main à 8 cartes.

À la fin de toutes les phases Movement/Hazard du tour, les compagnies d'un même joueur présentes sur un même site non-Haven **doivent** fusionner (facultatif sur un Haven).

### 5. Site Phase (une fois par compagnie)
Pour chaque compagnie, décider si elle **entre** sur son site :
1. Affronter les **automatic-attacks** du site, s'il y en a (chaque tour, même si déjà vaincus avant).
2. L'adversaire peut déclarer une attaque d'**agent** présent sur le site.
3. Si la compagnie a un personnage non-tapé et que le site est non-tapé, jouer une ressource : **item**, **allié**, ou **faction** (celle-ci nécessite un "influence check" : 2D6 + direct influence du personnage, à comparer au nombre requis). Cela tape le personnage et le site.
4. Après une ressource réussie qui a tapé le site, un **item mineur supplémentaire** peut être joué par un autre personnage.
5. L'adversaire peut révéler une carte "on-guard" posée sur ce site si la ressource jouée va taper un site non-tapé.

### 6. End-of-Turn Phase
- L'un ou l'autre joueur peut défausser une carte.
- Les deux joueurs ajustent leur main à 8 cartes (pioche ou défausse).
- Les rôles resource/hazard s'inversent pour le tour suivant.

## Combat (résumé)

Une attaque (créature, automatic-attack, agent) se compose d'une ou plusieurs **strikes**, chacune ciblant un seul personnage.
1. Le défenseur assigne d'abord les strikes à des personnages non-tapés de son choix ; l'attaquant assigne les strikes restants ; s'il y a plus de strikes que de personnages, l'excédent devient des malus de -1 en prowess.
2. Pour chaque strike (séquence dans l'ordre choisi par le défenseur) :
   - L'attaquant peut jouer des hazards affectant la strike.
   - Le personnage ciblé prend -1 s'il était déjà tapé, -2 s'il était déjà blessé (ou -3 volontaire pour éviter de se taper).
   - Un autre personnage non-tapé de la compagnie peut se taper pour donner +1 en soutien.
   - Le défenseur peut jouer une ressource affectant la strike (une seule "skill" par strike).
   - Le défenseur lance 2D6 + prowess modifié, comparé à la prowess de la strike :
     - **Résultat supérieur** → la strike échoue ; le personnage est tapé (sauf -3 volontaire) ; un **body check** est fait contre la strike elle-même (l'attaque est vaincue si le body check échoue, ou automatiquement si l'attaque n'a pas de "body").
     - **Résultat égal** → strike inefficace, rien ne se passe (le personnage est quand même tapé).
     - **Résultat inférieur** → strike réussie : le personnage est **blessé** et doit faire un **body check** (sauf attaque "detainment", auquel cas il est juste tapé, sans body check).
3. **Body check** : l'adversaire (celui qui ne contrôle pas l'entité) lance 2D6 (+1 si déjà blessé) contre le "body" du personnage/de la créature. Échec → élimination (personnage retiré définitivement) ou destruction (créature envoyée en pile de MP du défenseur si toutes les strikes de l'attaque sont vaincues).

**Detainment** : certaines attaques (indiqué sur la carte, tous les Nazgûl, toute attaque "keyed" à un Dark-domain/Shadow-hold/Dark-hold, ou attaque Orc/Troll/Undead/Man "keyed" à un Shadow-land contre un Minion) tapent au lieu de blesser, et ne provoquent jamais de body check.

**Trophées** : un Orc/Troll qui vainc une strike peut garder la créature vaincue comme trophée (item mineur, 0 corruption), donnant des bonus de direct influence/prowess selon sa valeur en MP.

**Company vs. Company combat** : des compagnies adverses présentes sur le même site (Wizard vs Ringwraith uniquement) peuvent s'attaquer directement, avec des règles d'assignation de strikes similaires mais où les deux joueurs lancent les dés (attaquant puis défenseur), sans jouer de hazards.

## Corruption checks (aperçu)

Chaque personnage a un total de points de corruption (0 par défaut, modifié par certains hazards). Un check de corruption = 2D6 + modificateurs comparé à ce total :
- Résultat supérieur au total → rien.
- Résultat égal ou 1 de moins → le personnage hero échoue et est défaussé (un Wizard est éliminé) ; un personnage minion est simplement tapé.
- Résultat inférieur de 2 ou plus → le personnage est éliminé.
Les Ringwraiths ne font jamais de corruption check.

## Ce qui manque encore dans cette base (voir fichier 04)

Cette synthèse couvre la structure générale et le combat de base. Les règles officielles CoE détaillent aussi, avec de nombreux cas particuliers non repris ici : les **agents** (section 4), les **events courts/longs/permanents** en détail (section 5), les **items et anneaux** (section 6), la **corruption** en détail (section 7), les **influence attempts** (section 8), les règles de **timing/chaînes d'effets** (section 9), et la **fin de partie** en détail (section 10) + le **glossaire** officiel.
