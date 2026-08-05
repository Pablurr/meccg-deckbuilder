import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';
import { buildSlots, allKeys, toggle, setMany, selectRange, groupState, selectedCardIds, selectedQuantitiesZones } from '../web/src/lib/export/selection.js';

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

describe('selection mutations', () => {
  const keys = ['a', 'b', 'c', 'd'];
  const slots = keys.map((key) => ({ key }));

  it('toggle flips one key and never mutates its input', () => {
    const before = new Set(['a']);
    const on = toggle(before, 'b');
    expect([...on].sort()).toEqual(['a', 'b']);
    expect(toggle(on, 'a').has('a')).toBe(false);
    expect([...before]).toEqual(['a']);
  });

  it('setMany adds or removes a batch without mutating its input', () => {
    const before = new Set(['a']);
    expect([...setMany(before, ['b', 'c'], true)].sort()).toEqual(['a', 'b', 'c']);
    expect([...setMany(new Set(keys), ['a', 'b'], false)].sort()).toEqual(['c', 'd']);
    expect([...before]).toEqual(['a']);
  });

  it('selectRange applies one value across the span, in either direction', () => {
    expect([...selectRange(new Set(), slots, 'b', 'd', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...selectRange(new Set(), slots, 'd', 'b', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...selectRange(new Set(keys), slots, 'a', 'c', false)].sort()).toEqual(['d']);
  });

  // The collapse case: the anchor was clicked, then its section was folded
  // away. Ranging to an anchor that is no longer on screen would either throw
  // or silently span the wrong slots, so it degrades to a plain single click.
  it('falls back to the clicked slot when the anchor is no longer visible', () => {
    const visible = [{ key: 'c' }, { key: 'd' }];
    expect([...selectRange(new Set(), visible, 'a', 'd', true)]).toEqual(['d']);
  });

  it('groupState reports all, none or partial', () => {
    expect(groupState(new Set(keys), keys)).toBe('all');
    expect(groupState(new Set(), keys)).toBe('none');
    expect(groupState(new Set(['a']), keys)).toBe('partial');
  });

  // deckSections() drops empty groups, so this cannot arise from a real deck --
  // it is pinned only so the ambiguous "0 of 0" case has one defined answer
  // instead of depending on which check runs first.
  it('calls an empty group none, not all', () => {
    expect(groupState(new Set(), [])).toBe('none');
  });
});

describe('projections', () => {
  const build = () => deckSections({
    quantities: { [res.id]: 2, [hz.id]: 1, [site.id]: 2 },
    zones: { pool: { [chr.id]: 1 }, sideboard: { [hz.id]: 1 }, sideboardFw: {} },
    cardsById: index, lang: 'en',
  });

  it('selectedCardIds keeps canonical order and copy counts', () => {
    const slots = buildSlots(build());
    const ids = selectedCardIds(slots, allKeys(slots));
    expect(ids).toEqual(slots.map((s) => s.cardId));
    expect(ids.filter((id) => id === res.id)).toHaveLength(2);
  });

  it('selectedCardIds drops exactly what was unticked', () => {
    const slots = buildSlots(build());
    const oneResourceOff = setMany(allKeys(slots), [slots.find((s) => s.cardId === res.id).key], false);
    const ids = selectedCardIds(slots, oneResourceOff);
    expect(ids).toHaveLength(slots.length - 1);
    expect(ids.filter((id) => id === res.id)).toHaveLength(1);
  });

  // The trap this whole module exists for: deckSections() split one
  // `quantities` map into a play section and a locations section by card type.
  // Handing the text list two separate maps would drop the location deck.
  it('selectedQuantitiesZones folds play and locations back into one quantities map', () => {
    const slots = buildSlots(build());
    const { quantities, zones } = selectedQuantitiesZones(slots, allKeys(slots));
    expect(quantities[res.id]).toBe(2);
    expect(quantities[hz.id]).toBe(1);
    expect(quantities[site.id]).toBe(2);
    expect(zones.pool[chr.id]).toBe(1);
    expect(zones.sideboard[hz.id]).toBe(1);
    expect(zones.sideboardFw).toEqual({});
  });

  // The same card in the play deck and in the sideboard must not have its
  // sideboard copy counted into `quantities`.
  it('keeps a card that sits in two sections in the right bucket each time', () => {
    const slots = buildSlots(build());
    const { quantities, zones } = selectedQuantitiesZones(slots, allKeys(slots));
    expect(quantities[hz.id]).toBe(1);
    expect(zones.sideboard[hz.id]).toBe(1);
  });

  it('omits a card entirely once its last copy is unticked', () => {
    const slots = buildSlots(build());
    const noHazardInPlay = setMany(
      allKeys(slots),
      slots.filter((s) => s.sectionId === 'play' && s.cardId === hz.id).map((s) => s.key),
      false,
    );
    const { quantities, zones } = selectedQuantitiesZones(slots, noHazardInPlay);
    expect(quantities[hz.id]).toBeUndefined();
    expect(zones.sideboard[hz.id]).toBe(1);
  });

  // The guard that keeps the two export paths honest: whatever the selection,
  // the id list and the quantities/zones pair must describe the same multiset
  // of cards. Without it, one path could be filtered and the other not, and no
  // test would notice.
  it('both projections describe the same multiset for any selection', () => {
    const slots = buildSlots(build());
    const partial = setMany(allKeys(slots), [slots[0].key, slots[slots.length - 1].key], false);
    const fromIds = selectedCardIds(slots, partial).reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    const { quantities, zones } = selectedQuantitiesZones(slots, partial);
    const fromMaps = {};
    for (const map of [quantities, zones.pool, zones.sideboard, zones.sideboardFw]) {
      for (const [id, n] of Object.entries(map)) fromMaps[id] = (fromMaps[id] || 0) + n;
    }
    expect(fromMaps).toEqual(fromIds);
  });

  // Non-regression on the default path: a full selection must reproduce the
  // exact list ExportDialog builds today.
  it('a full selection equals the unfiltered export order', () => {
    const sections = build();
    const slots = buildSlots(sections);
    const today = flattenSections(sections).flatMap((e) => Array(e.count).fill(e.card.id));
    expect(selectedCardIds(slots, allKeys(slots))).toEqual(today);
  });
});
