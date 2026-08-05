// Turns the section -> group -> card tree from deckSections() into a flat,
// ordered list of "slots": one slot per physical copy. Built on top of that
// tree rather than recomputing it, so the canonical export order stays owned
// by deckSections.js alone.

// The key is qualified by section AND group because the same card can sit in
// several sections at once (two copies in the play deck, one in the sideboard
// prints once per copy, in every section it appears in). A key reduced to the
// card id would merge those stacks into one.
function slotKey(sectionId, groupId, cardId, copyIndex) {
  return `${sectionId}:${groupId}:${cardId}:${copyIndex}`;
}

export function buildSlots(sections) {
  const slots = [];
  for (const section of sections) {
    for (const group of section.groups) {
      for (const entry of group.entries) {
        // Which copy is ticked never matters -- two copies of a card are
        // interchangeable in print. copyIndex only keeps the keys distinct.
        for (let copyIndex = 0; copyIndex < entry.count; copyIndex += 1) {
          slots.push({
            key: slotKey(section.id, group.id, entry.card.id, copyIndex),
            sectionId: section.id,
            groupId: group.id,
            cardId: entry.card.id,
            copyIndex,
          });
        }
      }
    }
  }
  return slots;
}

export function allKeys(slots) {
  return new Set(slots.map((s) => s.key));
}
