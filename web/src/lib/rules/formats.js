// Game lengths -> numeric thresholds. STUB values from the local rules KB
// (modes-de-jeu.md); to be confirmed against councilofelrond.org.
// NOTE (2026-08-03): the "+10 sideboard cards against a Fallen-wizard
// opponent" allowance is now modelled properly -- as its own deck zone,
// `zones.sideboardFw`, rather than as a field on LENGTHS. It doesn't belong
// in this table: the app still doesn't model an opponent (there is no second
// player/deck in scope), and the allowance is 10 cards flat regardless of
// game length -- a fifth LENGTHS column would imply it varies the way
// sideboardMax does, which it never has. See SIDEBOARD_FW_MAX below.
export const LENGTHS = {
  starter:  { id: 'starter',  sideboardMax: 30 },
  standard: { id: 'standard', sideboardMax: 30 },
  long:     { id: 'long',     sideboardMax: 35 },
  campaign: { id: 'campaign', sideboardMax: 40 },
};

// 1.6.1 -- "up to 10 additional cards ... preselected for Fallen-wizard
// opponents". ADDITIONAL: this allowance sits on top of sideboardMax rather
// than inside it, and unlike sideboardMax it does not vary with the game
// length -- which is exactly why it is a constant here and not a fifth column
// in LENGTHS.
export const SIDEBOARD_FW_MAX = 10;
