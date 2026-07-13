import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards, computeFacets, parseCards } from '../web/src/lib/parseCards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'web', 'public', 'cards.json');

const fixture = {
  AS: {
    imageBaseUrl: { en: 'https://cdn/en/as/', fr: 'https://cdn/fr/as/' },
    cards: {
      'AS-1': { id: 'AS-1', type: 'Character', alignment: 'Minion', rarity: 'U2', artist: 'Omar Rayyan', attributes: { race: 'Troll', keywords: ['Maia'] }, image: 'Burat.jpg', text: { en: '<p>+1 <b>prowess</b> against Dwarves.</p>', fr: '<p>+1 prouesse contre les Nains.</p>', es: '' } },
      'AS-2': { id: 'AS-2', type: 'Resource', alignment: 'Hero', rarity: 'C1', artist: 'Angus McBride', attributes: { subtype: 'Short-event' }, image: 'x.jpg' },
    },
  },
  BA: {
    imageBaseUrl: { en: 'https://cdn/en/ba/' },
    cards: {
      'BA-1': { id: 'BA-1', type: 'Site', alignment: 'Neutral', rarity: 'R', attributes: {}, image: 'y.jpg' },
    },
  },
};

describe('flattenCards', () => {
  it('flattens nested sets into an array with setCode and per-set imageBaseUrl', () => {
    const cards = flattenCards(fixture);
    expect(cards).toHaveLength(3);
    expect(cards[0].setCode).toBe('AS');
    expect(cards[0].id).toBe('AS-1');
    expect(cards[0].image).toBe('Burat.jpg');
    expect(cards[0].imageBaseUrl.en).toBe('https://cdn/en/as/');
    expect(cards[2].imageBaseUrl.en).toBe('https://cdn/en/ba/');
    expect(cards[0].relativePath).toBeUndefined();
  });

  it('builds a stripped, concatenated searchable text field', () => {
    const cards = flattenCards(fixture);
    expect(cards[0].text).toBe('+1 prowess against Dwarves. +1 prouesse contre les Nains.');
    expect(cards[1].text).toBe('');
  });
});

describe('computeFacets', () => {
  it('produces sorted, de-duplicated, non-empty facet lists', () => {
    const facets = computeFacets(flattenCards(fixture));
    expect(facets.sets).toEqual(['AS', 'BA']);
    expect(facets.types).toEqual(['Character', 'Resource', 'Site']);
    expect(facets.races).toEqual(['Troll']);
    expect(facets.artists).toEqual(['Angus McBride', 'Omar Rayyan']);
    expect(facets.keywords).toEqual(['Maia']);
  });
});

describe('parseCards (real data)', () => {
  it('parses all 1683 cards from web/public/cards.json', async () => {
    const raw = JSON.parse(await readFile(CARDS_JSON, 'utf-8'));
    const { cards, facets, index } = parseCards(raw);
    expect(cards).toHaveLength(1683);
    expect(facets.sets).toEqual(['AS', 'BA', 'DM', 'LE', 'TD', 'TW', 'WH']);
    const burat = index.get('AS-1');
    expect(burat.name.en).toBe('Bûrat');
    expect(burat.image).toBe('Burat.jpg');
    expect(burat.imageBaseUrl.en).toMatch(/en-remaster\/as\/$/);
  });
});
