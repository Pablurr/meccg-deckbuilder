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

  it('falls back to English then to the key itself', () => {
    expect(makeT('xx')('drawer.total')).toBe('Total'); // unknown lang -> en
    expect(makeT('en')('does.not.exist')).toBe('does.not.exist');
  });

  it('falls back to English for keys missing from a partial dictionary', () => {
    // es is intentionally partial at this stage (see i18n.js); Task 20
    // completes it and adds it to the parity check below.
    expect(makeT('es')('proxy.label')).toBe('Proxy'); // present in es
    expect(makeT('es')('drawer.export')).toBe('Export'); // missing in es -> en
  });

  // Scoped to fr/en for now: es is a deliberately partial groundwork
  // dictionary (see i18n.js). Task 20 (trilingual phase) completes es and
  // extends this check to all three languages.
  it('keeps the fr and en dictionaries in sync', () => {
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(enKeys).toEqual(frKeys);
  });
});
