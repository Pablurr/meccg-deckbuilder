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

// Card name in the requested language, falling back to en then fr then id.
export function cardName(card, lang = 'fr') {
  const n = (card && card.name) || {};
  return (n[lang] && n[lang].trim()) || n.en || n.fr || (card && card.id) || '';
}
