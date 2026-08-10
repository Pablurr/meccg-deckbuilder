import { describe, it, expect } from 'vitest';
import { filterCards, sortFacetOptions, sortCards } from '../web/src/lib/filter.js';

const cards = [
  { id: 'AS-1', setCode: 'AS', type: 'Character', alignment: 'Minion', rarity: 'U2', artist: 'Omar Rayyan', name: { en: 'Bûrat', fr: 'Bûrat' }, text: 'Manifestation of Bert. +1 prowess against Dwarves.', attributes: { race: 'Troll', skills: 'Warrior/Ranger', unique: true, keywords: ['Maia'] } },
  { id: 'AS-44', setCode: 'AS', type: 'Resource', alignment: 'Hero', rarity: 'C1', artist: 'Angus McBride', name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin', es: 'Campanas al Vuelo' }, text: 'Tap to make each opposing company move.', attributes: { subtype: 'Creature/Short-event', skills: 'Sage/Diplomat' } },
  { id: 'BA-1', setCode: 'BA', type: 'Site', alignment: 'Neutral', rarity: 'R', artist: 'Angus McBride', name: { en: 'Bag End', fr: 'Cul-de-Sac' }, text: '', attributes: { race: 'Orcs,Men' } },
];

describe('filterCards', () => {
  it('returns everything with no filters', () => {
    expect(filterCards(cards, {})).toHaveLength(3);
  });

  it('filters by set and type', () => {
    expect(filterCards(cards, { sets: ['AS'] })).toHaveLength(2);
    expect(filterCards(cards, { types: ['Site'] }).map((c) => c.id)).toEqual(['BA-1']);
  });

  it('filters by unique as an array facet', () => {
    // AS-1 is unique: true; AS-44 and BA-1 have no `unique` attribute (falsy).
    expect(filterCards(cards, { unique: ['true'] }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { unique: ['false'] }).map((c) => c.id)).toEqual(['AS-44', 'BA-1']);
    // Both values selected excludes nothing, like any other multi-select facet.
    expect(filterCards(cards, { unique: ['true', 'false'] }).map((c) => c.id)).toEqual(['AS-1', 'AS-44', 'BA-1']);
    // No selection excludes nothing.
    expect(filterCards(cards, { unique: [] })).toHaveLength(3);
  });

  it('filters by keyword membership', () => {
    expect(filterCards(cards, { keywords: ['Maia'] }).map((c) => c.id)).toEqual(['AS-1']);
  });

  it('searches en and fr names case-insensitively', () => {
    expect(filterCards(cards, { search: 'bells' }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { search: 'tocsin' }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { search: 'cul-de-sac' }).map((c) => c.id)).toEqual(['BA-1']);
  });

  it('filters by artist (exact match, OR within the facet)', () => {
    expect(filterCards(cards, { artists: ['Omar Rayyan'] }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { artists: ['Angus McBride'] }).map((c) => c.id)).toEqual(['AS-44', 'BA-1']);
    expect(filterCards(cards, { artists: ['Omar Rayyan', 'Angus McBride'] }).map((c) => c.id)).toEqual(['AS-1', 'AS-44', 'BA-1']);
  });

  it('searches es names too', () => {
    expect(filterCards(cards, { search: 'campanas' }).map((c) => c.id)).toEqual(['AS-44']);
  });

  it('searches ignoring accents (both query and card names)', () => {
    // query without accent matches accented name
    expect(filterCards(cards, { search: 'burat' }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { search: 'BÛRAT' }).map((c) => c.id)).toEqual(['AS-1']);
  });

  it('matches skills by base token across compound values', () => {
    // AS-1 is Warrior/Ranger, AS-44 is Sage/Diplomat
    expect(filterCards(cards, { skills: ['Warrior'] }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { skills: ['Sage'] }).map((c) => c.id)).toEqual(['AS-44']);
    // cumulative (OR): either skill
    expect(filterCards(cards, { skills: ['Ranger', 'Diplomat'] }).map((c) => c.id)).toEqual(['AS-1', 'AS-44']);
  });

  it('matches subtypes by base token across compound values', () => {
    expect(filterCards(cards, { subtypes: ['Creature'] }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { subtypes: ['Short-event'] }).map((c) => c.id)).toEqual(['AS-44']);
  });

  it('matches races by base token, splitting commas and folding plural to singular', () => {
    // BA-1 race is "Orcs,Men"
    expect(filterCards(cards, { races: ['Man'] }).map((c) => c.id)).toEqual(['BA-1']);
    expect(filterCards(cards, { races: ['Orc'] }).map((c) => c.id)).toEqual(['BA-1']);
    expect(filterCards(cards, { races: ['Troll'] }).map((c) => c.id)).toEqual(['AS-1']);
  });

  it('searches card text ignoring accents', () => {
    expect(filterCards(cards, { cardText: 'dwarves' }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { cardText: 'company' }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { cardText: 'nothing here' })).toHaveLength(0);
  });
});

describe('sortFacetOptions', () => {
  const label = (v) => ({ Character: 'Personnages', Resource: 'Ressources', Hazard: 'Périls', Site: 'Sites', Region: 'Régions' }[v] || v);

  it('sortFacetOptions: with an order, the display language cannot change the sequence', () => {
    const opts = ['Region', 'Hazard', 'Character', 'Site', 'Resource'];
    const order = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];
    expect(sortFacetOptions(opts, { order, label })).toEqual(order);
  });

  it('sortFacetOptions: a value missing from the order goes last, not first', () => {
    const order = ['Character', 'Resource'];
    expect(sortFacetOptions(['Zebra', 'Resource', 'Alpha'], { order, label: (v) => v }))
      .toEqual(['Resource', 'Alpha', 'Zebra']);
  });

  it('sortFacetOptions: with no order it sorts on the label, which is the existing behaviour', () => {
    // Returns raw values, ordered by what they DISPLAY as. French collation
    // treats "é" as "e", so "Périls" sorts before "Personnages" — which is
    // exactly why the Type facet needed an explicit order instead.
    expect(sortFacetOptions(['Hazard', 'Character'], { label })).toEqual(['Hazard', 'Character']);
  });
});

describe('sortCards', () => {
  const sortCardsFixture = [
    { id: 'AS-10', setCode: 'AS', type: 'Hazard', name: { en: 'Zed' } },
    { id: 'AS-2', setCode: 'AS', type: 'Character', name: { en: 'Alpha' } },
    { id: 'BA-1', setCode: 'BA', type: 'Character', name: { en: 'Mid' } },
  ];

  it('returns the same array reference when no primary key is given', () => {
    expect(sortCards(sortCardsFixture, {})).toBe(sortCardsFixture);
  });

  it('sorts by a single primary key', () => {
    const result = sortCards(sortCardsFixture, { primary: 'sets' });
    expect(result.map((c) => c.id)).toEqual(['AS-2', 'AS-10', 'BA-1']);
  });

  it('breaks ties on card_id with numeric comparison (AS-2 before AS-10)', () => {
    const result = sortCards(sortCardsFixture, { primary: 'sets' });
    // Both AS-10 and AS-2 share setCode "AS" -- numeric id comparison must
    // place AS-2 first, not "AS-10" < "AS-2" as a plain string compare would.
    expect(result.map((c) => c.id).slice(0, 2)).toEqual(['AS-2', 'AS-10']);
  });

  it('types sorts by TYPE_ORDER (play order), not alphabetically', () => {
    const cards = [
      { id: 'X-1', type: 'Hazard' },
      { id: 'X-2', type: 'Character' },
      { id: 'X-3', type: 'Resource' },
    ];
    // TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region']
    expect(sortCards(cards, { primary: 'types' }).map((c) => c.id)).toEqual(['X-2', 'X-3', 'X-1']);
  });

  it('applies primary then secondary then the id tiebreak', () => {
    const cards = [
      { id: 'A-2', setCode: 'X', alignment: 'Minion' },
      { id: 'A-1', setCode: 'X', alignment: 'Hero' },
      { id: 'A-3', setCode: 'Y', alignment: 'Hero' },
    ];
    const result = sortCards(cards, { primary: 'sets', secondary: 'alignments' });
    expect(result.map((c) => c.id)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('uses labelFor to localize the comparison for non-type/name keys', () => {
    const cards = [
      { id: 'A-1', alignment: 'Minion' },
      { id: 'A-2', alignment: 'Hero' },
    ];
    // Without labelFor, "Hero" < "Minion" alphabetically. With a labelFor that
    // reverses the display order, the sort must follow the label, not the raw value.
    const labelFor = (key, v) => (key === 'alignments' ? { Hero: 'Z', Minion: 'A' }[v] : v);
    expect(sortCards(cards, { primary: 'alignments' }, { labelFor }).map((c) => c.id)).toEqual(['A-1', 'A-2']);
  });

  it('sorts name by the given display language, falling back to en', () => {
    const cards = [
      { id: 'A-1', name: { en: 'Zeta', fr: 'Alpha' } },
      { id: 'A-2', name: { en: 'Alpha', fr: 'Zeta' } },
    ];
    expect(sortCards(cards, { primary: 'name' }, { lang: 'fr' }).map((c) => c.id)).toEqual(['A-1', 'A-2']);
    expect(sortCards(cards, { primary: 'name' }, { lang: 'en' }).map((c) => c.id)).toEqual(['A-2', 'A-1']);
  });
});
