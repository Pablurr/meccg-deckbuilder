# Gestion des cartes « Agent » — design

Date : 2026-08-07
Statut : validé, prêt pour le plan d'implémentation

## Le problème

Un agent MECCG change de nature selon le camp qui le joue : péril pour un Sorcier ou un
Balrog, personnage pour une Ombre Noire ou un Magicien Déchu (1.3.W2, 1.3.R2, 1.3.B2,
1.3.F4). Le moteur de règles encode déjà cette bascule ; le reste de l'application, non.

Trois défauts en découlent :

1. **Les 30 agents-personnages sont invisibles dans le navigateur d'un deck Sorcier.**
   Ils sont d'alignement `Minion`, `wizard.alignments` vaut `['Hero','Neutral','Dual']`,
   et `isLegalForSide` ([sides.js:152](../../../web/src/lib/rules/sides.js)) les rejette
   sur cette seule base. Le navigateur masque par défaut les cartes illégales
   ([CardBrowser.jsx:148](../../../web/src/components/CardBrowser.jsx)) : le joueur
   Sorcier ne peut donc pas les trouver.
2. **La Réserve leur est proposée à tort.** `zonesFor` ignore le camp et renvoie
   `primary: 'pool'` pour tout Character non-avatar. Un agent-péril y est donc accepté au
   glisser-déposer, au menu « déplacer » et à l'import, et `validate.js:316` le compte
   même dans le plafond des dix personnages de réserve.
3. **Il s'affiche comme personnage.** `buildGroups` ([deckList.js:55](../../../web/src/lib/deckList.js))
   regroupe sur `card.type`, pas sur le rôle.

Demande connexe : 1.3.B4 restreint les personnages non-avatar d'un deck Balrog aux races
Orc et Troll de mind < 9. La règle est encodée sous `SIDES.balrog.pool`, donc appliquée à
la seule réserve, alors qu'elle porte sur le deck entier.

## Ce qui existe déjà et ne bouge pas

- `attributes.agent: true` est présent sur les 32 cartes concernées : les 30
  Character/Minion de Dark Minions (DM-1→27, DM-181, DM-182, DM-183) et les 2 agents de
  type Hazard (DM-28, DM-29). Aucune n'a d'attribut `specific`.
- `roleFor(card, sideId)` ([roles.js:51](../../../web/src/lib/rules/roles.js)) bascule le
  bucket via `side.agents.role`. `validate.js:35` et `copies.js:87` en dépendent déjà :
  les budgets de deck et la table de copies suivent donc le camp sans modification.
- `creatureWeight` rend déjà 0.5 pour un agent compté comme péril
  ([roles.js:31](../../../web/src/lib/rules/roles.js)), et les trois traductions de
  `rules.CREATURE-MIN` le disent. **La règle 1.5.1 ne demande aucun travail.**

`attributes.agent` reste le signal autoritaire pour les règles. Le keyword ajouté au JSON
est un libellé de filtre, jamais une entrée du moteur.

## Lot 1 — Légalité (`sides.js`)

`requireRaces` et `balrogMindPerCharacterLimit` quittent `SIDES.balrog.pool` pour le
niveau du camp : 1.3.B4 porte sur le deck entier, et les laisser sous `pool` était la
raison pour laquelle la contrainte ne s'appliquait qu'à la réserve.

Deux passes nouvelles dans `isLegalForSide`, **après** les passes avatar et `specific` —
aucun agent ne porte `specific` aujourd'hui, mais cet ordre garantit que 1.3.4 primera si
la donnée évolue, et le ban continue de primer sur tout :

- **Agent-péril** — `agent === true` et `side.agents.role === 'hazard'` ⇒ légal quel que
  soit l'alignement.
- **Race et mind du personnage** — un Character non-avatar, non-agent, est illégal si le
  camp impose des races et que la sienne n'en est pas, ou si son mind atteint la limite.
  Exemption `specificMode: 'balrog-exempt'` : une carte `specific: 'Balrog'` y échappe.
  `raceAllowed` lit désormais la clé déplacée ; sa comparaison passe toujours par
  `matchesRace` (la donnée écrit « Wolves » là où la règle dit « Wolf », et joint
  plusieurs races par des virgules).

Le mind est lu comme entier ; une valeur absente ou non numérique ne restreint rien —
une donnée qu'on ne sait pas interpréter ne doit jamais masquer une carte en silence,
au même titre qu'un `specific` inconnu.

Effet mesuré sur un navigateur Balrog : **35 personnages** passent masqués par défaut —
30 de race non-Orc/Troll, plus BA-5, BA-9, LE-20, LE-21, LE-22 (Orc ou Troll de mind 9).
Aucun n'est Balrog-spécifique, donc l'exemption reste théorique mais doit être codée.
Sans la passe agent-péril, les 30 agents (races Man, Elf, Dúnadan…) tomberaient sous le
même couperet.

`ImportDialog.jsx:260` lit la même fonction : l'import cesse du même coup de signaler les
agents illégaux pour un Sorcier.

### Répercussion sur la documentation des règles

`poolText` ([docText.js:53-63](../../../web/src/lib/rules/docText.js)) compose le texte de
la réserve à partir de `pool.balrogMindPerCharacterLimit` et `pool.requireRaces`. Les deux
clés déménageant, ces fragments doivent migrer vers le texte du camp, et leurs clés i18n
`docs.pool.balrogMindBelow` / `docs.pool.requireRaces` être renommées en conséquence dans
les trois langues. Laisser ces contraintes décrites sous « réserve » alors qu'elles
s'appliquent au deck entier serait une documentation fausse.

## Lot 2 — Zones (`zones.js`)

`zonesFor(card, sideId)`, `zoneTargets(card, sideId)`, `moveTargets(card, fromZone, sideId)`.

`sideId` est **optionnel**, sur le précédent d'`openBalrog`/`bannedIds` dans
`isLegalForSide` : omis, le comportement actuel est strictement inchangé, et les tests
existants ne bougent pas.

Branche Character : si `agent === true` et que le camp en fait un péril, renvoyer les
zones d'un péril — `{ primary: 'deck', extra: ['sideboard', 'sideboardFw'] }`. La Réserve
disparaît alors des trois surfaces d'un seul geste (glisser-déposer, menu « déplacer »,
import), ce qui est exactement la garantie que le commentaire de `zoneTargets` existe pour
tenir : ces trois surfaces ne doivent pas pouvoir se contredire.

Appelants à câbler : `dropTargets.js:40`, `import/target.js:33`, `CardBrowser.jsx:61`,
`App.jsx:431`, `validate.js:310`.

`zones.js` importera `sides.js`, qui ne dépend que de `races.js` : aucun cycle d'import
créé, l'invariant de §6 tient.

## Lot 3 — Validateur (`validate.js`)

- Ligne 310, `zonesFor(c)` reçoit le camp.
- Nouveau motif `POOL-ELIGIBLE.agent`. Le motif actuel `'type'` mentirait : ce n'est pas
  son type qui disqualifie l'agent, c'est le camp. **Nouvelle clé i18n en fr, en et es** —
  le test de contrat exige une clé par `code` émis, dans les trois langues.
- Ligne 316, `c.type === 'Character'` devient `roleFor(c, side).bucket === 'character'`.
  Redondant une fois la zone bloquée, mais deux sources de vérité qui peuvent diverger
  finiront par diverger.
- Le contrôle `BALROG-MIND` (ligne 238) lit la clé déplacée.

## Lot 4 — Affichage

- `buildGroups` ([deckList.js:55](../../../web/src/lib/deckList.js)) regroupe sur
  `roleFor(card, side).bucket` au lieu de `card.type`, et reçoit donc le camp. Les agents
  s'affichent sous **Périls** en deck Sorcier ou Balrog, sous **Personnages** en Ombre
  Noire ou Magicien Déchu.
- `poolCharCount` ([DeckPanel.jsx:198](../../../web/src/components/DeckPanel.jsx)) suit la
  même correction.
- `CardBrowser` : **aucun code neuf**. Les agents cessent d'être masqués parce qu'ils
  deviennent légaux ; les personnages hors 1.3.B4 se masquent par le mécanisme existant,
  révélables par « tout afficher » avec la marque d'illégalité.

## Lot 5 — Données (`cards.json`)

- Keyword `"Agent"` sur les **32** cartes portant `attributes.agent: true`, agents de type
  Hazard DM-28 et DM-29 compris : le keyword désigne « c'est un agent », pas « c'est un
  agent-personnage ». Aucun effet sur les règles ; c'est une facette de filtre.
- BA-3 (Le Balrog) : `attributes.subtype: "Spawn"` retiré, `"Spawn"` ajouté à
  `attributes.keywords`. C'est le seul `subtype: "Spawn"` du jeu, donc l'entrée disparaît
  proprement de la facette Subtype ; `"Spawn"` en keyword rejoint 12 cartes existantes.
  Sans effet sur `creatureWeight` : BA-3 est un avatar, son bucket est `avatar`, et la
  branche Spawn de [roles.js:35](../../../web/src/lib/rules/roles.js) ne vise que les
  permanent-events. Le commentaire qui y compte « 12 cartes » passe à 13.

## Tests

- `roleFor` et `creatureWeight` sur les agents : couverts aujourd'hui, à ne pas régresser.
- `isLegalForSide` : un agent est légal pour les quatre camps ; un personnage Homme est
  illégal pour le Balrog et légal pour l'Ombre Noire ; BA-5 (Orc, mind 9) est illégal pour
  le Balrog ; une carte bannie reste illégale même agent.
- `zonesFor` : sans `sideId`, sortie identique à aujourd'hui (garde anti-régression) ;
  avec `wizard` et `balrog`, un agent n'expose pas `pool` ; avec `ringwraith` et
  `fallen-wizard`, il l'expose.
- `dropTargets` et `import/target` refusent la réserve pour un agent en deck Sorcier.
- `validate` : un agent placé de force en réserve émet `POOL-ELIGIBLE.agent` ; un agent en
  pioche ne consomme pas de place au plafond des dix personnages.
- Contrat i18n : les clés nouvelles et renommées existent en fr, en et es.
- Données : les 32 cartes portent le keyword ; BA-3 n'a plus de `subtype` et a le keyword
  `Spawn`.

## Hors périmètre

- Les autres règles de 1.3.B4 non citées ici.
- Toute règle de jeu en cours de partie : l'application ne construit que des decks.
- Le vocabulaire FR est déjà fixé (§9) ; « agent » et « péril » ne changent pas.
