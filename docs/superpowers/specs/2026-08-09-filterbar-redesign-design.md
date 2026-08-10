# FilterBar : nettoyage skills, réordre, unique en multiselect, tri configurable

Date : 2026-08-09

## Contexte

`FilterBar.jsx` liste actuellement les facets dans un ordre ad hoc, inclut
"Ally" (un artefact de données, pas une vraie compétence jouable) dans le
menu skills, traite "unique" comme un simple toggle bouton au lieu d'un
facet cohérent avec le reste, et ne propose aucun contrôle de tri — les
cartes s'affichent toujours dans l'ordre naturel du JSON (set + card_id).

## 1. Retirer "Ally" du menu skills

`App.jsx` (autour de la ligne 99) construit `derivedFacets.skills` via
`baseOptions(cards, 'skills')`. On filtre `"Ally"` du résultat avant de
l'assigner :

```js
skills: baseOptions(cards, 'skills').filter((v) => v !== 'Ally'),
```

Les cartes gardent leur tag `Ally` en interne (`cardTags`), donc le
filtrage par tag continue de fonctionner si jamais il est réutilisé
ailleurs — seul le menu déroulant du filtre skills ne le propose plus.

## 2. Réordre des filtres

Dans `FilterBar.jsx`, la séquence des appels `facet(...)` (bloc
`filterbar-bottom`) passe de l'ordre actuel :

```
sets, types, alignments, rarities, artists, races, subtypes, skills, keywords
```

au nouvel ordre :

```
sets, alignments, types, subtypes, keywords, races, skills, artists, rarities
```

suivi de `unique` (converti en facet, voir §3) puis du bouton reset.

## 3. "Unique" en multiselect (facet à deux valeurs)

Remplacer le bouton `chip-toggle` actuel par une `FacetDropdown` standard
avec deux options fixes : `'true'` et `'false'` (chaînes, pas des
booléens — `FacetDropdown`/`sortFacetOptions` travaillent sur des
tableaux de valeurs comparées par `includes`).

- `filters.unique` devient un tableau (`[]`, `['true']`, `['false']`, ou
  `['true', 'false']` si les deux sont cochées — dans ce cas le filtre
  n'exclut rien, comme n'importe quel autre facet à choix multiple).
- Les valeurs internes restent les chaînes `'true'`/`'false'` (comparées
  par `includes`), mais le menu doit afficher "Unique" / "Non-unique",
  jamais les chaînes brutes. `FilterBar.jsx` a déjà ce mécanisme pour
  `sets` et pour `types`/`alignments`/`races` (fonction `optionLabel`,
  ligne ~128) : on y ajoute une entrée pour `'unique'` qui mappe
  `'true' → t('filter.uniqueYes')` et `'false' → t('filter.uniqueNo')`
  (nouvelles clés i18n dans les trois langues). L'ordre `['true', 'false']`
  reste fixe via le paramètre `order` de `sortFacetOptions`, déjà
  supporté par `FacetDropdown`.
- `filterCards` (`lib/filter.js`) : remplacer
  `if (filters.unique === true && a.unique !== true) return false;`
  par un `tagMatch`-style check :
  ```js
  if (has(filters.unique) && !filters.unique.includes(String(a.unique === true))) return false;
  ```
- `anyActive` dans `FilterBar.jsx` : `filters.unique` passe du test
  booléen à `(filters.unique || []).length` comme les autres facets — on
  l'ajoute simplement à la liste `['sets', 'types', ...]` déjà itérée.
- Le bouton `chip-toggle` `unique` et son style associé disparaissent du
  JSX (le CSS générique `.chip-toggle` reste utilisé ailleurs, donc pas de
  suppression de règle CSS nécessaire).

## 4. Tri configurable

### Modèle de données

Nouvel état dans `App.jsx`, séparé de `filters` (le reset des filtres ne
doit **pas** toucher au tri) :

```js
const [sortBy, setSortBy] = useState({ primary: 'sets', secondary: null });
```

Clés disponibles (identiques pour les deux sélecteurs) :

| clé        | libellé menu     | valeur comparée                                  |
|------------|-------------------|---------------------------------------------------|
| `sets`     | Set               | `c.setCode`                                        |
| `types`    | Type              | `c.type` (ordre `TYPE_ORDER`, pas alpha)           |
| `subtypes` | Sous-type         | premier tag de `cardTags(c, 'subtypes')`           |
| `alignments`| Alignement      | `c.alignment`                                      |
| `races`    | Race              | premier tag de `cardTags(c, 'races')`              |
| `skills`   | Compétence        | premier tag de `cardTags(c, 'skills')`             |
| `rarities` | Rareté            | `c.rarity`                                         |
| `artists`  | Artiste           | `c.artist`                                         |
| `name`     | Nom               | `c.name[lang]` (langue d'affichage courante)       |

Le 2e sélecteur propose en plus une option `null` = "Aucun" (pas de 2e
critère, seul `card_id` départage). Le 2e sélecteur retire de sa liste
la clé déjà choisie en 1er (pas de doublon primary===secondary).

### Fonction de tri

Nouvelle fonction dans `lib/filter.js` :

```js
// Comparateur générique pour une clé de tri : type suit TYPE_ORDER (ordre
// de jeu, pas alpha), les autres clés comparent le libellé localisé
// affiché (comme sortFacetOptions) sauf `name`, qui compare directement
// la chaîne déjà dans la langue d'affichage.
export function sortCards(cards, { primary, secondary }, { lang, t } = {}) { ... }
```

`sortCards` retourne une copie triée. Comparateur : `primary`, puis
`secondary` si fourni, puis `c.id` (qui porte déjà set+numéro, donc un
tiebreak stable même si `primary`/`secondary` ignorent le set).

Note : `c.id` seul suffit comme tiebreak universel (il encode déjà
set+numéro), donc pas besoin de rappeler `setCode` explicitement dans le
tiebreak — juste `c.id` en dernier, avec un comparateur naturel
(`localeCompare` avec l'option `numeric: true` pour que "AS-2" précède
"AS-10").

### Application

`CardBrowser.jsx` : après `filterCards`, avant `.slice(0, CAP)` :

```js
const sorted = useMemo(() => sortCards(filtered, sortBy, { lang, t }), [filtered, sortBy, lang, t]);
```

`sortBy` et `t` (pour les libellés localisés utilisés en tiebreak alpha)
descendent depuis `App.jsx` comme nouvelle prop de `CardBrowser`.

### UI

Nouveau composant `SortPicker` dans `FilterBar.jsx`, positionné en tout
premier dans `filterbar-bottom` (avant `sets`), pour rester visible même
si l'utilisateur n'ouvre pas les autres facets — c'est un réglage
d'affichage, pas un filtre actif/inactif au même sens.

- Bouton déclencheur : réutilise le style `.facet button` existant,
  libellé `t('filter.sortBy')`, actif visuellement (`active` class) dès
  que `secondary !== null` (le primaire seul == comportement par défaut,
  donc pas marqué "actif").
- Menu (`.facet-menu`) : deux `<select>` natifs empilés verticalement
  (compact sur mobile, pas de double dropdown côte à côte qui
  déborderait à 320px) :
  - Select 1 : "1er critère", options = les 9 clés du tableau ci-dessus.
  - Select 2 : "2e critère", options = "Aucun" + les 8 clés restantes
    (celle du select 1 exclue).
- Pas de bouton de validation : chaque `onChange` met à jour `sortBy`
  immédiatement (cohérent avec le reste de la barre, qui est tout en
  live-update).
- Le composant utilise le même `openKey`/`onToggle` que les autres
  facets (un seul menu ouvert à la fois, fermeture au clic extérieur/Esc
  — mécanisme déjà générique dans `FilterBar`).

### Reset

Le bouton "Réinitialiser les filtres" (`onChange({})`) ne touche que
`filters`. `sortBy` vit dans un état React séparé (`App.jsx`) avec son
propre setter, jamais réinitialisé par ce bouton. Pas de bouton reset
dédié pour le tri dans ce scope (YAGNI — l'utilisateur re-choisit "Set"
en 1er critère et "Aucun" en 2e s'il veut revenir au défaut).

## Tests

- `filter.test.js` (ou nouveau `sort.test.js`) : `sortCards` avec
  primary seul, primary+secondary, tiebreak sur `c.id`, cas `types`
  respectant `TYPE_ORDER` plutôt que l'alphabétique.
- `filter.test.js` : `filterCards` avec `filters.unique` en tableau
  (`['true']`, `['false']`, `[]`, les deux valeurs).
- Test existant sur `anyActive`/reset (si présent) à vérifier : le reset
  ne doit pas affecter `sortBy` — test au niveau `App` ou `FilterBar` si
  la logique de reset y est déjà couverte.
- Vérifier qu'aucun test i18n/vocabulaire (`test/i18n.test.js`) ne casse
  avec les nouvelles clés `filter.uniqueYes`, `filter.uniqueNo`,
  `filter.sortBy`, et les libellés des 9 clés de tri (peuvent réutiliser
  les clés `filter.set`, `filter.type`, etc. déjà existantes plutôt que
  d'en créer de nouvelles).

## Hors scope

- Pas de direction de tri (croissant/décroissant) — toujours ascendant.
- Pas de persistance du tri en `localStorage` (contrairement à
  `proxyMode`) : sauf demande explicite, il repart à "Set" au rechargement.
- Pas de 3e critère de tri.
