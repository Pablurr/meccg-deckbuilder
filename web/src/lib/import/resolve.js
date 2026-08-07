// Resolve parsed lines to cards.
//
// The disambiguation stack, in order. EACH RANK NARROWS the candidate set,
// and IS IGNORED IF IT WOULD EMPTY IT -- a wrong hint must never turn a card
// that exists into a card that does not.
//
//   0. candidate readings  keep the first reading that matches a real card
//   1. parenthesis         id decides outright; set code/name and alignment narrow
//   2. sub-section         narrows by card type
//   3. side                narrows by alignment (ALIGNMENT_PREFERENCES)
//
// Rank 1 is sovereign over rank 3: what is written down beats what is
// inferred, even when the result is illegal for the side. The card is
// imported and marked, never silently swapped.
import { normalizeName } from './normalize.js';

// Alignment preferences for auto-resolving duplicate-name lines. Each maps a
// (lowercased) alignment to a rank; lower = preferred. Alignments absent from
// a table are excluded (never auto-picked).
export const ALIGNMENT_PREFERENCES = {
  hero: { hero: 0, neutral: 1, dual: 1 },
  minion: { minion: 0, neutral: 1, dual: 1 },
  balrog: { balrog: 0, minion: 1, neutral: 2, dual: 2 },
  // Fallen-wizard/Stage win; neutral/dual next; a lone hero *or* minion is
  // acceptable, but a hero+minion pair ties (rank 2) so the player chooses.
  fallenWizard: { 'fallen-wizard': 0, stage: 0, neutral: 1, dual: 1, hero: 2, minion: 2 },
};

export const PREF_BY_SIDE = {
  wizard: 'hero',
  ringwraith: 'minion',
  balrog: 'balrog',
  'fallen-wizard': 'fallenWizard',
};

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

// Index cards by full name (en and fr, plus `extraLang` when it is a third
// language), normalized. A list exported in Spanish or German still resolves.
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

const ALIGNMENTS = ['hero', 'minion', 'neutral', 'dual', 'balrog', 'fallen-wizard', 'stage'];

// What is this parenthetical? Anything unrecognised is `unknown` and is simply
// dropped -- a note in brackets must not break the line it annotates.
export function classifyHint(text, { cardsById, setNames } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return { kind: 'unknown', value: null };
  if (cardsById && cardsById.has(raw.toUpperCase())) return { kind: 'id', value: raw.toUpperCase() };
  const norm = normalizeName(raw);
  if (ALIGNMENTS.includes(norm.replace(/wizard$/, '-wizard'))) {
    return { kind: 'alignment', value: norm.replace(/^fallenwizard$/, 'fallen-wizard') };
  }
  for (const [code, names] of Object.entries(setNames || {})) {
    if (normalizeName(code) === norm) return { kind: 'set', value: code };
    for (const n of Object.values(names || {})) {
      if (n && normalizeName(n) === norm) return { kind: 'set', value: code };
    }
  }
  return { kind: 'unknown', value: null };
}

// Narrow, unless narrowing would empty the set.
const narrow = (matches, keep) => {
  const next = matches.filter(keep);
  return next.length ? next : matches;
};

function resolveOne(line, ctx) {
  const { nameIndex, cardsById, setNames, side, alignPref } = ctx;

  // Rank 0 -- first reading that matches anything.
  let reading = null;
  let matches = [];
  for (const c of line.candidates) {
    const found = nameIndex.get(normalizeName(c.name)) || [];
    if (found.length) { reading = c; matches = [...found]; break; }
  }
  if (!reading) {
    return { ...line, qty: line.candidates[0].qty, name: line.candidates[0].name, matches: [], status: 'notfound' };
  }

  // Rank 1 -- the parenthesis. Sovereign, even against the side.
  for (const hint of reading.hints) {
    const h = classifyHint(hint, { cardsById, setNames });
    if (h.kind === 'id') matches = narrow(matches, (c) => c.id === h.value);
    else if (h.kind === 'set') matches = narrow(matches, (c) => c.setCode === h.value);
    else if (h.kind === 'alignment') matches = narrow(matches, (c) => String(c.alignment || '').toLowerCase() === h.value);
  }

  // Rank 2 -- the sub-section's type.
  if (line.typeHint) matches = narrow(matches, (c) => c.type === line.typeHint);

  // Rank 3 -- the side, or the manual preference when there is no side (that
  // is the freeform path: no side to infer from, so the player picks).
  // preferredMatchId is reused rather than reimplemented: it already encodes
  // the fallen-wizard tie the player must settle.
  //
  // A known side NEVER falls through to alignPref, even if it is somehow
  // missing from PREF_BY_SIDE (a typo, or a fifth side added to
  // rules/sides.js without updating this table) -- alignPref is the
  // freeform player's manual choice and must not silently leak onto a
  // side-bound import just because the table lookup came up empty.
  const pref = side ? (PREF_BY_SIDE[side] || null) : (alignPref || null);
  if (matches.length > 1 && pref) {
    const picked = preferredMatchId(matches, pref);
    if (picked) matches = matches.filter((c) => c.id === picked);
  }

  return {
    ...line,
    qty: reading.qty,
    name: reading.name,
    matches,
    status: matches.length > 1 ? 'ambiguous' : 'ok',
  };
}

// A line the user did not mark with a quantity and that matches no card is
// prose, not a missing card -- pasting a forum post must import its cards and
// keep its commentary, without a wall of red. A line the user DID mark stays a
// reported miss: the intent there was plainly a card, and a typo must show.
//
// A trailing "(...)" is NOT by itself a mark: line.js's peeler treats every
// trailing parenthetical as a hint, so a plain remark like "Contrôler les
// havres tôt (stratégie principale)" would otherwise count as "marked" and
// come back as a reported miss instead of prose -- the exact wall-of-red
// outcome this function exists to prevent. A hint only proves intent when it
// actually looks like a disambiguator, so it is run through classifyHint and
// only 'id'/'set'/'alignment' count; 'unknown' is a remark, not a marking.
function isMarked(line, { cardsById, setNames }) {
  if (line.candidates.some((c) => c.qty > 1)) return true;
  if (/^\s*\d/.test(line.raw)) return true;
  return line.candidates[0].hints.some((h) => classifyHint(h, { cardsById, setNames }).kind !== 'unknown');
}

// A line made ENTIRELY of decoration characters ("----", "####", "===",
// "***") is a forum/markdown divider, not a remark -- it carries no
// information a player would want back in their notes. isMarked would call
// it unmarked (no digit, no qty>1, no hint), so without this it would join
// `prose` and silently fill the notes with separator noise on every import
// of a list copied from a forum post.
const DECORATION_ONLY = /^[#\-=*_~.]+$/;

export function resolveLines(lines, ctx) {
  const resolved = [];
  const prose = [];
  for (const line of lines) {
    const r = resolveOne(line, ctx);
    if (r.status === 'notfound' && DECORATION_ONLY.test(line.raw)) continue;
    if (r.status === 'notfound' && !isMarked(line, ctx)) prose.push(line.raw);
    else resolved.push(r);
  }
  return { resolved, prose };
}
