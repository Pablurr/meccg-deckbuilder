// A card's ROLE depends on the side that plays it (1.3.W2, 1.3.R2, 1.3.B2,
// 1.3.F2, 1.3.F5): the same agent is a hazard for a Wizard and a character for
// a Ringwraith, and a hazard playable as a resource may be counted either way.
// Everything downstream -- the play-deck budgets, the creature count, the copy
// table -- reads this instead of card.type, the same way zonesFor is the single
// source of truth for zones.
import { SIDES } from './sides.js';
import { matchesRace } from './races.js';

// 1.5.1 -- "Ahunt" / "at Home" Dragon manifestations count as half a creature.
// A curated id list, NOT a name pattern: /at Home/ also matches TD-143 "Not at
// Home", a Hero short-event that is no manifestation at all. The set is TD-only
// and closed, so a list is stable.
export const DRAGON_MANIFESTATIONS = new Set([
  'TD-1', 'TD-2', 'TD-4', 'TD-5', 'TD-10', 'TD-11', 'TD-21', 'TD-22', 'TD-37',
  'TD-38', 'TD-43', 'TD-44', 'TD-61', 'TD-62', 'TD-64', 'TD-65', 'TD-70', 'TD-71',
]);

const BALROG_TROLL_ORC = ['Orc', 'Troll'];

// 1.5.1, evaluated in this order so nothing is counted twice.
function creatureWeight(card, bucket) {
  const a = card.attributes || {};
  const sub = String(a.subtype || '');
  if (sub === 'Creature') return 1;
  // "A creature that is also playable as an event" -- Creature/Short-event and
  // Creature/Permanent-event.
  if (sub.includes('Creature')) return 0.5;
  if (DRAGON_MANIFESTATIONS.has(card.id)) return 0.5;
  if (bucket !== 'hazard') return 0; // an Ally resource with Spawn is no creature
  if (a.agent === true) return 0.5;  // "an agent that counts as a hazard"
  // "A Spawn permanent-event". The data disagrees with itself -- `spawn` is on
  // 9 cards, keywords ["Spawn"] on 12 -- so take either signal but only for a
  // hazard permanent-event that is not already a creature (handled above).
  if (sub.includes('Permanent-event') && (a.spawn === true || (a.keywords || []).includes('Spawn'))) return 0.5;
  return 0;
}

export function roleFor(card, sideId) {
  const side = Object.prototype.hasOwnProperty.call(SIDES, sideId) ? SIDES[sideId] : undefined;
  const a = (card && card.attributes) || {};
  const none = { bucket: 'resource', flexible: null, creatureWeight: 0, effectiveAlignment: '' };
  if (!card || !side) return { ...none, effectiveAlignment: (card && card.alignment) || '' };

  let bucket;
  let flexible = null;

  if (card.type === 'Site') bucket = 'site';
  else if (card.type === 'Region') bucket = 'region';
  else if (a.avatar === true) bucket = 'avatar';
  else if (a.agent === true) {
    // 1.3.R2 speaks of agent CHARACTER cards, so the two Hazard-type agents
    // (DM-28, DM-29) stay hazards on every side.
    bucket = card.type === 'Character' ? side.agents.role : 'hazard';
  } else if (card.type === 'Character') bucket = 'character';
  else if (card.type === 'Hazard') {
    bucket = 'hazard';
    // 1.3.3 -- may be counted as a resource instead. 1.3.F2 caps a
    // Fallen-wizard at two copies counted as resources; the third is a hazard.
    if (a.playableAsResource === true) flexible = { alt: 'resource', maxAsAlt: side.flexMaxAsResource };
  } else {
    bucket = 'resource';
    // The other direction: 1.3.F2 constrains only hazards playable as
    // resources, so this carries no Fallen-wizard cap.
    if (a.playableAsHazard === true) flexible = { alt: 'hazard', maxAsAlt: null };
  }

  // 1.3.F5 -- a Fallen-wizard player's non-Orc, non-Troll characters are
  // treated as hero characters. No deck-construction rule turns on this by
  // itself (1.3.F1 caps non-unique characters at 2 whatever their alignment),
  // but lot 3's copy table keys on effectiveAlignment.
  let effectiveAlignment = card.alignment;
  if (side.heroTreatment && bucket === 'character'
      && !BALROG_TROLL_ORC.some((r) => matchesRace(a.race, r))) {
    effectiveAlignment = 'Hero';
  }

  return { bucket, flexible, creatureWeight: creatureWeight(card, bucket), effectiveAlignment };
}
