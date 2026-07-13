import { describe, it, expect } from 'vitest';
import { filterCards } from '../web/src/lib/filter.js';

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
