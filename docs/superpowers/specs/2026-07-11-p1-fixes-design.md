# Lot P1 — corrections prioritaires — design

Date: 2026-07-11

Trois corrections issues de la revue du 2026-07-11 : deux bugs UX et une grosse
économie de bande passante. Aucune ne touche le format d'export ni le schéma des
données ; toutes sont locales à des composants front + `lang.js` + `i18n.js`.

## 1. Confirmation avant suppression d'un deck

**Problème.** `web/src/components/DeckManager.jsx` supprime le deck dès le clic
sur « Suppr. » (`remove(id)` → `api.deleteDeck` → réécriture localStorage,
irréversible). Incohérent avec le retrait d'*une carte* du deck, qui lui demande
confirmation (`DeckPanel.jsx` → `MiniCard`).

**Solution.** Confirmation *inline* dans la ligne du deck, sur le modèle exact de
`MiniCard` (pas de nouvelle modale). Un état local `confirmId` (l'id du deck en
attente de confirmation, ou `null`).

- Clic sur « Suppr. » → `setConfirmId(d.id)` (ne supprime rien).
- Quand `confirmId === d.id`, la ligne remplace les trois boutons
  Charger/Dupliquer/Suppr. par : un libellé d'avertissement + bouton
  **Supprimer** (classe `btn danger small`) qui appelle l'actuel `remove(id)`,
  et bouton **Annuler** (`btn secondary small`) qui fait `setConfirmId(null)`.
- Après suppression effective : `setConfirmId(null)` puis `refresh()`.
- Ouvrir la confirmation d'un autre deck remplace la précédente (un seul
  `confirmId` à la fois).

**i18n** (`web/src/lib/i18n.js`, blocs fr *et* en, pour la parité) : une clé
`decks.confirmDelete` avec paramètre `{name}` —
fr « Supprimer « {name} » ? », en "Delete “{name}”?".
Le bouton de confirmation réutilise `panel.remove` (« Supprimer » / "Remove") ;
l'annulation réutilise `common.cancel`.

## 2. Volet deck : miniatures + survol plein format

**Problème.** `MiniCard` (`DeckPanel.jsx`) charge `cardImageSrc` — l'image CDN
plein format (~400 Ko JPEG/PNG par carte) — alors que la grille principale sert
déjà des miniatures WebP via le proxy wsrv.nl (~9× plus légères, commit
`48e25f3`). Un deck de 100 cartes au zoom par défaut (50 %) télécharge des
dizaines de Mo inutiles.

Mais le plein format servait aussi à **lire** chaque carte dans le volet. Passer
à des miniatures seules dégraderait la lisibilité aux zooms bas. On préserve donc
la lisibilité par deux moyens complémentaires.

### 2a. Miniatures à résolution suivant le zoom

`MiniCard` utilise `cardThumbSrc` (proxy wsrv.nl, WebP) au lieu de
`cardImageSrc`. Le volet a un zoom réglable (15 → 100 % de la largeur source
570 px, soit ~85 → 570 px affichés). Pour garder des images nettes à tout zoom
*sans* refetcher à chaque cran du slider, la largeur demandée au proxy est
**quantifiée par paliers de 100 px et plafonnée à 570 px** :

```
deckThumbWidth(cardW) = min(570, max(200, ceil(cardW / 100) * 100))
```

Conséquence directe : **à 100 % de zoom la miniature fait 570 px = la largeur
native de la source, donc lisible sans perte** ; aux zooms bas la miniature est
volontairement plus petite (c'est le gain de bande passante). Le nombre d'URLs
distinctes est borné à ~5 variantes (200/300/400/500/570), toutes mises en cache
par wsrv.nl. `deckThumbWidth` est une fonction pure ajoutée à
`web/src/lib/lang.js` (testée).

Chaîne de repli (identique à `CardBrowser`, `onError` sur le `<img>`) : miniature
localisée → miniature anglaise → plein format anglais.

```
const chain = [...new Set([
  cardThumbSrc(card, lang, w),
  cardThumbSrc(card, 'en', w),
  cardImageEn(card),
].filter(Boolean))];
const next = chain[chain.indexOf(el.getAttribute('src')) + 1];
if (next) el.src = next;
```

Câblage : `DeckPanel` calcule déjà `cardW` (ligne 94) ; il calcule
`const thumbW = deckThumbWidth(cardW)` et le passe en prop à chaque `MiniCard`.

### 2b. Survol plein format dans le volet (lisibilité à tout zoom)

Pour lire une carte précise sans monter le zoom, `MiniCard` gagne le **même
survol plein format que la grille principale** : après ~600 ms d'immobilité du
curseur sur une carte, une prévisualisation 570×796 en plein format CDN apparaît
près du curseur. C'est indispensable puisque, hors zoom 100 %, la miniature
inline n'est pas assez fine pour lire le texte.

Cette logique existe déjà dans `CardBrowser` (~60 lignes : timer d'inactivité,
positionnement/flip près du curseur, annulation au scroll). Pour éviter de la
dupliquer, elle est **extraite telle quelle** dans un module partagé
`web/src/components/CardPreview.jsx` qui exporte :

- `useCardPreview(lang)` — le hook : détient les refs (`previewRef`,
  `previewImgRef`, `timerRef`, `shownIdRef`, `posRef`), les constantes
  (`PREVIEW_W=570`, `PREVIEW_H=796`, `PREVIEW_DELAY_MS=600`), et les fonctions
  `positionPreview`/`showPreview`/`hidePreview`/`trackPointer` + le `useEffect`
  d'annulation au scroll (`wheel`/`scroll` capture). `showPreview` construit la
  source via `cardImageSrc(c, lang)` avec repli `cardImageEn` sur `onerror`.
  Retourne `{ previewRef, previewImgRef, trackPointer, hidePreview }`.
- `CardPreview` — l'élément boîte partagé :
  `<div className="card-preview" ref={previewRef} …><img ref={previewImgRef} …/></div>`.

`CardBrowser` est refactoré pour *consommer* ce module (comportement strictement
identique : mêmes handlers `onMouseEnter/onMouseMove/onMouseLeave`, même
`<CardPreview>` en fin de rendu). Aucune régression attendue ; à vérifier
manuellement.

`DeckPanel` appelle `useCardPreview(lang)`, rend un `<CardPreview>` unique, et
passe `trackPointer`/`hidePreview` en props à chaque `MiniCard`, qui les câble
sur son `<img>` (en plus de l'`onClick` de retrait et de l'`onError` de repli
déjà présents). La boîte se positionne près du curseur et bascule à gauche quand
elle déborderait à droite (`positionPreview` gère déjà ce cas), ce qui convient
au volet ancré à droite. Le scroll du corps du volet est capté par le listener
`window … capture:true` du hook, donc la preview s'annule au défilement comme
dans la grille.

*Hors périmètre* : le volet « maximisé » (déjà géré par le zoom/redimensionnement)
et les exports ZIP/PDF continuent d'utiliser le plein format / 300 DPI —
inchangés. Le style `.card-preview` existe déjà dans `styles.css` et est
réutilisé tel quel.

## 3. Upload d'un dos de carte : gestion d'erreur

**Problème.** `ExportDialog.jsx` → `pickBack` appelle `api.uploadBack(file)` sans
`try/catch`. `uploadBack` fait `createImageBitmap(file)`, qui **rejette** si le
fichier n'est pas une image décodable (`accept="image/*"` n'est qu'indicatif :
un `.svg`, un fichier corrompu ou renommé passe le filtre). Résultat : rejet de
promesse non géré, aucun retour à l'utilisateur, l'ancien dos reste en place
silencieusement.

**Solution.** Envelopper le corps de `pickBack` dans `try/catch`. En cas
d'échec, afficher un message via l'état `error` *déjà présent* dans le composant
(rendu ligne 171, `{error && …}`). Ne pas modifier `backs` en cas d'échec.

```js
async function pickBack(group, file) {
  if (!file) return;
  setError(null);
  try {
    const { path } = await api.uploadBack(file);
    const next = { ...backs, [group]: path };
    setBacks(next);
    onBacksChange(next);
  } catch {
    setError(t('export.back.uploadError'));
  }
}
```

**i18n** (blocs fr *et* en) : clé `export.back.uploadError` —
fr « Image illisible — choisis un autre fichier. »,
en "Unreadable image — pick another file.".

## Tests

Suivant la convention du repo (les modules `lib/` purs sont testés en Vitest ;
le comportement des composants React est vérifié manuellement — pas de
React Testing Library dans le projet) :

- **`test/lang.test.js`** (modifié) : ajouter un bloc `deckThumbWidth` —
  paliers de 100 px, plancher 200, plafond 570, arrondi supérieur.
- **`test/i18n.test.js`** (existant, inchangé) : le test de parité fr/en des clés
  valide automatiquement l'ajout de `decks.confirmDelete` et
  `export.back.uploadError` dans les deux langues (il échoue si une clé manque
  d'un côté). Aucun nouveau cas à écrire.
- **Vérification manuelle** (via `npm run dev` + navigateur) :
  - Item 1 : « Suppr. » ouvre la confirmation inline ; Annuler la ferme sans
    rien supprimer ; Supprimer retire bien le deck de la liste.
  - Item 2a : les cartes du volet se chargent en WebP wsrv.nl (onglet réseau) ;
    monter le zoom à 100 % recharge une variante 570 px nette.
  - Item 2b : la grille principale conserve exactement son survol (non-régression
    après extraction) ; le volet deck affiche désormais le même survol plein
    format après ~600 ms d'immobilité, annulé au scroll.
  - Item 3 : choisir un fichier non-image comme dos affiche le message d'erreur
    sans modifier le dos courant.

## Hors périmètre

Les points P2/P3 de la revue (lazy-load de jszip/pdf-lib, montée de version
vite/vitest, headers de sécurité Cloudflare, validation des decks chargés, etc.)
ne sont pas traités ici. Aucun refactoring non lié.
