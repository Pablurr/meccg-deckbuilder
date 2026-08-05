// The single source of export order: the PDF, the ZIP and the text list all
// consume it, so they cannot disagree. Applies in both deck modes — a freeform
// deck exports in this order too (owner decision, 2026-07-26), so there is only
// one export order to explain. Sections: Pool, Play deck, Locations, Sideboard,
// Sideboard vs FW.
import { cardName } from '../lang.js';
import { backGroupForType } from '../deck.js';

// 1.6.1's Fallen-wizard sideboard holds the same kinds of card as the
// ordinary one, so it groups the same way. Shared rather than copied: two
// copies of this list are two things to keep in agreement for one rule.
const SIDEBOARD_GROUPS = [
  { id: 'characters', match: (c) => c.type === 'Character' },
  { id: 'resources', match: (c) => c.type === 'Resource' },
  { id: 'hazards', match: (c) => c.type === 'Hazard' },
];

const GROUP_DEFS = {
  pool: [
    { id: 'characters', match: (c) => c.type === 'Character' },
    { id: 'resources', match: (c) => c.type === 'Resource' },
  ],
  play: [
    { id: 'avatars', match: (c) => c.attributes.avatar === true },
    { id: 'characters', match: (c) => c.type === 'Character' && !c.attributes.avatar },
    { id: 'resources', match: (c) => c.type === 'Resource' },
    { id: 'hazards', match: (c) => c.type === 'Hazard' },
  ],
  locations: [
    { id: 'sites', match: (c) => c.type === 'Site' },
    { id: 'regions', match: (c) => c.type === 'Region' },
  ],
  sideboard: SIDEBOARD_GROUPS,
  // A separate SECTION though it groups identically: it is a separate ten-card
  // allowance, and the player has to be able to count it on its own.
  sideboardFw: SIDEBOARD_GROUPS,
};

function toEntries(map, cardsById) {
  return Object.entries(map)
    .map(([id, count]) => ({ card: cardsById.get(id), count }))
    .filter((e) => e.card && e.count > 0);
}

function grouped(sectionId, entries, lang) {
  const defs = GROUP_DEFS[sectionId];
  const groups = defs.map((d) => ({ id: d.id, entries: [] }));
  const misc = { id: 'other', entries: [] };
  for (const e of entries) {
    const g = defs.findIndex((d) => d.match(e.card));
    (g >= 0 ? groups[g] : misc).entries.push(e);
  }
  if (misc.entries.length) groups.push(misc);
  // Locale pinned to 'en' for the *collation rules only* (card names still
  // render in `lang`) so sort order can't diverge between a browser's and
  // Node's default locale — this module is billed as the order the PDF
  // exporter will also use, so it must be reproducible across environments.
  for (const g of groups) g.entries.sort((a, b) => cardName(a.card, lang).localeCompare(cardName(b.card, lang), 'en'));
  return groups.filter((g) => g.entries.length > 0);
}

export function deckSections({ quantities = {}, zones = {}, cardsById, lang = 'en' }) {
  const main = toEntries(quantities, cardsById);
  const play = main.filter((e) => backGroupForType(e.card.type) === 'playdeck');
  const locations = main.filter((e) => backGroupForType(e.card.type) === 'locationdeck');
  const sections = [
    { id: 'pool', entries: toEntries(zones.pool || {}, cardsById) },
    { id: 'play', entries: play },
    { id: 'locations', entries: locations },
    { id: 'sideboard', entries: toEntries(zones.sideboard || {}, cardsById) },
    { id: 'sideboardFw', entries: toEntries(zones.sideboardFw || {}, cardsById) },
  ];
  return sections
    .map((s) => ({ id: s.id, groups: grouped(s.id, s.entries, lang) }))
    .filter((s) => s.groups.length > 0);
}

export function flattenSections(sections) {
  const out = [];
  for (const s of sections) for (const g of s.groups) for (const e of g.entries) out.push(e);
  return out;
}
