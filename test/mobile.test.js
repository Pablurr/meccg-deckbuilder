import { describe, it, expect } from 'vitest';
import { MOBILE_QUERY, isMobileWidth } from '../web/src/lib/mobile.js';

describe('MOBILE_QUERY', () => {
  it('is a width-only breakpoint so touch desktops stay on desktop', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 768px)');
  });
});

describe('isMobileWidth', () => {
  it('is true at or below 768px', () => {
    expect(isMobileWidth(768)).toBe(true);
    expect(isMobileWidth(375)).toBe(true);
  });
  it('is false above 768px, regardless of pointer type', () => {
    expect(isMobileWidth(769)).toBe(false);
    expect(isMobileWidth(1024)).toBe(false);
    expect(isMobileWidth(1400)).toBe(false);
  });
});
