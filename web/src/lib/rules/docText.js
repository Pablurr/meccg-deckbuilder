// Pure text-composition helpers for the documentation page (RulesDoc.jsx).
// Split out from the component so the conditional logic here -- optional mind
// cap, optional per-character cap, forbidden/required races, unsourced
// playDeck ranges -- can be unit-tested directly against the real SIDES data
// without mounting React. Every value rendered still comes from the SIDES/
// LENGTHS modules the validator itself reads; only word choice lives here.
// Kept alongside validate.js/sides.js/formats.js since these functions are
// the doc-page's read layer over that same data.

// Same fallback-safe localization DeckPanel's localizeParams uses for raw
// data values: keep the untranslated value rather than show a raw i18n key
// when a translation doesn't exist yet.
export function localize(t, prefix, value) {
  const localized = t(`${prefix}.${value}`);
  return localized === `${prefix}.${value}` ? value : localized;
}

// "3 per card, 3 for Stage" -- the default copy limit plus any per-alignment
// overrides, straight from SIDES[side].copies.
export function copiesText(t, profile) {
  const parts = [t('docs.copies.default', { n: profile.copies.default })];
  for (const [alignment, n] of Object.entries(profile.copies.byAlignment)) {
    parts.push(t('docs.copies.override', { n, alignment: localize(t, 'alignment', alignment) }));
  }
  return parts.join(', ');
}

// Compose the starting-pool constraints as short localized fragments rather
// than one sentence template, since several fields are null for any given side
// (see SIDES.*.pool) and one template can't gracefully drop clauses per
// language.
export function poolText(t, pool) {
  const parts = [
    t('docs.pool.maxCharacters', { n: pool.maxCharacters }),
    t('docs.pool.maxMinorItems', { n: pool.maxMinorItems }),
  ];
  if (pool.balrogMindPerCharacterLimit != null) parts.push(t('docs.pool.balrogMindBelow', { n: pool.balrogMindPerCharacterLimit }));
  if (pool.requireRaces && pool.requireRaces.length) {
    parts.push(t('docs.pool.requireRaces', { races: pool.requireRaces.map((r) => localize(t, 'race', r)).join(', ') }));
  }
  return parts.join(' · ');
}

// playDeck is null for sides whose min/max haven't been sourced yet (see
// sides.js "// unverified" comments) -- say so rather than showing a blank.
export function playDeckText(t, playDeck) {
  return playDeck ? t('docs.playDeck.range', { min: playDeck.min, max: playDeck.max }) : t('status.unverified');
}
