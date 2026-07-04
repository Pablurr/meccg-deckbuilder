import { describe, it, expect } from 'vitest';
import { filterCards } from '../web/src/lib/filter.js';

const cards = [
  { id: 'AS-1', setCode: 'AS', type: 'Character', alignment: 'Minion', rarity: 'U2', name: { en: 'Bûrat', fr: 'Bûrat' }, attributes: { race: 'Troll', unique: true, keywords: ['Maia'] } },
  { id: 'AS-44', setCode: 'AS', type: 'Resource', alignment: 'Hero', rarity: 'C1', name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin' }, attributes: { subtype: 'Short-event' } },
  { id: 'BA-1', setCode: 'BA', type: 'Site', alignment: 'Neutral', rarity: 'R', name: { en: 'Bag End', fr: 'Cul-de-Sac' }, attributes: {} },
];

describe('filterCards', () => {
  it('returns everything with no filters', () => {
    expect(filterCards(cards, {})).toHaveLength(3);
  });

  it('filters by set and type', () => {
    expect(filterCards(cards, { sets: ['AS'] })).toHaveLength(2);
    expect(filterCards(cards, { types: ['Site'] }).map((c) => c.id)).toEqual(['BA-1']);
  });

  it('filters by unique flag', () => {
    expect(filterCards(cards, { unique: true }).map((c) => c.id)).toEqual(['AS-1']);
  });

  it('filters by keyword membership', () => {
    expect(filterCards(cards, { keywords: ['Maia'] }).map((c) => c.id)).toEqual(['AS-1']);
  });

  it('searches en and fr names case-insensitively', () => {
    expect(filterCards(cards, { search: 'bells' }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { search: 'tocsin' }).map((c) => c.id)).toEqual(['AS-44']);
    expect(filterCards(cards, { search: 'cul-de-sac' }).map((c) => c.id)).toEqual(['BA-1']);
  });

  it('searches ignoring accents (both query and card names)', () => {
    // query without accent matches accented name
    expect(filterCards(cards, { search: 'burat' }).map((c) => c.id)).toEqual(['AS-1']);
    expect(filterCards(cards, { search: 'BÛRAT' }).map((c) => c.id)).toEqual(['AS-1']);
  });
});
