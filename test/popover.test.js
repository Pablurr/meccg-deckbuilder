import { describe, it, expect } from 'vitest';
import { placePopover, POPOVER_MARGIN } from '../web/src/lib/popover.js';

const VIEWPORT = { width: 1280, height: 800 };
const SIZE = { width: 300, height: 120 };

describe('placePopover', () => {
  it('prefers the left of the anchor, where the deck panel leaves room', () => {
    const anchor = { left: 900, right: 1260, top: 200 };
    expect(placePopover(anchor, SIZE, VIEWPORT)).toEqual({ left: 900 - 8 - 300, top: 200 });
  });

  it('flips to the right when the left side would overflow', () => {
    const anchor = { left: 40, right: 300, top: 100 };
    expect(placePopover(anchor, SIZE, VIEWPORT).left).toBe(308);
  });

  it('clamps inside the viewport when neither side fits', () => {
    const narrow = { width: 420, height: 800 };
    const anchor = { left: 60, right: 380, top: 100 };
    const { left } = placePopover(anchor, SIZE, narrow);
    expect(left).toBeGreaterThanOrEqual(POPOVER_MARGIN);
    expect(left + SIZE.width).toBeLessThanOrEqual(narrow.width - POPOVER_MARGIN);
  });

  it('never returns a negative coordinate, even in a viewport narrower than the panel', () => {
    const tiny = { width: 200, height: 150 };
    const { left, top } = placePopover({ left: 10, right: 190, top: 10 }, SIZE, tiny);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('pulls the panel up so its bottom stays on screen', () => {
    const anchor = { left: 900, right: 1260, top: 760 };
    const { top } = placePopover(anchor, SIZE, VIEWPORT);
    expect(top).toBe(800 - 120 - 8);
    expect(top + SIZE.height).toBeLessThanOrEqual(VIEWPORT.height - POPOVER_MARGIN);
  });

  it('pins a panel taller than the viewport to the top margin instead of pushing it off', () => {
    const tall = { width: 300, height: 900 };
    expect(placePopover({ left: 900, right: 1260, top: 400 }, tall, VIEWPORT).top).toBe(POPOVER_MARGIN);
  });

  it('keeps the anchor top when the panel already fits below it', () => {
    expect(placePopover({ left: 900, right: 1260, top: 0 }, SIZE, VIEWPORT).top).toBe(POPOVER_MARGIN);
  });
});
