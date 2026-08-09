// Minimum horizontal travel (px) before a touch drag counts as a swipe, and
// the maximum vertical drift still tolerated as "horizontal" -- a diagonal
// drag or a vertical scroll gesture must not be mistaken for page navigation.
export const SWIPE_THRESHOLD_PX = 50;
export const SWIPE_VERTICAL_TOLERANCE_PX = 30;

// `list` is whatever ordered set of cards the modal was opened from (the
// filtered selector grid, or the active deck zone's flattened groups) --
// callers capture it once, at open time; this function never re-derives it.
// No wrap-around: past either end it returns null, so the caller is a no-op.
export function navigateList(list, currentCard, delta) {
  if (!currentCard) return null;
  const idx = list.findIndex((c) => c.id === currentCard.id);
  if (idx === -1) return null;
  const next = list[idx + delta];
  return next || null;
}

export function swipeDirection(dx, dy) {
  if (Math.abs(dy) > SWIPE_VERTICAL_TOLERANCE_PX) return 0;
  if (dx <= -SWIPE_THRESHOLD_PX) return 1;
  if (dx >= SWIPE_THRESHOLD_PX) return -1;
  return 0;
}
