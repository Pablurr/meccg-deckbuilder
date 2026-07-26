// Per-side deckbuilding profiles. STUB values seeded from the local rules KB;
// every numeric/list value is to be confirmed against councilofelrond.org.
// `specificMode` says how attributes.specific is read:
//   'balrog-exempt'  — specific:"Balrog" cards escape race/mind restrictions
//   'avatar-match'   — a card naming a fallen wizard is legal only in that wizard's deck
export const SIDES = {
  wizard: {
    id: 'wizard', avatarAlignment: 'Hero',
    alignments: ['Hero', 'Neutral'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 10, maxMinorItems: 2, mindCap: null, mindPerCharacter: null, forbidRaces: [], requireRaces: null },
    playDeck: { min: 25, max: 50 },
    specificMode: null,
  },
  ringwraith: {
    id: 'ringwraith', avatarAlignment: 'Minion',
    alignments: ['Minion', 'Neutral'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 6, maxMinorItems: 2, mindCap: 20, mindPerCharacter: null, forbidRaces: ['Ringwraith', 'Agent'], requireRaces: null },
    playDeck: null, // unverified
    specificMode: null,
  },
  'fallen-wizard': {
    id: 'fallen-wizard', avatarAlignment: 'Fallen-wizard',
    alignments: ['Hero', 'Minion', 'Neutral', 'Stage', 'Fallen-wizard'],
    copies: { default: 2, byAlignment: { Stage: 3 } },
    pool: { maxCharacters: 5, maxMinorItems: 2, mindCap: null, mindPerCharacter: 5, forbidRaces: [], requireRaces: null },
    playDeck: null, // unverified
    specificMode: 'avatar-match',
  },
  balrog: {
    id: 'balrog', avatarAlignment: 'Balrog',
    alignments: ['Minion', 'Neutral', 'Balrog'],
    copies: { default: 3, byAlignment: {} },
    pool: { maxCharacters: 6, maxMinorItems: 2, mindCap: null, mindPerCharacter: 9, forbidRaces: [], requireRaces: ['Orc', 'Troll'] },
    playDeck: null, // unverified
    specificMode: 'balrog-exempt',
  },
};

// Browser-filter legality: is this card even playable in a deck of this side?
// Avatars: legal only when their alignment IS the side's avatar alignment.
// Balrog-specific and wizard-specific cards are handled by the validator with
// finer messages; here they stay visible (legal) so the filter never hides
// what a rule merely restricts per-avatar.
export function isLegalForSide(card, sideId) {
  const side = SIDES[sideId];
  if (!side || !card) return true;
  const a = card.attributes || {};
  if (a.avatar === true) return card.alignment === side.avatarAlignment;
  if (sideId === 'balrog' && a.specific === 'Balrog') return true;
  return side.alignments.includes(card.alignment);
}
