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
