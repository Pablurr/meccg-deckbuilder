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

  // The owner's FR glossary. Three of these are a ROTATION, not renames:
  // "talon" used to name the play deck and now names the sideboard, whose old
  // name "réserve" now names the pool. So a retired word is not merely
  // obsolete — it is actively wrong, because it now denotes a different zone.
  // That is why each retired term is banned outright rather than left to
  // reviewer attention: a single surviving "réserve" meaning sideboard sends
  // the player to the wrong tab.
  const RETIRED_FR = [
    { bad: /\bdeck de jeu\b/i, use: 'pioche' },
    { bad: /\bmagiciens?\b/i, use: 'sorcier' },
    { bad: /\bsbires?\b/i, use: 'séide' },
    { bad: /\bmise en scène\b/i, use: 'progression' },
    { bad: /\bdangers?\b/i, use: 'péril' },
    // The English side of the glossary, left untranslated in a FR string. All
    // six are listed, not just the three that once slipped through: the guard
    // covered pool/sideboard/play deck but not minion/hazard/stage, which is
    // exactly how `import.alignPref.minion` shipped as "Minion" to French
    // users. A half-covered guard reads as a covered one.
    { bad: /\bpools?\b/i, use: 'réserve' },
    { bad: /\bsideboards?\b/i, use: 'talon' },
    { bad: /\bplay decks?\b/i, use: 'pioche' },
    { bad: /\bminions?\b/i, use: 'séide' },
    { bad: /\bhazards?\b/i, use: 'péril' },
    { bad: /\bstages?\b/i, use: 'progression' },
  ];

  // Two races, not two spellings of one: `Nazgûl` labels the nine METW hazards,
  // `Ringwraith` the nine MELE characters. Same individuals, opposite card
  // categories — played AGAINST the opponent versus played AS your avatar — so
  // the Race facet must keep them apart, and neither may be folded onto the
  // other in RACE_ALIASES (tags.js). The FR/ES names are the cards' own
  // ("Adûnaphel la Spectre" / "Adûnaphel la Espectro del Anillo").
  it('Nazgûl and Ringwraith are separate races with separate names', () => {
    expect(translations.fr['race.Nazgûl']).toBe('Nazgûl');
    expect(translations.fr['race.Ringwraith']).toBe('Spectre');
    expect(translations.es['race.Ringwraith']).toBe('Espectro del Anillo');
    for (const lang of ['fr', 'en', 'es']) {
      expect(translations[lang]['race.Nazgûl']).not.toBe(translations[lang]['race.Ringwraith']);
    }
  });

  // Alignment names must read the same wherever they appear. These four lived
  // in English in the fr and es dictionaries because nothing compared the two
  // families of keys against each other.
  it('import.alignPref.* agrees with alignment.* in every language', () => {
    const pairs = [['hero', 'Hero'], ['minion', 'Minion'], ['balrog', 'Balrog'], ['fallenWizard', 'Fallen-wizard']];
    for (const lang of ['fr', 'en', 'es']) {
      for (const [pref, align] of pairs) {
        expect(translations[lang][`import.alignPref.${pref}`], `${lang}: import.alignPref.${pref}`)
          .toBe(translations[lang][`alignment.${align}`]);
      }
    }
  });

  it('the retired-term patterns catch what they must and spare lookalikes', () => {
    for (const bad of ['deck de jeu', 'Magicien', 'magiciens', 'Sbire', 'sbires', 'Mise en scène', 'danger', 'Dangers', 'pool', 'Sideboard', 'Play deck', 'Minion', 'minions', 'Hazard', 'Stage']) {
      expect(RETIRED_FR.some((r) => r.bad.test(bad))).toBe(true);
    }
    // Words that merely contain a retired term as a substring must survive:
    // "dangereux" is ordinary French, and "Liverpool" shows the \b anchor
    // matters. Without the anchors this guard would ban legitimate prose.
    for (const ok of ['dangereux', 'dangereuse', 'Liverpool', 'poolside']) {
      expect(RETIRED_FR.some((r) => r.bad.test(ok))).toBe(false);
    }
  });

  // The glossary entries cite the English term on purpose ("en anglais « play
  // deck »") -- naming the word being retired is what a glossary is for, and
  // MECCG cards are printed in English, so a player needs the mapping. These
  // are the ONLY keys allowed to contain a retired term, and only inside that
  // citation. Do not extend this list to silence a failure elsewhere: outside
  // the glossary, a retired word is not obsolete but wrong, since "réserve"
  // and "talon" now denote different zones than they used to.
  const GLOSSARY_KEYS = new Set([
    'docs.glossary.play', 'docs.glossary.sideboard', 'docs.glossary.pool',
    'docs.glossary.hazard', 'docs.glossary.minion', 'docs.glossary.stage',
  ]);

  // `{placeholder}` tokens are identifiers, not prose: they never reach the
  // screen, and the parity guard below already forces them to be identical in
  // all three languages -- so they are code, and renaming them for vocabulary
  // would be renaming a variable to satisfy a spellchecker. Without this,
  // rules.DECKSIZE-HAZARDS ("{hazards} périls pour {resources} ressources")
  // fails on its own token while its French prose is exactly right.
  const prose = (s) => String(s).replace(/\{\w+\}/g, ' ');

  it('no FR string outside the glossary uses a retired term', () => {
    const offences = [];
    for (const [key, value] of Object.entries(translations.fr)) {
      if (GLOSSARY_KEYS.has(key)) continue;
      for (const { bad, use } of RETIRED_FR) {
        if (bad.test(prose(value))) offences.push(`fr:${key} = "${value}"  -> use "${use}"`);
      }
    }
    expect(offences).toEqual([]);
  });

  // The exemption is scoped: a glossary entry may name the English term, but
  // only inside the « … » citation. Prose outside the guillemets is ordinary
  // UI text and must use the new vocabulary like everything else.
  it('a glossary entry uses a retired term only inside its « … » citation', () => {
    // Offences are collected rather than asserted inline: the assertion
    // subject would otherwise interpolate the key ("docs.glossary.sideboard"),
    // which contains a retired term and fails the test against itself.
    const offences = [];
    for (const key of GLOSSARY_KEYS) {
      const outside = prose(translations.fr[key]).replace(/«[^»]*»/g, '');
      for (const { bad, use } of RETIRED_FR) {
        if (bad.test(outside)) offences.push(`${key} (outside citation) -> use "${use}"`);
      }
    }
    expect(offences).toEqual([]);
  });

  // "Wizard" is "Sorcier" in French everywhere: the camp (side.wizard), the
  // race (race.Wizard) and the derived "Sorcier déchu". It used to be split --
  // side.* and the rule docs said "Sorcier", alignment.* and race.* said
  // "Magicien" -- and nothing surfaced the disagreement until the filter menus
  // began localizing alignments and races, which put both words on screen in
  // the same session. "Magicien" is now banned outright by RETIRED_FR above,
  // so this test only pins the positive side: the exact strings, wherever the
  // camp and the race are named. Both halves matter -- the ban alone would be
  // satisfied by any other word, and these assertions are what make a partial
  // edit (one key "fixed", the others left behind) fail loudly.
  it('Wizard is "Sorcier" in French, camp and race alike', () => {
    expect(translations.fr['side.wizard']).toBe('Sorcier');
    expect(translations.fr['race.Wizard']).toBe('Sorcier');
    for (const key of ['side.fallen-wizard', 'alignment.Fallen-wizard', 'race.Fallen-wizard']) {
      expect(translations.fr[key]).toBe('Sorcier déchu');
    }
  });

  // The rotation's own trap: the three zone words must not be assigned to two
  // different zones. Pinning the exact strings is what makes a future edit
  // that "fixes" one tab without the others fail loudly.
  it('the three deck zones carry their glossary names, and no two share one', () => {
    expect(translations.fr['zones.play']).toBe('Pioche');
    expect(translations.fr['zones.sideboard']).toBe('Talon');
    expect(translations.fr['zones.pool']).toBe('Réserve');
    const zoneNames = ['zones.play', 'zones.sideboard', 'zones.pool'].map((k) => translations.fr[k]);
    expect(new Set(zoneNames).size).toBe(3);
    // The short tab labels must agree with the full names, not drift from them.
    expect(translations.fr['zoneShort.deck']).toBe('Pioche');
    expect(translations.fr['zoneShort.sideboard']).toBe('Talon');
    expect(new Set(['zoneShort.deck', 'zoneShort.sideboard', 'zoneShort.pool'].map((k) => translations.fr[k])).size).toBe(3);
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
