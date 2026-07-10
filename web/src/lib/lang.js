// Languages that are consistently populated in cards.json name fields
// (en/fr/es 100%, de/nl ≥99.9%). it/fi/ja are too sparse to offer.
export const LIST_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
];

// UI display language toggle (kept to the two main ones).
export const UI_LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

// Languages for which card IMAGES exist (imageBaseUrl en/es/fr only).
// Used for the ZIP/PDF export image language.
export const IMAGE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

// Card name in the requested language, falling back to en then fr then id.
export function cardName(card, lang = 'fr') {
  const n = (card && card.name) || {};
  return (n[lang] && n[lang].trim()) || n.en || n.fr || (card && card.id) || '';
}

// CDN image URL for a card: per-set imageBaseUrl (attached by parseCards)
// + bare filename. Falls back to the English base when the requested
// language has none (matches the on-screen <img> onError fallback).
export function cardImageEn(card) {
  const base = (card && card.imageBaseUrl) || {};
  return base.en && card.image ? base.en + card.image : '';
}

export function cardImageSrc(card, lang = 'en') {
  const base = (card && card.imageBaseUrl) || {};
  const root = base[lang] || base.en;
  return root && card && card.image ? root + card.image : '';
}
