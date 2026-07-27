import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { zonesFor } from '../web/src/lib/rules/zones.js';
import { SIDES, GENERAL, SPECIFIC_TO_SIDES, isLegalForSide, raceAllowed } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { BANNED, resolveBanned } from '../web/src/lib/rules/banned.js';
import { RULES, validateDeck, isRuleEnabled } from '../web/src/lib/rules/validate.js';
import { COE, ruleRefs } from '../web/src/lib/rules/catalog.js';
import { isDropAllowed, resolveDropTarget } from '../web/src/lib/rules/dropTargets.js';
import { racesOf, singularize, matchesRace } from '../web/src/lib/rules/races.js';
import { buildGroups, TYPE_ORDER } from '../web/src/lib/deckList.js';

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

describe('dropTargets', () => {
  it('a Character may be dropped on Pool, Sideboard and the deck tabs', () => {
    const chr = cards.find((c) => c.type === 'Character');
    expect(chr).toBeTruthy();
    expect(isDropAllowed(chr, 'pool')).toBe(true);
    expect(isDropAllowed(chr, 'sideboard')).toBe(true);
    expect(isDropAllowed(chr, 'play')).toBe(true);
    expect(isDropAllowed(chr, 'location')).toBe(true);
    expect(isDropAllowed(chr, 'cards')).toBe(true);
  });
  it('a Site may not be dropped on Pool or Sideboard', () => {
    const site = cards.find((c) => c.type === 'Site');
    expect(site).toBeTruthy();
    expect(isDropAllowed(site, 'pool')).toBe(false);
    expect(isDropAllowed(site, 'sideboard')).toBe(false);
    expect(isDropAllowed(site, 'play')).toBe(true);
  });
  it('a Resource flagged playableAsStartingMinorItem may be dropped on Pool; an ordinary Resource may not', () => {
    const minorItem = cards.find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);
    expect(minorItem).toBeTruthy();
    expect(isDropAllowed(minorItem, 'pool')).toBe(true);
    const ordinaryResource = cards.find((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem !== true);
    expect(ordinaryResource).toBeTruthy();
    expect(isDropAllowed(ordinaryResource, 'pool')).toBe(false);
  });
  it('the play, location and cards tabs all resolve to the same deck target', () => {
    expect(resolveDropTarget('play')).toBe('deck');
    expect(resolveDropTarget('location')).toBe('deck');
    expect(resolveDropTarget('cards')).toBe('deck');
    expect(resolveDropTarget('pool')).toBe('pool');
    expect(resolveDropTarget('sideboard')).toBe('sideboard');
  });
  it('isDropAllowed returns false for a missing card rather than throwing', () => {
    expect(isDropAllowed(null, 'pool')).toBe(false);
  });
});

describe('buildGroups', () => {
  it('puts each card under its own type and preserves the existing type ordering', () => {
    const chr = cards.find((c) => c.type === 'Character');
    const site = cards.find((c) => c.type === 'Site');
    const hz = cards.find((c) => c.type === 'Hazard');
    expect(chr).toBeTruthy();
    expect(site).toBeTruthy();
    expect(hz).toBeTruthy();
    // Deliberately out of TYPE_ORDER (Character, Resource, Hazard, Site, Region)
    // in the input list, to prove buildGroups reorders rather than preserving
    // insertion order.
    const entries = [
      { card: site, qty: 1 },
      { card: hz, qty: 2 },
      { card: chr, qty: 3 },
    ];
    const groups = buildGroups(entries, 'en');
    expect(groups.map((g) => g.type)).toEqual(['Character', 'Hazard', 'Site']);
    expect(TYPE_ORDER.indexOf('Character')).toBeLessThan(TYPE_ORDER.indexOf('Hazard'));
    expect(TYPE_ORDER.indexOf('Hazard')).toBeLessThan(TYPE_ORDER.indexOf('Site'));
    const charGroup = groups.find((g) => g.type === 'Character');
    expect(charGroup.items).toEqual([{ card: chr, qty: 3 }]);
    // Types absent from the entries list produce no group at all.
    expect(groups.some((g) => g.type === 'Resource')).toBe(false);
    expect(groups.some((g) => g.type === 'Region')).toBe(false);
  });
});

describe('sides data', () => {
  it('exposes the four sides with alignments and copy limits', () => {
    expect(Object.keys(SIDES).sort()).toEqual(['balrog', 'fallen-wizard', 'ringwraith', 'wizard']);
    expect(SIDES['fallen-wizard'].copies.default).toBe(2);
    expect(SIDES['fallen-wizard'].copies.byAlignment.Stage).toBe(3);
    expect(SIDES.wizard.alignments).toContain('Neutral');
  });
  it('every side allows Dual-alignment cards (1.3.W3/R3/F4/B3)', () => {
    // LE-245, LE-419, WH-38, WH-40 are alignment "Dual" -- playable by both
    // hero and minion sides. Section 1 never restricts them.
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      const out = validateDeck({
        side, length: 'standard', tournament: true,
        quantities: { 'LE-419': 1 }, cardsById: index,
      });
      expect(out.filter((w) => w.ruleId === 'ALIGN-LEGAL')).toEqual([]);
      expect(isLegalForSide(index.get('LE-419'), side)).toBe(true);
    }
  });

  it('the starting pool holds ten characters on every side (1.7)', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(SIDES[side].pool.maxCharacters).toBe(10);
      expect(SIDES[side].pool.maxMinorItems).toBe(2);
    }
  });

  it('POOL-MIND is gone: section 1 states no pool mind cap', () => {
    expect(RULES.find((r) => r.id === 'POOL-MIND')).toBeUndefined();
    // An override for a retired id must be ignored, not resurrect the rule.
    expect(isRuleEnabled('POOL-MIND', { 'POOL-MIND': true })).toBe(false);
    for (const side of Object.values(SIDES)) {
      expect(side.pool.mindCap).toBeUndefined();
      expect(side.pool.mindPerCharacterMax).toBeUndefined();
      expect(side.pool.forbidRaces).toBeUndefined();
    }
  });

  it('GENERAL carries the side-independent limits', () => {
    expect(GENERAL).toEqual({ agentMindMax: 36, copiesDefault: 3, uniqueMax: 1, siteMax: 1 });
  });

  it('raceAllowed uses race normalisation, not substring matching (1.3.B4)', () => {
    // Only the Balrog side requires races; every other side accepts anyone.
    expect(raceAllowed({ attributes: { race: 'Orcs' } }, 'balrog')).toBe(true);
    expect(raceAllowed({ attributes: { race: 'Trolls' } }, 'balrog')).toBe(true);
    expect(raceAllowed({ attributes: { race: 'Man' } }, 'balrog')).toBe(false);
    expect(raceAllowed({ attributes: { race: 'Man' } }, 'wizard')).toBe(true);
  });

  it('SPECIFIC_TO_SIDES covers every specific value in the card data', () => {
    const seen = new Set(cards.map((c) => (c.attributes || {}).specific).filter(Boolean));
    for (const s of seen) expect(SPECIFIC_TO_SIDES[s]).toBeDefined();
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

  it('folds typographic apostrophes in both directions via the injected lists param', () => {
    // Side key "wizard" doesn't exist in the real BANNED object, so a pre-fix
    // single-arg resolveBanned that ignores its second parameter would fall
    // back to module-level BANNED and leave bySide.wizard undefined -- this
    // test cannot pass by accident. DM-107's name.en uses an ASCII apostrophe
    // while TW-247's uses U+2019; each ban entry below is spelled with the
    // OPPOSITE apostrophe, so both fold directions get exercised.
    const { bySide } = resolveBanned(cards, {
      wizard: { names: ['Durin\u2019s Bane', "Gollum's Fate"] },
    });
    expect([...bySide.wizard]).toContain('DM-107');
    expect([...bySide.wizard]).toContain('TW-247');
  });

  it('an id-qualified entry bans exactly that card, not its namesake', () => {
    // Two cards are named "The Balrog": AS-71 (Resource/Minion, Ally) and
    // BA-3 (Character/Balrog) -- the Balrog player's own avatar. Banning by
    // name alone would ban the avatar inside its own deck.
    const { bySide } = resolveBanned(cards);
    expect(bySide.balrog.has('AS-71')).toBe(true);
    expect(bySide.balrog.has('BA-3')).toBe(false);
  });

  it('a family entry bans every listed id', () => {
    const { bySide } = resolveBanned(cards);
    for (const id of ['LE-161', 'LE-162', 'LE-182', 'LE-193', 'LE-198', 'LE-200', 'LE-222', 'LE-248', 'LE-257']) {
      expect(bySide.balrog.has(id)).toBe(true);
    }
  });

  it('the new Balrog entries resolve', () => {
    const { bySide } = resolveBanned(cards);
    expect(bySide.balrog.has('TW-12')).toBe(true); // Balrog of Moria
    expect(bySide.balrog.has('LE-183')).toBe(true); // Fell Rider
  });

  it('the Fallen-wizard list bans The Balrog (Ally) but not the avatar', () => {
    const { bySide } = resolveBanned(cards);
    expect(bySide['fallen-wizard'].has('AS-71')).toBe(true);
    expect(bySide['fallen-wizard'].has('BA-3')).toBe(false);
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
  it('BANNED is enabled by default and fires for a banned card; ruleOverrides can turn it off', () => {
    // "Old Road" (TW-294) is in BANNED['fallen-wizard'] and is Hero-alignment,
    // so it is otherwise perfectly legal for a fallen-wizard deck except for the ban.
    const bannedCard = firstWhere((c) => (c.name.en || '') === 'Old Road');
    const out = validateDeck({ ...base, side: 'fallen-wizard', quantities: { [bannedCard.id]: 1 } });
    expect(byId(out, 'BANNED')).toHaveLength(1);
    expect(byId(out, 'BANNED')[0].severity).toBe('error');
    expect(byId(out, 'BANNED')[0].params.id).toBe(bannedCard.id);

    // The override mechanism still works in the other direction: a rule that
    // is on by default can be silenced per-deck even though the deck still
    // violates it.
    const disabled = validateDeck({
      ...base,
      side: 'fallen-wizard',
      ruleOverrides: { BANNED: false },
      quantities: { [bannedCard.id]: 1 },
    });
    expect(byId(disabled, 'BANNED')).toHaveLength(0);
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
    expect(byId(out, 'SIDEBOARD-MAX')[0].severity).toBe('error');
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
    expect(hits[0].severity).toBe('error');
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
  it('BALROG-MIND: a non-exempt Balrog-side character at/above the per-character mind limit fires by default', () => {
    const balrogAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Balrog');
    const bigMindChar = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.specific !== 'Balrog' && parseInt(c.attributes.mind, 10) >= 9);
    const out = validateDeck({
      ...base, side: 'balrog',
      quantities: { [balrogAvatar.id]: 1, [bigMindChar.id]: 1 },
    });
    const hits = byId(out, 'BALROG-MIND');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.id).toBe(bigMindChar.id);
    expect(hits[0].params.limit).toBe(9); // balrog's balrogMindPerCharacterLimit (sides.js)
  });

  it('BALROG-MIND: a Balrog-specific character is exempt even at/above the mind limit', () => {
    const balrogAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Balrog');
    const exemptChar = cards.find((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.specific === 'Balrog' && parseInt(c.attributes.mind, 10) >= 9);
    if (exemptChar) {
      const out = validateDeck({
        ...base, side: 'balrog', ruleOverrides: { 'BALROG-MIND': true },
        quantities: { [balrogAvatar.id]: 1, [exemptChar.id]: 1 },
      });
      expect(byId(out, 'BALROG-MIND')).toHaveLength(0);
    }
  });

  it('BALROG-RACE: a non-Orc/Troll, non-exempt Balrog-side character fires by default', () => {
    const balrogAvatar = firstWhere((c) => c.attributes.avatar && c.alignment === 'Balrog');
    const wrongRaceChar = firstWhere((c) => c.type === 'Character' && !c.attributes.avatar && c.attributes.specific !== 'Balrog'
      && c.attributes.race && !String(c.attributes.race).includes('Orc') && !String(c.attributes.race).includes('Troll'));
    const out = validateDeck({
      ...base, side: 'balrog',
      quantities: { [balrogAvatar.id]: 1, [wrongRaceChar.id]: 1 },
    });
    const hits = byId(out, 'BALROG-RACE');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.id).toBe(wrongRaceChar.id);
  });

  it('POOL-ITEMS: starting minor items above the per-side max fire by default', () => {
    const minorItem = firstWhere((c) => c.type === 'Resource' && c.attributes.playableAsStartingMinorItem === true);
    const out = validateDeck({
      ...base, quantities: { [wizardAvatar.id]: 1 },
      zones: { sideboard: {}, pool: { [minorItem.id]: 3 } }, // wizard pool.maxMinorItems = 2
    });
    const hits = byId(out, 'POOL-ITEMS');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(3);
    expect(hits[0].params.max).toBe(2);
    expect(hits[0].severity).toBe('error');
  });

  it('UNIQUE-LIMIT: exactly 2+ copies of a unique non-avatar card fire by default; 1 copy never does', () => {
    const uniqueCard = firstWhere((c) => c.attributes.unique === true && !c.attributes.avatar && c.type !== 'Site');
    const oneCopy = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1, [uniqueCard.id]: 1 },
    });
    // Pins the implicit limit at 1 copy: DeckPanel.jsx's localizeParams computes
    // `excess = count - 1` for this code without the validator emitting a
    // `limit` param, so the "1" is an assumption this test locks down.
    expect(byId(oneCopy, 'UNIQUE-LIMIT')).toHaveLength(0);

    const twoCopies = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1, [uniqueCard.id]: 2 },
    });
    const hits = byId(twoCopies, 'UNIQUE-LIMIT');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.id).toBe(uniqueCard.id);
    expect(hits[0].params.count).toBe(2);
    expect(hits[0].params.count - 1).toBe(1); // matches DeckPanel.jsx's hardcoded excess = count - 1
  });

  it('DECKSIZE-LOCATION: play-deck cards with zero location-deck cards fire by default', () => {
    const out = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1 }, // a Character only: play count > 0, location count 0
    });
    const hits = byId(out, 'DECKSIZE-LOCATION');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.count).toBe(0);
    expect(hits[0].params.min).toBe(1);
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
  it('every rule has a unique id and required metadata', () => {
    const seen = new Set();
    for (const r of RULES) {
      expect(seen.has(r.id)).toBe(false);
      seen.add(r.id);
      expect(typeof r.id).toBe('string');
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['verified', 'unverified']).toContain(r.status);
      expect(typeof r.source).toBe('string');
    }
  });

  it('every rule either cites CoE section 1 or is explicitly a house rule', () => {
    for (const r of RULES) {
      if (r.house) {
        // A house advisory must not pretend to come from the source.
        expect(r.ref).toBeUndefined();
        expect(r.refs).toBeUndefined();
        continue;
      }
      const refs = ruleRefs(r);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(ref).toMatch(/^1\.[0-9]+(\.[A-Z]?[0-9]+)?$/);
      expect(r.source).toBe(COE);
    }
  });

  it('every CoE-cited rule is severity error (section 1 is hard legality)', () => {
    // The house-implies-warning half of the same policy does not hold today:
    // AVATAR-UNIQUE is house:true but ships as 'error' because it also
    // contradicts 1.5 and is disabled by default (see the "two rules that
    // contradict section 1" test below). So only pin the half that is
    // actually true of the current data -- a citation forces 'error'.
    for (const r of RULES) {
      if (ruleRefs(r).length > 0) expect(r.severity).toBe('error');
    }
  });

  it('ruleRefs normalises single- and multi-clause rules', () => {
    expect(ruleRefs({ ref: '1.3.2' })).toEqual(['1.3.2']);
    expect(ruleRefs({ refs: ['1.4', '1.4.F1'] })).toEqual(['1.4', '1.4.F1']);
    expect(ruleRefs({ house: true })).toEqual([]);
    expect(ruleRefs(null)).toEqual([]);
  });

  it('the two rules that contradict section 1 ship disabled until lot 2 replaces them', () => {
    // AVATAR-UNIQUE fires on any total > 1, but 1.5 allows up to three
    // avatars. DECKSIZE-PLAY applies one 25-50 range to every play-deck card,
    // but 1.5 is four separate budgets. Both report legal decks as illegal.
    expect(isRuleEnabled('AVATAR-UNIQUE', {})).toBe(false);
    expect(isRuleEnabled('DECKSIZE-PLAY', {})).toBe(false);
  });
});

describe('races', () => {
  it('splits comma-joined race values', () => {
    expect(racesOf('Animals,Men,Bears')).toEqual(['Animals', 'Men', 'Bears']);
    expect(racesOf('Orcs, Men')).toEqual(['Orcs', 'Men']);
    expect(racesOf('')).toEqual([]);
    expect(racesOf(undefined)).toEqual([]);
  });

  it('singularises the plural forms the card data actually uses', () => {
    // Regular -s
    expect(singularize('Orcs')).toBe('orc');
    expect(singularize('Trolls')).toBe('troll');
    expect(singularize('Animals')).toBe('animal');
    expect(singularize('Spiders')).toBe('spider');
    // -ves, the case a substring match gets wrong
    expect(singularize('Wolves')).toBe('wolf');
    expect(singularize('Elves')).toBe('elf');
    expect(singularize('Dwarves')).toBe('dwarf');
    // Irregular
    expect(singularize('Men')).toBe('man');
    expect(singularize('D\u00fanedain')).toBe('dunadan');
    // Already singular, and accent folding
    expect(singularize('Orc')).toBe('orc');
    expect(singularize('D\u00fanadan')).toBe('dunadan');
  });

  it('matches a wanted race against any of a compound value', () => {
    expect(matchesRace('Wolves', 'Wolf')).toBe(true);
    expect(matchesRace('Orcs,Men', 'Orc')).toBe(true);
    expect(matchesRace('Orcs,Men', 'Man')).toBe(true);
    expect(matchesRace('Balrog,Spawn', 'Balrog')).toBe(true);
    expect(matchesRace('Man', 'Orc')).toBe(false);
    expect(matchesRace('', 'Orc')).toBe(false);
    // "Wose" must not be swallowed by a naive plural rule
    expect(matchesRace('Wose', 'Wose')).toBe(true);
  });

  it('every race value in the card data singularises without throwing', () => {
    for (const c of cards) {
      const v = (c.attributes || {}).race;
      if (v === undefined) continue;
      for (const r of racesOf(v)) expect(typeof singularize(r)).toBe('string');
    }
  });
});
