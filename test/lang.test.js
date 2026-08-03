import { describe, it, expect } from 'vitest';
import { cardImageSrc, cardImageEn, cardName, cardThumbSrc, deckThumbWidth, setName, setLabel } from '../web/src/lib/lang.js';

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

describe('setName / setLabel', () => {
  const SETS = {
    AS: { en: 'Against the Shadow', fr: "Contre l'Ombre", es: 'Contra la Sombra' },
    XX: { en: 'English Only' },
  };

  it('returns the name in the requested language', () => {
    expect(setName(SETS, 'AS', 'fr')).toBe("Contre l'Ombre");
    expect(setName(SETS, 'AS', 'es')).toBe('Contra la Sombra');
    expect(setName(SETS, 'AS', 'en')).toBe('Against the Shadow');
  });

  it('falls back to English, then French, then the bare code — like cardName', () => {
    expect(setName(SETS, 'XX', 'fr')).toBe('English Only');
    expect(setName(SETS, 'NOPE', 'fr')).toBe('NOPE');
    expect(setName({}, 'NOPE', 'fr')).toBe('NOPE');
    expect(setName(null, 'NOPE', 'fr')).toBe('NOPE');
  });

  it('treats a whitespace-only name as absent', () => {
    // "   " is not a name; without the trim it would render as a blank menu row.
    expect(setName({ Z: { fr: '   ', en: 'Fallback' } }, 'Z', 'fr')).toBe('Fallback');
  });

  it('shows the code alongside the name, since ids and text exports use it', () => {
    expect(setLabel(SETS, 'AS', 'fr')).toBe("Contre l'Ombre (AS)");
    expect(setLabel(SETS, 'AS', 'en')).toBe('Against the Shadow (AS)');
  });

  it('does not print "AS (AS)" when the code is all there is', () => {
    expect(setLabel(SETS, 'NOPE', 'fr')).toBe('NOPE');
    expect(setLabel({}, 'TW', 'fr')).toBe('TW');
  });
});

describe('deckThumbWidth', () => {
  it('rounds up to 100px steps', () => {
    expect(deckThumbWidth(285)).toBe(300);
    expect(deckThumbWidth(300)).toBe(300);
    expect(deckThumbWidth(301)).toBe(400);
  });
  it('floors at 200px', () => {
    expect(deckThumbWidth(85)).toBe(200);
    expect(deckThumbWidth(150)).toBe(200);
  });
  it('caps at the 570px source width', () => {
    expect(deckThumbWidth(570)).toBe(570);
    expect(deckThumbWidth(9999)).toBe(570);
  });
});
