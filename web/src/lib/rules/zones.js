// Which zone counters a card exposes in deckbuilding mode.
// 'deck' = the main deck; play vs location derives from the card type
// (backGroupForType), so it is not a zone of its own here.
// 1.6.1 -- 'sideboardFw' is the ten cards preselected for a Fallen-wizard
// OPPONENT. It follows 'sideboard' everywhere and comes last in `extra`,
// because `extra`'s order drives the order the browser tile lists its zone
// counters in, and the rarest zone belongs after the common ones.
//
// Site and Region keep an empty `extra`, which is what makes the zone
// unreachable for them in the three surfaces at once -- drag-and-drop, the
// "move to" menu and import all ask zoneTargets instead of each deciding.
export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') {
    // 1.7 -- the pool holds up to ten NON-avatar characters, so an avatar's
    // zones are the play deck and the two sideboards only.
    if (a.avatar === true) return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
    return { primary: 'pool', extra: ['deck', 'sideboard', 'sideboardFw'] };
  }
  // 1.7 -- the pool may also hold up to two minor items. Two families qualify:
  // actual Minor Item cards, and the six permanent-events whose own text says
  // they may be played with a starting company "in lieu of a minor item"
  // (AS-94, BA-31, BA-44, BA-60, BA-70, WH-46), which consume an item slot.
  // 1.7.F1 -- a third family, Fallen-wizard only: Stage resource
  // permanent-events, up to three of them totalling exactly three stage points.
  if (type === 'Resource' && (a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true
    || (card.alignment === 'Stage' && a.subtype === 'Permanent-event'))) {
    return { primary: 'deck', extra: ['sideboard', 'pool', 'sideboardFw'] };
  }
  return { primary: 'deck', extra: ['sideboard', 'sideboardFw'] };
}

// The zones a card may occupy, as one ordered list with the primary first --
// the shape the UI actually needs, where zonesFor's {primary, extra} split is
// what the rules text cares about. 'deck' is appended because every card may
// always reach the play deck; the Set drops the duplicate for the cards whose
// primary or extra already names it, so no zone is ever offered twice.
//
// isDropAllowed (dropTargets.js) is built on this same list rather than
// re-deriving one from zonesFor: the touch UI and drag-and-drop must not be
// able to disagree about where a card may go, and a shared function is the
// only version of that guarantee that cannot rot.
export function zoneTargets(card) {
  if (!card) return [];
  const z = zonesFor(card);
  return [...new Set([z.primary, ...z.extra, 'deck'])];
}

// Where one copy sitting in `fromZone` may be moved to. Empty for a Site,
// which only ever has the deck -- and an empty list is what tells the deck
// card to render no move action at all rather than a menu with nothing in it.
export function moveTargets(card, fromZone) {
  return zoneTargets(card).filter((zone) => zone !== fromZone);
}

// The full-name i18n key per zone. 'deck' maps to zones.play because the play
// deck is what the player sees that tab called; reusing the existing tab keys
// keeps the modal's wording identical to the tab the card will land on. That
// matters most in French, whose three zone names are a rotation of the English
// ones rather than direct translations, so a freshly invented synonym here
// would confidently point the player at the wrong tab.
export const ZONE_LABEL_KEY = {
  deck: 'zones.play',
  sideboard: 'zones.sideboard',
  pool: 'zones.pool',
  sideboardFw: 'zones.sideboardFw',
};
