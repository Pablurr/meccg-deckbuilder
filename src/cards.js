import { readFile } from 'node:fs/promises';

// Strip HTML tags and collapse whitespace, for the searchable card text.
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Plain-text, searchable card text: en + fr + es game text, tags stripped,
// joined into one compact string (no per-language HTML shipped to the client).
function searchableText(text) {
  const t = text || {};
  return [t.en, t.fr, t.es].map(stripHtml).filter(Boolean).join(' ');
}

// Flatten the nested cards.json ({ SET: { cards: { "AS-1": {...} } } })
// into a single array of normalized card objects.
export function flattenCards(raw) {
  const out = [];
  for (const [setCode, setObj] of Object.entries(raw || {})) {
    const cards = (setObj && setObj.cards) || {};
    for (const [cardId, card] of Object.entries(cards)) {
      out.push({
        id: card.id ?? cardId,
        setCode,
        name: card.name || {},
        type: card.type || '',
        alignment: card.alignment || '',
        rarity: card.rarity || '',
        artist: card.artist || '',
        relativePath: card.relativePath || '',
        image: card.image || '', // bare filename, e.g. "Burat.jpg"
        attributes: card.attributes || {},
        text: searchableText(card.text), // stripped en+fr+es game text, for search
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
    races: uniqSorted(cards.map((c) => c.attributes.race)),
    subtypes: uniqSorted(cards.map((c) => c.attributes.subtype)),
    skills: uniqSorted(cards.map((c) => c.attributes.skills)),
    keywords: uniqSorted(cards.flatMap((c) => c.attributes.keywords || [])),
  };
}

// Per-set image base URLs, keyed by language: { AS: { en, es, fr, ... } }.
export function collectImageBaseUrls(raw) {
  const map = {};
  for (const [setCode, setObj] of Object.entries(raw || {})) {
    map[setCode] = (setObj && setObj.imageBaseUrl) || {};
  }
  return map;
}

// Load and index cards.json from disk.
export async function loadCards(jsonPath) {
  const raw = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const cards = flattenCards(raw);
  const index = new Map(cards.map((c) => [c.id, c]));
  return { cards, facets: computeFacets(cards), index, imageBaseUrls: collectImageBaseUrls(raw) };
}
