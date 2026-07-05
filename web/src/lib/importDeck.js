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
