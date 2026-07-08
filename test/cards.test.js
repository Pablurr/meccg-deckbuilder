import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards, computeFacets, loadCards } from '../src/cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'cards', 'remastered-all', 'cards.json');

const fixture = {
  AS: {
    cards: {
      'AS-1': { id: 'AS-1', type: 'Character', alignment: 'Minion', rarity: 'U2', attributes: { race: 'Troll', keywords: ['Maia'] }, relativePath: 'as/minions/Burat.jpg', text: { en: '<p>+1 <b>prowess</b> against Dwarves.</p>', fr: '<p>+1 prouesse contre les Nains.</p>', es: '' } },
      'AS-2': { id: 'AS-2', type: 'Resource', alignment: 'Hero', rarity: 'C1', attributes: { subtype: 'Short-event' }, relativePath: 'as/resources/x.jpg' },
    },
  },
  BA: {
    cards: {
      'BA-1': { id: 'BA-1', type: 'Site', alignment: 'Neutral', rarity: 'R', attributes: {}, relativePath: 'ba/sites/y.jpg' },
    },
  },
};

describe('flattenCards', () => {
  it('flattens nested sets into an array with setCode', () => {
    const cards = flattenCards(fixture);
    expect(cards).toHaveLength(3);
    expect(cards[0].setCode).toBe('AS');
    expect(cards[0].id).toBe('AS-1');
    expect(cards[2].setCode).toBe('BA');
  });

  it('builds a stripped, concatenated searchable text field', () => {
    const cards = flattenCards(fixture);
    expect(cards[0].text).toBe('+1 prowess against Dwarves. +1 prouesse contre les Nains.');
    expect(cards[1].text).toBe(''); // no text field
  });
});

describe('computeFacets', () => {
  it('produces sorted, de-duplicated, non-empty facet lists', () => {
    const facets = computeFacets(flattenCards(fixture));
    expect(facets.sets).toEqual(['AS', 'BA']);
    expect(facets.types).toEqual(['Character', 'Resource', 'Site']);
    expect(facets.races).toEqual(['Troll']);
    expect(facets.keywords).toEqual(['Maia']);
  });
});

describe('loadCards (real data)', () => {
  it('loads all 1683 cards from remastered-all/cards.json', async () => {
    const { cards, facets, index } = await loadCards(CARDS_JSON);
    expect(cards).toHaveLength(1683);
    expect(facets.types).toContain('Resource');
    expect(facets.sets).toEqual(['AS', 'BA', 'DM', 'LE', 'TD', 'TW', 'WH']);
    expect(index.get('AS-1').name.en).toBe('Bûrat');
  });
});
