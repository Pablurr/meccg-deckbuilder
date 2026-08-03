import { describe, it, expect } from 'vitest';
import { lookupHeading, lookupMetaKey, parseMetaValue, HEADINGS } from '../web/src/lib/import/vocabulary.js';

describe('lookupHeading — a heading is its content, not its markdown level', () => {
  it('reads the same word through every wrapping', () => {
    for (const s of ['## Talon', '### Talon', 'Talon', 'Talon :', 'Talon:', '**Talon**', '# Talon']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'sideboard' });
    }
  });

  it('ignores accents and case, so "Reserve" and "RÉSERVE" are one word', () => {
    for (const s of ['Réserve', 'reserve', 'RÉSERVE']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'pool' });
    }
  });

  it('drops a trailing count, which our own exports write', () => {
    expect(lookupHeading('### Characters (12)')).toMatchObject({ family: 'group', type: 'Character' });
  });

  it('routes every zone word to its zone, in the three languages', () => {
    expect(lookupHeading('Play deck')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Pioche')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Mazo de juego')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Sideboard')).toMatchObject({ zone: 'sideboard' });
    expect(lookupHeading('Pool')).toMatchObject({ zone: 'pool' });
    expect(lookupHeading('Reserva')).toMatchObject({ zone: 'pool' });
    // The location deck is not a zone of its own: it lives in `quantities`,
    // and play deck vs locations is derived from the card type.
    expect(lookupHeading('Locations')).toMatchObject({ zone: 'quantities' });
    expect(lookupHeading('Lieux')).toMatchObject({ zone: 'quantities' });
  });

  it('"Deck" alone is the play deck, which is why the metadata block is not called that', () => {
    expect(lookupHeading('Deck')).toMatchObject({ family: 'zone', zone: 'quantities' });
    expect(lookupHeading('Metadata')).toMatchObject({ family: 'meta' });
  });

  it('a group heading carries a TYPE_ORDER value, or none at all', () => {
    expect(lookupHeading('Hazards')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Périls')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Peligros')).toMatchObject({ family: 'group', type: 'Hazard' });
    expect(lookupHeading('Minor objects')).toMatchObject({ family: 'group', type: 'Resource' });
    expect(lookupHeading('Stage events')).toMatchObject({ family: 'group', type: 'Resource' });
    // Avatars and Other do not reduce to one type: no hint beats a false hint.
    expect(lookupHeading('Avatars')).toMatchObject({ family: 'group', type: null });
    expect(lookupHeading('Other')).toMatchObject({ family: 'group', type: null });
  });

  it('note headings select a field when they name one, and none when generic', () => {
    expect(lookupHeading('Notes')).toMatchObject({ family: 'notes', field: null });
    expect(lookupHeading('Description')).toMatchObject({ family: 'notes', field: null });
    expect(lookupHeading('Resource strategy')).toMatchObject({ family: 'notes', field: 'resourceStrategy' });
    expect(lookupHeading('Stratégie ressources')).toMatchObject({ family: 'notes', field: 'resourceStrategy' });
  });

  it('an unknown heading is not a heading', () => {
    expect(lookupHeading('Plan de jeu')).toBe(null);
    expect(lookupHeading('3x Bûrat')).toBe(null);
    expect(lookupHeading('')).toBe(null);
  });
});

describe('HEADINGS — one reading per word', () => {
  it('no normalized word belongs to two families', () => {
    // This is the assertion that would have caught "Deck" being both the play
    // deck and the metadata block heading.
    const seen = new Map();
    for (const [word, entry] of HEADINGS) {
      expect(seen.has(word)).toBe(false);
      seen.set(word, entry);
    }
    expect(seen.size).toBe(HEADINGS.size);
  });
});

describe('metadata keys and values', () => {
  it('reads the key in the three languages', () => {
    expect(lookupMetaKey('Mode')).toBe('mode');
    expect(lookupMetaKey('Side')).toBe('side');
    expect(lookupMetaKey('Camp')).toBe('side');
    expect(lookupMetaKey('Bando')).toBe('side');
    expect(lookupMetaKey('Game length')).toBe('length');
    expect(lookupMetaKey('Longueur de partie')).toBe('length');
    expect(lookupMetaKey('Nimportequoi')).toBe(null);
  });

  it('accepts the canonical value, the raw id and the localized label', () => {
    expect(parseMetaValue('side', 'Balrog')).toBe('balrog');
    expect(parseMetaValue('side', 'balrog')).toBe('balrog');
    expect(parseMetaValue('side', "Spectre de l'Anneau")).toBe('ringwraith');
    expect(parseMetaValue('side', 'Espectro del Anillo')).toBe('ringwraith');
    expect(parseMetaValue('mode', 'Deckbuilding')).toBe('deckbuilding');
    expect(parseMetaValue('mode', 'Libre')).toBe('freeform');
    expect(parseMetaValue('length', 'Standard')).toBe('standard');
    // length.standard displays as "Short" in all three languages -- the label
    // and the canonical value differ, and both must resolve.
    expect(parseMetaValue('length', 'Short')).toBe('standard');
    expect(parseMetaValue('length', 'Campagne')).toBe('campaign');
    expect(parseMetaValue('side', 'Nimportequoi')).toBe(null);
  });
});
