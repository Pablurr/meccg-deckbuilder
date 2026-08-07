import { describe, it, expect } from 'vitest';
import { lookupHeading, lookupMetaKey, parseMetaValue, TABLE } from '../web/src/lib/import/vocabulary.js';
import { normalizeName } from '../web/src/lib/import/normalize.js';

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

  it('"Sites" and "Regions" name a zone, not just a group', () => {
    // A site can only ever live in the location deck, so a list that opens a
    // "Sites" section after its sideboard means the location deck -- reading
    // the word as a group hint alone left every site under it in the
    // sideboard, which is where hand-written and LLM-written lists put them.
    for (const s of ['Sites', 'Sitios', '### Sites (12)']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'quantities', type: 'Site' });
    }
    for (const s of ['Regions', 'Régions', 'Regiones']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'quantities', type: 'Region' });
    }
  });

  it('"Other characters" is a zone too, closing a pool/starting-company section', () => {
    // A group heading (like plain "Characters") does not change the zone; an
    // UNRECOGNISED heading also leaves the zone alone (document.js). Either
    // reading would let "## Other characters" silently keep routing cards
    // into the pool if it followed "## Starting"/"## Pool" -- it must
    // instead close that section and send its characters to the play deck.
    for (const s of ['Other characters', 'Additional characters', 'Autres personnages', 'Otros personajes']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'quantities', type: 'Character' });
    }
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

  it('"Starting"/"Starting company" and their FR/ES equivalents are the pool section', () => {
    for (const s of ['Starting', 'Starting company', 'Starting deck', 'Compagnie de départ', 'Compañía inicial']) {
      expect(lookupHeading(s)).toMatchObject({ family: 'zone', zone: 'pool' });
    }
    // Distinct from the "Starting notes" heading, which selects a NOTES
    // field rather than the pool zone -- the two must never collide.
    expect(lookupHeading('Starting notes')).toMatchObject({ family: 'notes', field: 'starting' });
  });

  it('an unknown heading is not a heading', () => {
    expect(lookupHeading('Plan de jeu')).toBe(null);
    expect(lookupHeading('3x Bûrat')).toBe(null);
    expect(lookupHeading('')).toBe(null);
  });
});

describe('the Fallen-wizard sideboard heading (1.6.1)', () => {
  const aliases = [
    'Sideboard vs FW', 'Sideboard vs. fw', '## SIDEBOARD VS FALLEN-WIZARD',
    'FW sideboard', 'Fallen-wizard opponent sideboard', 'Anti-FW sideboard',
    'SB vs FW', 'Talon vs SD', 'Talon contre Sorcier déchu', 'SB vs MC',
    '### Sideboard vs FW (10)', '**Sideboard vs FW**', 'Sideboard vs FW:',
  ];

  it.each(aliases)('%s resolves to the sideboardFw zone', (raw) => {
    expect(lookupHeading(raw)).toMatchObject({ family: 'zone', zone: 'sideboardFw' });
  });

  it('leaves a bare Sideboard heading on the ordinary sideboard', () => {
    // The trap this pins: 'Sideboard vs FW' CONTAINS 'Sideboard'. If the
    // lookup ever became a prefix or substring match instead of an exact
    // normalized-word match, one of these two would silently swallow the other.
    for (const raw of ['Sideboard', 'SB', 'Side', 'Talon', '## Sideboard (30)']) {
      expect(lookupHeading(raw)).toMatchObject({ family: 'zone', zone: 'sideboard' });
    }
  });
});

describe('TABLE — one reading per word', () => {
  // vocabulary.js builds HEADINGS from TABLE with first-writer-wins, which
  // silently drops the loser of a real collision -- so checking HEADINGS
  // afterwards can never find one: a Map can't hold a duplicate key by
  // construction. To genuinely catch a mistake like "Deck" being registered
  // as both the play deck and the metadata heading, this has to look at
  // every claim in TABLE before any of them are dropped.
  //
  // Two different rows sharing a word is only a problem if they disagree on
  // what the word means. `zone('quantities')` from the play-deck row and
  // from the locations row are two different objects but the SAME reading,
  // so that has to be allowed -- comparing by value, not by reference, is
  // what makes "add a synonym to an existing row's neighbor" safe.
  function sameReading(a, b) {
    return a.family === b.family && a.zone === b.zone && a.type === b.type && a.field === b.field;
  }

  function collidingWords(table) {
    const claimed = new Map(); // normalized word -> first entry that claimed it
    const collisions = [];
    for (const [words, entry] of table) {
      for (const w of words) {
        const key = normalizeName(w);
        if (!key) continue;
        const existing = claimed.get(key);
        if (existing === undefined) claimed.set(key, entry);
        else if (!sameReading(existing, entry)) collisions.push(key);
      }
    }
    return collisions;
  }

  it('no normalized word in the real vocabulary is claimed by two different headings', () => {
    expect(collidingWords(TABLE)).toEqual([]);
  });

  it('two rows sharing a word is not a collision when they mean the same thing', () => {
    const table = [
      [['Foo'], { family: 'zone', zone: 'quantities' }],
      [['Foo', 'Bar'], { family: 'zone', zone: 'quantities' }],
    ];
    expect(collidingWords(table)).toEqual([]);
  });

  it('two rows sharing a word IS a collision when they disagree on its meaning', () => {
    const table = [
      [['Foo'], { family: 'zone', zone: 'sideboard' }],
      [['Foo'], { family: 'group', type: 'Character' }],
    ];
    expect(collidingWords(table)).toEqual(['foo']);
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
