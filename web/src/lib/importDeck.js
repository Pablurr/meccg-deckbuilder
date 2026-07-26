// SECTION_TITLES/NOTE_TITLES are the canonical (English) headings emitted by
// buildDeckListText — imported here so the two files can never drift apart.
import { SECTION_TITLES, NOTE_TITLES } from './deckList.js';

// Aggressive normalization for full-name matching so the pasted list is
// forgiving. Beyond accents/case, it makes these all equivalent:
//   - hyphen vs space vs underscore ("star-glass" = "star glass")
//   - apostrophes/quotes/punctuation ("Thrór's Map" = "thrors map")
//   - "&" and "and", common ligatures (œ→oe, æ→ae, ß→ss)
//   - any extra whitespace
// It reduces a name to its bare alphanumeric characters.
export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, ''); // drop spaces, hyphens, apostrophes, punctuation
}

// Parse one "<qty>x <name>" line (the "x" and count are optional; a bare name
// means quantity 1). Extracted from parseDeckList so the section-aware
// document parser below (parseDeckListDocument) can reuse the exact same
// per-line rule.
//   "1x burat" -> { qty: 1, name: 'burat' }
//   "2 x beautiful gold ring" -> { qty: 2, name: 'beautiful gold ring' }
//   "glamour" -> { qty: 1, name: 'glamour' }
function parseLine(line) {
  const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/) || line.match(/^(\d+)[xX]\s*(.+)$/);
  let qty = 1;
  let name = line;
  if (m) {
    qty = parseInt(m[1], 10);
    name = m[2].trim();
  }
  return { raw: line, qty: Math.max(1, qty || 1), name };
}

// Parse a pasted deck list with no section structure at all (the flat legacy
// paste format, and still how a bare card-name-per-line clipboard paste is
// read). Kept byte-for-byte compatible with its original behavior.
export function parseDeckList(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    out.push(parseLine(line));
  }
  return out;
}

// Reverse lookup: canonical English `##` section heading -> target zone.
// "Play deck" and "Locations" (and any *unrecognized* `##` heading — which
// includes every legacy flat heading like "Characters (3)") are not listed
// here and fall back to the main deck ('quantities') in
// parseDeckListDocument below. That fallback is exactly what keeps old flat
// exports importing unchanged.
const ZONE_HEADING_TARGETS = { [SECTION_TITLES.pool]: 'pool', [SECTION_TITLES.sideboard]: 'sideboard' };

// Reverse lookup: canonical English `###` note heading -> notes field.
const NOTE_FIELD_BY_TITLE = Object.fromEntries(Object.entries(NOTE_TITLES).map(([field, title]) => [title, field]));

// Parse a full deck-list document (title + optional Notes + card sections)
// into the free-text notes plus a flat list of card lines, each tagged with
// its target zone ('quantities' | 'pool' | 'sideboard'). Sections are
// identified purely by canonical English `##`/`###` headings (see
// deckList.js's SECTION_TITLES/GROUP_TITLES/NOTE_TITLES), so a list exported
// in any UI language still imports — only card *names* are language-specific,
// and those are resolved later by resolveDeckList.
//
// The central hazard this guards against: prose under `## Notes` must never
// be read as a card line. For example a note reading "3x Gandalf is the
// plan" must not import three Gandalfs. The rule (per the task brief) is
// absolute: once mode === 'notes', every non-heading line — including one
// that looks exactly like "<qty>x <name>" — is appended to the current note
// field's text and is never passed to parseLine/matched against a card name.
// That branch never calls parseLine while mode is 'notes'; only the 'cards'
// branch does. Mode changes only on a `##` heading line, so a note body can
// never accidentally slip into 'cards' mode by itself.
//
// A `##` line inside a note's own text (e.g. a note that talks about
// Markdown) intentionally ends the notes section early and starts a new
// (unrecognized) section targeting the main deck — see the report for why
// this is an acceptable, documented trade-off rather than a bug: escaping
// arbitrary user prose while still allowing every real `##` heading to work
// as a heading is not solvable within a plain-text, line-oriented format.
export function parseDeckListDocument(text) {
  const notes = { starting: '', resourceStrategy: '', hazardStrategy: '', other: '' };
  const noteBuf = { starting: [], resourceStrategy: [], hazardStrategy: [], other: [] };
  const lines = [];

  // Starts in 'cards' mode targeting the main deck ('quantities') so that a
  // bare, headingless paste — the format ImportDialog's own placeholder
  // advertises ("Nx name" per line, no "##" anywhere) — is collected as
  // card lines instead of being silently dropped. Mode only ever *changes*
  // on a "##" heading below; a document that has one starts collecting into
  // whatever that first heading implies, exactly as before.
  let mode = 'cards'; // 'notes' | 'cards'
  let target = 'quantities'; // 'quantities' | 'pool' | 'sideboard' — only meaningful when mode === 'cards'
  let noteField = null; // only meaningful when mode === 'notes'
  let sawHeading = false; // becomes true on the first "##" heading; gates the "# title" skip below

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const heading = h2[1].trim();
      noteField = null;
      sawHeading = true;
      if (heading === 'Notes') {
        mode = 'notes';
        target = null;
      } else {
        mode = 'cards';
        target = ZONE_HEADING_TARGETS[heading] || 'quantities';
      }
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      // Inside 'cards' mode this is a group header ("Characters (3)", ...)
      // with no state to track beyond the enclosing section. Inside 'notes'
      // mode it selects which field subsequent lines accumulate into.
      if (mode === 'notes') noteField = NOTE_FIELD_BY_TITLE[h3[1].trim()] || 'other';
      continue;
    }

    if (!line) {
      // A blank line inside a note is part of that note's own paragraph
      // breaks — keep it. Blank lines elsewhere are pure formatting.
      if (mode === 'notes' && noteField) noteBuf[noteField].push('');
      continue;
    }

    // Only the deck-title line (always the first content line, before any
    // "##" heading) is skipped here. Gating on sawHeading keeps this from
    // also eating a note line that happens to start with "# " once we're
    // past the title — e.g. a note body reading "# 1 goal: ramp" must
    // round-trip intact, not get silently deleted.
    if (!sawHeading && line.startsWith('# ')) continue; // deck title, not part of the body

    if (mode === 'notes') {
      // Guard for the central hazard: never call parseLine here. A stray
      // line before the first ### field heading still lands in 'other' —
      // kept as text, never matched as a card.
      noteBuf[noteField || 'other'].push(line);
      continue;
    }

    lines.push({ ...parseLine(line), target });
  }

  for (const field of Object.keys(notes)) notes[field] = noteBuf[field].join('\n').trim();
  return { notes, lines };
}

// Index cards by their full name (en and fr, plus `extraLang` when it's a
// third language), normalized (accent/case-insensitive). `extraLang` lets a
// list exported in, say, Spanish or German still resolve on import even
// though only en/fr are indexed by default (matches ImportDialog's existing,
// unchanged default call with no second argument).
export function buildNameIndex(cards, extraLang) {
  const idx = new Map();
  const add = (name, card) => {
    const key = normalizeName(name);
    if (!key) return;
    if (!idx.has(key)) idx.set(key, []);
    const arr = idx.get(key);
    if (!arr.includes(card)) arr.push(card);
  };
  for (const c of cards) {
    add(c.name && c.name.en, c);
    add(c.name && c.name.fr, c);
    if (extraLang && extraLang !== 'en' && extraLang !== 'fr') add(c.name && c.name[extraLang], c);
  }
  return idx;
}

// Alignment preferences for auto-resolving duplicate-name lines on import.
// Each preference maps a (lowercased) alignment to a rank; lower = preferred.
// Alignments absent from a table are excluded (never auto-picked). See
// preferredMatchId for the tie/exclusion rules.
export const ALIGNMENT_PREFERENCES = {
  hero: { hero: 0, neutral: 1, dual: 1 },
  minion: { minion: 0, neutral: 1, dual: 1 },
  balrog: { balrog: 0, minion: 1, neutral: 2, dual: 2 },
  // Fallen-wizard/Stage win; neutral/dual next; a lone hero *or* minion is
  // acceptable, but a hero+minion pair ties (rank 2) so the player chooses.
  fallenWizard: { 'fallen-wizard': 0, stage: 0, neutral: 1, dual: 1, hero: 2, minion: 2 },
};

// Auto-pick one card from `matches` according to an alignment `preference` key
// (a key of ALIGNMENT_PREFERENCES). Returns the chosen id, or null when there
// is no preference, nothing qualifies, or the top rank is shared by several
// cards (a tie the player must resolve manually).
export function preferredMatchId(matches, preference) {
  const table = ALIGNMENT_PREFERENCES[preference];
  if (!table || !matches || matches.length === 0) return null;
  let bestRank = Infinity;
  let best = [];
  for (const c of matches) {
    const a = String((c && c.alignment) || '').toLowerCase();
    const rank = table[a] !== undefined ? table[a] : Infinity;
    if (rank < bestRank) { bestRank = rank; best = [c]; }
    else if (rank === bestRank && rank !== Infinity) best.push(c);
  }
  if (bestRank === Infinity || best.length !== 1) return null;
  return best[0].id;
}

// Resolve each parsed line to card matches by full-name equality (accent-insensitive).
//   status: 'ok' (1 match) | 'ambiguous' (>1) | 'notfound' (0)
export function resolveDeckList(parsed, nameIndex) {
  return parsed.map((item) => {
    const key = normalizeName(item.name);
    const matches = nameIndex.get(key) || [];
    let status = 'ok';
    if (matches.length === 0) status = 'notfound';
    else if (matches.length > 1) status = 'ambiguous';
    return { ...item, matches, status };
  });
}

// Full, non-interactive import: parse the section-aware document and resolve
// every card line against `cards` (by name, in `lang` — see buildNameIndex's
// `extraLang`). This is the round-trip entry point used by the deck
// round-trip tests and is what a legacy flat-format paste also goes through
// (every line simply targets 'quantities', since no zone headings are
// present, and there is no ## Notes to trigger notes mode).
//
// Ambiguous lines (matched by a shared name, e.g. a hero/minion pair) fall
// back to their first match here, exactly like ImportDialog's own default
// selection, but are also listed in `ambiguous` so an interactive caller can
// still prompt to disambiguate. Unmatched lines are omitted from
// quantities/zones and listed in `unmatched`.
export function importDeckList(text, cards, lang = 'en') {
  const { notes, lines } = parseDeckListDocument(text);
  const nameIndex = buildNameIndex(cards, lang);
  const resolved = resolveDeckList(lines, nameIndex);

  const quantities = {};
  const zones = { pool: {}, sideboard: {} };
  const unmatched = [];
  const ambiguous = [];

  for (const line of resolved) {
    if (line.status === 'notfound') {
      unmatched.push(line);
      continue;
    }
    if (line.status === 'ambiguous') ambiguous.push(line);
    const id = line.matches[0].id;
    const bucket = line.target === 'pool' ? zones.pool : line.target === 'sideboard' ? zones.sideboard : quantities;
    bucket[id] = (bucket[id] || 0) + line.qty;
  }

  return { quantities, zones, notes, unmatched, ambiguous };
}
