import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';
import { buildSlots, allKeys } from '../web/src/lib/export/selection.js';

const { cards, index } = parseCards(raw);
const find = (p) => { const c = cards.find(p); expect(c).toBeTruthy(); return c; };

const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
const res = find((c) => c.type === 'Resource');
const hz = find((c) => c.type === 'Hazard');
const site = find((c) => c.type === 'Site');

describe('buildSlots', () => {
  it('emits one slot per physical copy, in canonical export order', () => {
    const sections = deckSections({
      quantities: { [res.id]: 3, [site.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    // flattenSections already carries the canonical order; expanding it by
    // count is exactly what the slot list must equal.
    const expected = flattenSections(sections).flatMap((e) => Array(e.count).fill(e.card.id));
    expect(slots.map((s) => s.cardId)).toEqual(expected);
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s.cardId === res.id).map((s) => s.copyIndex)).toEqual([0, 1, 2]);
  });

  // The invariant the section-qualified key exists for: the same card in two
  // sections is two independent stacks of copies. A key reduced to the card id
  // would merge them, and unticking the sideboard copy would silently untick
  // the play-deck ones.
  it('gives a card that sits in two sections distinct keys per section', () => {
    const sections = deckSections({
      quantities: { [hz.id]: 2 },
      zones: { pool: {}, sideboard: { [hz.id]: 1 }, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((s) => s.key)).size).toBe(3);
    expect(slots.filter((s) => s.sectionId === 'play')).toHaveLength(2);
    expect(slots.filter((s) => s.sectionId === 'sideboard')).toHaveLength(1);
  });

  it('carries the section and group each slot belongs to', () => {
    const sections = deckSections({
      quantities: { [chr.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const [slot] = buildSlots(sections);
    expect(slot.sectionId).toBe('play');
    expect(slot.groupId).toBe('characters');
    expect(slot.key).toBe(`play:characters:${chr.id}:0`);
  });
});

describe('allKeys', () => {
  it('covers every slot exactly once', () => {
    const sections = deckSections({
      quantities: { [res.id]: 2, [hz.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index, lang: 'en',
    });
    const slots = buildSlots(sections);
    const keys = allKeys(slots);
    expect(keys.size).toBe(slots.length);
    for (const s of slots) expect(keys.has(s.key)).toBe(true);
  });
});
