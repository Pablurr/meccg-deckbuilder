// Which zone counters a card exposes in deckbuilding mode.
// 'deck' = the main deck; play vs location derives from the card type
// (backGroupForType), so it is not a zone of its own here.
export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') {
    // 1.7 -- the pool holds up to ten NON-avatar characters, so an avatar's
    // zones are the play deck and the sideboard only.
    if (a.avatar === true) return { primary: 'deck', extra: ['sideboard'] };
    return { primary: 'pool', extra: ['deck', 'sideboard'] };
  }
  // 1.7 -- the pool may also hold up to two minor items. Two families qualify:
  // actual Minor Item cards, and the six permanent-events whose own text says
  // they may be played with a starting company "in lieu of a minor item"
  // (AS-94, BA-31, BA-44, BA-60, BA-70, WH-46), which consume an item slot.
  if (type === 'Resource' && (a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true)) {
    return { primary: 'deck', extra: ['sideboard', 'pool'] };
  }
  return { primary: 'deck', extra: ['sideboard'] };
}
