// Placement maths for a hover panel anchored to an element.
//
// Pure, and separate from the component, for one structural reason: the rule
// warnings live in a scroll container (`.rule-warns`, max-height 35vh,
// overflow-y auto). An absolutely positioned child of a scroll container is
// clipped by it, so the panel would be cut off precisely when the list is long
// enough to need scrolling — the case it exists to serve. The panel is
// therefore `position: fixed` and must compute its own viewport coordinates,
// which is arithmetic worth testing without a DOM.

export const POPOVER_MARGIN = 8;

// Returns viewport coordinates for a fixed-position panel of `size` anchored to
// `anchor`. Preference order is left of the anchor, then right, then clamped
// inside the viewport — left first because the deck panel sits against the
// right edge, so that is where the room is.
//
// `anchor` needs { left, right, top }; `size` { width, height }; `viewport`
// { width, height }. All in CSS pixels, matching getBoundingClientRect().
export function placePopover(anchor, size, viewport, margin = POPOVER_MARGIN) {
  const leftSide = anchor.left - margin - size.width;
  const rightSide = anchor.right + margin;
  let left;
  if (leftSide >= margin) {
    left = leftSide;
  } else if (rightSide + size.width <= viewport.width - margin) {
    left = rightSide;
  } else {
    // Neither side fits: overlap the anchor rather than hang off-screen. The
    // clamp is what guarantees the panel is readable at any window width,
    // including narrower than the panel itself (hence the Math.max last).
    left = Math.max(margin, Math.min(anchor.left, viewport.width - size.width - margin));
  }
  // Top-aligned with the anchor, pulled up as needed to keep the whole panel on
  // screen. A panel taller than the viewport cannot be fully shown, so it is
  // pinned to the top margin instead of being pushed off the top edge.
  const maxTop = viewport.height - size.height - margin;
  const top = maxTop < margin ? margin : Math.max(margin, Math.min(anchor.top, maxTop));
  return { left, top };
}
