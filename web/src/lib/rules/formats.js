// Game lengths -> numeric thresholds. STUB values from the local rules KB
// (modes-de-jeu.md); to be confirmed against councilofelrond.org.
// NOTE: a "+10 sideboard cards against a Fallen-wizard opponent" allowance
// existed here as `fwExtra: 10` on every length, but nothing read it -- the
// allowance depends on the *opponent's* side, which this app does not model
// (there is no second player/deck in scope). Deliberately left out rather
// than re-added: if the app ever models an opponent, source and wire this
// properly instead of restoring a field nothing consumed.
export const LENGTHS = {
  starter:  { id: 'starter',  sideboardMax: 30 },
  standard: { id: 'standard', sideboardMax: 30 },
  long:     { id: 'long',     sideboardMax: 35 },
  campaign: { id: 'campaign', sideboardMax: 40 },
};
