// Per-side deckbuilding profiles, sourced from councilofelrond.org section 1.
// specificMode says how attributes.specific is read:
//   'balrog-exempt'  -- specific:"Balrog" cards escape race/mind restrictions
//   'avatar-match'   -- a card naming an avatar is legal only in that avatar's deck
import { matchesRace } from './races.js';

// Side-independent limits (1.3.1, 1.3.2, 1.4).
export const GENERAL = {
  agentMindMax: 36, // 1.3.2 -- total mind of all agent cards in the whole deck
  uniqueMax: 1,     // 1.3.1 -- copies of a unique non-avatar card
  siteMax: 1,       // 1.4   -- copies of a non-haven site
  // Avatars are exempt from the unique rule (1.3.1 says "each unique
  // NON-avatar card"). 1.5 allows three in the play deck; 1.6's "across the
  // whole deck" clause makes three the whole-deck maximum per avatar.
  avatarMaxCopies: 3,        // 1.5 + 1.6, cumulative across every zone
  avatarMaxDistinct: 2,      // 1.5 -- "except for three different avatars"
  avatarMaxInSideboard: 1,   // 1.6.2 -- one copy of each avatar, any number of avatars
  avatarMaxWithMultiples: 1, // 1.6.2 -- at most one avatar with multiple copies
  avatarMaxInPlayDeck: 3,    // 1.5
  // 1.5 / 1.5.1 -- play-deck composition. Not side-specific, so it lives here
  // once rather than four times in SIDES.
  playDeck: { resourcesMin: 30, resourcesMax: 50, maxCharacters: 10, minCreatures: 12 },
};

// 1.3.4 -- which sides may declare the avatar a "specific" card names. Each of
// the five wizard names exists as both a Wizard avatar (TW, Hero alignment) and
// a Fallen-wizard avatar (WH), so both sides can declare them.
export const SPECIFIC_TO_SIDES = {
  Balrog: ['balrog'],
  Alatar: ['wizard', 'fallen-wizard'],
  Gandalf: ['wizard', 'fallen-wizard'],
  Pallando: ['wizard', 'fallen-wizard'],
  Radagast: ['wizard', 'fallen-wizard'],
  Saruman: ['wizard', 'fallen-wizard'],
};

// 'Dual' is on every side's list: the four Dual cards (LE-245 Tidings of Death,
// LE-419 Deadly Dart, WH-38 Beasts of the Wood, WH-40 Wild Hounds) are playable
// by both hero and minion sides and section 1 never restricts them.
export const SIDES = {
  wizard: {
    id: 'wizard', avatarAlignment: 'Hero',
    alignments: ['Hero', 'Neutral', 'Dual'],
    // 1.3.1 -- three copies of any non-unique card.
    copies: [{ limit: 3 }],
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null, stagePoints: null },
    agents: { role: 'hazard' },   // 1.3.W2
    flexMaxAsResource: null,      // 1.3.3 -- free choice
    heroTreatment: false,
    specificMode: 'avatar-match',
    // 1.4.W1 -- a location deck holds only Hero sites, plus 1.4.1's five open Balrog sites.
    locationDeck: { alignments: ['Hero'], unlimitedFwSites: false, requireBalrogVersion: false },
    factionRaces: null,
  },
  ringwraith: {
    id: 'ringwraith', avatarAlignment: 'Minion',
    alignments: ['Minion', 'Neutral', 'Dual'],
    // 1.3.1 -- three copies of any non-unique card.
    copies: [{ limit: 3 }],
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null, stagePoints: null },
    agents: { role: 'character' }, // 1.3.R2 (for deck-building requirements)
    flexMaxAsResource: null,
    heroTreatment: false,
    specificMode: 'avatar-match',
    // 1.4.R1 -- a location deck holds only Minion sites, plus 1.4.1's five open Balrog sites.
    locationDeck: { alignments: ['Minion'], unlimitedFwSites: false, requireBalrogVersion: false },
    factionRaces: null,
  },
  'fallen-wizard': {
    id: 'fallen-wizard', avatarAlignment: 'Fallen-wizard',
    alignments: ['Hero', 'Minion', 'Neutral', 'Dual', 'Stage', 'Fallen-wizard'],
    // 1.3.F1 -- four categories, checked in order, first match wins. Hazards
    // match none of them and fall through to 1.3.1's general 3.
    copies: [
      { bucket: 'resource', alignment: 'Stage', limit: 3 },
      { bucket: 'character', limit: 2 },
      { bucket: 'resource', alignment: 'Hero', limit: 2 },
      { bucket: 'resource', alignment: 'Minion', limit: 2 },
      { limit: 3 },
    ],
    pool: {
      maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: null, requireRaces: null,
      // 1.7.F1 -- up to three Stage resource permanent-events in the starting
      // pool, totalling exactly three stage points, at least one non-unique.
      stagePoints: { total: 3, maxCards: 3, minNonUnique: 1 },
    },
    agents: { role: 'character' }, // 1.3.F4
    flexMaxAsResource: 2,          // 1.3.F2 -- the third copy counts as a hazard
    heroTreatment: true,           // 1.3.F5
    specificMode: 'avatar-match',
    // 1.4.F1 -- a Fallen-wizard location deck takes hero AND minion sites, plus
    // its own Fallen-wizard sites (unlimited copies of those, see copies.js).
    locationDeck: { alignments: ['Hero', 'Minion', 'Fallen-wizard'], unlimitedFwSites: true, requireBalrogVersion: false },
    factionRaces: null,
  },
  balrog: {
    id: 'balrog', avatarAlignment: 'Balrog',
    alignments: ['Minion', 'Neutral', 'Dual', 'Balrog'],
    // 1.3.1 -- three copies of any non-unique card.
    copies: [{ limit: 3 }],
    // 1.3.B4 -- non-avatar characters must be Orc or Troll with mind < 9,
    // unless they are Balrog-specific.
    pool: { maxCharacters: 10, maxMinorItems: 2, balrogMindPerCharacterLimit: 9, requireRaces: ['Orc', 'Troll'], stagePoints: null },
    agents: { role: 'hazard' },   // 1.3.B2
    flexMaxAsResource: null,
    heroTreatment: false,
    specificMode: 'balrog-exempt',
    // 1.4.B1 -- a location deck holds Minion and Balrog sites, plus 1.4.1's
    // five open Balrog sites; a Balrog version is required for the sites 1.4.B1 names.
    locationDeck: { alignments: ['Minion', 'Balrog'], unlimitedFwSites: false, requireBalrogVersion: true },
    // 1.3.B4 -- "Factions can only be Orc, Troll, Wolf, Animal, or Dragon".
    factionRaces: ['Orc', 'Troll', 'Wolf', 'Animal', 'Dragon'],
  },
};

// Browser-filter legality: is this card even playable in a deck of this side?
// Avatars: legal only when their alignment IS the side's avatar alignment.
//
// `openBalrog` and `bannedIds` are both optional Sets, for the same reason:
// deriving either means walking the full card array (siteIndex / resolveBanned)
// and this function must stay pure and per-card. Callers that already have them
// (the card browser) pass them through; callers that don't (existing tests,
// non-site checks) are unaffected, since a card's id is never in an undefined
// Set.
//   - openBalrog: the five Balrog sites 1.4.1 opens to every side (no hero or
//     minion counterpart).
//   - bannedIds: this side's ban list (1.3.F6 / 1.3.B5), resolved to ids.
export function isLegalForSide(card, sideId, openBalrog, bannedIds) {
  const side = SIDES[sideId];
  if (!side || !card) return true;
  // A ban is unconditional, so it is checked before every pass below: a banned
  // card is no more playable for being an avatar, Balrog-specific, or an open
  // 1.4.1 site.
  if (bannedIds && bannedIds.has(card.id)) return false;
  const a = card.attributes || {};
  if (a.avatar === true) return card.alignment === side.avatarAlignment;
  // 1.3.4 -- a card naming a specific avatar is only playable by a side that
  // may declare that avatar. This used to be left to the validator on the
  // grounds that the filter should not hide what a rule merely restricts *per
  // avatar*; but SPECIFIC_TO_SIDES is a *side*-level fact, and the 46
  // Balrog-specific cards sat in a Ringwraith browser looking playable under
  // any avatar, which they are not. The finer, per-avatar case (a card
  // specific to Gandalf in a Saruman deck) stays with SPECIFIC-AVATAR: the
  // browser does not know which avatar the deck declares, and three distinct
  // avatars are allowed.
  // An unrecognised `specific` value restricts nothing -- data we do not know
  // about must not silently hide cards.
  if (a.specific && SPECIFIC_TO_SIDES[a.specific]) {
    return SPECIFIC_TO_SIDES[a.specific].includes(sideId);
  }
  if (openBalrog && openBalrog.has(card.id)) return true;
  return side.alignments.includes(card.alignment);
}

// 1.3.B4 -- does this character's race satisfy the side's requirement?
// Uses matchesRace rather than a substring test: the data writes "Wolves"
// where the rule says "Wolf", and joins several races with commas.
export function raceAllowed(card, sideId) {
  const side = SIDES[sideId];
  if (!side || !side.pool.requireRaces) return true;
  return side.pool.requireRaces.some((r) => matchesRace((card.attributes || {}).race, r));
}
