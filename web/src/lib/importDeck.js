import { normalizeText } from './filter.js';

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
    const key = normalizeText(name).trim();
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
    const key = normalizeText(item.name).trim();
    const matches = nameIndex.get(key) || [];
    let status = 'ok';
    if (matches.length === 0) status = 'notfound';
    else if (matches.length > 1) status = 'ambiguous';
    return { ...item, matches, status };
  });
}
