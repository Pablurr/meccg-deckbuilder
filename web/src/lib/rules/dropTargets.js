// Pure drop-target legality for the deck panel's zone tabs. Extracted from
// DeckPanel's onDropOnTab so the routing logic (which zone a dragged card is
// allowed to land on) can be unit-tested without a DOM/React tree -- the same
// kind of pure rule logic test/rules.test.js already covers for
// zonesFor/isLegalForSide.
import { zoneTargets } from './zones.js';
import { backGroupForType } from '../deck.js';

// The play/location/cards tabs are three views onto the same underlying
// `quantities` map; a drop on any of them is really a drop on the 'deck'
// zone. pool/sideboard map onto themselves.
export function resolveDropTarget(toTab) {
  return toTab === 'play' || toTab === 'location' || toTab === 'cards' ? 'deck' : toTab;
}

// Which tab actually SHOWS a card once it is in the 'deck' zone. The panel
// filters play/location by backGroupForType (DeckPanel's activeEntries), so
// this is that same split, asked ahead of the drop instead of after it.
const DECK_TAB_GROUP = { play: 'playdeck', location: 'locationdeck' };

// Is dropping `card` onto tab `toTab` legal? Two questions, and both have to
// answer yes.
//
// 1. May the card occupy the zone the tab stands for? zoneTargets names every
//    zone it may occupy, and is the same list the touch UI offers as move
//    targets -- deliberately shared so a drop and a "move to" can never
//    disagree. A Site/Region dropped on Pool or Sideboard is the case a naive
//    "always allow" implementation would silently get wrong.
//
// 2. Will the tab dropped on actually DISPLAY the card? This one is not a rule
//    of the game, it is a rule of the interface, and skipping it produced a
//    real bug: play and location are two views on one zone, so dragging a
//    character out of the pool onto the Sites tab counted as a legal drop on
//    'deck' -- and the character landed in the play deck, a tab away from
//    where the player let go, with nothing to explain the jump. A drop the
//    destination cannot show is a miss, and a miss leaves the card where it
//    was. The freeform 'cards' tab shows the whole deck, so it refuses
//    nothing.
export function isDropAllowed(card, toTab) {
  if (!zoneTargets(card).includes(resolveDropTarget(toTab))) return false;
  const wantGroup = DECK_TAB_GROUP[toTab];
  return wantGroup == null || backGroupForType(card.type) === wantGroup;
}
