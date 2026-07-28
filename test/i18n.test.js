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
  const NAMESPACES = ['side.', 'setup.', 'zones.', 'rules.', 'docs.', 'notes.', 'status.', 'length.', 'decks.', 'browser.', 'panel.', 'drawer.'];

  it('the guard pattern actually catches every spelling it must', () => {
    for (const bad of ['faction', 'Faction', 'FACTION', 'factions', 'facción', 'faccion', 'facciones']) {
      expect(bad).toMatch(OFFENDING);
    }
    // and does not fire on unrelated words that merely start alike
    for (const ok of ['factory', 'satisfaction', 'factual']) {
      expect(ok).not.toMatch(OFFENDING);
    }
  });

  // Explicit allow-list: keys where "faction" legitimately names the game's
  // Faction card category rather than a player's camp/side. CoE 1.3.B4 is a
  // rule *about* Factions (a Balrog player's allowed Faction races), so its
  // message and doc keys must say the word. Every entry here is a conscious,
  // hand-verified assertion that THIS key's value uses "faction"/"facción" in
  // its card-category sense — not a blanket exemption. Do not add a key here
  // to silence a failure without first reading the string and confirming it
  // never refers to a side; each addition is a hole in the guard's coverage
  // for that one key, in every language, forever.
  const ALLOWED_FACTION_KEYS = new Set([
    'rules.FACTION-RACE',
    'rules.FACTION-RACE.doc',
  ]);

  it('side-related strings never use the word "faction" for a side', () => {
    for (const lang of ['fr', 'en', 'es']) {
      for (const [key, value] of Object.entries(translations[lang])) {
        if (ALLOWED_FACTION_KEYS.has(key)) continue;
        if (NAMESPACES.some((ns) => key.startsWith(ns))) {
          expect(`${lang}:${key}=${value}`).not.toMatch(OFFENDING);
        }
      }
    }
  });
});

// The key-set parity check above (`fr, en and es have identical key sets`)
// only proves the three dictionaries agree on which keys exist — not on what
// each string actually needs to render. A translator who drops `{limit}`
// from one language's message still passes every existing test and ships a
// warning silently missing its number. This guard closes that gap: for every
// key present in all three dictionaries, the *set* of `{placeholder}` tokens
// must be identical across fr/en/es (order doesn't matter, e.g. "{a} {b}" vs
// "{b}, {a}" is fine — only the token set is compared).
describe('placeholder parity across fr/en/es', () => {
  const PLACEHOLDER_RE = /\{(\w+)\}/g;
  const placeholderTokens = (s) => new Set([...String(s).matchAll(PLACEHOLDER_RE)].map((m) => m[1]));

  it('every key present in all three dictionaries uses the same {placeholder} tokens in each language', () => {
    const langs = ['fr', 'en', 'es'];
    const sharedKeys = Object.keys(translations.fr)
      .filter((k) => Object.prototype.hasOwnProperty.call(translations.en, k) && Object.prototype.hasOwnProperty.call(translations.es, k));
    expect(sharedKeys.length).toBeGreaterThan(0);
    for (const key of sharedKeys) {
      const [frTokens, enTokens, esTokens] = langs.map((l) => [...placeholderTokens(translations[l][key])].sort());
      expect(enTokens, `en:"${key}" placeholders ${JSON.stringify(enTokens)} != fr ${JSON.stringify(frTokens)}`).toEqual(frTokens);
      expect(esTokens, `es:"${key}" placeholders ${JSON.stringify(esTokens)} != fr ${JSON.stringify(frTokens)}`).toEqual(frTokens);
    }
  });
});
