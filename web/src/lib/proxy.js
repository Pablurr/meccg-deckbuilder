// Proxy-stamp classification & geometry. Pure data + functions, no IO.
// Maps each card to one of 16 swatch textures (the band segment matching the
// card frame's colour) and positions the covered copyright / set-name zone.
// Spec: docs/superpowers/specs/2026-07-23-proxy-card-stamp-design.md

export const PROXY_LABEL = 'Proxy';

export const SWATCH_KEYS = [
  'hero-character', 'minion-character',
  'hero-site', 'minion-site', 'balrog-site', 'fw-site',
  'hero-resource', 'minion-resource', 'stage-resource',
  'hazard',
  'red',
  'alatar', 'gandalf', 'pallando', 'radagast', 'saruman',
];

// Covered zone, as fractions of card width/height. en/es show the left-aligned
// "©19xx Tolkien Enterprises"; fr shows the more-centred French set name.
// Values calibrated visually (final task) — keep both rects in sync with the
// CSS overlay and the canvas baking, which both read them from here.
export const PROXY_RECT = {
  enes: { x: 0.095, y: 0.953, w: 0.375, h: 0.034 },
  fr: { x: 0.255, y: 0.953, w: 0.325, h: 0.034 },
};

export function rectForLang(lang) {
  return lang === 'fr' ? PROXY_RECT.fr : PROXY_RECT.enes;
}

// The four Resource/Dual cards reuse the minion/hero resource frame by name.
const DUAL_BY_NAME = {
  'Tidings of Death': 'minion-resource',
  'Deadly Dart': 'minion-resource',
  'Beasts of the Wood': 'hero-resource',
  'Wild Hounds': 'hero-resource',
};

const WIZARD_NAMES = new Set(['alatar', 'gandalf', 'pallando', 'radagast', 'saruman']);

const BY_TYPE_ALIGNMENT = {
  'Character/Hero': 'hero-character',
  'Character/Minion': 'minion-character',
  'Site/Hero': 'hero-site',
  'Site/Minion': 'minion-site',
  'Site/Balrog': 'balrog-site',
  'Site/Fallen-wizard': 'fw-site',
  'Resource/Hero': 'hero-resource',
  'Resource/Minion': 'minion-resource',
  'Resource/Stage': 'stage-resource',
};

// One of the 16 swatch keys, or null for Regions / unknown combinations
// (null = leave the card unstamped; fail-safe, never a wrong stamp).
export function swatchKeyForCard(card) {
  if (!card || card.type === 'Region') return null;
  const race = (card.attributes && card.attributes.race) || '';
  // The 9 Ringwraiths and The Balrog (BA-3) share one identical red frame.
  // The type guard keeps the 22 Site/Balrog on their own balrog-site frame.
  if (race === 'Ringwraith' || (race === 'Balrog' && card.type === 'Character')) return 'red';
  // Each wizard's frame is identical in its Wizard and Fallen-wizard version.
  if (race === 'Wizard' || race === 'Fallen-wizard') {
    const name = ((card.name && card.name.en) || '').toLowerCase();
    if (WIZARD_NAMES.has(name)) return name;
  }
  if (card.type === 'Resource' && card.alignment === 'Dual') {
    return DUAL_BY_NAME[(card.name && card.name.en) || ''] || null;
  }
  if (card.type === 'Hazard') return 'hazard';
  return BY_TYPE_ALIGNMENT[`${card.type}/${card.alignment}`] || null;
}
