// Pure cores of App's quantity mutators, extracted so the copy-cap guard can be
// unit-tested without a DOM -- the same reason dropTargets.js was extracted
// from DeckPanel.
//
// `room` is how many more copies may be added (Infinity when uncapped). The cap
// gates INCREMENTS ONLY: a count already over its cap -- from a freeform deck
// switched to deckbuilding, an import, or a side change -- is never reduced,
// and a decrement always goes through.

// Floor at 0 and delete the key, so an absent card and a zero count are the
// same thing everywhere downstream.
export function bumpCount(map, id, delta) {
  const next = Math.max(0, (map[id] || 0) + delta);
  const out = { ...map };
  if (next <= 0) delete out[id];
  else out[id] = next;
  return out;
}

export function applyDelta(map, id, delta, room) {
  if (delta > 0 && !(room > 0)) return map; // blocked: hand back the same map
  return bumpCount(map, id, delta);
}

// First click selects one copy, second deselects. Adding one copy can still
// breach a cumulative cap -- a unique card held in the pool leaves no room in
// the deck -- so the guard applies here too.
export function applyToggle(map, id, room) {
  const out = { ...map };
  if (out[id]) { delete out[id]; return out; }
  if (!(room > 0)) return map;
  out[id] = 1;
  return out;
}

// Add one copy of every id that isn't selected yet. roomFor is consulted
// against the ACCUMULATING map so a cap reached partway through is respected.
export function applySelectAll(map, ids, roomFor) {
  const out = { ...map };
  for (const id of ids) {
    if (out[id]) continue;
    if (!(roomFor(id, out) > 0)) continue;
    out[id] = 1;
  }
  return out;
}
