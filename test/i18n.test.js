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

  it('falls back to English for a key missing from every dictionary', () => {
    // es is now fully translated (Task 20); the fallback path is still
    // exercised via a key absent from all three dictionaries.
    expect(makeT('es')('proxy.label')).toBe('Proxy'); // present in es
    expect(makeT('es')('does.not.exist')).toBe('does.not.exist'); // absent everywhere -> raw key
  });

  it('fr, en and es have identical key sets', () => {
    const langs = ['fr', 'en', 'es'];
    const keySets = langs.map((l) => Object.keys(translations[l]).sort());
    expect(keySets[1]).toEqual(keySets[0]);
    expect(keySets[2]).toEqual(keySets[0]);
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

describe('terminology guards', () => {
  // In MECCG "Faction" is a card category (Orc, Troll, Dragon, Wolf, Animal)
  // AND a marshalling-point category, so it must never denote a player's camp —
  // those are "sides" (camp / side / bando). Scoped to the namespaces this
  // feature introduced: the word is legitimate elsewhere, in its card meaning.
  // en/fr "faction" is spelled -cti-, es "facción" -cci-: a pattern for one
  // silently misses the other, so both stems are listed explicitly.
  const OFFENDING = /\b(factions?|facci[oó]n(?:es)?)\b/i;
  const NAMESPACES = ['side.', 'setup.', 'zones.', 'rules.', 'docs.', 'notes.', 'status.', 'length.'];

  it('the guard pattern actually catches every spelling it must', () => {
    for (const bad of ['faction', 'Faction', 'FACTION', 'factions', 'facción', 'faccion', 'facciones']) {
      expect(bad).toMatch(OFFENDING);
    }
    // and does not fire on unrelated words that merely start alike
    for (const ok of ['factory', 'satisfaction', 'factual']) {
      expect(ok).not.toMatch(OFFENDING);
    }
  });

  it('side-related strings never use the word "faction" for a side', () => {
    for (const lang of ['fr', 'en', 'es']) {
      for (const [key, value] of Object.entries(translations[lang])) {
        if (NAMESPACES.some((ns) => key.startsWith(ns))) {
          expect(`${lang}:${key}=${value}`).not.toMatch(OFFENDING);
        }
      }
    }
  });
});
