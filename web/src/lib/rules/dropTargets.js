// Pure drop-target legality for the deck panel's zone tabs. Extracted from
// DeckPanel's onDropOnTab so the routing logic (which zone a dragged card is
// allowed to land on) can be unit-tested without a DOM/React tree — the same
// kind of pure rule logic test/rules.test.js already covers for
// zonesFor/isLegalForSide.
import { zonesFor } from './zones.js';

// The play/location/cards tabs are three views onto the same underlying
// `quantities` map; a drop on any of them is really a drop on the 'deck'
// zone. pool/sideboard map onto themselves.
export function resolveDropTarget(toTab) {
  return toTab === 'play' || toTab === 'location' || toTab === 'cards' ? 'deck' : toTab;
}

// Is dropping `card` onto tab `toTab` legal? zonesFor names the zones a card
// may occupy (primary + extra); every card may additionally always reach
// 'deck'. A Site/Region dropped on Pool or Sideboard is the case a naive
// "always allow" implementation would silently get wrong.
export function isDropAllowed(card, toTab) {
  if (!card) return false;
  const z = zonesFor(card);
  const allowed = new Set([z.primary, ...z.extra, 'deck']);
  return allowed.has(resolveDropTarget(toTab));
}
