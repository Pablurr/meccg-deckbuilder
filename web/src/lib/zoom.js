// Pure sizing maths for the deck panel's card zoom. Extracted from DeckPanel
// so the semantics (a percentage of *what*, and what happens to a corrupted
// stored value) can be unit-tested without a DOM/React tree, the same way
// rules/dropTargets.js was extracted from onDropOnTab.
//
// THE SEMANTIC CHANGE: zoom used to be an absolute percentage of the 570px
// source image, so 50% meant a 285px card whether the deck zone was a 336px
// desktop panel (one card per row, unusable) or an 1800px maximised one (six
// per row). It is now a percentage of the width available to the deck list,
// so one percentage means one visual density everywhere and the panel can be
// dragged wider without the cards silently getting relatively smaller.
//
// No migration path is needed: zoom was never persisted before this change
// (it was a plain useState in App), so there is no legacy stored value that
// could still carry the old absolute meaning. Reads are still validated,
// because localStorage is user-writable and shared with other tabs.

// Natural source-image width. Cards are never drawn wider than this: past it
// the proxy has nothing left to serve and we would just upsample.
export const SOURCE_WIDTH = 570;

// Slider bounds. These ARE the persisted-value contract: a stored number
// outside them cannot have come from the slider, so it is treated as junk.
export const MIN_ZOOM = 15;
export const MAX_ZOOM = 100;

// Defaults per surface. Mobile gets the larger share because its deck zone is
// only a phone wide, so a smaller percentage there would floor out (below)
// and the slider's bottom half would do nothing.
//
// The desktop default is the smallest value at which a card still renders its
// controls at full size: below FULL_CONTROLS_CARD_WIDTH the tile's move button
// falls back to a compact one (see the @container rule on .deck-mini-move-btn),
// so a smaller default would ship a degraded tile as the out-of-box state.
// On the 360px default panel, 25% gives an 84px card -- clear of that
// threshold, and three columns.
export const DEFAULT_ZOOM_MOBILE = 30;
export const DEFAULT_ZOOM_DESKTOP = 25;

// Mirrors the `@container (min-width: 80px)` breakpoint in styles.css, which
// is where .deck-mini's controls switch to their full touch size. Kept here so
// a test can prove the defaults clear it; keep the two in sync.
export const FULL_CONTROLS_CARD_WIDTH = 80;

// Below this a mini-card can no longer carry its −/count/+ row (two 20px
// buttons plus the count), so a low percentage in a narrow panel floors here
// rather than rendering something unusable.
//
// Kept at the width that row physically needs, and no higher: a floor above it
// silently overrides the chosen defaults instead of guarding against absurdity.
// At 90 it did exactly that -- the 20% desktop default on a 360px panel
// resolves to 67px, so every setting from 15% to 27% rendered identically and
// the default was really 27%. See the regression test in test/zoom.test.js.
export const MIN_CARD_WIDTH = 60;

// .deckpanel-body has `padding: 10px 12px` in styles.css — keep in sync.
export const BODY_PADDING_X = 24;

export const ZOOM_STORAGE_KEY = 'meccg.cardZoom';

export function defaultZoom(isMobile) {
  return isMobile ? DEFAULT_ZOOM_MOBILE : DEFAULT_ZOOM_DESKTOP;
}

// Total: anything that is not a finite number (null, '', 'abc', NaN, Infinity,
// a boolean, an object) yields `fallback` rather than coercing — Number(null)
// is 0, which would otherwise clamp to MIN_ZOOM and look like a real choice.
export function clampZoom(value, fallback = DEFAULT_ZOOM_DESKTOP) {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(n)));
}

// Width available to the card grid inside a panel/sheet of `outerWidth`.
export function deckZoneWidth(outerWidth) {
  const n = Number(outerWidth);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n) - BODY_PADDING_X);
}

// On-screen card width for a deck zone `containerWidth` px wide at `zoomPct`.
// Floored at MIN_CARD_WIDTH and capped at SOURCE_WIDTH, so no percentage and
// no container width can produce a zero, negative or upsampled card.
export function cardWidthFor(containerWidth, zoomPct) {
  const pct = clampZoom(zoomPct);
  const w = Number(containerWidth);
  if (!Number.isFinite(w) || w <= 0) return MIN_CARD_WIDTH;
  return Math.min(SOURCE_WIDTH, Math.max(MIN_CARD_WIDTH, Math.round((w * pct) / 100)));
}

// localStorage string (or null when unset) -> a usable percentage. Junk and
// out-of-range values fall back to the surface default rather than clamping to
// a bound: a stored 99999 did not come from the slider, and snapping it to
// 100% would present someone else's corruption as the user's own preference.
export function parseStoredZoom(raw, isMobile) {
  const fallback = defaultZoom(isMobile);
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < MIN_ZOOM || rounded > MAX_ZOOM) return fallback;
  return rounded;
}
