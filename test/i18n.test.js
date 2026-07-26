import { describe, it, expect } from 'vitest';
import { makeT, translations } from '../web/src/lib/i18n.js';
import { RULES } from '../web/src/lib/rules/validate.js';

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

// RulesDoc.jsx renders `rules.${r.id}.doc` for every RULES entry (both the
// checked table and the "not yet checked" list). If a future rule ships
// without a matching key in one language, t() falls back to printing the raw
// key string inline in that table row — a silent, easy-to-miss failure. This
// guard fails loudly instead, in all three languages (unlike the fr/en-only
// parity check above, since es already fully covers rules.*.doc today).
describe('rules.<ID>.doc coverage', () => {
  it('every RULES id has a rules.<ID>.doc key in fr, en and es', () => {
    for (const lang of ['fr', 'en', 'es']) {
      for (const rule of RULES) {
        const key = `rules.${rule.id}.doc`;
        expect(translations[lang], `translations.${lang} missing entirely`).toBeTruthy();
        expect(
          Object.prototype.hasOwnProperty.call(translations[lang], key),
          `translations.${lang} is missing "${key}"`
        ).toBe(true);
      }
    }
  });
});
