// MPC (MakePlayingCards) print target — US Game / Poker size, full-bleed.
// VERIFY these against the exact MPC template you download before a real order.
// All values are grouped here for easy adjustment.

export const DPI = 300;
export const BLEED_PX = 36; // 0.12in per edge

// MPC poker / US Game size: cut 2.5x3.5in (750x1050px), +36px bleed each edge.
export const CARD_W_BLEED = 822; // 2.74in @ 300 DPI
export const CARD_H_BLEED = 1122; // 3.74in @ 300 DPI

export const CARD_W_CUT = CARD_W_BLEED - 2 * BLEED_PX; // 750
export const CARD_H_CUT = CARD_H_BLEED - 2 * BLEED_PX; // 1050

export const SIDE_IDS = ['wizard', 'ringwraith', 'fallen-wizard', 'balrog'];
export const LENGTH_IDS = ['starter', 'standard', 'long', 'campaign'];

// Play order, not alphabetical order. Authoritative for the deck panel's
// grouping, every export, and the Type filter menu — which is why it lives
// here and not in deckList.js: the filter bar has no business importing an
// export-layer module for a constant that belongs to neither.
export const TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];

// MECCG expansion release order, not alphabetical or localized-label order.
// Used by the "Set" sort key (mirrors TYPE_ORDER's role for the Type facet/sort).
export const SET_ORDER = ['TW', 'TD', 'DM', 'LE', 'AS', 'WH', 'BA'];

// Target for the "Report this rule" link in rule-warning rows (DeckPanel).
export const REPORT_ISSUES_URL = 'https://github.com/Pablurr/meccg-deckbuilder/issues/new';
