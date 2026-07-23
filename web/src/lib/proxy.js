// Proxy-stamp geometry (SELF-CLONE variant). Pure data + functions, no IO.
// Instead of per-type swatch assets, the covered copyright / set-name zone is
// filled by cloning a clean segment of the card's OWN bottom-rail band,
// stretched across the zone — so the colour/texture matches every card with
// zero assets. This module only positions the covered zone + the clone source.
// Compare against the swatch-library branch `proxy-card-stamp`.

export const PROXY_LABEL = 'Proxy';

// Covered zone, as fractions of card width/height. en/es show the left-aligned
// "©19xx Tolkien Enterprises"; fr shows the more-centred French set name.
// Calibrated visually; the CSS overlay and the canvas baking both read these.
export const PROXY_RECT = {
  enes: { x: 0.11, y: 0.947, w: 0.35, h: 0.021 },
  fr: { x: 0.165, y: 0.94, w: 0.275, h: 0.024 },
};

export function rectForLang(lang) {
  return lang === 'fr' ? PROXY_RECT.fr : PROXY_RECT.enes;
}

// Clean band segment (same rail row as the covered zone) that gets sampled and
// stretched across the zone. en/es sample just RIGHT of the copyright (clear of
// "Remaster 20xx"); fr samples just LEFT of the set name (clear of the frame
// corner). x/w are card-width fractions; the y/height come from PROXY_RECT.
export const CLONE_SRC = {
  enes: { x: 0.48, w: 0.12 },
  fr: { x: 0.11, w: 0.05 },
};

export function cloneSrcForLang(lang) {
  return lang === 'fr' ? CLONE_SRC.fr : CLONE_SRC.enes;
}

// Whether a card gets a proxy stamp. Only Regions are skipped (their bottom
// strip carries no copyright and no set name). Everything else is cloned
// uniformly — no per-type classification needed in this variant.
export function isStampable(card) {
  return !!card && card.type !== 'Region';
}
