// Single source of truth for the mobile breakpoint. The CSS @media block in
// web/src/styles.css MUST use this exact same condition — keep them in sync.
//
// Width-only, on purpose: a touchscreen *desktop* (coarse pointer but a wide
// screen) must keep the desktop experience — hover to enlarge, click to add,
// the side deck panel, and the full filter row. Only a genuinely narrow
// viewport (a phone, or a deliberately narrow window) switches to mobile.
export const MOBILE_QUERY = '(max-width: 768px)';

// Pure predicate mirroring MOBILE_QUERY, used in tests and as a fallback.
export function isMobileWidth(width) {
  return width <= 768;
}
