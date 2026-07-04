import { readFile } from 'node:fs/promises';

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
        attributes: card.attributes || {},
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

// Load and index cards.json from disk.
export async function loadCards(jsonPath) {
  const raw = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const cards = flattenCards(raw);
  const index = new Map(cards.map((c) => [c.id, c]));
  return { cards, facets: computeFacets(cards), index };
}
