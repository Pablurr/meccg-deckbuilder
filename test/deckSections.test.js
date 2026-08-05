import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { deckSections, flattenSections } from '../web/src/lib/export/deckSections.js';
import { buildDeckListText, SECTION_TITLES } from '../web/src/lib/deckList.js';
import { importDeckList, parseDeckListDocument } from '../web/src/lib/importDeck.js';

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

describe('the Fallen-wizard sideboard section (1.6.1)', () => {
  const playCard = find((c) => c.type === 'Character' && !c.attributes.avatar);
  const sideboardCard = find((c) => c.type === 'Resource');
  const hazard = find((c) => c.type === 'Hazard');

  it('comes last, after the ordinary sideboard', () => {
    const sections = deckSections({
      quantities: { [playCard.id]: 1 },
      zones: { pool: {}, sideboard: { [sideboardCard.id]: 1 }, sideboardFw: { [sideboardCard.id]: 1 } },
      cardsById: index,
    });
    expect(sections.map((s) => s.id)).toEqual(['play', 'sideboard', 'sideboardFw']);
  });

  it('is dropped entirely when the zone is empty', () => {
    const sections = deckSections({
      quantities: { [playCard.id]: 1 },
      zones: { pool: {}, sideboard: {}, sideboardFw: {} },
      cardsById: index,
    });
    expect(sections.map((s) => s.id)).not.toContain('sideboardFw');
  });

  it('groups like the ordinary sideboard does', () => {
    const [section] = deckSections({
      quantities: {}, zones: { pool: {}, sideboard: {}, sideboardFw: { [hazard.id]: 2 } }, cardsById: index,
    });
    expect(section.id).toBe('sideboardFw');
    expect(section.groups.map((g) => g.id)).toEqual(['hazards']);
  });

  it('has a canonical English heading, so an export re-imports', () => {
    expect(SECTION_TITLES.sideboardFw).toBe('Sideboard vs FW');
  });
});

// The brief's suggested test names a `parseDeckList` entry point taking
// (text, cards, lang) and returning { quantities, zones, notes, ... } — the
// real file already has a `parseDeckList(text)` with a different,
// pre-existing signature (flat lines, no card resolution, used by
// ImportDialog's interactive per-line ambiguity picker). The real full
// round-trip entry point is `importDeckList(text, cards, lang)`, added in
// this task alongside the section-aware `parseDeckListDocument(text)`. Tests
// below use the real names.
describe('markdown round-trip', () => {
  const chr = find((c) => c.type === 'Character' && !c.attributes.avatar);
  const hz = find((c) => c.type === 'Hazard');
  const site = find((c) => c.type === 'Site');

  it('notes render first and never parse as cards', () => {
    const notes = { starting: '3x Gandalf is the plan', resourceStrategy: '', hazardStrategy: 'drown them', other: '' };
    const text = buildDeckListText(index, { [hz.id]: 2, [site.id]: 1 }, 'RT', 'en', { zones: { sideboard: {}, pool: { [chr.id]: 1 } }, notes });
    expect(text.indexOf('## Notes')).toBeLessThan(text.indexOf('## Pool'));

    const back = importDeckList(text, cards, 'en');
    expect(back.quantities[hz.id]).toBe(2);
    expect(back.quantities[site.id]).toBe(1);
    expect(back.zones.pool[chr.id]).toBe(1);
    expect(back.notes.starting).toContain('3x Gandalf');
    expect(back.notes.hazardStrategy).toBe('drown them');

    // The central hazard: a note line that looks exactly like a card entry
    // ("3x Gandalf is the plan") must NOT import as cards.
    const gandalf = cards.find((c) => (c.name.en || '') === 'Gandalf');
    expect(gandalf).toBeTruthy();
    expect(back.quantities[gandalf.id]).toBeUndefined();
    expect(back.zones.pool[gandalf.id]).toBeUndefined();
    expect(back.zones.sideboard[gandalf.id]).toBeUndefined();
  });

  it('a note line that is itself an exact "Nx <card name>" match still does not import as a card', () => {
    // "3x Gandalf is the plan" (above) has trailing prose, so it would fail
    // exact-name matching even without the guard. This case removes that
    // safety net: the note body is *only* "3x Gandalf" — the single most
    // dangerous shape for the hazard, since it is indistinguishable from a
    // real card line by content alone. Only the enclosing ## Notes / mode
    // state tells the parser it is prose. (Verified by temporarily disabling
    // the mode==='notes' guard in importDeck.js: this exact case then
    // imports quantities['TW-156'] === 3 — see the task report.)
    const gandalf = cards.find((c) => (c.name.en || '') === 'Gandalf');
    const notes = { starting: '3x Gandalf', resourceStrategy: '', hazardStrategy: '', other: '' };
    const text = buildDeckListText(index, { [hz.id]: 1 }, 'RT3', 'en', { zones: { sideboard: {}, pool: {} }, notes });
    const back = importDeckList(text, cards, 'en');
    expect(back.notes.starting).toBe('3x Gandalf');
    expect(back.quantities[gandalf.id]).toBeUndefined();
  });

  it('zones restore from section headings', () => {
    const text = buildDeckListText(index, { [hz.id]: 1 }, 'RT2', 'en', { zones: { sideboard: { [hz.id]: 2 }, pool: {} }, notes: {} });
    const back = importDeckList(text, cards, 'en');
    expect(back.quantities[hz.id]).toBe(1);
    expect(back.zones.sideboard[hz.id]).toBe(2);
  });

  it('an unknown ## heading inside a legacy flat list still targets the main deck', () => {
    const legacy = `# Legacy\n\n## Characters (1)\n1x ${chr.name.en}\n\n## Hazards (1)\n1x ${hz.name.en}\n`;
    const back = importDeckList(legacy, cards, 'en');
    expect(back.quantities[chr.id]).toBe(1);
    expect(back.quantities[hz.id]).toBe(1);
    expect(back.zones.pool).toEqual({});
    expect(back.zones.sideboard).toEqual({});
    expect(back.notes).toEqual({ starting: '', resourceStrategy: '', hazardStrategy: '', other: '' });
  });

  // Pre-refactor, ANY "###" line was a field selector by markdown level alone
  // and was swallowed even when its text meant nothing -- "Something New"
  // used to vanish, falling back to 'other'. import/vocabulary.js's design
  // deliberately dropped that: a heading is recognised by its normalized
  // CONTENT, never by its level, so unrecognized "### Something New" is no
  // longer a heading at all -- it survives as literal text in whichever
  // field is active (here 'other', since the generic "## Notes" opener
  // selects none), per document.js's own "nothing is lost" guarantee. See
  // task-8-report.md for the trace that found this.
  it('an unrecognized "###" line is not swallowed as a heading; it survives as note text', () => {
    const doc = parseDeckListDocument('# D\n\n## Notes\n\n### Something New\n\nhello\n');
    expect(doc.notes.other).toBe('### Something New\n\nhello');
  });
});
