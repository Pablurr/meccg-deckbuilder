import { SIDE_IDS, LENGTH_IDS } from './constants.js';

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

// The empty shape of `zones`, in one place. normalizeDeck guarantees this for
// anything read from storage, but App and the importer build zones objects in
// memory that never pass through it -- and a map missing here is not a missing
// feature, it is a TypeError in bumpCount (deckMutations.js) the first time a
// card is routed to that zone. Adding a sixth zone must mean editing exactly
// this function; grep the repo for `sideboard: {}` afterwards to make sure no
// hand-rolled copy of this shape survived the edit.
export function emptyZones() {
  return { sideboard: {}, pool: {}, sideboardFw: {} };
}

// Expand a { id: count } map into an ordered list with repeats (for export/counts).
export function expandQuantities(quantities = {}) {
  const out = [];
  for (const [id, count] of Object.entries(quantities)) {
    for (let i = 0; i < count; i++) out.push(id);
  }
  return out;
}

// Every copy held anywhere in the deck: play deck plus sideboard plus pool.
//
// Distinct from deckCounts().total, which counts the play deck alone because
// it feeds the per-type/per-alignment breakdown of that deck. Anything gating
// on "does this deck have cards" must use THIS one: a card added only to the
// pool or the sideboard is genuinely in the deck -- the panel lists it and the
// export prints it -- so a play-deck-only total wrongly reported an empty deck
// and left the drawer's "view deck" button disabled, which on mobile is the
// only way to reach those zones at all.
export function totalCopies(quantities = {}, zones = {}) {
  const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  return sum(quantities) + sum(zones.sideboard) + sum(zones.pool) + sum(zones.sideboardFw);
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

// Non-blocking warnings shown in the drawer, as translation-ready descriptors:
//   { code: 'emptyDeck' } | { code: 'missingBack', group } | { code: 'missingImage', count }
// defaultBacks: { playdeck: bool, locationdeck: bool } — groups covered by a shipped default.
export function deckWarnings(cardsById, cardIds, backAssignments = {}, defaultBacks = {}) {
  const warnings = [];
  if (cardIds.length === 0) warnings.push({ code: 'emptyDeck' });
  const groupsUsed = new Set(cardIds.map((id) => cardsById.get(id)).filter(Boolean).map((c) => backGroupForType(c.type)));
  for (const group of groupsUsed) {
    if (!backAssignments[group] && !defaultBacks[group]) warnings.push({ code: 'missingBack', group });
  }
  const missingImg = cardIds.map((id) => cardsById.get(id)).filter((c) => c && !c.image);
  if (missingImg.length) warnings.push({ code: 'missingImage', count: missingImg.length });
  return warnings;
}

export const EMPTY_NOTES = { starting: '', resourceStrategy: '', hazardStrategy: '', other: '' };

// Fill mode/ruleset/zones/notes with safe defaults. A record without `mode`
// (every pre-existing deck) reads as freeform; a deckbuilding record whose
// side or length is unknown falls back to freeform rather than throwing.
export function normalizeDeck(d = {}) {
  // Built from emptyZones()'s own keys, not a re-listing of them, so the two
  // cannot drift: a zone added to emptyZones() alone is enough for a deck
  // written before it existed to read as having it, empty -- there is no
  // schema version number to branch on instead.
  const zones = Object.fromEntries(
    Object.keys(emptyZones()).map((z) => [z, { ...((d.zones && d.zones[z]) || {}) }]),
  );
  const notes = { ...EMPTY_NOTES, ...(d.notes || {}) };
  let mode = d.mode === 'deckbuilding' ? 'deckbuilding' : 'freeform';
  let ruleset = null;
  if (mode === 'deckbuilding') {
    const r = d.ruleset || {};
    if (SIDE_IDS.includes(r.side) && LENGTH_IDS.includes(r.length)) {
      ruleset = { side: r.side, length: r.length, tournament: !!r.tournament, ruleOverrides: { ...(r.ruleOverrides || {}) } };
    } else {
      mode = 'freeform';
    }
  }
  // "Ignore this rule" choices must survive a deckbuilding -> freeform -> back
  // round-trip: freeform has no `ruleset` to hold ruleOverrides (it's nulled
  // above), so DeckSetupDialog.confirm losing that object would silently wipe
  // every per-deck override. Kept as its own top-level field, independent of
  // `ruleset`, and mirrored from ruleset.ruleOverrides whenever one exists so
  // it's always the latest choices; when there's no ruleset (freeform), the
  // previously-saved value passes through untouched instead of being reset.
  const savedRuleOverrides = { ...((ruleset && ruleset.ruleOverrides) || d.savedRuleOverrides || {}) };
  return { ...d, mode, ruleset, zones, notes, savedRuleOverrides, order: typeof d.order === 'number' ? d.order : null };
}
