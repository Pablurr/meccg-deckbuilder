// Public face of the import pipeline. The work lives in ./import/*; this file
// exists so every existing caller and test keeps the API it was written
// against while the parser underneath was split into testable units.
//
// See docs/superpowers/specs/2026-08-03-import-zones-design.md for the design.
export { normalizeName } from './import/normalize.js';
export { parseLineCandidates, stripDecoration } from './import/line.js';
export { lookupHeading } from './import/vocabulary.js';
export { parseDocument } from './import/document.js';
export {
  buildNameIndex, resolveLines, classifyHint,
  ALIGNMENT_PREFERENCES, preferredMatchId, PREF_BY_SIDE,
} from './import/resolve.js';
export { targetForCard, bucketFor } from './import/target.js';

import { parseLineCandidates } from './import/line.js';
import { parseDocument } from './import/document.js';
import { buildNameIndex, resolveLines } from './import/resolve.js';
import { normalizeName } from './import/normalize.js';
import { bucketFor } from './import/target.js';

// Flat, sectionless paste. Each entry carries the pre-refactor reading
// (leading quantity only) so the shape callers destructure is unchanged.
export function parseDeckList(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const candidates = parseLineCandidates(line);
    const baseline = candidates[candidates.length - 1];
    out.push({ raw: line, qty: baseline.qty, name: baseline.name });
  }
  return out;
}

// `qty` and `name` mirror the LAST candidate on purpose: that reading is
// byte-for-byte the old parseLine, so anything reading these two fields keeps
// working.
//
// parseDocument's own lines carry two more fields this facade must NOT leak:
// `typeHint` (a disambiguation hint for resolveLines) and `candidates` (every
// peeled reading, for the same). Neither existed pre-refactor, and
// test/importDeck.test.js pins the old four-field shape with toEqual, which
// fails on any extra key -- so they are stripped here. ImportDialog and any
// other caller that wants them uses `parseDocument` directly (re-exported
// above) instead of this compatibility wrapper.
export function parseDeckListDocument(text) {
  const { notes, lines } = parseDocument(text);
  return { notes, lines: lines.map(({ raw, qty, name, target }) => ({ raw, qty, name, target })) };
}

// Resolve without a side or a card index beyond the name index -- the
// non-interactive path. Kept for callers that only have a name index.
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

// Full, non-interactive import: the round-trip entry point.
export function importDeckList(text, cards, lang = 'en') {
  const doc = parseDocument(text);
  const nameIndex = buildNameIndex(cards, lang);
  const cardsById = new Map(cards.map((c) => [c.id, c]));

  // Card records carry a setCode but not a set's display name -- the name
  // lives in cards.json's top-level `sets` block, which only the app (not
  // this pure-data function) has. Building the table from `cards` alone
  // means a parenthetical SET CODE, e.g. "(AS)", narrows a match, while a
  // spelled-out set name in the same parenthetical still won't -- correct
  // and honest, not a shortfall: this entry point genuinely cannot resolve
  // what it was never given. (Passing `setNames: {}` here, as originally
  // drafted, makes classifyHint's set lookup loop never run, so a set-code
  // hint reads as 'unknown' -- silently losing its disambiguating power and,
  // since isMarked below only counts an 'id'/'set'/'alignment' hint as a
  // mark, routing an unmatched "Name (AS)" line to prose instead of
  // reporting it in `unmatched`.)
  const setNames = {};
  for (const c of cards) if (c.setCode && !setNames[c.setCode]) setNames[c.setCode] = {};

  const { resolved } = resolveLines(doc.lines, { nameIndex, cardsById, setNames, side: doc.meta.side });

  // resolveLines treats an unmarked line that matches no card as prose, not
  // a miss -- lenience built for the future interactive dialog, which shows
  // the player what it kept as plain text (a pasted forum post's commentary
  // must survive). importDeckList has no such display: it is the
  // non-interactive round trip, so nothing parseDocument put in 'cards' mode
  // may vanish without a trace -- test/importDeck.test.js's headingless-paste
  // case pins exactly this (a bare "glamour" line must land in `unmatched`).
  // Reclaim every line resolveLines dropped by comparing raw text: its
  // classification is a pure function of a line's own content, so identical
  // raw strings always land on the same side of the split and this
  // Set-difference can't cross-wire two different lines that happen to share
  // text.
  // `line.candidates[0]` (not the baseline doc.lines carries) on purpose:
  // that is exactly the reading resolveOne's own notfound fallback reports
  // (see resolve.js), so a reclaimed miss and a miss resolveOne resolved
  // itself always agree on `name`/`qty` -- otherwise the SAME kind of line
  // (e.g. one with a trailing "(...)" hint) would report peeled or unpeeled
  // depending on the accident of which path it took, which is exactly the
  // kind of inconsistency a player reading `unmatched[i].name` would notice.
  const resolvedRaws = new Set(resolved.map((r) => r.raw));
  const reclaimed = doc.lines
    .filter((line) => !resolvedRaws.has(line.raw))
    .map((line) => ({
      ...line,
      qty: line.candidates[0].qty,
      name: line.candidates[0].name,
      matches: [],
      status: 'notfound',
    }));

  const quantities = {};
  const zones = { pool: {}, sideboard: {} };
  const unmatched = [];
  const ambiguous = [];

  for (const line of [...resolved, ...reclaimed]) {
    // `line` (from resolveLines or from `reclaimed` above) still carries
    // `candidates`/`typeHint` -- resolveLines' own input/output shape, which
    // never existed pre-refactor. Same leak as parseDeckListDocument's, same
    // fix: strip before this object escapes as a public `unmatched`/
    // `ambiguous` entry. `quantities`/`zones` never see the object itself
    // (just `id`/`qty`), so they need no stripping.
    const { candidates, typeHint, ...clean } = line;
    if (clean.status === 'notfound') { unmatched.push(clean); continue; }
    if (clean.status === 'ambiguous') ambiguous.push(clean);
    const card = clean.matches[0];
    const bucket = bucketFor(card, clean.target, { quantities, zones });
    bucket[card.id] = (bucket[card.id] || 0) + clean.qty;
  }

  return { quantities, zones, notes: doc.notes, unmatched, ambiguous, meta: doc.meta, name: doc.name };
}
