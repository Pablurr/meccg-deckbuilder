import { describe, it, expect } from 'vitest';
import { MOBILE_QUERY, isMobileWidth } from '../web/src/lib/mobile.js';

describe('MOBILE_QUERY', () => {
  it('matches the CSS breakpoint: 768px max-width or coarse pointer', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 768px), (pointer: coarse)');
  });
});

describe('isMobileWidth', () => {
  it('is true at or below 768px', () => {
    expect(isMobileWidth(768, false)).toBe(true);
    expect(isMobileWidth(375, false)).toBe(true);
  });
  it('is false above 768px with a fine pointer', () => {
    expect(isMobileWidth(1024, false)).toBe(false);
    expect(isMobileWidth(769, false)).toBe(false);
  });
  it('is true for a coarse pointer regardless of width', () => {
    expect(isMobileWidth(1400, true)).toBe(true);
  });
});
