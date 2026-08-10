// Pure transforms over the raw cards.json shape:
//   { SET: { imageBaseUrl: {en,es,fr,...}, cards: { "AS-1": {...} } } }
// Runs in the browser; no IO here.

// Strip HTML tags and collapse whitespace, for the searchable card text.
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Plain-text, searchable card text: en + fr + es game text, tags stripped.
function searchableText(text) {
  const t = text || {};
  return [t.en, t.fr, t.es].map(stripHtml).filter(Boolean).join(' ');
}

// Flatten the nested cards.json into a single array of normalized card
// objects. Each card carries a reference to its set's CDN roots
// (imageBaseUrl, keyed by language) so image URLs can be built anywhere.
export function flattenCards(raw) {
  const out = [];
  for (const [setCode, setObj] of Object.entries(raw || {})) {
    const cards = (setObj && setObj.cards) || {};
    const imageBaseUrl = (setObj && setObj.imageBaseUrl) || {};
    for (const [cardId, card] of Object.entries(cards)) {
      out.push({
        id: card.id ?? cardId,
        setCode,
        name: card.name || {},
        type: card.type || '',
        alignment: card.alignment || '',
        rarity: card.rarity || '',
        artist: card.artist || '',
        image: card.image || '', // bare filename, e.g. "Burat.jpg"
        imageBaseUrl, // shared per-set reference, e.g. { en: "https://cdn.../as/" }
        attributes: card.attributes || {},
        text: searchableText(card.text),
      });
    }
  }
  return out;
}

function uniqSorted(values) {
  return [...new Set(values.filter((v) => v !== undefined && v !== null && v !== ''))].sort();
}

// Build the list of available filter values from a flattened card array.
export function computeFacets(cards) {
  return {
    sets: uniqSorted(cards.map((c) => c.setCode)),
    types: uniqSorted(cards.map((c) => c.type)),
    alignments: uniqSorted(cards.map((c) => c.alignment)),
    rarities: uniqSorted(cards.map((c) => c.rarity)),
    artists: uniqSorted(cards.map((c) => c.artist)),
    races: uniqSorted(cards.map((c) => c.attributes.race)),
    subtypes: uniqSorted(cards.map((c) => c.attributes.subtype)),
    skills: uniqSorted(cards.map((c) => c.attributes.skills)),
    keywords: uniqSorted(cards.flatMap((c) => c.attributes.keywords || [])),
  };
}

// Set display names, keyed by set code: { AS: { en, es, fr }, … }.
//
// cards.json already carries these, in exactly the three UI languages, so the
// Set filter needs no i18n keys of its own — and a set added to the data ships
// its own name with it, in every language, instead of waiting on a dictionary
// entry that would silently fall back to the bare code.
//
// flattenCards deliberately does not copy this onto each card: it is per-set
// metadata, and 1683 copies of the same object is not a lookup table.
export function collectSetNames(raw) {
  const out = {};
  for (const [setCode, setObj] of Object.entries(raw || {})) {
    if (setObj && setObj.name) out[setCode] = setObj.name;
  }
  return out;
}

// "Ally" is a real value in the skills data field (Ally-type cards carry it
// as their "skill"), so it must stay in cardTags/filterCards for matching --
// but it is not a real MECCG skill, so the skills FILTER MENU hides it.
export function excludeSkill(skills, value) {
  return skills.filter((s) => s !== value);
}

// One-stop parse: cards + facets + id index + set names.
export function parseCards(raw) {
  const cards = flattenCards(raw);
  return {
    cards,
    facets: computeFacets(cards),
    index: new Map(cards.map((c) => [c.id, c])),
    setNames: collectSetNames(raw),
  };
}
