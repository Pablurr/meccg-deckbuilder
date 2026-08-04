# Import par zones, ordre des types, cartes spécifiques — design

**Date :** 2026-08-03
**Branche :** `deck-import-zones` (depuis `dev` @ `84304fe`)

Trois changements dans un même lot. Les deux premiers sont courts et
indépendants ; le troisième est le gros morceau.

---

## 1 — Ordre des types dans le filtre

### Constat

`FacetDropdown` ([`FilterBar.jsx:29`](../../../web/src/components/FilterBar.jsx))
trie **toutes** les facettes sur le libellé affiché, donc l'ordre du menu Type
change avec la langue et n'a aucun rapport avec l'ordre de jeu.

L'ordre demandé — Characters, Resources, Hazards, Sites, Regions — **existe
déjà** : `TYPE_ORDER` dans [`deckList.js:28`](../../../web/src/lib/deckList.js).
Il pilote le regroupement du panneau de deck et de tous les exports.

### Décision

`TYPE_ORDER` **déménage vers `lib/constants.js`** et `deckList.js` le
ré-exporte. Motif : `deckList.js` appartient à la couche export ; importer un
module d'export depuis `FilterBar` coupleraient l'UI à l'export pour une
constante qui n'appartient à aucun des deux. Le ré-export garde tous les
appelants actuels intacts.

`FacetDropdown` gagne une prop **`order` optionnelle** :

- `order` fourni → tri sur la position dans `order` ;
- valeur absente d'`order` → rejetée en fin de liste, triée alphabétiquement
  entre elles (aucun type ne devrait s'y trouver, mais une donnée nouvelle ne
  doit pas disparaître ni se retrouver en tête) ;
- `order` absent → tri alphabétique sur le libellé, **inchangé** pour les huit
  autres facettes.

Seul l'appel `facet('types', …)` passe `order={TYPE_ORDER}`. L'ordre devient
donc identique dans les trois langues, ce qui est exactement la demande.

---

## 2 — Masquer les cartes spécifiques à un autre camp

### Constat

`isLegalForSide` ([`sides.js:131`](../../../web/src/lib/rules/sides.js)) laisse
volontairement passer les cartes `attributes.specific` — son commentaire dit
que le filtre « ne cache jamais ce qu'une règle ne fait que restreindre par
avatar ». Conséquence : les 46 cartes `specific: "Balrog"` s'affichent dans un
deck Spectre, où elles ne sont jouables sous aucun avatar.

`SPECIFIC_TO_SIDES` ([`sides.js:28`](../../../web/src/lib/rules/sides.js))
porte déjà la réponse : `Balrog: ['balrog']`, les cinq sorciers
`['wizard', 'fallen-wizard']`.

### Décision

Une passe supplémentaire dans `isLegalForSide`, **entre** le test d'avatar et
celui d'alignement : si `attributes.specific` est renseigné et que
`SPECIFIC_TO_SIDES[specific]` n'inclut pas le camp, la carte est illégale.

Portée voulue : **niveau camp uniquement**, pas niveau avatar. Une carte
spécifique à Gandalf reste visible dans un deck Sorcier même si l'avatar
déclaré est Saroumane — le navigateur ne connaît pas l'avatar du deck (trois
avatars distincts sont permis), et c'est le rôle de la règle `SPECIFIC-AVATAR`
du validateur, qui a le contexte pour le dire finement.

Le contournement reste **« Afficher les cartes illégales »**, qui existe déjà
et marque la carte au lieu de la masquer — aucun nouveau contrôle.

### Vérification d'impact

`isLegalForSide` n'est consommé que par `CardBrowser` et les tests.
`dropTargets.js` passe par `zoneTargets`, pas par lui : **le glisser-déposer
n'est pas affecté.**

### Risque identifié

`test/rules.test.js:396` affirme que toute carte bannie « n'était pas déjà
cachée » (`isLegalForSide(card, side, openBalrog) === true` avant application
de la liste de bannis). Si une carte bannie porte aussi `specific` d'un autre
camp, cette assertion tombe. À vérifier à l'implémentation : si le cas existe,
c'est l'assertion qui est trop forte, pas le design.

---

## 3 — Refonte de l'import de deck

### Constat

[`importDeck.js`](../../../web/src/lib/importDeck.js) (12 Ko) porte quatre
responsabilités mêlées et ne reconnaît que les titres **anglais canoniques**
`## Pool` / `## Sideboard` ; tout autre `##` retombe sur la pioche.
`parseLine` n'est pas exporté, donc la grammaire d'une ligne n'est pas
testable seule. La fenêtre d'import n'expose ni mode, ni camp, ni longueur, et
[`importDeckData` (`App.jsx:154`)](../../../web/src/App.jsx) **écrase** le deck
ouvert sans jamais toucher à `mode` ni `ruleset`.

### 3.1 Architecture

```
lib/import/vocabulary.js   familles de titres, FR + EN + ES + alias
lib/import/line.js         une ligne brute → lectures candidates
lib/import/document.js     machine à états : lignes + titres → { lines, notes, meta, name }
lib/import/resolve.js      index de noms + pile de départage
lib/importDeck.js          façade : l'API publique actuelle, inchangée
```

La façade continue d'exporter `normalizeName`, `parseDeckList`,
`parseDeckListDocument`, `buildNameIndex`, `ALIGNMENT_PREFERENCES`,
`preferredMatchId`, `resolveDeckList`, `importDeckList`. Aucun appelant ne
bouge.

**`vocabulary.js` importe `SECTION_TITLES` / `GROUP_TITLES` / `NOTE_TITLES`
depuis `deckList.js`** et les étend ; il ne les recopie pas. C'est la
protection contre la dérive que le commentaire en tête d'`importDeck.js`
décrit déjà.

### 3.2 Grammaire d'une ligne

**Principe :** `line.js` ne tranche pas les ambiguïtés. Il renvoie une liste de
**lectures candidates** ordonnées, et `resolve.js` garde la première qui
correspond à une carte réelle. `Bûrat 2` produit `{qty:2, name:'Bûrat'}` puis
`{qty:1, name:'Bûrat 2'}` ; c'est `cards.json` qui arbitre, pas une règle de
ponctuation devinée d'avance.

Décapage, dans l'ordre :

| Étape | Absorbe |
|---|---|
| Puces | `- ` `* ` `• ` `+ ` |
| Énumérateurs | `1. ` `2) ` — **retirés, jamais lus comme quantité** |
| Décoration markdown | `**nom**`, `_nom_`, `` `nom` `` |
| Quantité en tête | `3 nom`, `3x nom`, `3 x nom`, `3× nom` |
| Quantité en queue | `nom (1x)`, `nom - 2`, `nom -2x`, `nom x2`, `nom [2]`, `nom 2` |
| Parenthèse d'indice | `(AS)`, `(Contre l'Ombre)`, `(Hero)`, `(AS-58)` |

La distinction `1.` / `1)` = énumérateur contre `1` / `1x` = quantité est la
seule règle arbitraire, et elle est assumée : personne n'écrit « 3. Bûrat »
pour trois exemplaires. Une ligne `1) 3x Bûrat` fonctionne — l'énumérateur
part, la quantité reste.

Quantité par défaut : **1**. Plancher : 1 (une quantité `0` ou négative est
remontée à 1, comme aujourd'hui).

### 3.3 Vocabulaire des titres

Un titre est reconnu à son **contenu normalisé**, jamais à son niveau
markdown : `## Talon`, `### Talon`, `Talon :` et `**Talon**` sont le même
titre. La normalisation est celle de `normalizeName` (accents dépouillés,
casse, ponctuation supprimée), donc « Reserve », « réserve » et « RÉSERVE »
sont un seul mot. Un compte entre parenthèses en fin de titre — `Characters
(12)`, que nos propres exports écrivent — est retiré avant comparaison.

Quatre familles :

| Famille | Effet |
|---|---|
| **zone** | change la cible : pioche (`quantities`), talon (`sideboard`), réserve (`pool`), location deck (`quantities`) |
| **groupe** | ne change **pas** la zone ; pose un **indice de type** pour le départage |
| **notes** | bascule en mode notes : plus aucune ligne n'est lue comme carte |
| **metadata** | lignes `Clé: Valeur`, jamais lues comme carte (§3.7) ; une clé inconnue est ignorée |

Synonymes couverts, au minimum :

- **pioche** — Play deck, Playdeck, Deck, Main deck, Pioche, Mazo, Baraja
- **talon** — Sideboard, Side, Talon, Banquillo
- **réserve** — Pool, Starting pool, Réserve, Reserva
- **lieux** — Locations, Location deck, Site deck, Lieux, Lugares
- **groupes** — Avatars, Characters, Resources, Hazards, Sites, Regions,
  Minor objects, Stage events / permanent events, Other, et leurs formes
  FR/ES (Personnages, Ressources, Périls, Lieux, Régions, Objets mineurs,
  Progressions…)
- **notes** — Notes, Description, Strategy / Stratégie / Estrategia,
  Comments / Commentaires, Intro(duction), Overview / Résumé / Resumen, Notas,
  plus les quatre titres canoniques de `NOTE_TITLES`
- **metadata** — Metadata, Métadonnées, Deck info, Infos, Información

> **Les libellés FR et ES ne s'inventent pas.** Les synonymes ci-dessus sont
> une liste minimale ; les formes localisées doivent être **reprises de
> `i18n.js`** (`zones.*`, `zoneShort.*`, `panel.group.*`, `notes.*`,
> `side.*`, `length.*`) et non rédigées de mémoire, sans quoi le vocabulaire du
> parseur et celui de l'interface divergent silencieusement. Le glossaire FR
> imposé (§9) s'applique : pioche / talon / réserve / péril.

**`Deck` seul est un synonyme de pioche, pas de metadata.** C'est pour ça que
le bloc exporté s'intitule `## Metadata` et non `## Deck` : le mot « deck »
désigne le play deck dans les listes communautaires, et une seule lecture par
mot est la condition pour que le vocabulaire reste une table plate.

« Sites » et « Regions » appartiennent à la fois à la famille lieux et à la
famille groupe : ce n'est pas un conflit, les deux mènent à `quantities` et la
lecture « groupe » ajoute en plus l'indice de type.

L'indice de type posé par un titre de groupe est toujours **une valeur de
`TYPE_ORDER`** (`Character | Resource | Hazard | Site | Region`), jamais une
catégorie plus fine : « Minor objects » et « Stage events » posent tous deux
`Resource`. Un groupe qui ne se réduit pas à un type (`Avatars`, `Other`) ne
pose **aucun** indice plutôt qu'un indice faux.

> **Piège à documenter dans le fichier.** « Réserve » a changé de référent le
> 2026-07-29 (§9 : c'était le sideboard, c'est le pool). Le vocabulaire retient
> **uniquement le sens actuel** — décision prise : aucune liste écrite à la
> main n'emploiera l'ancien. Le commentaire existe pour que la session suivante
> ne « corrige » pas ça par erreur.

### 3.4 Modèle de document

`document.js` parcourt les lignes et tient quatre états : la zone cible,
l'indice de type, le mode (cartes / notes / metadata) et le champ de note
courant. Règles :

- **Point de départ** : mode cartes, cible pioche, aucun indice. Une liste sans
  le moindre titre s'importe donc entièrement dans la pioche — comportement
  actuel préservé.
- **L'ordre des sections est libre** : le vocabulaire ne fait aucune hypothèse
  de position. « Notes: » en tête comme en queue fonctionne à l'identique.
- **Un titre inconnu part dans les notes et laisse la zone en cours intacte.**
  C'est un changement : aujourd'hui tout `##` inconnu renvoie la cible sur
  `quantities` ([`importDeck.js:119`](../../../web/src/lib/importDeck.js)),
  donc un « Plan de jeu » écrit au milieu du talon renvoyait les cartes
  suivantes dans la pioche.
- **Rien n'est perdu.** Une ligne sans quantité explicite et sans
  correspondance de carte est de la prose : elle s'accumule dans les notes
  (champ courant en mode notes, `other` sinon). Une ligne **avec** quantité
  explicite qui ne correspond à rien reste signalée « non trouvée » —
  l'intention y était clairement une carte.
- **Le mode notes reste absolu.** Aucune ligne n'y est jamais passée au
  résolveur, même « 3x Gandalf est le plan ». C'est la garantie centrale du
  parseur actuel et elle ne bouge pas.
- **`# Titre`** en première ligne de contenu → nom du deck.

### 3.5 Résolution et départage

`resolve.js` applique une pile où **chaque rang restreint** l'ensemble des
candidats, et **est ignoré s'il le viderait** — un indice erroné ne doit jamais
produire zéro résultat sur une carte qui existe.

| Rang | Indice | Effet |
|---|---|---|
| 0 | lecture candidate | garder la première lecture qui matche une carte |
| 1 | parenthèse | id (`AS-58`) décisif ; code ou nom de set → filtre ; alignement → filtre |
| 2 | sous-section | filtre par type (`Hazards` → `Hazard`) |
| 3 | camp du deck | filtre par alignement, via `ALIGNMENT_PREFERENCES` |

Le rang 1 est **souverain, même si le résultat est illégal pour le camp** : ce
qui est écrit noir sur blanc l'emporte sur ce qui est déduit. La carte
s'importe et se marque.

Issue : un seul candidat → résolu ; plusieurs → menu déroulant présélectionné
sur le premier ; zéro → « non trouvée ».

Le rang 3 remplace le menu **Préférence d'alignement** quand le camp est connu
(`wizard`→`hero`, `ringwraith`→`minion`, `balrog`→`balrog`,
`fallen-wizard`→`fallenWizard`). Le menu manuel **reste, en freeform
uniquement**, où il n'y a pas de camp d'où déduire.

**Freeform :** les titres de zone continuent d'être lus (un deck freeform a lui
aussi un talon et une réserve). Ce qui disparaît en freeform, c'est le rang 3
et les marques de légalité.

### 3.6 La fenêtre d'import, en deux temps

**Temps 1 — coller.** Texte d'aide, textarea, bouton *Analyser*. Rien d'autre.
Identique à aujourd'hui.

**Temps 2 — régler et vérifier.** L'analyse tourne, puis apparaissent
ensemble les contrôles et le rapport :

```
Cible  : (•) Nouveau deck   ( ) Remplacer le deck ouvert
Mode   : [ Deckbuilding ▾ ]
Camp   : [ Sorcier ▾ ]        Partie : [ Standard ▾ ]     ← si deckbuilding
─────────────────────────────────────────────────────────
47 cartes reconnues · 2 introuvables · 3 lignes en notes ▾
✓ 3× Bûrat                    (TW-119)
⚠ 1× Ered Mithrin — illégale pour le camp Sorcier
? 2× Angmarim                 [ AS-58 — Angmarim (AS · Character · Hero) ▾ ]
✗ 1× Machin — non trouvée
```

Les sélecteurs n'existent **qu'après** l'analyse : c'est ce qui rend impossible
la contradiction entre un réglage manuel et les métadonnées du texte collé.

**Amorçage du camp / de la longueur / du mode**, pour la première résolution
qui tourne avant que quoi que ce soit soit affiché :

> métadonnées du texte collé (§3.7) > `ruleset` du deck ouvert > aucun camp

Changer un sélecteur ensuite **relance la résolution sans re-cliquer**.

**Choix manuels :** ils survivent à un changement de camp, sauf ceux dont la
carte a disparu de l'ensemble des candidats. Correctif au passage : aujourd'hui
changer la préférence d'alignement efface **tous** les choix manuels
([`ImportDialog.jsx:51`](../../../web/src/components/ImportDialog.jsx)).

**Marques de légalité :** `isLegalForSide(c, side, openBalrog, bannedIds)`,
avec `siteIndex(cards).openBalrog` et `resolveBanned(cards).bySide[side]` —
les mêmes appels que `CardBrowser`, pour que la fenêtre d'import et le
navigateur ne puissent pas se contredire. **Non bloquant** : la carte
s'importe, elle est marquée. Aucune marque en freeform.

**Zones impossibles :** une carte listée sous *Réserve* alors qu'elle ne peut
pas y aller est importée **là où c'est écrit**. C'est `validateDeck`, qui porte
déjà `POOL-ELIGIBLE`, qui le signale ensuite. L'import ne réimplémente pas la
légalité des zones.

**Nom du deck :** pris de la ligne `# Titre` si elle existe, sinon un défaut
i18n. En mode *Remplacer*, le nom du deck ouvert est **conservé**.

**`importDeckData`** reçoit en plus `{ name, mode, ruleset, target }` et, sur
`target === 'new'`, crée un deck neuf au lieu d'écraser.

### 3.7 Bloc de métadonnées à l'export

`buildDeckListText` émet, juste sous le titre et avant `## Notes` :

```
## Metadata
- Mode: Deckbuilding
- Side: Balrog
- Game length: Standard
```

Le titre est `## Metadata` et non `## Deck` parce que « Deck » est déjà un
synonyme de pioche (§3.3).

**Valeurs en anglais canonique**, comme les titres de section et pour la même
raison (`deckList.js:21-23`) : un export français doit se ré-importer. Le
parseur accepte **en plus** les valeurs localisées et les identifiants bruts,
parce qu'un humain écrira « Camp : Balrog ». Les valeurs se résolvent contre
les clés de `SIDES` (`wizard | ringwraith | fallen-wizard | balrog`) et de
`LENGTHS` (`starter | standard | long | campaign`), plus leurs libellés
`side.*` / `length.*` dans les trois langues.

Le bloc est **toujours émis** ; un deck freeform ne porte que `Mode: Freeform`.

**Trois champs, pas quatre.** `tournament` reste dehors : la fenêtre d'import
ne l'expose pas, et un champ exporté que l'import ne sait pas régler crée une
asymétrie. Frontière posée explicitement : **le bloc porte exactement ce que la
fenêtre d'import sait régler.** L'export texte n'a jamais été une sérialisation
complète — il perd déjà `ruleOverrides`, les dos personnalisés et l'ordre.

**Pas d'avertissement de désaccord.** Les métadonnées lues **pilotent** les
sélecteurs ; l'utilisateur voit les contrôles apparaître sur ces valeurs et
peut les changer. Un avertissement exigerait un état séparé, une comparaison,
trois chaînes i18n, et surtout de trancher lequel des deux fait foi pour la
résolution : trois pièces de machinerie pour une situation qui se résout d'un
clic.

`buildDeckListText` gagne `mode` et `ruleset` dans son objet d'options ; seul
`ExportDialog` l'appelle.

---

## Ce qui n'est délibérément pas fait

- **Pas de `validateDeck` dans la fenêtre d'import.** Le panneau de deck le
  fait déjà en direct à la seconde où l'import atterrit ; le dupliquer, c'est
  deux endroits à tenir en phase pour montrer la même chose une seconde plus
  tôt.
- **Pas de filtrage par avatar déclaré** dans le navigateur de cartes (§2) —
  c'est le travail de `SPECIFIC-AVATAR`, qui a le contexte.
- **Pas de moteur de grammaire déclarative** pour le parseur : quatre fonctions
  pures suffisent, et le dépôt n'a pas de précédent de ce style.
- **`tournament` hors du bloc de métadonnées** (§3.7).

---

## Tests

Le dépôt n'a **pas de tests de composants** (§14.2) : tout se joue dans les
modules purs, ce qui est l'intérêt principal du découpage. Convention plate
existante, un fichier par module :

- `test/importLine.test.js` — décapage, quantités aux quatre positions,
  lectures candidates, énumérateur contre quantité.
- `test/importVocabulary.test.js` — les quatre familles, les trois langues, la
  normalisation, le compte `(12)` retiré, un titre inconnu. **Plus une
  assertion d'unicité : aucun mot normalisé ne doit appartenir à deux
  familles** — c'est ce qui aurait attrapé la collision `Deck` (§3.3).
- `test/importDocument.test.js` — ordre libre des sections, titre inconnu qui
  ne réinitialise pas la zone, prose vers les notes, ligne à quantité
  explicite non trouvée, mode notes absolu, `# Titre`, bloc metadata.
- `test/importResolve.test.js` — les quatre rangs de la pile, un rang ignoré
  plutôt qu'appliqué s'il vide l'ensemble, parenthèse souveraine sur une carte
  illégale.

Garde-fous de non-régression :

- **`test/importDeck.test.js` ne doit pas être modifié.** Il teste la façade ;
  s'il faut le toucher, c'est qu'un contrat public a été cassé.
- **`test/deckList.test.js` sera modifié** — le format d'export change (§3.7).
  Ses fixtures gagnent le bloc ; l'assertion d'aller-retour, elle, reste et
  reste le garde-fou.
- `test/rules.test.js` — cas passants et échouants pour la passe `specific`,
  plus l'assertion `:396` à revérifier.
- `test/constants.test.js` — `TYPE_ORDER` à sa nouvelle adresse.
- `test/i18n-rules-contract.test.js` — les nouvelles clés `import.*` dans les
  trois dictionnaires, sinon il échoue.

---

## Documentation à mettre à jour (même commit — règle n°1)

| Section | Motif |
|---|---|
| §5 | signature d'`importDeckData` (`name`, `mode`, `ruleset`, `target`) |
| §6 | `isLegalForSide` durci ; portée camp et non avatar |
| §7 | format de `buildDeckListText` — le bloc `## Deck` (documenté ligne 482) |
| §9 | nouvelles clés `import.*` ; le piège du vocabulaire « réserve » |
| §10 | la fenêtre d'import en deux temps |
| §13 | tableau d'état des fonctionnalités |
| §15 | journal daté + la date en tête du fichier |

`README.md` également : l'import et le format d'export sont visibles par
l'utilisateur.

---

## Risques

1. **`test/rules.test.js:396`** peut tomber si une carte bannie est aussi
   `specific` d'un autre camp (§2).
2. **Les lectures candidates peuvent surprendre** sur une carte dont le nom se
   termine par un chiffre. Aucune n'existe dans `cards.json` à ma
   connaissance ; à confirmer par un test qui balaie les 1683 noms.
3. **Le vocabulaire est la partie vivante.** Chaque nouvelle source de listes
   apportera ses synonymes. C'est pour ça qu'il est seul dans son fichier :
   l'étendre doit rester « ajouter une ligne dans une table ».
