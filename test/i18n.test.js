import { describe, it, expect } from 'vitest';
import { makeT, translations } from '../web/src/lib/i18n.js';

describe('makeT', () => {
  it('translates keys per language', () => {
    expect(makeT('fr')('drawer.export')).toBe('Exporter');
    expect(makeT('en')('drawer.export')).toBe('Export');
  });

  it('interpolates parameters', () => {
    expect(makeT('en')('browser.selectAll', { n: 5 })).toBe('Select all (5)');
    expect(makeT('fr')('warn.missingImage', { n: 2 })).toBe('2 carte(s) sans image source.');
  });

  it('falls back to French then to the key itself', () => {
    expect(makeT('xx')('drawer.total')).toBe('Total'); // unknown lang -> fr
    expect(makeT('en')('does.not.exist')).toBe('does.not.exist');
  });

  it('keeps the fr and en dictionaries in sync', () => {
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(enKeys).toEqual(frKeys);
  });
});
