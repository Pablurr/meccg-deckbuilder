// Pure drop-target legality for the deck panel's zone tabs. Extracted from
// DeckPanel's onDropOnTab so the routing logic (which zone a dragged card is
// allowed to land on) can be unit-tested without a DOM/React tree -- the same
// kind of pure rule logic test/rules.test.js already covers for
// zonesFor/isLegalForSide.
import { zoneTargets } from './zones.js';

// The play/location/cards tabs are three views onto the same underlying
// `quantities` map; a drop on any of them is really a drop on the 'deck'
// zone. pool/sideboard map onto themselves.
export function resolveDropTarget(toTab) {
  return toTab === 'play' || toTab === 'location' || toTab === 'cards' ? 'deck' : toTab;
}

// Is dropping `card` onto tab `toTab` legal? zoneTargets names every zone the
// card may occupy, and is the same list the touch UI offers as move targets --
// deliberately shared so a drop and a "move to" can never disagree. A
// Site/Region dropped on Pool or Sideboard is the case a naive "always allow"
// implementation would silently get wrong.
export function isDropAllowed(card, toTab) {
  return zoneTargets(card).includes(resolveDropTarget(toTab));
}
