import { describe, it, expect } from 'vitest';
import { imageUrl, IMAGE_LANGUAGES } from '../src/imageSource.js';

const imageBaseUrls = {
  AS: { en: 'https://cdn/en/as/', es: 'https://cdn/es/as/', fr: 'https://cdn/fr/as/' },
};

describe('imageUrl', () => {
  it('joins the language base URL with the card image filename', () => {
    const card = { setCode: 'AS', image: 'Burat.jpg' };
    expect(imageUrl(card, imageBaseUrls, 'en')).toBe('https://cdn/en/as/Burat.jpg');
    expect(imageUrl(card, imageBaseUrls, 'fr')).toBe('https://cdn/fr/as/Burat.jpg');
    expect(imageUrl(card, imageBaseUrls, 'es')).toBe('https://cdn/es/as/Burat.jpg');
  });

  it('falls back to en when the language has no base URL', () => {
    const card = { setCode: 'AS', image: 'Burat.jpg' };
    expect(imageUrl(card, imageBaseUrls, 'de')).toBe('https://cdn/en/as/Burat.jpg');
  });

  it('returns null when the set or image is missing', () => {
    expect(imageUrl({ setCode: 'ZZ', image: 'x.jpg' }, imageBaseUrls, 'en')).toBeNull();
    expect(imageUrl({ setCode: 'AS', image: '' }, imageBaseUrls, 'en')).toBeNull();
  });

  it('exposes only the languages that actually have images', () => {
    expect(IMAGE_LANGUAGES).toEqual(['en', 'es', 'fr']);
  });
});
