// Where an imported line actually lands.
//
// parseDocument reads the SECTION a line was written under; this module has
// the last word on the ZONE it goes to, because a heading is what the author
// typed and a zone is what the rules allow. The two disagree often enough to
// matter: hand-written and LLM-written lists routinely open a "Sites" section
// after the sideboard, and until that word was taught to close the section
// above it (see vocabulary.js) every site in the list ended up in the
// sideboard -- a place the rules give sites no reason to be.
//
// The legality question is NOT re-derived here. rules/zones.js already owns it
// for the deck panel's drag-and-drop and its "move to" menu, so an import that
// answered it its own way would be a third opinion waiting to drift. A paste
// can therefore never build a deck the interface would refuse to build by
// hand, which is the whole invariant: the sideboard holds no sites, the pool
// holds no sites and no avatars, and so on for every rule zoneTargets knows.
//
// A refused zone falls back to the main deck rather than dropping the card.
// The player wrote the card down; only the section was wrong.
import { zoneTargets } from '../rules/zones.js';

// parseDocument's target names vs rules/zones.js's zone names. 'quantities' is
// the play AND location deck (ARCHITECTURE.md §4), which rules/zones.js calls
// 'deck'.
const ZONE_BY_TARGET = { quantities: 'deck', pool: 'pool', sideboard: 'sideboard', sideboardFw: 'sideboardFw' };

export function targetForCard(card, target, sideId) {
  const wanted = ZONE_BY_TARGET[target] ? target : 'quantities';
  // No card means an unresolved line, which imports nothing anyway; and the
  // main deck is the one zone open to every card, so neither case has a
  // question to answer.
  if (!card || wanted === 'quantities') return 'quantities';
  return zoneTargets(card, sideId).includes(ZONE_BY_TARGET[wanted]) ? wanted : 'quantities';
}

// The map a line's copies should be added to. Both import call sites -- the
// non-interactive importDeckList and the dialog's live preview -- go through
// this, so the deck the dialog counts is the deck the app receives. `sideId`
// is optional and last for the same reason zoneTargets' is: a caller with no
// camp (freeform, or a pre-camp resolution) gets the pre-existing answer.
export function bucketFor(card, target, { quantities, zones }, sideId) {
  const t = targetForCard(card, target, sideId);
  if (t === 'pool') return zones.pool;
  if (t === 'sideboard') return zones.sideboard;
  if (t === 'sideboardFw') return zones.sideboardFw;
  return quantities;
}
