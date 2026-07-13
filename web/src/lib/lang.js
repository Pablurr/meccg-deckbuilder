// Languages that are consistently populated in cards.json name fields
// (en/fr/es 100%, de/nl ≥99.9%). it/fi/ja are too sparse to offer.
export const LIST_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
];

// Card-name display languages offered by the language selector. Names in
// cards.json cover en/fr/es fully, and card images exist for all three.
// (UI chrome text is only translated fr/en; 'es' maps to 'en' — see App.jsx.)
export const UI_LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
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

// Lightweight thumbnail for the browser grid: the full-res CDN image resized
// to ~w px WebP through the wsrv.nl image proxy (free, cached), cutting the
// transferred bytes ~10-20x. Full-res cardImageSrc stays in use for the hover
// preview, the deck panel, and the ZIP/PDF exports (which need 300 DPI).
export function cardThumbSrc(card, lang = 'en', w = 260) {
  const full = cardImageSrc(card, lang);
  return full ? `https://wsrv.nl/?url=${encodeURIComponent(full)}&w=${w}&output=webp` : '';
}

// Thumbnail width to request from the proxy for a deck-panel card displayed at
// `cardW` px. Quantized to 100px steps (floor 200, cap 570 = source width) so
// the zoom slider yields at most ~5 distinct, cache-friendly URLs while staying
// >= the on-screen size (crisp at every zoom; pixel-perfect at 100%).
export function deckThumbWidth(cardW) {
  return Math.min(570, Math.max(200, Math.ceil(cardW / 100) * 100));
}
