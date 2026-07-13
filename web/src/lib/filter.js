// Lowercase and strip diacritics so search ignores accents ("burat" ~ "Bûrat").
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

import { cardTags } from './tags.js';

// Pure, in-memory filtering of the card list.
// filters: { search, cardText, sets[], types[], alignments[], rarities[],
//            artists[], races[], subtypes[], skills[], keywords[], unique(bool) }
export function filterCards(cards, filters = {}) {
  const q = normalizeText((filters.search || '').trim());
  const qText = normalizeText((filters.cardText || '').trim());
  const has = (arr) => Array.isArray(arr) && arr.length > 0;
  // race/subtype/skills hold compound values; match if any selected base tag
  // is among the card's tags (OR within the facet).
  const tagMatch = (c, key) =>
    !has(filters[key]) || filters[key].some((t) => cardTags(c, key).includes(t));

  return cards.filter((c) => {
    const a = c.attributes || {};
    if (has(filters.sets) && !filters.sets.includes(c.setCode)) return false;
    if (has(filters.types) && !filters.types.includes(c.type)) return false;
    if (has(filters.alignments) && !filters.alignments.includes(c.alignment)) return false;
    if (has(filters.rarities) && !filters.rarities.includes(c.rarity)) return false;
    if (has(filters.artists) && !filters.artists.includes(c.artist)) return false;
    if (!tagMatch(c, 'races')) return false;
    if (!tagMatch(c, 'subtypes')) return false;
    if (!tagMatch(c, 'skills')) return false;
    if (has(filters.keywords)) {
      const kw = a.keywords || [];
      if (!filters.keywords.some((k) => kw.includes(k))) return false;
    }
    if (filters.unique === true && a.unique !== true) return false;
    if (q) {
      const names = normalizeText([c.name?.en, c.name?.fr, c.name?.es].filter(Boolean).join(' '));
      if (!names.includes(q)) return false;
    }
    if (qText) {
      if (!normalizeText(c.text || '').includes(qText)) return false;
    }
    return true;
  });
}
