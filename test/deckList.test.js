import { describe, it, expect } from 'vitest';
import { buildDeckListText } from '../web/src/lib/deckList.js';

const cardsById = new Map([
  ['AS-1', { id: 'AS-1', type: 'Character', name: { en: 'Bûrat', fr: 'Bûrat' } }],
  ['AS-7', { id: 'AS-7', type: 'Hazard', name: { en: 'Alatar', fr: 'Alatar' } }],
  ['AS-44', { id: 'AS-44', type: 'Resource', name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin' } }],
  ['BA-9', { id: 'BA-9', type: 'Site', name: { en: 'Bag End', fr: 'Cul-de-Sac' } }],
]);

describe('buildDeckListText', () => {
  it('groups by type in a fixed order with per-type totals', () => {
    const text = buildDeckListText(cardsById, { 'AS-1': 1, 'AS-44': 2, 'AS-7': 1, 'BA-9': 1 }, 'My Deck');
    expect(text).toBe(
      [
        '# My Deck',
        '',
        '## Characters (1)',
        '1x Bûrat',
        '',
        '## Resources (2)',
        '2x Sonner le tocsin',
        '',
        '## Hazards (1)',
        '1x Alatar',
        '',
        '## Sites (1)',
        '1x Cul-de-Sac',
      ].join('\n') + '\n'
    );
  });

  it('ignores unknown ids', () => {
    const text = buildDeckListText(cardsById, { 'AS-1': 1, 'ZZ-9': 5 }, 'D');
    expect(text).toContain('1x Bûrat');
    expect(text).not.toContain('ZZ-9');
  });
});
