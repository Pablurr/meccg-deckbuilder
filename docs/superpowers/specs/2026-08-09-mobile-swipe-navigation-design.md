# Mobile: swipe navigation dans la modale de carte

Date : 2026-08-09

## Problème

Sur mobile, `CardPreviewModal` (`web/src/components/CardPreviewModal.jsx`) ouvre une
carte en plein écran avec les curseurs +/- de quantité par zone. Pour voir la carte
suivante ou précédente, l'utilisateur doit fermer la modale et retaper une nouvelle
tuile. On veut un swipe gauche/droite qui navigue directement, dans deux contextes :

- **Sélecteur de cartes** (`CardBrowser.jsx`) : carte suivante/précédente dans la liste
  filtrée actuellement affichée.
- **Panneau de deck** (`DeckPanel.jsx`) : carte suivante/précédente dans la zone/onglet
  actif du deck.

## Comportement

- Swipe horizontal (delta > seuil, mouvement vertical faible) → navigue.
- En bout de liste (première/dernière carte) : le swipe ne fait rien (pas de
  wrap-around).
- Dans le panneau de deck, la liste groupée par type de carte (héros, allié, item…)
  est traversée en continu : les titres de groupe sont ignorés, le swipe passe d'un
  groupe à l'autre sans s'arrêter.
- La liste de navigation est figée au moment de l'ouverture de la modale. Si les
  filtres ou le contenu du deck changent pendant que la modale est ouverte (cas rare),
  la navigation continue sur l'ancienne liste plutôt que de se recalculer.

## Conception

**État de navigation porté par `App.jsx`.**

- `App.jsx` ajoute un état `previewList` (tableau de cartes, pas juste d'ids) à côté de
  `previewCard`.
- `onPreview` passe de `(card) => void` à `(card, list) => void` partout où il est
  câblé : `CardBrowser` fournit `shown` (la liste filtrée/plafonnée qu'il affiche
  déjà), `DeckPanel` fournit les cartes de `groups` aplaties dans l'ordre d'affichage
  de l'onglet/zone actif (`activeZone`).
- `App.jsx` calcule l'index courant (`previewList.findIndex(c => c.id ===
  previewCard.id)`) et fournit à `CardPreviewModal` un handler `onNav(delta)` qui fait
  `setPreviewCard(previewList[index + delta])`, no-op si hors bornes.
- `CardPreviewModal` gagne un listener tactile (`onTouchStart`/`onTouchEnd`) sur la
  zone image (`.card-modal-imgwrap`), pas sur la barre de contrôle ni le backdrop
  entier — la barre doit continuer à ne réagir qu'aux clics des boutons, et le
  backdrop doit continuer à fermer la modale au tap simple. Seuil de swipe ~50px
  horizontal, avec un delta vertical toléré faible pour ne pas confondre swipe et
  scroll accidentel.
- Aucune dépendance ajoutée (pas de lib de gestes) ; implémentation avec les événements
  tactiles natifs React.

## Hors périmètre

- Pas d'animation de transition entre cartes (juste un remplacement d'image, comme un
  nouvel appel à `setPreviewCard` aujourd'hui).
- Pas de swipe vertical, pas de pincer-zoomer.
- Pas de recalcul dynamique de la liste si les filtres/le deck changent pendant que la
  modale reste ouverte.
