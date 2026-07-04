// Back-group mapping, duplicated from src/exporter.js (tiny, stable map;
// kept here so the browser bundle needs no server import).
export const BACK_GROUPS = {
  Character: 'playdeck',
  Resource: 'playdeck',
  Hazard: 'playdeck',
  Site: 'locationdeck',
  Region: 'locationdeck',
};

export function backGroupForType(type) {
  return BACK_GROUPS[type] || 'playdeck';
}

// Copy limits: unique cards max 1, everything else max 3.
export const MAX_COPIES = 3;
export function maxCopies(card) {
  return card && card.attributes && card.attributes.unique === true ? 1 : MAX_COPIES;
}

// Expand a { id: count } map into an ordered list with repeats (for export/counts).
export function expandQuantities(quantities = {}) {
  const out = [];
  for (const [id, count] of Object.entries(quantities)) {
    for (let i = 0; i < count; i++) out.push(id);
  }
  return out;
}

// Rebuild a { id: count } map from a (possibly repeated) list of ids.
export function countOccurrences(cardIds = []) {
  const q = {};
  for (const id of cardIds) q[id] = (q[id] || 0) + 1;
  return q;
}

// Live counters for the deck drawer.
// cardsById: Map<id, card>; cardIds: array of selected ids.
export function deckCounts(cardsById, cardIds) {
  const counts = {
    total: cardIds.length,
    byType: {},
    byAlignment: {},
    byGroup: { playdeck: 0, locationdeck: 0 },
  };
  for (const id of cardIds) {
    const c = cardsById.get(id);
    if (!c) continue;
    counts.byType[c.type] = (counts.byType[c.type] || 0) + 1;
    counts.byAlignment[c.alignment] = (counts.byAlignment[c.alignment] || 0) + 1;
    counts.byGroup[backGroupForType(c.type)] += 1;
  }
  return counts;
}

// Non-blocking warnings shown in the drawer.
// defaultBacks: { playdeck: bool, locationdeck: bool } — groups covered by a shipped default.
export function deckWarnings(cardsById, cardIds, backAssignments = {}, defaultBacks = {}) {
  const warnings = [];
  if (cardIds.length === 0) warnings.push('Deck vide.');
  const groupsUsed = new Set(cardIds.map((id) => cardsById.get(id)).filter(Boolean).map((c) => backGroupForType(c.type)));
  for (const group of groupsUsed) {
    if (!backAssignments[group] && !defaultBacks[group]) warnings.push(`Dos manquant pour le groupe « ${group} ».`);
  }
  const missingImg = cardIds.map((id) => cardsById.get(id)).filter((c) => c && !c.relativePath);
  if (missingImg.length) warnings.push(`${missingImg.length} carte(s) sans image source.`);
  return warnings;
}
