import { describe, it, expect } from 'vitest';
import { splitTags, cardTags, baseOptions } from '../web/src/lib/tags.js';

describe('splitTags', () => {
  it('splits skills on "/" into base tokens', () => {
    expect(splitTags('Warrior/Diplomat/Sage', 'skills')).toEqual(['Warrior', 'Diplomat', 'Sage']);
  });

  it('splits subtypes on "/" into base tokens', () => {
    expect(splitTags('Creature/Short-event', 'subtypes')).toEqual(['Creature', 'Short-event']);
  });

  it('keeps a single-value skill as one token', () => {
    expect(splitTags('Sage', 'skills')).toEqual(['Sage']);
  });

  it('splits races on "," and canonicalizes plural/variant to singular', () => {
    expect(splitTags('Orcs,Men', 'races')).toEqual(['Orc', 'Man']);
    expect(splitTags('Animals,Men,Bears', 'races')).toEqual(['Animal', 'Man', 'Bears']);
    expect(splitTags('Dúnedain', 'races')).toEqual(['Dúnadan']);
    expect(splitTags('Troll', 'races')).toEqual(['Troll']);
  });

  it('returns [] for empty/missing values', () => {
    expect(splitTags('', 'skills')).toEqual([]);
    expect(splitTags(undefined, 'races')).toEqual([]);
  });
});

describe('cardTags', () => {
  it('reads the right attribute per facet key', () => {
    const card = { attributes: { race: 'Orcs,Men', subtype: 'Creature/Short-event', skills: 'Warrior/Sage' } };
    expect(cardTags(card, 'races')).toEqual(['Orc', 'Man']);
    expect(cardTags(card, 'subtypes')).toEqual(['Creature', 'Short-event']);
    expect(cardTags(card, 'skills')).toEqual(['Warrior', 'Sage']);
  });

  it('returns [] when the attribute is absent', () => {
    expect(cardTags({ attributes: {} }, 'races')).toEqual([]);
  });
});

describe('baseOptions', () => {
  const cards = [
    { attributes: { race: 'Orcs,Men', skills: 'Warrior/Sage' } },
    { attributes: { race: 'Orc', skills: 'Sage/Diplomat' } },
    { attributes: { race: 'Troll' } },
  ];

  it('produces a sorted, de-duplicated base option list', () => {
    expect(baseOptions(cards, 'races')).toEqual(['Man', 'Orc', 'Troll']);
    expect(baseOptions(cards, 'skills')).toEqual(['Diplomat', 'Sage', 'Warrior']);
  });
});
