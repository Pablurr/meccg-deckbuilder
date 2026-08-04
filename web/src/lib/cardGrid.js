// Card sizing for the deck panel's grid.
//
// THE CHANGE THIS FILE RECORDS: the deck panel used to size its cards from a
// persisted zoom percentage, with a slider in the head. It now uses the card
// SELECTOR's grid rule verbatim -- `repeat(auto-fill, minmax(120px, 1fr))` --
// so one card is one size across both surfaces, and the way to see more or
// fewer cards is to drag the panel wider or narrower, exactly as it is in the
// selector. Owner decision, 2026-08-03.
//
// The consequence worth stating: the CSS owns the layout now. Nothing here
// sets a column width. `deckCardWidth` exists only to PREDICT the width the
// browser will compute, because `deckThumbWidth` still has to pick which
// proxy thumbnail to request, and a `1fr` column has no width in JavaScript.
// A prediction that drifts costs a slightly wrong thumbnail size, never a
// broken layout.

// Natural source-image width. Cards are never drawn wider than this: past it
// the proxy has nothing left to serve and we would just upsample.
export const SOURCE_WIDTH = 570;

// Mirrors `.grid` in styles.css, which both surfaces now use — keep in sync.
export const GRID_MIN_WIDTH = 120;
export const GRID_GAP = 10;

// .deckpanel-body has `padding: 10px 12px` in styles.css — keep in sync.
export const BODY_PADDING_X = 24;

// Width available to the card grid inside a panel/sheet of `outerWidth`.
export function deckZoneWidth(outerWidth) {
  const n = Number(outerWidth);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n) - BODY_PADDING_X);
}

// The column width `repeat(auto-fill, minmax(GRID_MIN_WIDTH, 1fr))` will
// produce in a panel of `outerWidth`: as many columns as fit at the floor,
// then the leftover shared out between them.
//
// Floored at GRID_MIN_WIDTH so a panel too narrow for even one column still
// names a real thumbnail size instead of zero or a negative.
export function deckCardWidth(outerWidth) {
  const w = deckZoneWidth(outerWidth);
  if (!(w > 0)) return GRID_MIN_WIDTH;
  const cols = Math.max(1, Math.floor((w + GRID_GAP) / (GRID_MIN_WIDTH + GRID_GAP)));
  return Math.max(GRID_MIN_WIDTH, Math.floor((w - GRID_GAP * (cols - 1)) / cols));
}
