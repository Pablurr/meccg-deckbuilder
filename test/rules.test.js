import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { zonesFor } from '../web/src/lib/rules/zones.js';
import { SIDES, isLegalForSide } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { BANNED, resolveBanned } from '../web/src/lib/rules/banned.js';
import { RULES, validateDeck, isRuleEnabled } from '../web/src/lib/rules/validate.js';

const { cards, index } = parseCards(raw);

describe('zonesFor', () => {
  it('never throws and always yields a primary over all cards', () => {
    for (const c of cards) {
      const z = zonesFor(c);
      expect(['deck', 'pool']).toContain(z.primary);
      expect(Array.isArray(z.extra)).toBe(true);
    }
  });
  it('sites and regions are location-only (single deck counter, no expander)', () => {
    const site = cards.find((c) => c.type === 'Site');
    expect(site).toBeTruthy();
    const region = cards.find((c) => c.type === 'Region');
    expect(region).toBeTruthy();
    expect(zonesFor(site)).toEqual({ primary: 'deck', extra: [] });
    expect(zonesFor(region)).toEqual({ primary: 'deck', extra: [] });
  });
  it('characters default to pool; resources/hazards default to deck', () => {
    const chr = cards.find((c) => c.type === 'Character');
    expect(chr).toBeTruthy();
    expect(zonesFor(chr)).toEqual({ primary: 'pool', extra: ['deck', 'sideboard'] });
    const hz = cards.find((c) => c.type === 'Hazard');
    expect(hz).toBeTruthy();
    expect(zonesFor(hz)).toEqual({ primary: 'deck', extra: ['sideboard'] });
  });
  it('starting minor items also offer the pool', () => {
    const item = cards.find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);
    expect(item).toBeTruthy();
    expect(zonesFor(item)).toEqual({ primary: 'deck', extra: ['sideboard', 'pool'] });
  });
});

describe('sides data', () => {
  it('exposes the four sides with alignments and copy limits', () => {
    expect(Object.keys(SIDES).sort()).toEqual(['balrog', 'fallen-wizard', 'ringwraith', 'wizard']);
    expect(SIDES['fallen-wizard'].copies.default).toBe(2);
    expect(SIDES['fallen-wizard'].copies.byAlignment.Stage).toBe(3);
    expect(SIDES.wizard.alignments).toContain('Neutral');
  });
  it('legality: hero card illegal for ringwraith, legal for wizard and fallen-wizard', () => {
    const hero = cards.find((c) => c.alignment === 'Hero' && c.type === 'Resource');
    expect(hero).toBeTruthy();
    expect(isLegalForSide(hero, 'ringwraith')).toBe(false);
    expect(isLegalForSide(hero, 'wizard')).toBe(true);
    expect(isLegalForSide(hero, 'fallen-wizard')).toBe(true);
  });
  it('avatars are legal for their own side only', () => {
    const gandalfTW = index.get('TW-156') || cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
    expect(gandalfTW).toBeTruthy();
    expect(isLegalForSide(gandalfTW, 'wizard')).toBe(true);
    expect(isLegalForSide(gandalfTW, 'balrog')).toBe(false);
  });

  it('wizard side accepts its own avatar (Hero alignment)', () => {
    const gandalfTW = index.get('TW-156') || cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
    expect(gandalfTW).toBeTruthy();
    expect(isLegalForSide(gandalfTW, 'wizard')).toBe(true);
  });

  it('ringwraith side accepts its own avatar (Minion alignment)', () => {
    const adunaphelLE = index.get('LE-50') || cards.find((c) => c.attributes.avatar && c.alignment === 'Minion');
    expect(adunaphelLE).toBeTruthy();
    expect(isLegalForSide(adunaphelLE, 'ringwraith')).toBe(true);
  });

  it('fallen-wizard side accepts its own avatar (Fallen-wizard alignment)', () => {
    const alataWH = index.get('WH-1') || cards.find((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard');
    expect(alataWH).toBeTruthy();
    expect(isLegalForSide(alataWH, 'fallen-wizard')).toBe(true);
  });

  it('balrog side accepts its own avatar (Balrog alignment)', () => {
    const balrogBA = index.get('BA-3') || cards.find((c) => c.attributes.avatar && c.alignment === 'Balrog');
    expect(balrogBA).toBeTruthy();
    expect(isLegalForSide(balrogBA, 'balrog')).toBe(true);
  });

  it('wizard rejects ringwraith avatar', () => {
    const adunaphelLE = index.get('LE-50') || cards.find((c) => c.attributes.avatar && c.alignment === 'Minion');
    expect(adunaphelLE).toBeTruthy();
    expect(isLegalForSide(adunaphelLE, 'wizard')).toBe(false);
  });

  it('ringwraith rejects wizard avatar', () => {
    const gandalfTW = index.get('TW-156') || cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
    expect(gandalfTW).toBeTruthy();
    expect(isLegalForSide(gandalfTW, 'ringwraith')).toBe(false);
  });

  it('balrog rejects wizard avatar', () => {
    const gandalfTW = index.get('TW-156') || cards.find((c) => c.attributes.avatar && c.alignment === 'Hero');
    expect(gandalfTW).toBeTruthy();
    expect(isLegalForSide(gandalfTW, 'balrog')).toBe(false);
  });

  it('fallen-wizard rejects balrog avatar', () => {
    const balrogBA = index.get('BA-3') || cards.find((c) => c.attributes.avatar && c.alignment === 'Balrog');
    expect(balrogBA).toBeTruthy();
    expect(isLegalForSide(balrogBA, 'fallen-wizard')).toBe(false);
  });

  it('balrog side: Minion alignment card is legal (alignment membership)', () => {
    const minionCard = cards.find((c) => c.alignment === 'Minion' && !c.attributes?.avatar);
    expect(minionCard).toBeTruthy();
    expect(isLegalForSide(minionCard, 'balrog')).toBe(true);
  });

  it('balrog side: Balrog alignment card is legal (alignment membership)', () => {
    const balrogAlignCard = cards.find((c) => c.alignment === 'Balrog' && !c.attributes?.avatar);
    expect(balrogAlignCard).toBeTruthy();
    expect(isLegalForSide(balrogAlignCard, 'balrog')).toBe(true);
  });

  it('balrog side: Hero alignment card is illegal', () => {
    const heroCard = cards.find((c) => c.alignment === 'Hero' && !c.attributes?.avatar);
    expect(heroCard).toBeTruthy();
    expect(isLegalForSide(heroCard, 'balrog')).toBe(false);
  });

  it('balrog side: specific:"Balrog" card is legal regardless of alignment', () => {
    const specificBalrog = cards.find((c) => c.attributes?.specific === 'Balrog');
    expect(specificBalrog).toBeTruthy();
    expect(isLegalForSide(specificBalrog, 'balrog')).toBe(true);
  });

  it('sideboard caps follow the length', () => {
    expect(LENGTHS.starter.sideboardMax).toBe(30);
    expect(LENGTHS.standard.sideboardMax).toBe(30);
    expect(LENGTHS.long.sideboardMax).toBe(35);
    expect(LENGTHS.campaign.sideboardMax).toBe(40);
  });
});

describe('banned lists', () => {
  it('every banned name resolves to at least one real card', () => {
    const { unresolved, bySide } = resolveBanned(cards);
    expect(unresolved).toEqual([]); // a typo must fail loudly, with the name in the diff
    expect(bySide['fallen-wizard'].size).toBeGreaterThan(0);
    expect(bySide.balrog.size).toBeGreaterThan(0);
  });

  it('diacritic folding: decomposed accents match precomposed names, unaccented matches accented', () => {
    // Verify that the fold() helper (driven through resolveBanned) correctly:
    // 1. Decomposes NFD accents and strips combining diacritical marks
    // 2. Matches decomposed vs. precomposed forms
    // 3. Matches accented vs. unaccented forms
    //
    // "Orders From Lugbúrz" (with precomposed ú, U+00FA) is in BANNED.balrog.
    // Create synthetic cards that differ only in diacritic representation:

    const syntheticCards = [
      // Decomposed form: u + combining acute accent (U+0301)
      {
        id: 'test-decomposed-accent',
        name: {
          en: 'Orders From Lugbu' + '\u0301' + 'rz'
        }
      },
      // Unaccented form (plain u, no accent)
      {
        id: 'test-unaccented',
        name: {
          en: 'Orders From Lugburz'
        }
      },
      // Completely different name (negative control — should not be banned)
      {
        id: 'test-different-name',
        name: {
          en: 'This Is Definitely Not A Banned Card'
        }
      }
    ];

    const allCards = [...cards, ...syntheticCards];
    const { unresolved, bySide } = resolveBanned(allCards);

    // All banned names (including synthetic) must resolve
    expect(unresolved).toEqual([]);

    // Both decomposed and unaccented variants of "Orders From Lugbúrz" should match
    // and appear in the balrog banned set
    expect(bySide.balrog.has('test-decomposed-accent')).toBe(true);
    expect(bySide.balrog.has('test-unaccented')).toBe(true);

    // The genuinely different name must not appear in any banned set (negative control)
    expect(bySide.balrog.has('test-different-name')).toBe(false);
    expect(bySide['fallen-wizard'].has('test-different-name')).toBe(false);
  });
});

const byId = (list, ruleId) => list.filter((w) => w.ruleId === ruleId);
const cardsById = index;
function firstWhere(pred) { const c = cards.find(pred); expect(c).toBeTruthy(); return c; }

describe('validateDeck', () => {
  const wizardAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Hero');
  const base = { side: 'wizard', length: 'standard', tournament: true, ruleOverrides: {}, zones: { sideboard: {}, pool: {} }, cardsById };

  it('flags a missing avatar as a warning, never an error', () => {
    const out = validateDeck({ ...base, quantities: {} });
    expect(byId(out, 'AVATAR-PRESENT')).toHaveLength(1);
    expect(byId(out, 'AVATAR-PRESENT')[0].severity).toBe('warning');
  });
  it('AVATAR-UNIQUE: fires on 3 copies of a single avatar (copy count, not distinct-card count)', () => {
    const out = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 3 } });
    const hits = byId(out, 'AVATAR-UNIQUE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(3);
    expect(hits[0].params.names).toEqual([wizardAvatar.name.en || Object.values(wizardAvatar.name)[0]]);
  });
  it('AVATAR-UNIQUE: fires on two different avatar cards', () => {
    const otherWizardAvatar = cards.find(
      (c) => c.attributes.avatar && c.alignment === 'Hero' && c.id !== wizardAvatar.id
    );
    expect(otherWizardAvatar).toBeTruthy();
    const out = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 1, [otherWizardAvatar.id]: 1 } });
    const hits = byId(out, 'AVATAR-UNIQUE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(2);
  });
  it('AVATAR-SIDE: an avatar whose alignment does not match the side fires', () => {
    const rwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Minion');
    const out = validateDeck({ ...base, side: 'wizard', quantities: { [rwAvatar.id]: 1 } });
    const hits = byId(out, 'AVATAR-SIDE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.name).toBeTruthy();
  });
  it('flags illegal alignment for the side', () => {
    const minionRes = firstWhere((c) => c.alignment === 'Minion' && c.type === 'Resource');
    const out = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 1, [minionRes.id]: 1 } });
    expect(byId(out, 'ALIGN-LEGAL')).toHaveLength(1);
    expect(byId(out, 'ALIGN-LEGAL')[0].params.name).toBeTruthy();
  });
  it('fallen-wizard: 2 copies max but 3 for Stage resources', () => {
    const fwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard');
    const stage = firstWhere((c) => c.alignment === 'Stage' && !c.attributes.unique);
    const hero = firstWhere((c) => c.alignment === 'Hero' && c.type === 'Resource' && !c.attributes.unique);
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [fwAvatar.id]: 1, [hero.id]: 3, [stage.id]: 3 } });
    const copies = byId(out, 'COPIES-LIMIT');
    expect(copies.some((w) => w.params.id === hero.id)).toBe(true);   // 3 > 2
    expect(copies.some((w) => w.params.id === stage.id)).toBe(false); // 3 <= 3
  });
  it('counts copies across deck + sideboard + pool', () => {
    // Split across all three zones (2 + 1 + 1 = 4 > the wizard default limit
    // of 3) so that dropping any one zone from the totals loop in validate.js
    // would bring the count back to 3 and silently pass.
    const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique && c.alignment === 'Neutral');
    const out = validateDeck({ ...base, quantities: { [hz.id]: 2 }, zones: { sideboard: { [hz.id]: 1 }, pool: { [hz.id]: 1 } } });
    expect(byId(out, 'COPIES-LIMIT').some((w) => w.params.id === hz.id)).toBe(true);
  });
  it('wizard-specific cards must match the avatar', () => {
    const gandalfSpecific = firstWhere((c) => c.attributes.specific === 'Gandalf');
    const saruman = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard' && (c.name.en || '').includes('Saruman'));
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [saruman.id]: 1, [gandalfSpecific.id]: 1 } });
    expect(byId(out, 'SPECIFIC-AVATAR')).toHaveLength(1);
  });
  it('BANNED is disabled by default (unverified) and emits nothing without an override', () => {
    // "Old Road" (TW-294) is in BANNED['fallen-wizard'] and is Hero-alignment,
    // so it is otherwise perfectly legal for a fallen-wizard deck.
    const bannedCard = firstWhere((c) => (c.name.en || '') === 'Old Road');
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [bannedCard.id]: 1 } });
    expect(byId(out, 'BANNED')).toHaveLength(0);
  });
  it('banned cards are errors once BANNED is enabled via ruleOverrides', () => {
    const bannedCard = firstWhere((c) => (c.name.en || '') === 'Old Road');
    const out = validateDeck({
      ...base,
      side: 'fallen-wizard',
      ruleOverrides: { BANNED: true },
      quantities: { [bannedCard.id]: 1 },
    });
    expect(byId(out, 'BANNED')).toHaveLength(1);
    expect(byId(out, 'BANNED')[0].severity).toBe('error');
    expect(byId(out, 'BANNED')[0].params.id).toBe(bannedCard.id);
  });
  it('sideboard size follows the length', () => {
    const hz = firstWhere((c) => c.type === 'Hazard' && !c.attributes.unique);
    const out = validateDeck({ ...base, length: 'long', quantities: { [wizardAvatar.id]: 1 }, zones: { sideboard: { [hz.id]: 36 }, pool: {} } });
    expect(byId(out, 'SIDEBOARD-MAX')).toHaveLength(1);
    expect(byId(out, 'SIDEBOARD-MAX')[0].params.max).toBe(35);
  });
  it('casual downgrades severities one notch and never below info', () => {
    const minionRes = firstWhere((c) => c.alignment === 'Minion' && c.type === 'Resource');
    const strict = validateDeck({ ...base, quantities: { [minionRes.id]: 1 } });
    const casual = validateDeck({ ...base, tournament: false, quantities: { [minionRes.id]: 1 } });
    expect(byId(strict, 'ALIGN-LEGAL')[0].severity).toBe('error');
    expect(byId(casual, 'ALIGN-LEGAL')[0].severity).toBe('warning');
    // Same fixture has no avatar in quantities, so AVATAR-PRESENT (base
    // severity 'warning') also fires — covering the warning -> info half
    // of the one-notch-down rule, never below 'info'.
    expect(byId(strict, 'AVATAR-PRESENT')[0].severity).toBe('warning');
    expect(byId(casual, 'AVATAR-PRESENT')[0].severity).toBe('info');
  });
  it('POOL-MIND: per-character mind limit over the cap uses the .char code', () => {
    // BA-1 (Strider), Hero alignment, mind 8 > fallen-wizard's mindPerCharacter (5).
    const bigMindChar = firstWhere((c) => c.id === 'BA-1');
    const fwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Fallen-wizard');
    const disabled = validateDeck({
      ...base, side: 'fallen-wizard',
      quantities: { [fwAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [bigMindChar.id]: 1 } },
    });
    expect(byId(disabled, 'POOL-MIND')).toHaveLength(0); // unverified rule, off by default

    const enabled = validateDeck({
      ...base, side: 'fallen-wizard', ruleOverrides: { 'POOL-MIND': true },
      quantities: { [fwAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [bigMindChar.id]: 1 } },
    });
    const poolMind = byId(enabled, 'POOL-MIND');
    expect(poolMind).toHaveLength(1);
    expect(poolMind[0].code).toBe('POOL-MIND.char');
  });
  it('POOL-MIND: pool total over the cap uses the .total code', () => {
    // ringwraith mindCap = 20; four Minion/Neutral characters (mind 7+7+5+5=24) exceed it,
    // but ringwraith has no per-character mind cap, so only the .total code should fire.
    const rwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Minion');
    const azog = firstWhere((c) => c.id === 'BA-2');
    const bolg = firstWhere((c) => c.id === 'BA-4');
    const mauhur = firstWhere((c) => c.id === 'AS-2');
    const perchen = firstWhere((c) => c.id === 'AS-4');
    const out = validateDeck({
      ...base, side: 'ringwraith', ruleOverrides: { 'POOL-MIND': true },
      quantities: { [rwAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [azog.id]: 1, [bolg.id]: 1, [mauhur.id]: 1, [perchen.id]: 1 } },
    });
    const poolMind = byId(out, 'POOL-MIND');
    expect(poolMind.some((w) => w.code === 'POOL-MIND.total')).toBe(true);
    expect(poolMind.some((w) => w.code === 'POOL-MIND.char')).toBe(false);
  });
  it('SITE-COPIES: a non-haven site over 1 copy fires; the haven exemption suppresses it', () => {
    const nonHavenSite = firstWhere((c) => c.type === 'Site' && ['Hero', 'Neutral'].includes(c.alignment));
    const overCount = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 1, [nonHavenSite.id]: 2 } });
    expect(byId(overCount, 'SITE-COPIES').some((w) => w.params.id === nonHavenSite.id)).toBe(true);

    // Real cards.json has no Site with attributes.haven === true — `haven`
    // there is a string (the haven place-name recorded on OTHER cards that
    // may be stored/healed there), never the boolean the old exemption
    // checked for. The real criterion is attributes.siteType === '{H}'
    // (13 cards, one per Darkhaven/Wizardhaven). LE-367 "Dol Guldur" is
    // Minion-alignment and is exempt for the ringwraith side, whose
    // alignments+avatarAlignment include Minion.
    const dolGuldur = firstWhere((c) => c.id === 'LE-367');
    expect(dolGuldur.attributes.siteType).toBe('{H}');
    expect(dolGuldur.alignment).toBe('Minion');
    const rwAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Minion');
    const exempt = validateDeck({
      ...base,
      side: 'ringwraith',
      quantities: { [rwAvatar.id]: 1, [dolGuldur.id]: 2 },
    });
    expect(byId(exempt, 'SITE-COPIES').some((w) => w.params.id === dolGuldur.id)).toBe(false);

    // Same haven site, but in a deck for a side whose alignment it does NOT
    // match (wizard: Hero/Neutral) — the exemption is per-side, not blanket,
    // so SITE-COPIES must fire here even though it didn't for ringwraith.
    const wrongSide = validateDeck({
      ...base,
      side: 'wizard',
      quantities: { [wizardAvatar.id]: 1, [dolGuldur.id]: 2 },
    });
    expect(byId(wrongSide, 'SITE-COPIES').some((w) => w.params.id === dolGuldur.id)).toBe(true);
  });
  it('DECKSIZE-PLAY: play-deck count below the side minimum fires', () => {
    const out = validateDeck({ ...base, quantities: { [wizardAvatar.id]: 1 } });
    const hits = byId(out, 'DECKSIZE-PLAY');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(1);
    expect(hits[0].params.min).toBe(25);
  });
  it('POOL-CHARS: pool character count above the side max fires', () => {
    const poolChar = firstWhere((c) => c.type === 'Character' && ['Hero', 'Neutral'].includes(c.alignment) && !c.attributes.avatar);
    const out = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [poolChar.id]: 11 } }, // wizard pool.maxCharacters = 10
    });
    const hits = byId(out, 'POOL-CHARS');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(11);
    expect(hits[0].params.max).toBe(10);
  });
  it('POOL-ELIGIBLE: a card whose type cannot occupy the pool fires with reason "type"', () => {
    const hazard = firstWhere((c) => c.type === 'Hazard' && ['Hero', 'Neutral'].includes(c.alignment));
    const out = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [hazard.id]: 1 } },
    });
    const hits = byId(out, 'POOL-ELIGIBLE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.reason).toBe('type');
    expect(hits[0].params.id).toBe(hazard.id);
  });
  it('a prototype-named side ("constructor") is rejected rather than treated as a profile', () => {
    const out = validateDeck({ ...base, side: 'constructor', quantities: {} });
    expect(out).toEqual([]);
  });
  it('isRuleEnabled: unverified rules default off, overrides can flip them, unknown ids are ignored', () => {
    const unverified = RULES.find((r) => r.status === 'unverified');
    expect(unverified.defaultEnabled).toBe(false);
    expect(isRuleEnabled(unverified.id, {})).toBe(false);
    expect(isRuleEnabled(unverified.id, { [unverified.id]: true })).toBe(true);
    expect(isRuleEnabled('ALIGN-LEGAL', { 'ALIGN-LEGAL': false })).toBe(false);
    expect(isRuleEnabled('NO-SUCH-RULE', { 'NO-SUCH-RULE': true })).toBe(false); // unknown ids ignored
  });
  it('every rule has unique id and required metadata', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['verified', 'unverified', 'disputed']).toContain(r.status);
      expect(typeof r.source).toBe('string');
      expect(r.defaultEnabled).toBe(r.status === 'verified');
    }
  });
});
