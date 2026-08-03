// Build a human-readable, re-importable deck list grouped by card type.
// cardsById: Map<id, card>; quantities: { id: count }.
//
//   # Deck name
//
//   ## Metadata
//
//   - Mode: Deckbuilding
//
//   ## Notes
//
//   ### Starting notes
//
//   ...
//
//   ## Pool
//
//   ### Characters (3)
//   1x Bûrat
//   2x ...
//
//   ## Sites (2)
//   ...
//
// Section/group headings are always canonical English (see SECTION_TITLES/
// GROUP_TITLES/NOTE_TITLES below) regardless of the UI language, so a list
// exported in French still imports — only card names follow `lang`.

import { cardName } from './lang.js';
import { deckSections } from './export/deckSections.js';
import { TYPE_ORDER } from './constants.js';

export { TYPE_ORDER } from './constants.js';

// Canonical (English) section/group/note headings — must match the reverse
// lookups in importDeck.js exactly.
export const SECTION_TITLES = { pool: 'Pool', play: 'Play deck', locations: 'Locations', sideboard: 'Sideboard' };
export const GROUP_TITLES = { avatars: 'Avatars', characters: 'Characters', resources: 'Resources', hazards: 'Hazards', sites: 'Sites', regions: 'Regions', other: 'Other' };
export const NOTE_TITLES = { starting: 'Starting notes', resourceStrategy: 'Resource strategy', hazardStrategy: 'Hazard strategy', other: 'Other notes' };

// Deck metadata, emitted right under the title so a pasted list can restore
// the mode/side/length the deck was built under.
//
// The heading is "Metadata" and NOT "Deck": the import vocabulary already
// reads the bare word "deck" as the play deck, which is how community lists
// use it, and one reading per word is what keeps that vocabulary a flat table.
export const METADATA_TITLE = 'Metadata';
export const META_KEYS = { mode: 'Mode', side: 'Side', length: 'Game length' };

// Canonical English values, like every heading here and for the same reason:
// a list exported in French must re-import. The parser additionally accepts
// the localized labels and the raw ids, because a human will write them.
const META_MODE = { freeform: 'Freeform', deckbuilding: 'Deckbuilding' };
const META_SIDE = { wizard: 'Wizard', ringwraith: 'Ringwraith', 'fallen-wizard': 'Fallen-wizard', balrog: 'Balrog' };
const META_LENGTH = { starter: 'Starter', standard: 'Standard', long: 'Long', campaign: 'Campaign' };

// Bucket a { card, qty } entry list by TYPE_ORDER, sorted by name within each
// group, dropping empty groups. Shared by the deck panel's zone tabs (play,
// pool, sideboard, location, cards) — same grouping the panel has always
// used, factored out here alongside buildDeckListText since both group deck
// entries by card type in the same fixed order.
export function buildGroups(entries, lang) {
  return TYPE_ORDER.map((type) => {
    const items = entries
      .filter((it) => it.card && it.card.type === type)
      .sort((a, b) => cardName(a.card, lang).localeCompare(cardName(b.card, lang)));
    return { type, items };
  }).filter((g) => g.items.length > 0);
}

// deckSections() is the single source of export order (Pool → Play deck →
// Locations → Sideboard, empty sections/groups already dropped) — build the
// text on top of it, never re-derive the order here.
//
// Notes render first (after the title), one `###` heading per non-empty
// field, in NOTE_TITLES order; empty fields are omitted entirely. Everything
// under `## Notes` is prose for a human to read — see importDeck.js for how
// the parser is kept from ever mistaking a note line (e.g. "3x Gandalf is
// the plan") for a card entry.
export function buildDeckListText(cardsById, quantities = {}, deckName = 'Deck', lang = 'fr', { zones = { sideboard: {}, pool: {} }, notes = {}, mode = 'freeform', ruleset = null } = {}) {
  const lines = [`# ${deckName}`, ''];

  // Always emitted, even in freeform: a block that is sometimes absent is a
  // conditional the reader has to reconstruct, and "Mode: Freeform" is two
  // lines that make the round trip total.
  lines.push(`## ${METADATA_TITLE}`, '');
  lines.push(`- ${META_KEYS.mode}: ${META_MODE[mode] || META_MODE.freeform}`);
  if (mode === 'deckbuilding' && ruleset) {
    if (META_SIDE[ruleset.side]) lines.push(`- ${META_KEYS.side}: ${META_SIDE[ruleset.side]}`);
    if (META_LENGTH[ruleset.length]) lines.push(`- ${META_KEYS.length}: ${META_LENGTH[ruleset.length]}`);
  }
  lines.push('');

  const noteEntries = Object.entries(NOTE_TITLES).filter(([field]) => (notes[field] || '').trim());
  if (noteEntries.length) {
    lines.push('## Notes', '');
    for (const [field, title] of noteEntries) lines.push(`### ${title}`, '', notes[field].trim(), '');
  }

  for (const section of deckSections({ quantities, zones, cardsById, lang })) {
    lines.push(`## ${SECTION_TITLES[section.id]}`, '');
    for (const group of section.groups) {
      const total = group.entries.reduce((sum, e) => sum + e.count, 0);
      lines.push(`### ${GROUP_TITLES[group.id]} (${total})`);
      for (const e of group.entries) lines.push(`${e.count}x ${cardName(e.card, lang)}`);
      lines.push('');
    }
  }
  return lines.join('\n').trim() + '\n';
}
