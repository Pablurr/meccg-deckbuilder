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

// Parse a pasted deck list. Each non-empty line is "<qty>x <name>" (the "x" and
// count are optional; a bare name means quantity 1).
//   "1x burat" -> { qty: 1, name: 'burat' }
//   "2 x beautiful gold ring" -> { qty: 2, name: 'beautiful gold ring' }
//   "glamour" -> { qty: 1, name: 'glamour' }
export function parseDeckList(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/) || line.match(/^(\d+)[xX]\s*(.+)$/);
    let qty = 1;
    let name = line;
    if (m) {
      qty = parseInt(m[1], 10);
      name = m[2].trim();
    }
    out.push({ raw: line, qty: Math.max(1, qty || 1), name });
  }
  return out;
}

// Index cards by their full name (en and fr), normalized (accent/case-insensitive).
export function buildNameIndex(cards) {
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
