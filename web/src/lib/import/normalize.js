// Aggressive normalization for full-name matching so a pasted list is
// forgiving. Beyond accents and case, it makes these equivalent:
//   - hyphen vs space vs underscore ("star-glass" = "star glass")
//   - apostrophes/quotes/punctuation ("Thrór's Map" = "thrors map")
//   - "&" and "and", common ligatures (oe, ae, ss)
//
// It lives alone in a leaf module with no imports on purpose: the facade
// (importDeck.js) re-exports it while also importing the vocabulary, and the
// vocabulary needs it -- routing it through the facade would be a cycle.
//
// The combining-mark range is written with explicit \u escapes: literal
// combining marks are destroyed by a copy-paste and the strip then stops
// working silently.
export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, ''); // drop spaces, hyphens, apostrophes, punctuation
}
