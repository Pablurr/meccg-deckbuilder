// Compound tag handling for the race / subtype / skills filters.
//
// Card fields pack several tags into one string (skills "Warrior/Diplomat/Sage",
// race "Orcs,Men"). Filters should list only base options and match any card
// carrying the tag. This module is the single source of truth for splitting a
// field value into its base tokens and for building the facet option lists.

// Plural/variant race forms folded onto their singular base so the filter shows
// one option per race. Forms without a singular partner in the data
// (Giants, Spiders, Bears) are left untouched.
const RACE_ALIASES = {
  Animals: 'Animal',
  Dwarves: 'Dwarf',
  Elves: 'Elf',
  Men: 'Man',
  Orcs: 'Orc',
  Trolls: 'Troll',
  Wolves: 'Wolf',
  Dúnedain: 'Dúnadan',
};

// Per-facet config: which attribute holds the value, what separates the tags,
// and an optional alias map applied to each token.
const FACET_TAGS = {
  races: { attr: 'race', sep: ',', aliases: RACE_ALIASES },
  subtypes: { attr: 'subtype', sep: '/', aliases: null },
  skills: { attr: 'skills', sep: '/', aliases: null },
};

export function isTagFacet(key) {
  return Object.prototype.hasOwnProperty.call(FACET_TAGS, key);
}

// Split a raw field value into trimmed, canonicalized base tokens.
export function splitTags(value, key) {
  const cfg = FACET_TAGS[key];
  if (!cfg || !value) return [];
  return String(value)
    .split(cfg.sep)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (cfg.aliases && cfg.aliases[t]) || t);
}

// Base tokens for a card's field, for the given facet key.
export function cardTags(card, key) {
  const cfg = FACET_TAGS[key];
  if (!cfg) return [];
  return splitTags((card.attributes || {})[cfg.attr], key);
}

// Sorted, de-duplicated base options across all cards, for the facet menu.
export function baseOptions(cards, key) {
  const set = new Set();
  for (const c of cards) for (const t of cardTags(c, key)) set.add(t);
  return [...set].sort();
}
