import { describe, it, expect } from 'vitest';
import { cardImageSrc, cardImageEn, cardName, cardThumbSrc } from '../web/src/lib/lang.js';

const card = {
  id: 'AS-1',
  image: 'Burat.jpg',
  name: { en: 'Bûrat', fr: 'Bûrat-fr' },
  imageBaseUrl: { en: 'https://cdn/en/as/', fr: 'https://cdn/fr/as/' },
};

describe('cardImageSrc (CDN)', () => {
  it('builds the URL from the per-set base for the language', () => {
    expect(cardImageSrc(card, 'fr')).toBe('https://cdn/fr/as/Burat.jpg');
    expect(cardImageSrc(card, 'en')).toBe('https://cdn/en/as/Burat.jpg');
  });
  it('falls back to English when the language has no base', () => {
    expect(cardImageSrc(card, 'es')).toBe('https://cdn/en/as/Burat.jpg');
  });
  it('returns empty string when data is missing', () => {
    expect(cardImageSrc({}, 'en')).toBe('');
  });
  it('cardImageEn always returns the English URL', () => {
    expect(cardImageEn(card)).toBe('https://cdn/en/as/Burat.jpg');
  });
});

describe('cardThumbSrc (wsrv proxy)', () => {
  it('wraps the full-res CDN url in the wsrv resizer as WebP', () => {
    expect(cardThumbSrc(card, 'fr', 260)).toBe(
      'https://wsrv.nl/?url=' + encodeURIComponent('https://cdn/fr/as/Burat.jpg') + '&w=260&output=webp'
    );
  });
  it('follows the same English fallback as cardImageSrc', () => {
    expect(cardThumbSrc(card, 'es', 100)).toBe(
      'https://wsrv.nl/?url=' + encodeURIComponent('https://cdn/en/as/Burat.jpg') + '&w=100&output=webp'
    );
  });
  it('returns empty string when there is no image', () => {
    expect(cardThumbSrc({}, 'en')).toBe('');
  });
});

describe('cardName', () => {
  it('uses the requested language with en fallback', () => {
    expect(cardName(card, 'fr')).toBe('Bûrat-fr');
    expect(cardName({ id: 'X' }, 'fr')).toBe('X');
  });
});
