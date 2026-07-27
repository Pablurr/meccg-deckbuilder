// Pure text-composition helpers for the documentation page (RulesDoc.jsx).
// Split out from the component so the conditional logic here -- optional mind
// cap, optional per-character cap, forbidden/required races, unsourced
// playDeck ranges -- can be unit-tested directly against the real SIDES data
// without mounting React. Every value rendered still comes from the SIDES/
// LENGTHS modules the validator itself reads; only word choice lives here.
// Kept alongside validate.js/sides.js/formats.js since these functions are
// the doc-page's read layer over that same data.

import { ruleRefs, RULE_BY_ID } from './catalog.js';
import { GENERAL } from './sides.js';

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

// 1.5 / 1.5.1 -- four budgets, not a range. Side-independent, so no profile
// argument: every side reads the same numbers from GENERAL.playDeck.
export function playDeckText(t) {
  const pd = GENERAL.playDeck;
  return [
    t('docs.playDeck.resources', { min: pd.resourcesMin, max: pd.resourcesMax }),
    t('docs.playDeck.hazards'),
    t('docs.playDeck.characters', { n: pd.maxCharacters }),
    t('docs.playDeck.avatars', { n: GENERAL.avatarMaxInPlayDeck, d: GENERAL.avatarMaxDistinct }),
    t('docs.playDeck.creatures', { n: pd.minCreatures }),
  ].join(' · ');
}

// "CoE section 1.3.2" (rules.coeRef) per cited clause -- the section-sign
// glyph lives only in the i18n dictionary, never as a literal byte here.
// House advisories cite nothing -- they are ours, not the source's
// (ruleRefs already returns [] for those). When the printed page numbers a
// clause wrongly (the Fallen-wizard ban list is printed 1.5.F6 for 1.3.F6)
// both are shown, so a player searching the page still finds it.
export function refText(t, rule) {
  const refs = ruleRefs(rule);
  if (refs.length === 0) return '';
  return refs
    .map((ref) => {
      const printed = rule.printedAs && rule.printedAs[ref];
      const base = t('rules.coeRef', { ref });
      return printed ? `${base} (${t('rules.coeRefPrinted', { ref: printed })})` : base;
    })
    .join(', ');
}

// Tooltip for a disabled + button: what stops it, and which clause says so.
// Empty when there is room, so the caller can spread it straight into JSX
// (title="") rather than branching on whether to render the attribute at all.
export function capTitle(t, ruleId, remaining) {
  if (remaining > 0 || !ruleId) return '';
  const rule = RULE_BY_ID.get(ruleId);
  const ref = rule ? refText(t, rule) : '';
  const reason = t(`cap.${ruleId}`);
  return ref ? `${reason} (${ref})` : reason;
}
