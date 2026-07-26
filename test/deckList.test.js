import { describe, it, expect } from 'vitest';
import { buildDeckListText } from '../web/src/lib/deckList.js';

const cardsById = new Map([
  ['AS-1', { id: 'AS-1', type: 'Character', attributes: {}, name: { en: 'Bûrat', fr: 'Bûrat' } }],
  ['AS-7', { id: 'AS-7', type: 'Hazard', attributes: {}, name: { en: 'Alatar', fr: 'Alatar' } }],
  ['AS-44', { id: 'AS-44', type: 'Resource', attributes: {}, name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin' } }],
  ['BA-9', { id: 'BA-9', type: 'Site', attributes: {}, name: { en: 'Bag End', fr: 'Cul-de-Sac' } }],
]);

describe('buildDeckListText', () => {
  it('groups by type in section/group headings with per-group totals', () => {
    const text = buildDeckListText(cardsById, { 'AS-1': 1, 'AS-44': 2, 'AS-7': 1, 'BA-9': 1 }, 'My Deck');
    expect(text).toBe(
      [
        '# My Deck',
        '',
        '## Play deck',
        '',
        '### Characters (1)',
        '1x Bûrat',
        '',
        '### Resources (2)',
        '2x Sonner le tocsin',
        '',
        '### Hazards (1)',
        '1x Alatar',
        '',
        '## Locations',
        '',
        '### Sites (1)',
        '1x Cul-de-Sac',
      ].join('\n') + '\n'
    );
  });

  it('ignores unknown ids', () => {
    const text = buildDeckListText(cardsById, { 'AS-1': 1, 'ZZ-9': 5 }, 'D');
    expect(text).toContain('1x Bûrat');
    expect(text).not.toContain('ZZ-9');
  });

  it('uses the requested language for names', () => {
    const en = buildDeckListText(cardsById, { 'AS-44': 2, 'BA-9': 1 }, 'D', 'en');
    expect(en).toContain('2x All the Bells Ringing');
    expect(en).toContain('1x Bag End');
    const fr = buildDeckListText(cardsById, { 'AS-44': 2, 'BA-9': 1 }, 'D', 'fr');
    expect(fr).toContain('2x Sonner le tocsin');
    expect(fr).toContain('1x Cul-de-Sac');
  });

  it('renders notes first, only for non-empty fields, before any section', () => {
    const notes = { starting: 'Start with the ring', resourceStrategy: '', hazardStrategy: 'Stall', other: '' };
    const text = buildDeckListText(cardsById, { 'AS-1': 1 }, 'D', 'en', { notes });
    expect(text.indexOf('## Notes')).toBeGreaterThan(-1);
    expect(text.indexOf('## Notes')).toBeLessThan(text.indexOf('## Play deck'));
    expect(text).toContain('### Starting notes\n\nStart with the ring');
    expect(text).toContain('### Hazard strategy\n\nStall');
    expect(text).not.toContain('Resource strategy');
    expect(text).not.toContain('Other notes');
  });

  it('emits Pool and Sideboard sections from zones', () => {
    const text = buildDeckListText(cardsById, {}, 'D', 'en', { zones: { pool: { 'AS-1': 2 }, sideboard: { 'AS-7': 1 } } });
    expect(text).toContain('## Pool');
    expect(text).toContain('2x Bûrat');
    expect(text).toContain('## Sideboard');
    expect(text).toContain('1x Alatar');
  });

  // The only other whole-document assertion above ('groups by type...') has
  // no notes and no zones, so it can't catch a wrong assumption shared by
  // both sides of the export/import round trip (e.g. a dropped blank line,
  // or a "###" group heading emitted without its "(n)" count — import
  // ignores "###" entirely, so a round-trip test alone would never notice).
  // Pin the exact emitted text for a deck with notes AND all four sections
  // (Pool, Play deck, Locations, Sideboard).
  it('emits the exact literal text for a deck with notes and all four sections', () => {
    const notes = { starting: 'Start with the ring', resourceStrategy: '', hazardStrategy: 'Stall', other: '' };
    const text = buildDeckListText(
      cardsById,
      { 'AS-1': 1, 'AS-7': 1, 'BA-9': 1 },
      'Full Deck',
      'en',
      { zones: { pool: { 'AS-44': 2 }, sideboard: { 'AS-7': 1 } }, notes }
    );
    expect(text).toBe(
      [
        '# Full Deck',
        '',
        '## Notes',
        '',
        '### Starting notes',
        '',
        'Start with the ring',
        '',
        '### Hazard strategy',
        '',
        'Stall',
        '',
        '## Pool',
        '',
        '### Resources (2)',
        '2x All the Bells Ringing',
        '',
        '## Play deck',
        '',
        '### Characters (1)',
        '1x Bûrat',
        '',
        '### Hazards (1)',
        '1x Alatar',
        '',
        '## Locations',
        '',
        '### Sites (1)',
        '1x Bag End',
        '',
        '## Sideboard',
        '',
        '### Hazards (1)',
        '1x Alatar',
      ].join('\n') + '\n'
    );
  });
});
