# 09. Mécaniques transverses (Agents, Under-deeps, Prisonniers, Manifestations)

Ce fichier couvre des mécaniques introduites par **Dark Minions (MEDM)** qui s'appliquent (avec des variantes) à travers tous les camps, plus complétées par MELE/MEBA. Source : livret MEDM complet (aucune troncature).

## Les Agents

Un agent a les mêmes attributs qu'un personnage (race, compétences, direct influence, prowess, body, mind, MP, capacités spéciales), mais **fonctionne seul** (pas de compagnie) et se comporte comme un hazard qui agit comme une créature.

### Comment un agent est traité selon le camp (rappel synthétique)
- **Wizard** : l'agent compte comme une carte **hazard** (pas personnage) pour la construction de deck et partout ailleurs.
- **Ringwraith / Fallen-wizard** : l'agent compte **à la fois** comme personnage et comme hazard pour la construction de deck, jusqu'à ce qu'il soit joué comme l'un ou l'autre.
- **Balrog** : l'agent compte **uniquement comme hazard**, jamais comme personnage — il ne peut pas être joué comme personnage.
- Limite commune : le total des mind de tous les agents (play deck + sideboard) ne peut pas dépasser **36**.

### États possibles d'un agent
Face-cachée+non-tapé, face-cachée+tapé, face-visible+non-tapé, face-visible+tapé, ou face-visible+blessé. Un agent est toujours unique (un doublon révélé est immédiatement défaussé).

### Cycle de vie
- **Jouer un agent** : posé face-cachée et non-tapé, considéré à l'un quelconque de ses home sites (pas besoin de carte de site tant qu'il n'a pas bougé/été révélé). Compte 1 contre la hazard limit.
- **Untap** : chaque agent se dégage à l'untap phase de son propriétaire.
- **Actions d'agent** (une seule par tour, uniquement pendant la movement/hazard phase adverse, compte 1 contre la hazard limit) : se déplacer vers un site non-Haven/non-Under-deeps dans la même région ou une région adjacente (nécessite Region Movement/pas en Starter Rules) ; retourner à son home site ; taper pour rendre certaines créatures jouables sur son site (voir ci-dessous) ; guérir (blessé → tapé) ; se dégager (tapé → non-tapé) ; se retourner face-cachée (avec sa carte de site).
- **Révéler un agent** : possible à tout moment pendant la movement/hazard phase adverse (ne compte pas contre la hazard limit) ; obligatoire s'il attaque, influence, ou si une carte l'exige. Le premier site joué doit être cohérent avec son parcours (home site ou région adjacente) sous peine d'être immédiatement défaussé.
- **Jouer des créatures via un agent** : si l'agent et une compagnie adverse sont au même site (Ruins & Lairs/Shadow-hold/Dark-hold, ou le home site de l'agent), il peut taper pour permettre de jouer certaines créatures hazard hors-clé habituelle, selon le type de site (ex. Orcs/Nazgûl/Trolls à un Ruins & Lairs ; +Undead à un Shadow-hold ; etc.).
- **Attaquer avec un agent** : pendant la site phase adverse, si l'agent est au même site qu'une compagnie qui décide d'entrer, il attaque juste après les automatic-attacks (se révèle si besoin). **Une attaque d'agent contre un minion est toujours du detainment.**
- **Résolution de combat avec un agent** : la prowess de chaque strike de l'agent est modifiée par un roll séparé (2D6) ; -2 si blessé ; +2 si face-cachée hors de son home site au moment de l'attaque ; +5 prowess/+1 body si face-cachée à son home site ; +2 prowess/+1 body si face-visible à son home site. Un agent n'est pas un personnage : les ressources qui modifient la prowess d'un personnage ne s'appliquent pas à lui.
- **MP d'un agent vaincu** : seul l'**adversaire** du joueur de l'agent reçoit les MP (comptés comme kill points, pas character points). Si le propriétaire lui-même le fait "perdre", l'agent est retiré du jeu sans MP pour personne.
- **Influencer avec un agent** : certaines cartes le permettent (allié/faction/follower/personnage), en utilisant la direct influence non utilisée de l'agent (+2 s'il est à son home site), sans possibilité d'utiliser des ressources d'assistance (pas de révélation de carte identique, pas de Muster...).

## Le réseau Under-deeps (introduit par MEDM, exploité surtout par le Balrog — voir fichier 08)

- Chaque site Under-deeps est situé **sous** un autre site (son "surface site"), et non dans une région classique.
- Au lieu d'un "nearest Haven", chaque site Under-deeps liste ses **sites adjacents** (toujours son surface site en premier, plus d'autres sites Under-deeps).
- Pas d'Eagle-mounts/Gwaihir vers/depuis l'Under-deeps. Pas de site path pour une compagnie qui y entre/sort (donc les hazards ne peuvent être "keyed" qu'au nouveau site directement, pas à une région). Les cartes "environment" qui changent le type de site ne fonctionnent pas sur l'Under-deeps.
- Bonus notable : à un site Under-deeps, l'item supplémentaire jouable après une ressource réussie n'est pas limité aux items mineurs — n'importe quel item jouable au site peut être choisi.
- Les MP d'une compagnie en Under-deeps ne comptent **pas** pour convoquer le Free Council/l'Audience with Sauron (sauf pour un joueur Balrog, cf. fichier 08).
- **Mouvement Under-deeps** : depuis le surface site vers l'Under-deeps, aucun roll nécessaire. Depuis un site Under-deeps vers un site adjacent : roll 2D6 ≥ un seuil indiqué entre parenthèses sur la carte ; échec = retour au site d'origine (comme si la compagnie n'avait pas bougé).

## Manifestations

Certaines entités (le Balrog, Gollum, Lobelia...) ont plusieurs cartes différentes les représentant ("manifestations"). Si une manifestation est en jeu, aucune autre manifestation de la même entité ne peut être jouée. Si une attaque d'une manifestation est vaincue, l'entité est retirée du jeu et plus aucune manifestation de cette entité ne peut être jouée par personne. **Exception** : plusieurs manifestations d'un même Dragon unique peuvent être en jeu simultanément.

## Prise de prisonniers et sauvetage

Certains hazard permanent-events ("hazard hosts") capturent un personnage : il quitte sa compagnie, est placé "off to the side" sous le hazard host, avec un **rescue site** pris dans le location deck de l'attaquant (règles de placement selon le type de mouvement de la compagnie visée). Un personnage prisonnier ne peut agir ni être affecté par rien (sauf cartes spécifiques), n'est plus contrôlé (ses followers repassent en general influence à réconcilier), et ses items/alliés/events sont défaussés (sauf un anneau qu'il porte, qui reste avec lui). **Un prisonnier donne des MP négatifs égaux à sa valeur normale** à son propre camp ; s'il est éliminé en captivité, ces MP négatifs deviennent permanents.

**Sauver un prisonnier** : la compagnie de son propriétaire doit être au rescue site pendant sa site phase, affronter les automatic-attacks normaux puis un éventuel **rescue-attack** (pas un automatic-attack), puis un personnage non-tapé peut taper pour libérer tous les prisonniers sous ce hazard host (ils rejoignent la compagnie en general influence, à réconcilier au tour suivant) ; le site tape ensuite et un item mineur peut être joué en plus.

## Autres clarifications transverses issues de MEDM

- **Permanent-events** : si une compagnie se scinde, ses resource permanent-events peuvent être répartis librement entre les compagnies résultantes (sauf mention contraire type *Fellowship*). Impossible de faire une tentative d'influence sur un item porteur d'un permanent-event.
- **Cartes "off to the side"** : ne peuvent être ciblées que par des effets qui le permettent explicitement ; comptent comme "en jeu" pour l'unicité ; en général rapportent leurs MP à leur propriétaire sauf mention contraire (les cartes de capture de prisonniers font exception, elles rapportent des MP négatifs).
- Une créature jouée comme **automatic-attack** est défaussée si vaincue (jamais placée en pile de MP de l'adversaire).
