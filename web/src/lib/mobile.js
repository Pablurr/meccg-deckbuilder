// Single source of truth for the mobile breakpoint. The CSS @media block in
// web/src/styles.css MUST use this exact same condition — keep them in sync.
export const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';

// Pure predicate mirroring MOBILE_QUERY, used in tests and as a fallback.
export function isMobileWidth(width, coarsePointer) {
  return width <= 768 || coarsePointer === true;
}
