// Lowercase and strip diacritics so search ignores accents ("burat" ~ "Bûrat").
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Pure, in-memory filtering of the card list.
// filters: { search, sets[], types[], alignments[], rarities[], races[],
//            subtypes[], skills[], keywords[], unique(bool) }
export function filterCards(cards, filters = {}) {
  const q = normalizeText((filters.search || '').trim());
  const has = (arr) => Array.isArray(arr) && arr.length > 0;

  return cards.filter((c) => {
    const a = c.attributes || {};
    if (has(filters.sets) && !filters.sets.includes(c.setCode)) return false;
    if (has(filters.types) && !filters.types.includes(c.type)) return false;
    if (has(filters.alignments) && !filters.alignments.includes(c.alignment)) return false;
    if (has(filters.rarities) && !filters.rarities.includes(c.rarity)) return false;
    if (has(filters.races) && !filters.races.includes(a.race)) return false;
    if (has(filters.subtypes) && !filters.subtypes.includes(a.subtype)) return false;
    if (has(filters.skills) && !filters.skills.includes(a.skills)) return false;
    if (has(filters.keywords)) {
      const kw = a.keywords || [];
      if (!filters.keywords.some((k) => kw.includes(k))) return false;
    }
    if (filters.unique === true && a.unique !== true) return false;
    if (q) {
      const names = normalizeText([c.name?.en, c.name?.fr].filter(Boolean).join(' '));
      if (!names.includes(q)) return false;
    }
    return true;
  });
}
