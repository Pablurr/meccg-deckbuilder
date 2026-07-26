// Which zone counters a card exposes in deckbuilding mode.
// 'deck' = the main deck; play vs location derives from the card type
// (backGroupForType), so it is not a zone of its own here.
export function zonesFor(card) {
  const type = card && card.type;
  const a = (card && card.attributes) || {};
  if (type === 'Site' || type === 'Region') return { primary: 'deck', extra: [] };
  if (type === 'Character') return { primary: 'pool', extra: ['deck', 'sideboard'] };
  if (type === 'Resource' && a.playableAsStartingMinorItem === true) {
    return { primary: 'deck', extra: ['sideboard', 'pool'] };
  }
  return { primary: 'deck', extra: ['sideboard'] };
}
