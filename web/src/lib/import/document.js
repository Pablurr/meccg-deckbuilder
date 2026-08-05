// Turn a pasted document into { name, meta, notes, lines }.
//
// Four pieces of state: the target zone, the type hint, the mode
// (cards | notes | meta) and, in notes mode, the field being filled.
//
// Two guarantees this file exists to keep:
//
// 1. NOTES MODE IS ABSOLUTE. Once in it, no line is ever handed to the card
//    parser -- not even one shaped exactly like "3x Gandalf". A note reading
//    "3x Gandalf is the plan" must not import three Gandalfs.
//
// 2. NOTHING IS LOST. A line with no explicit quantity that matches no card is
//    prose, and prose goes to the notes. A line WITH an explicit quantity
//    stays a card line even when it matches nothing, because the intent there
//    was plainly a card and a typo must still be reported.
//
// An UNKNOWN heading goes to the notes and LEAVES THE ZONE ALONE. The previous
// implementation reset the target to the main deck on any unrecognised "##",
// so a "Plan de jeu" written inside the sideboard sent every following card
// back to the play deck.
import { parseLineCandidates } from './line.js';
import { lookupHeading, lookupMetaKey, parseMetaValue } from './vocabulary.js';

const NOTE_FIELDS = ['starting', 'resourceStrategy', 'hazardStrategy', 'other'];

// "- Side: Balrog" / "Camp : Balrog" / "Side = Balrog"
const META_LINE = /^\s*[-*+•]?\s*([^:=]+)\s*[:=]\s*(.+)\s*$/;

export function parseDocument(text) {
  const notes = { starting: '', resourceStrategy: '', hazardStrategy: '', other: '' };
  const buf = { starting: [], resourceStrategy: [], hazardStrategy: [], other: [] };
  const meta = { mode: null, side: null, length: null };
  const lines = [];

  let mode = 'cards';
  let target = 'quantities';
  let typeHint = null;
  let noteField = null;
  let name = '';
  let sawHeading = false;

  const pushNote = (s) => { buf[noteField || 'other'].push(s); };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();

    if (!line) {
      // A blank line inside a note is that note's own paragraph break.
      if (mode === 'notes') pushNote('');
      continue;
    }

    // The deck title: only before the first recognised heading, so a note
    // body reading "# 1 objectif : ramper" round-trips instead of vanishing.
    if (!sawHeading && !name && /^#\s+/.test(line) && !lookupHeading(line)) {
      name = line.replace(/^#\s+/, '').trim();
      continue;
    }

    const heading = lookupHeading(line);
    if (heading) {
      sawHeading = true;
      if (heading.family === 'zone') {
        // A zone heading clears the type hint -- unless it brings one of its
        // own ("## Sites" is both), in which case dropping it would throw
        // away a disambiguator the player did write down.
        mode = 'cards'; target = heading.zone; typeHint = heading.type || null; noteField = null;
      } else if (heading.family === 'group') {
        // Does NOT change the zone. Only the hint.
        mode = 'cards'; typeHint = heading.type || null; noteField = null;
      } else if (heading.family === 'notes') {
        mode = 'notes';
        noteField = NOTE_FIELDS.includes(heading.field) ? heading.field : null;
      } else {
        mode = 'meta'; noteField = null;
      }
      continue;
    }

    if (mode === 'notes') { pushNote(line); continue; }

    if (mode === 'meta') {
      const m = line.match(META_LINE);
      const key = m && lookupMetaKey(m[1]);
      if (key) {
        const value = parseMetaValue(key, m[2]);
        if (value) meta[key] = value;
      }
      // An unrecognised key is dropped rather than becoming a card or a note:
      // inside a metadata block, a "Key: Value" line is metadata by position.
      continue;
    }

    // Every non-heading line in cards mode becomes a card line here. Prose is
    // NOT separated out at this stage: telling "Contrôler les havres tôt"
    // from a bare card name requires the card index, which this module does
    // not have and must not grow. resolve.js does that split.
    const candidates = parseLineCandidates(line);
    const baseline = candidates[candidates.length - 1];
    if (!baseline.name) continue;
    lines.push({ raw: line, qty: baseline.qty, name: baseline.name, target, typeHint, candidates });
  }

  for (const f of NOTE_FIELDS) notes[f] = buf[f].join('\n').trim();
  return { name, meta, notes, lines };
}
