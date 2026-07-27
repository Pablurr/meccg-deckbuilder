// Pins the contract that broke in the POOL-ITEMS incident: every {placeholder}
// in a rule's i18n message template must actually be filled when the app
// renders it. 220 unit tests passed while a real deck showed a warning with
// raw "{side}" and "{over}" tokens in it, because nothing exercised the path
// from an emitted { code, params } descriptor through DeckPanel's
// localizeParams to the interpolated string. This file closes that hole.
//
// The placeholder list for each template is parsed out of the template
// itself (never hardcoded), so a new rule or a new {placeholder} extends
// this test automatically instead of rotting silently.
import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { validateDeck } from '../web/src/lib/rules/validate.js';
import { RULE_BY_ID } from '../web/src/lib/rules/catalog.js';
import { translations, makeT } from '../web/src/lib/i18n.js';
import { localizeParams } from '../web/src/components/DeckPanel.jsx';

const { cards, index } = parseCards(raw);
const cardsById = index;

function firstWhere(pred) {
  const c = cards.find(pred);
  expect(c).toBeTruthy();
  return c;
}

const base = { length: 'standard', tournament: true, ruleOverrides: {}, zones: { sideboard: {}, pool: {} }, cardsById };

// One small deck per emitted `code` (not just ruleId): POOL-ITEMS and
// POOL-ELIGIBLE emit a dotted code for their message shape while sharing a
// single ruleId/checkbox, and each dotted variant has its own template.
// Returns null for a code this suite cannot trigger against real card data.
function buildFixture(code) {
  const wizardAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Hero');
  switch (code) {
    case 'AVATAR-PRESENT':
      return { ...base, side: 'wizard', quantities: {} };
    case 'AVATAR-COPIES': {
      // Gandalf x3 in the play deck + 1 more in the sideboard = 4, over the
      // whole-deck cap of 3 (1.5 + 1.6).
      return {
        ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 3 },
        zones: { sideboard: { [wizardAvatar.id]: 1 }, pool: {} },
      };
    }
    case 'AVATAR-SIDEBOARD': {
      // Two copies of the same avatar in the sideboard, over the 1-copy cap (1.6.2).
      return {
        ...base, side: 'wizard', quantities: {},
        zones: { sideboard: { [wizardAvatar.id]: 2 }, pool: {} },
      };
    }
    case 'AVATAR-COUNT.total': {
      // 3 Gandalf + 1 Saruman = 4 avatar copies in the play deck, over the
      // 1.5 cap of 3.
      const saruman = firstWhere((c) => c.attributes.avatar && c.alignment === 'Hero' && c.id !== wizardAvatar.id);
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 3, [saruman.id]: 1 } };
    }
    case 'AVATAR-COUNT.distinct': {
      // Three different avatars in the play deck, one copy each -- 1.5 caps
      // distinct avatars at two.
      const others = cards.filter((c) => c.attributes.avatar && c.alignment === 'Hero' && c.id !== wizardAvatar.id);
      expect(others.length).toBeGreaterThanOrEqual(2);
      return {
        ...base, side: 'wizard',
        quantities: { [wizardAvatar.id]: 1, [others[0].id]: 1, [others[1].id]: 1 },
      };
    }
    case 'AVATAR-MULTIPLES': {
      // Two avatars each split 1 in the play deck + 1 in the sideboard --
      // 1.6.2 allows only one avatar to have multiple copies.
      const saruman = firstWhere((c) => c.attributes.avatar && c.alignment === 'Hero' && c.id !== wizardAvatar.id);
      return {
        ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1, [saruman.id]: 1 },
        zones: { sideboard: { [wizardAvatar.id]: 1, [saruman.id]: 1 }, pool: {} },
      };
    }
    case 'AVATAR-SIDE': {
      const rwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Minion');
      return { ...base, side: 'wizard', quantities: { [rwAvatar.id]: 1 } };
    }
    case 'ALIGN-LEGAL': {
      const minionRes = firstWhere((c) => c.alignment === 'Minion' && c.type === 'Resource');
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1, [minionRes.id]: 1 } };
    }
    case 'BANNED': {
      const bannedCard = firstWhere((c) => (c.name.en || '') === 'Old Road');
      return { ...base, side: 'fallen-wizard', quantities: { [bannedCard.id]: 1 } };
    }
    case 'SPECIFIC-AVATAR': {
      const gandalfSpecific = firstWhere((c) => c.attributes.specific === 'Gandalf');
      const saruman = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard' && (c.name.en || '').includes('Saruman'));
      return { ...base, side: 'fallen-wizard', quantities: { [saruman.id]: 1, [gandalfSpecific.id]: 1 } };
    }
    case 'SPECIFIC-SIDE': {
      // BA-4 Bolg: Character/Minion, specific "Balrog" -- its alignment is
      // legal for a Ringwraith, so only 1.3.4 (SPECIFIC-SIDE) catches it.
      const balrogSpecific = firstWhere((c) => c.attributes.specific === 'Balrog' && !c.attributes.avatar);
      return { ...base, side: 'ringwraith', quantities: { [balrogSpecific.id]: 1 } };
    }
    case 'AGENT-MIND':
      // Golodhros 9 + Baduila 8 + Elerina 8 + The Grimburgoth 8 + Dror 4 = 37,
      // one over the 36 limit (1.3.2). Same fixture as test/rules.test.js.
      return {
        ...base, side: 'ringwraith',
        quantities: { 'DM-14': 1, 'DM-2': 1, 'DM-7': 1, 'DM-15': 1, 'DM-6': 1 },
      };
    case 'COPIES-LIMIT': {
      const hero = firstWhere((c) => c.alignment === 'Hero' && c.type === 'Resource' && !c.attributes.unique);
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1, [hero.id]: 4 } };
    }
    case 'UNIQUE-LIMIT': {
      const uniqueCard = firstWhere((c) => c.attributes.unique === true && !c.attributes.avatar && c.type !== 'Site');
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1, [uniqueCard.id]: 2 } };
    }
    case 'SITE-COPIES': {
      const nonHavenSite = firstWhere((c) => c.type === 'Site' && ['Hero', 'Neutral'].includes(c.alignment));
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1, [nonHavenSite.id]: 2 } };
    }
    case 'REGION-EXCLUDED': {
      const region = firstWhere((c) => c.type === 'Region');
      return { ...base, side: 'wizard', quantities: { [region.id]: 1 } };
    }
    case 'BALROG-RACE': {
      const balrogAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Balrog');
      const wrongRaceChar = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.specific !== 'Balrog'
        && c.attributes.race && !String(c.attributes.race).includes('Orc') && !String(c.attributes.race).includes('Troll'));
      return { ...base, side: 'balrog', quantities: { [balrogAvatar.id]: 1, [wrongRaceChar.id]: 1 } };
    }
    case 'BALROG-MIND': {
      const balrogAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Balrog');
      const bigMindChar = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.specific !== 'Balrog' && parseInt(c.attributes.mind, 10) >= 9);
      return { ...base, side: 'balrog', quantities: { [balrogAvatar.id]: 1, [bigMindChar.id]: 1 } };
    }
    // DECKSIZE-PLAY: every side's `playDeck` is null in sides.js today, and
    // validate.js only emits DECKSIZE-PLAY when `profile.playDeck` is truthy
    // -- so this rule cannot be triggered against real data. Not a gap in
    // the fixture, a gap in the rule's sourcing (see sides.js).
    case 'DECKSIZE-PLAY':
      return null;
    case 'DECKSIZE-LOCATION':
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1 } };
    case 'SIDEBOARD-MAX': {
      const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique);
      return { ...base, side: 'wizard', length: 'long', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: { [hz.id]: 36 }, pool: {} } };
    }
    case 'POOL-CHARS': {
      const poolChar = firstWhere((c) => c.type === 'Character' && ['Hero', 'Neutral'].includes(c.alignment) && !c.attributes.avatar);
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: {}, pool: { [poolChar.id]: 11 } } };
    }
    case 'POOL-ITEMS.count': {
      const minorItem = firstWhere((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: {}, pool: { [minorItem.id]: 3 } } };
    }
    case 'POOL-ELIGIBLE.type': {
      const hazard = firstWhere((c) => c.type === 'Hazard' && ['Hero', 'Neutral'].includes(c.alignment));
      return { ...base, side: 'wizard', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: {}, pool: { [hazard.id]: 1 } } };
    }
    default:
      return null;
  }
}

// Every non-".doc" `rules.<ID>` / `rules.<ID>.<variant>` template key across
// every language block, grouped by its emitted `code` (everything after
// `rules.`). Filtering on RULE_BY_ID rather than a hardcoded list means a
// new rule or a new dotted variant is picked up automatically; rules.severity.*,
// rules.disable and rules.report are excluded because their first segment
// after "rules." is never a real rule id.
function ruleTemplateEntries() {
  const entries = [];
  for (const [lang, dict] of Object.entries(translations)) {
    for (const key of Object.keys(dict)) {
      if (!key.startsWith('rules.') || key.endsWith('.doc')) continue;
      const code = key.slice('rules.'.length);
      const ruleId = code.split('.')[0];
      if (!RULE_BY_ID.has(ruleId)) continue;
      entries.push({ lang, key, code, template: dict[key] });
    }
  }
  return entries;
}

function placeholdersOf(template) {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

describe('i18n rule-message placeholder contract', () => {
  const entries = ruleTemplateEntries();
  const codes = [...new Set(entries.map((e) => e.code))];
  const uncoveredCodes = [];

  // One real { code, params } descriptor per code, run through DeckPanel's
  // actual localizeParams -- the same derivation the app renders through --
  // rather than validateDeck's raw params. Some placeholders (over, excess)
  // are legitimately filled downstream of the validator, not by emit()
  // itself, so checking raw emit params would misreport those as broken.
  const t = makeT('en');
  const finalParamsByCode = {};
  for (const code of codes) {
    const args = buildFixture(code);
    if (!args) { uncoveredCodes.push(code); continue; }
    const out = validateDeck(args);
    const w = out.find((x) => x.code === code);
    if (!w) { uncoveredCodes.push(code); continue; }
    finalParamsByCode[code] = localizeParams(w, { cardsById, lang: 'en', t });
  }

  it('every rule template code is either triggered by a fixture or explicitly accounted for', () => {
    // DECKSIZE-PLAY is the one rule this suite cannot reach: every side's
    // playDeck is null (sides.js), so validate.js's `profile.playDeck &&`
    // guard can never pass with today's data. If that ever changes, add a
    // fixture above and this list should shrink back to empty.
    expect(uncoveredCodes).toEqual(['DECKSIZE-PLAY']);
  });

  const coveredEntries = entries.filter((e) => finalParamsByCode[e.code]);

  it('has at least one covered template entry to check (the check itself is not vacuous)', () => {
    expect(coveredEntries.length).toBeGreaterThan(0);
  });

  it.each(coveredEntries)(
    '[$lang] $key -- every {placeholder} is supplied by the render pipeline',
    ({ key, code, template }) => {
      const params = finalParamsByCode[code];
      for (const placeholder of placeholdersOf(template)) {
        expect(
          params[placeholder],
          `${key} uses {${placeholder}}, but the ${code} pipeline (validateDeck + localizeParams) never supplies "${placeholder}"`
        ).not.toBeUndefined();
      }
    }
  );
});
