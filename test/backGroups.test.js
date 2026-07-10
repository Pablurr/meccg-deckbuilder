import { describe, it, expect } from 'vitest';
import { backGroupForType, slug } from '../web/src/lib/export/backGroups.js';

describe('backGroupForType', () => {
  it('routes sites/regions to locationdeck, everything else to playdeck', () => {
    expect(backGroupForType('Site')).toBe('locationdeck');
    expect(backGroupForType('Region')).toBe('locationdeck');
    expect(backGroupForType('Character')).toBe('playdeck');
    expect(backGroupForType('Hazard')).toBe('playdeck');
    expect(backGroupForType(undefined)).toBe('playdeck');
  });
});

describe('slug', () => {
  it('strips diacritics and non-alphanumerics', () => {
    expect(slug('Bûrat')).toBe('Burat');
    expect(slug('All the Bells Ringing!')).toBe('All-the-Bells-Ringing');
    expect(slug('')).toBe('card');
  });
});
