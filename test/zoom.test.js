import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ZOOM_MOBILE,
  DEFAULT_ZOOM_DESKTOP,
  MIN_ZOOM,
  MAX_ZOOM,
  MIN_CARD_WIDTH,
  FULL_CONTROLS_CARD_WIDTH,
  SOURCE_WIDTH,
  ZOOM_STORAGE_KEY,
  defaultZoom,
  clampZoom,
  cardWidthFor,
  deckZoneWidth,
  parseStoredZoom,
} from '../web/src/lib/zoom.js';

describe('defaultZoom', () => {
  // The literals are pinned on purpose: these two numbers are a product
  // decision, not an implementation detail, so changing one should have to be
  // deliberate. Desktop was raised 20 -> 25 because 20% of a default panel
  // rendered an 67px card, below the width at which the tile keeps its
  // full-size controls.
  it('pins the per-surface defaults', () => {
    expect(defaultZoom(true)).toBe(DEFAULT_ZOOM_MOBILE);
    expect(defaultZoom(false)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(DEFAULT_ZOOM_MOBILE).toBe(30);
    expect(DEFAULT_ZOOM_DESKTOP).toBe(25);
  });

  it('returns two different values, so the surfaces do not share one default', () => {
    expect(defaultZoom(true)).not.toBe(defaultZoom(false));
  });

  it('treats a missing argument as desktop', () => {
    expect(defaultZoom()).toBe(DEFAULT_ZOOM_DESKTOP);
  });

  it('keeps both defaults inside the slider range', () => {
    for (const z of [DEFAULT_ZOOM_MOBILE, DEFAULT_ZOOM_DESKTOP]) {
      expect(z).toBeGreaterThanOrEqual(MIN_ZOOM);
      expect(z).toBeLessThanOrEqual(MAX_ZOOM);
    }
  });
});

describe('clampZoom', () => {
  it('passes an in-range value through', () => {
    expect(clampZoom(20)).toBe(20);
    expect(clampZoom(30)).toBe(30);
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
  });

  it('clamps out-of-range numbers to the bounds', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(-5)).toBe(MIN_ZOOM);
    expect(clampZoom(1e9)).toBe(MAX_ZOOM);
  });

  it('rounds fractional percentages', () => {
    expect(clampZoom(30.4)).toBe(30);
    expect(clampZoom(30.6)).toBe(31);
  });

  it('falls back for non-numeric, NaN and nullish input', () => {
    expect(clampZoom(null)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom(undefined)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom('')).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom('abc')).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom(NaN)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom(Infinity)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom({})).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(clampZoom(true)).toBe(DEFAULT_ZOOM_DESKTOP);
  });

  it('honours an explicit fallback', () => {
    expect(clampZoom('abc', DEFAULT_ZOOM_MOBILE)).toBe(DEFAULT_ZOOM_MOBILE);
  });
});

describe('deckZoneWidth', () => {
  it('subtracts the deck body padding from the outer width', () => {
    expect(deckZoneWidth(375)).toBe(351);
    expect(deckZoneWidth(360)).toBe(336);
  });

  it('never goes negative for a degenerate outer width', () => {
    expect(deckZoneWidth(0)).toBe(0);
    expect(deckZoneWidth(10)).toBe(0);
    expect(deckZoneWidth(NaN)).toBe(0);
    expect(deckZoneWidth(null)).toBe(0);
  });
});

describe('cardWidthFor', () => {
  it('is a percentage of the container, not of the source image', () => {
    expect(cardWidthFor(1000, 30)).toBe(300);
    expect(cardWidthFor(800, 25)).toBe(200);
  });

  it('is proportional: doubling the container doubles the card', () => {
    const small = cardWidthFor(500, 30);
    const big = cardWidthFor(1000, 30);
    expect(small).toBe(150);
    expect(big).toBe(2 * small);
  });

  it('rounds to whole pixels', () => {
    expect(Number.isInteger(cardWidthFor(351, 30))).toBe(true);
    expect(cardWidthFor(351, 30)).toBe(105);
  });

  it('never returns less than the usable minimum', () => {
    expect(cardWidthFor(336, MIN_ZOOM)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(100, 15)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(1, 15)).toBe(MIN_CARD_WIDTH);
  });

  // The floor guards against absurd sizes; it must not quietly redefine the
  // defaults. With MIN_CARD_WIDTH at 90 the desktop default resolved to the
  // floor on a default-width panel, so 15%-27% all rendered identically and
  // the effective default was 27%, not the 20% asked for. Both surfaces must
  // therefore land strictly above the floor at their own default.
  it('neither surface default is swallowed by the floor at its usual width', () => {
    const desktop = cardWidthFor(deckZoneWidth(360), DEFAULT_ZOOM_DESKTOP);
    const mobile = cardWidthFor(deckZoneWidth(375), DEFAULT_ZOOM_MOBILE);
    expect(desktop).toBeGreaterThan(MIN_CARD_WIDTH);
    expect(mobile).toBeGreaterThan(MIN_CARD_WIDTH);
    // and the slider still moves at the bottom of its range there
    expect(cardWidthFor(deckZoneWidth(360), MIN_ZOOM))
      .toBeLessThan(desktop);
  });

  // Both defaults must clear the width at which .deck-mini's controls drop to
  // their compact fallback (the @container rule in styles.css), so the shipped
  // default is never a degraded tile. This is the test that fails if someone
  // lowers a default for density without noticing what it costs.
  it('both defaults render a card with full-size controls', () => {
    expect(cardWidthFor(deckZoneWidth(360), DEFAULT_ZOOM_DESKTOP))
      .toBeGreaterThanOrEqual(FULL_CONTROLS_CARD_WIDTH);
    expect(cardWidthFor(deckZoneWidth(375), DEFAULT_ZOOM_MOBILE))
      .toBeGreaterThanOrEqual(FULL_CONTROLS_CARD_WIDTH);
  });

  it('never upsamples beyond the source image width', () => {
    expect(cardWidthFor(4000, 100)).toBe(SOURCE_WIDTH);
    expect(cardWidthFor(1900, 50)).toBe(SOURCE_WIDTH);
  });

  it('is total: junk container widths still yield a usable width', () => {
    expect(cardWidthFor(0, 30)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(-100, 30)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(NaN, 30)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(null, 30)).toBe(MIN_CARD_WIDTH);
    expect(cardWidthFor(undefined, 30)).toBe(MIN_CARD_WIDTH);
  });

  it('is total: a junk zoom falls back to the desktop default', () => {
    expect(cardWidthFor(1000, 'abc')).toBe(cardWidthFor(1000, DEFAULT_ZOOM_DESKTOP));
    expect(cardWidthFor(1000, null)).toBe(cardWidthFor(1000, DEFAULT_ZOOM_DESKTOP));
  });

  // Regression guard for the semantic change. The old implementation was
  // `SOURCE_WIDTH * zoom / 100`, which ignored the container entirely: one
  // percentage produced one width in a 336px desktop panel and in a 1800px
  // maximised one alike. This is the assertion that would have caught it.
  it('gives DIFFERENT widths for the same percentage in different containers', () => {
    const sheet = cardWidthFor(351, 30);
    const wide = cardWidthFor(1200, 30);
    expect(sheet).not.toBe(wide);
    expect(wide).toBeGreaterThan(sheet);
    // And neither equals what the absolute formula would have produced.
    const absolute = Math.round((SOURCE_WIDTH * 30) / 100);
    expect(sheet).not.toBe(absolute);
    expect(wide).not.toBe(absolute);
  });
});

describe('parseStoredZoom', () => {
  it('uses the meccg. namespace like the other persisted settings', () => {
    expect(ZOOM_STORAGE_KEY.startsWith('meccg.')).toBe(true);
  });

  it('round-trips a value the slider could have produced', () => {
    expect(parseStoredZoom('45', false)).toBe(45);
    expect(parseStoredZoom(String(DEFAULT_ZOOM_MOBILE), true)).toBe(DEFAULT_ZOOM_MOBILE);
    expect(parseStoredZoom(String(MIN_ZOOM), false)).toBe(MIN_ZOOM);
    expect(parseStoredZoom(String(MAX_ZOOM), false)).toBe(MAX_ZOOM);
  });

  it('falls back to the surface default when nothing is stored', () => {
    expect(parseStoredZoom(null, true)).toBe(DEFAULT_ZOOM_MOBILE);
    expect(parseStoredZoom(null, false)).toBe(DEFAULT_ZOOM_DESKTOP);
    expect(parseStoredZoom(undefined, true)).toBe(DEFAULT_ZOOM_MOBILE);
  });

  it('falls back for junk and out-of-range stored values', () => {
    for (const raw of ['', 'abc', '0', '-5', '99999', '  ', '30px', 'NaN', 'Infinity']) {
      expect(parseStoredZoom(raw, true)).toBe(DEFAULT_ZOOM_MOBILE);
      expect(parseStoredZoom(raw, false)).toBe(DEFAULT_ZOOM_DESKTOP);
    }
  });

  it('always yields a width the layout can render', () => {
    for (const raw of [null, '', 'abc', '0', '-5', '99999', '30']) {
      const z = parseStoredZoom(raw, true);
      const w = cardWidthFor(351, z);
      expect(w).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
      expect(w).toBeLessThanOrEqual(SOURCE_WIDTH);
    }
  });
});
