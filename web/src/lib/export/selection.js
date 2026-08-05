import { emptyZones } from '../deck.js';

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

export function toggle(selected, key) {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function setMany(selected, keys, value) {
  const next = new Set(selected);
  for (const key of keys) {
    if (value) next.add(key);
    else next.delete(key);
  }
  return next;
}

// `orderedSlots` is whatever the caller considers rangeable -- the dialog passes
// only the slots currently on screen, so a collapsed section is skipped the way
// a spreadsheet skips hidden rows. Keeping that filtering in the caller is what
// lets this module stay ignorant of collapsing.
export function selectRange(selected, orderedSlots, anchorKey, targetKey, value) {
  const from = orderedSlots.findIndex((s) => s.key === anchorKey);
  const to = orderedSlots.findIndex((s) => s.key === targetKey);
  // The anchor can have been collapsed away since it was clicked. Spanning to a
  // slot that is no longer on screen would touch cards the user cannot see.
  if (from === -1 || to === -1) return setMany(selected, [targetKey], value);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return setMany(selected, orderedSlots.slice(lo, hi + 1).map((s) => s.key), value);
}

export function groupState(selected, keys) {
  let on = 0;
  for (const key of keys) if (selected.has(key)) on += 1;
  // Order matters: an empty group satisfies both `on === 0` and
  // `on === keys.length`, and 'none' is the answer that renders an empty box.
  if (on === 0) return 'none';
  return on === keys.length ? 'all' : 'partial';
}

// The ZIP and the PDF take a flat id list; slots are already in canonical
// order, so filtering preserves it for free.
export function selectedCardIds(slots, selected) {
  return slots.filter((s) => selected.has(s.key)).map((s) => s.cardId);
}

const ZONE_OF_SECTION = { pool: 'pool', sideboard: 'sideboard', sideboardFw: 'sideboardFw' };

// The text list does NOT take an id list: buildDeckListText re-derives its own
// sections from raw `quantities` and `zones`. Filtering only the id list would
// leave the .txt showing the whole deck, with nothing to signal it.
export function selectedQuantitiesZones(slots, selected) {
  const quantities = {};
  const zones = emptyZones();
  for (const slot of slots) {
    if (!selected.has(slot.key)) continue;
    // `play` and `locations` are one map that deckSections() split by card
    // type; the projection has to put them back, or the .txt loses the sites.
    const target = slot.sectionId === 'play' || slot.sectionId === 'locations'
      ? quantities
      : zones[ZONE_OF_SECTION[slot.sectionId]];
    // No fallback here on purpose: slots only ever come from buildSlots(deckSections(...)),
    // whose five section ids all resolve. A new section id with no destination
    // must throw here, not silently drop its cards from the .txt.
    target[slot.cardId] = (target[slot.cardId] || 0) + 1;
  }
  return { quantities, zones };
}
