// Lowercase and strip diacritics so search ignores accents ("burat" ~ "Bûrat").
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

import { cardTags } from './tags.js';
import { TYPE_ORDER, SET_ORDER } from './constants.js';

// Pure, in-memory filtering of the card list.
// filters: { search, cardText, sets[], types[], alignments[], rarities[],
//            artists[], races[], subtypes[], skills[], keywords[], unique[] }
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
    if (has(filters.unique) && !filters.unique.includes(String(a.unique === true))) return false;
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

// Facet menus are read, so they sort on what is displayed -- "Périls" belongs
// under P even though the value behind it is "Hazard". The Type facet is the
// exception: its sequence is the play order (TYPE_ORDER), which must be the
// same in all three languages. A value absent from `order` goes last rather
// than first, so a newly added data value stays visible instead of jumping
// to the head of the menu.
export function sortFacetOptions(options, config) {
  const { order, label = (v) => v } = config || {};
  const copy = [...options];
  if (!order) return copy.sort((a, b) => label(a).localeCompare(label(b)));
  const rank = (v) => { const i = order.indexOf(v); return i === -1 ? Infinity : i; };
  return copy.sort((a, b) => (rank(a) - rank(b)) || label(a).localeCompare(label(b)));
}

// Raw value a sort key reads off a card, before any localization. `types`
// and `name` are handled specially in compareSortKey below (play order and
// display-language string respectively), so they have no entry here.
const SORT_FIELD = {
  sets: (c) => c.setCode,
  subtypes: (c) => cardTags(c, 'subtypes')[0] || '',
  alignments: (c) => c.alignment,
  races: (c) => cardTags(c, 'races')[0] || '',
  skills: (c) => cardTags(c, 'skills')[0] || '',
  rarities: (c) => c.rarity,
  artists: (c) => c.artist,
};

// Sort keys the "Trier par" picker offers, in menu order.
export const SORT_KEYS = ['sets', 'types', 'subtypes', 'alignments', 'races', 'skills', 'rarities', 'artists', 'name'];

const typeRank = (v) => { const i = TYPE_ORDER.indexOf(v); return i === -1 ? Infinity : i; };
const setRank = (v) => { const i = SET_ORDER.indexOf(v); return i === -1 ? Infinity : i; };

// -1/0/1 comparison of two cards on one sort key. `labelFor` mirrors
// sortFacetOptions' principle -- menus (and now sort) order on what the
// player reads, not the raw English data value -- except `types`, which
// follows game play order (TYPE_ORDER), `sets`, which follows MECCG release
// order (SET_ORDER) so the default grid order doesn't depend on display
// language, and `name`, which has no dictionary entry and reads straight off
// the card in the current display language.
function compareSortKey(key, a, b, { lang, labelFor }) {
  if (key === 'types') return typeRank(a.type) - typeRank(b.type);
  if (key === 'sets') return setRank(a.setCode) - setRank(b.setCode);
  if (key === 'name') {
    const na = (a.name && (a.name[lang] || a.name.en)) || '';
    const nb = (b.name && (b.name[lang] || b.name.en)) || '';
    return String(na).localeCompare(String(nb));
  }
  const field = SORT_FIELD[key];
  if (!field) return 0;
  const va = labelFor(key, field(a));
  const vb = labelFor(key, field(b));
  return String(va).localeCompare(String(vb));
}

// Sorts a copy of `cards` by `primary`, then `secondary` (if given), then
// always by `card.id` as the final tiebreak -- `id` already encodes
// set+number ("AS-44"), so no explicit setCode tiebreak is needed on top of
// it. Returns `cards` itself, unsorted, when `primary` is falsy, so callers
// memoizing on the result can rely on referential equality in that case.
export function sortCards(cards, { primary, secondary } = {}, { lang = 'en', labelFor = (key, v) => v } = {}) {
  if (!primary) return cards;
  const ctx = { lang, labelFor };
  const copy = [...cards];
  copy.sort((a, b) => {
    const p = compareSortKey(primary, a, b, ctx);
    if (p !== 0) return p;
    if (secondary) {
      const s = compareSortKey(secondary, a, b, ctx);
      if (s !== 0) return s;
    }
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
  return copy;
}
