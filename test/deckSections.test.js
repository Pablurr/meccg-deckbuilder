import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';

const { cards, index } = parseCards(raw);
const find = (p) => { const c = cards.find(p); expect(c).toBeTruthy(); return c; };

describe('deckSections', () => {
  const avatar = find((c) => c.attributes.avatar && c.alignment === 'Hero');
  const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
  const res = find((c) => c.type === 'Resource');
  const hz = find((c) => c.type === 'Hazard');
  const site = find((c) => c.type === 'Site');
  const region = find((c) => c.type === 'Region');
  const item = find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);

  it('orders sections pool → play → locations → sideboard and groups per spec', () => {
    const sections = deckSections({
      quantities: { [avatar.id]: 1, [chr.id]: 2, [res.id]: 3, [hz.id]: 2, [site.id]: 1, [region.id]: 1 },
      zones: { sideboard: { [hz.id]: 1 }, pool: { [chr.id]: 1, [item.id]: 1 } },
      cardsById: index, lang: 'en',
    });
    expect(sections.map((s) => s.id)).toEqual(['pool', 'play', 'locations', 'sideboard']);
    const play = sections.find((s) => s.id === 'play');
    expect(play.groups.map((g) => g.id)).toEqual(['avatars', 'characters', 'resources', 'hazards']);
    const pool = sections.find((s) => s.id === 'pool');
    expect(pool.groups.map((g) => g.id)).toEqual(['characters', 'resources']);
    const loc = sections.find((s) => s.id === 'locations');
    expect(loc.groups.map((g) => g.id)).toEqual(['sites', 'regions']);
  });
  it('flatten preserves order and repeats counts', () => {
    const sections = deckSections({ quantities: { [res.id]: 2 }, zones: { sideboard: {}, pool: {} }, cardsById: index, lang: 'en' });
    const flat = flattenSections(sections);
    expect(flat).toEqual([{ card: res, count: 2 }]);
  });
  it('drops empty sections and groups', () => {
    const sections = deckSections({ quantities: { [res.id]: 1 }, zones: { sideboard: {}, pool: {} }, cardsById: index, lang: 'en' });
    expect(sections.map((s) => s.id)).toEqual(['play']);
  });
});
