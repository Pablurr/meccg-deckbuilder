import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { zonesFor } from '../web/src/lib/rules/zones.js';
import { SIDES, GENERAL, SPECIFIC_TO_SIDES, isLegalForSide, raceAllowed } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { BANNED, resolveBanned } from '../web/src/lib/rules/banned.js';
import { RULES, validateDeck, isRuleEnabled, bucketCounts } from '../web/src/lib/rules/validate.js';
import { COE, ruleRefs } from '../web/src/lib/rules/catalog.js';
import { isDropAllowed, resolveDropTarget } from '../web/src/lib/rules/dropTargets.js';
import { racesOf, singularize, matchesRace } from '../web/src/lib/rules/races.js';
import { buildGroups, TYPE_ORDER } from '../web/src/lib/deckList.js';
import { copyCaps, remainingCopies } from '../web/src/lib/rules/copies.js';
import { roleFor, DRAGON_MANIFESTATIONS } from '../web/src/lib/rules/roles.js';
import { siteIndex } from '../web/src/lib/rules/sites.js';

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
  it('avatars belong to the play deck and sideboard, never the pool (1.7)', () => {
    // 1.7: "a pool is a set of up to 10 NON-avatar characters".
    for (const c of cards.filter((x) => (x.attributes || {}).avatar === true)) {
      const z = zonesFor(c);
      expect(z.primary).toBe('deck');
      expect(z.extra).toEqual(['sideboard']);
      expect(isDropAllowed(c, 'pool')).toBe(false);
    }
  });
  it('minor items may sit in the pool (1.7)', () => {
    // BA-34 Elven Rope: Resource/Hero, subtype "Minor Item", non-unique.
    const z = zonesFor(index.get('BA-34'));
    expect(z.extra).toContain('pool');
    expect(isDropAllowed(index.get('BA-34'), 'pool')).toBe(true);
    // A non-item resource still may not.
    expect(isDropAllowed(index.get('TW-205'), 'pool')).toBe(false);
  });
  it('the six "in lieu of a minor item" permanent-events keep their pool slot', () => {
    for (const id of ['AS-94', 'BA-31', 'BA-44', 'BA-60', 'BA-70', 'WH-46']) {
      expect(zonesFor(index.get(id)).extra).toContain('pool');
    }
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
    // 1.3.F1 -- ordered (bucket, alignment) table, first match wins; hazards
    // match none of the four categories and fall through to the catch-all 3.
    expect(SIDES['fallen-wizard'].copies).toEqual([
      { bucket: 'resource', alignment: 'Stage', limit: 3 },
      { bucket: 'character', limit: 2 },
      { bucket: 'resource', alignment: 'Hero', limit: 2 },
      { bucket: 'resource', alignment: 'Minion', limit: 2 },
      { limit: 3 },
    ]);
    expect(SIDES.wizard.copies).toEqual([{ limit: 3 }]);
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
    expect(GENERAL.agentMindMax).toBe(36);
    expect(GENERAL.copiesDefault).toBe(3);
    expect(GENERAL.uniqueMax).toBe(1);
    expect(GENERAL.siteMax).toBe(1);
    expect(GENERAL.avatarMaxCopies).toBe(3);
    expect(GENERAL.avatarMaxDistinct).toBe(2);
    expect(GENERAL.avatarMaxInSideboard).toBe(1);
    expect(GENERAL.avatarMaxWithMultiples).toBe(1);
    expect(GENERAL.avatarMaxInPlayDeck).toBe(3);
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
  it('SPECIFIC-SIDE: a Balrog-specific card is illegal in a Ringwraith deck (1.3.4)', () => {
    // BA-4 Bolg: Character/Minion, specific "Balrog". Its alignment is legal
    // for a Ringwraith, so only 1.3.4 catches it.
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: { 'BA-4': 1 }, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'SPECIFIC-SIDE');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.specific).toBe('Balrog');
  });

  it('SPECIFIC-SIDE: the same card is fine in a Balrog deck', () => {
    const out = validateDeck({
      side: 'balrog', length: 'standard', tournament: true,
      quantities: { 'BA-4': 1 }, cardsById: index,
    });
    expect(out.filter((w) => w.ruleId === 'SPECIFIC-SIDE')).toEqual([]);
  });

  it('SPECIFIC-SIDE: a wizard-specific Stage card is fine for a Fallen-wizard', () => {
    // WH-90-style Stage resources naming a wizard are Fallen-wizard territory;
    // pick any Stage card carrying `specific`.
    const stage = cards.find((c) => c.alignment === 'Stage' && (c.attributes || {}).specific);
    const out = validateDeck({
      side: 'fallen-wizard', length: 'standard', tournament: true,
      quantities: { [stage.id]: 1 }, cardsById: index,
    });
    expect(out.filter((w) => w.ruleId === 'SPECIFIC-SIDE')).toEqual([]);
  });

  it('SPECIFIC-SIDE: BA-3 (the Balrog avatar) in a Wizard deck emits AVATAR-SIDE but not SPECIFIC-SIDE', () => {
    // BA-3 The Balrog is the one avatar carrying attributes.specific ("Balrog").
    // Without the !a.avatar guard, SPECIFIC-SIDE fires redundantly alongside
    // AVATAR-SIDE, which already reports the same mismatch better.
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      quantities: { 'BA-3': 1 }, cardsById: index,
    });
    expect(out.filter((w) => w.ruleId === 'AVATAR-SIDE')).toHaveLength(1);
    expect(out.filter((w) => w.ruleId === 'SPECIFIC-SIDE')).toEqual([]);
  });

  it('REGION-EXCLUDED: a Region card in the deck fires (1.4)', () => {
    const region = cards.find((c) => c.type === 'Region');
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      quantities: { [region.id]: 1 }, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'REGION-EXCLUDED');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.id).toBe(region.id);
  });
  it('AGENT-MIND: total mind of all agent cards over 36 fires (1.3.2)', () => {
    // Golodhros 9 + Baduila 8 + Elerina 8 + The Grimburgoth 8 = 33, plus
    // Dror 4 = 37, one over the limit.
    const over = { 'DM-14': 1, 'DM-2': 1, 'DM-7': 1, 'DM-15': 1, 'DM-6': 1 };
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: over, cardsById: index,
    });
    const hit = out.filter((w) => w.ruleId === 'AGENT-MIND');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ total: 37, max: 36 });
    expect(hit[0].severity).toBe('error');

    // Bill Ferny (mind 3) instead of Dror (4) lands exactly on 36 -- legal.
    const exact = { 'DM-14': 1, 'DM-2': 1, 'DM-7': 1, 'DM-15': 1, 'DM-3': 1 };
    const ok = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: exact, cardsById: index,
    });
    expect(ok.filter((w) => w.ruleId === 'AGENT-MIND')).toEqual([]);
  });

  it('AGENT-MIND counts agents in the sideboard and pool too (1.3.2)', () => {
    const out = validateDeck({
      side: 'ringwraith', length: 'standard', tournament: true,
      quantities: { 'DM-14': 1, 'DM-2': 1 },
      zones: { sideboard: { 'DM-7': 1, 'DM-15': 1 }, pool: { 'DM-6': 1 } },
      cardsById: index,
    });
    expect(out.find((w) => w.ruleId === 'AGENT-MIND').params.total).toBe(37);
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

  it('POOL-ITEMS.unique: a unique minor item in the pool fires (1.7)', () => {
    const uniq = cards.find((c) => (c.attributes || {}).subtype === 'Minor Item' && (c.attributes || {}).unique);
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool: { [uniq.id]: 1 } }, cardsById: index,
    });
    const hit = out.filter((w) => w.code === 'POOL-ITEMS.unique');
    expect(hit).toHaveLength(1);
    expect(hit[0].ruleId).toBe('POOL-ITEMS');
  });

  it('POOL-ITEMS.hoard: a hoard minor item in the pool fires (1.7)', () => {
    // AS-70 Jewel of Beleriand is a Minor Item keyworded "Hoard Item".
    const hoard = cards.find((c) => (c.attributes || {}).subtype === 'Minor Item'
      && ((c.attributes || {}).keywords || []).includes('Hoard Item')
      && !(c.attributes || {}).unique);
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool: { [hoard.id]: 1 } }, cardsById: index,
    });
    expect(out.filter((w) => w.code === 'POOL-ITEMS.hoard')).toHaveLength(1);
  });

  it('POOL-ITEMS.count: three pool items fire, two do not (1.7)', () => {
    const ok = cards.filter((c) => (c.attributes || {}).subtype === 'Minor Item'
      && !(c.attributes || {}).unique
      && !((c.attributes || {}).keywords || []).includes('Hoard Item')
      && c.alignment === 'Hero').slice(0, 3);
    expect(ok.length).toBe(3); // guard: the data must actually offer three
    const pool = Object.fromEntries(ok.map((c) => [c.id, 1]));
    const out = validateDeck({
      side: 'wizard', length: 'standard', tournament: true,
      zones: { sideboard: {}, pool }, cardsById: index,
    });
    const hit = out.filter((w) => w.code === 'POOL-ITEMS.count');
    expect(hit).toHaveLength(1);
    // side is kept in the params (not just count/max) -- a previous task
    // dropped it and shipped a warning that rendered a raw "{side}" token to
    // the user, which is why the i18n contract test exists.
    expect(hit[0].params).toEqual({ count: 3, max: 2, side: 'wizard' });
  });

  it('UNIQUE-LIMIT: exactly 2+ copies of a unique non-avatar card fire by default; 1 copy never does', () => {
    const uniqueCard = firstWhere((c) => c.attributes.unique === true && !c.attributes.avatar && c.type !== 'Site');
    const oneCopy = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1, [uniqueCard.id]: 1 },
    });
    // The limit is GENERAL.uniqueMax (1). copies.js's copyCaps supplies it
    // explicitly and validate.js echoes it into the warning's params as
    // limit/max/excess -- DeckPanel.jsx no longer derives excess itself, it
    // just spreads params through localizeParams.
    expect(byId(oneCopy, 'UNIQUE-LIMIT')).toHaveLength(0);

    const twoCopies = validateDeck({
      ...base,
      quantities: { [wizardAvatar.id]: 1, [uniqueCard.id]: 2 },
    });
    const hits = byId(twoCopies, 'UNIQUE-LIMIT');
    expect(hits).toHaveLength(1);
    expect(hits[0].params.id).toBe(uniqueCard.id);
    expect(hits[0].params.count).toBe(2);
    expect(hits[0].params.limit).toBe(1);
    expect(hits[0].params.max).toBe(1);
    expect(hits[0].params.excess).toBe(1); // validate.js: excess = used - cap.limit
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
  it('isRuleEnabled: no rule ships unverified any more, overrides flip a rule in both directions, and unknown/retired ids are ignored', () => {
    // Every rule in the catalogue now cites Council of Elrond section 1 (see
    // "every rule either cites CoE section 1..." below) or is an explicit
    // house rule, and every one of those is `status: 'verified'`. There is
    // no longer an unverified rule left in the catalogue to use as a
    // fixture for "unverified rules default off," so that half of this test
    // is unfixturable -- and that is a milestone, not a gap. It is pinned
    // here as a direct assertion instead: the day a rule ships unverified
    // again, this fails loudly, which is exactly when the old
    // defaultEnabled-false coverage should be restored.
    expect(RULES.some((r) => r.status === 'unverified')).toBe(false);

    // The override-flips-both-ways and unknown/retired-id-ignored behaviours
    // don't need an unverified fixture -- exercise them against ALIGN-LEGAL,
    // a verified (default-enabled) rule, plus a retired id (DECKSIZE-PLAY).
    expect(isRuleEnabled('ALIGN-LEGAL', {})).toBe(true);
    expect(isRuleEnabled('ALIGN-LEGAL', { 'ALIGN-LEGAL': false })).toBe(false);
    expect(isRuleEnabled('ALIGN-LEGAL', { 'ALIGN-LEGAL': true })).toBe(true);
    expect(isRuleEnabled('NO-SUCH-RULE', { 'NO-SUCH-RULE': true })).toBe(false); // unknown id ignored
    expect(isRuleEnabled('DECKSIZE-PLAY', { 'DECKSIZE-PLAY': true })).toBe(false); // retired id ignored
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

  it('every CoE-cited rule is severity error, and every house rule is severity warning (section 1 is hard legality)', () => {
    // AVATAR-UNIQUE used to be the exception that kept the house-implies-
    // warning half of this policy from being pinned: house:true but 'error',
    // because it also contradicted 1.5 and shipped disabled. It was retired
    // (replaced by four avatar-specific rules -- see the "AVATAR-UNIQUE is
    // retired" test below), so both halves of the policy now hold.
    for (const r of RULES) {
      if (ruleRefs(r).length > 0) expect(r.severity).toBe('error');
      if (r.house) expect(r.severity).toBe('warning');
    }
  });

  it('ruleRefs normalises single- and multi-clause rules', () => {
    expect(ruleRefs({ ref: '1.3.2' })).toEqual(['1.3.2']);
    expect(ruleRefs({ refs: ['1.4', '1.4.F1'] })).toEqual(['1.4', '1.4.F1']);
    expect(ruleRefs({ house: true })).toEqual([]);
    expect(ruleRefs(null)).toEqual([]);
  });

  it('AVATAR-UNIQUE and DECKSIZE-PLAY stay retired: both contradicted section 1 and were replaced, not revived', () => {
    // Both ids used to name real, catalogued rules that contradicted
    // section 1 and shipped disabled pending a fix ("lot 2"). Both fixes
    // have since landed: AVATAR-UNIQUE was replaced by four avatar-specific
    // rules (AVATAR-COUNT, AVATAR-MULTIPLES, AVATAR-SIDE, AVATAR-COPIES),
    // and this task replaced DECKSIZE-PLAY with the three play-deck budget
    // rules (DECKSIZE-RESOURCES, DECKSIZE-HAZARDS, DECKSIZE-CHARS) that
    // split 1.5's single 25-50 range into the four separate budgets it
    // actually describes. Neither id names a catalogue entry any more, so
    // isRuleEnabled returns false only because RULE_BY_ID has nothing to
    // find for them (see catalog.js) -- not because a contradictory rule
    // ships disabled. This pins that retirement rather than testing the
    // now-nonexistent disabled-contradictory-rule behaviour the old test
    // name described.
    expect(RULES.find((r) => r.id === 'AVATAR-UNIQUE')).toBeUndefined();
    expect(RULES.find((r) => r.id === 'DECKSIZE-PLAY')).toBeUndefined();
    expect(isRuleEnabled('AVATAR-UNIQUE', {})).toBe(false);
    expect(isRuleEnabled('DECKSIZE-PLAY', {})).toBe(false);
  });
});

describe('play-deck budgets (1.5)', () => {
  // 30 distinct non-unique Hero resources, one copy each, is the smallest legal
  // resource block; matching hazards make the deck legal.
  const pick = (fn, n) => cards.filter(fn).slice(0, n);
  const heroRes = pick((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique, 30);
  const haz = pick((c) => c.type === 'Hazard' && !(c.attributes || {}).unique && (c.attributes || {}).subtype === 'Creature', 30);
  const q = (list) => Object.fromEntries(list.map((c) => [c.id, 1]));
  const V = (quantities) => validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
  const of = (out, id) => out.filter((w) => w.ruleId === id);

  it('DECKSIZE-RESOURCES: 29 resources fires, 30 does not', () => {
    expect(of(V({ ...q(heroRes.slice(0, 29)), ...q(haz.slice(0, 29)) }), 'DECKSIZE-RESOURCES')).toHaveLength(1);
    expect(of(V({ ...q(heroRes), ...q(haz) }), 'DECKSIZE-RESOURCES')).toEqual([]);
  });

  it('DECKSIZE-HAZARDS: hazards must exactly equal resources', () => {
    const out = V({ ...q(heroRes), ...q(haz.slice(0, 29)) });
    const hit = of(out, 'DECKSIZE-HAZARDS');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ hazards: 29, resources: 30 });
    expect(of(V({ ...q(heroRes), ...q(haz) }), 'DECKSIZE-HAZARDS')).toEqual([]);
  });

  it('DECKSIZE-CHARS: eleven non-avatar characters fire, ten do not', () => {
    const chars = pick((c) => c.type === 'Character' && c.alignment === 'Hero' && !(c.attributes || {}).avatar, 11);
    expect(of(V({ ...q(heroRes), ...q(haz), ...q(chars) }), 'DECKSIZE-CHARS')).toHaveLength(1);
    expect(of(V({ ...q(heroRes), ...q(haz), ...q(chars.slice(0, 10)) }), 'DECKSIZE-CHARS')).toEqual([]);
  });

  it('a flexible hazard is counted whichever way keeps the deck legal (1.3.3)', () => {
    // 29 plain resources + 1 hazard-playable-as-resource + 30 hazards: counting
    // the flexible card as a resource satisfies both 30 resources and equality.
    const quantities = { ...q(heroRes.slice(0, 29)), 'TW-104': 1, ...q(haz) };
    const out = V(quantities);
    expect(of(out, 'DECKSIZE-RESOURCES')).toEqual([]);
    expect(of(out, 'DECKSIZE-HAZARDS')).toEqual([]);
  });

  it('a Wizard\'s agents count as hazards, not characters (1.3.W2)', () => {
    const { characters, hazards } = bucketCounts({ 'DM-3': 1 }, index, 'wizard');
    expect(characters).toBe(0);
    expect(hazards).toBe(1);
    const rw = bucketCounts({ 'DM-3': 1 }, index, 'ringwraith');
    expect(rw.characters).toBe(1);
    expect(rw.hazards).toBe(0);
  });

  it('DECKSIZE-PLAY is retired', () => {
    expect(RULES.find((r) => r.id === 'DECKSIZE-PLAY')).toBeUndefined();
  });

  it('CREATURE-MIN: twelve full creatures pass, eleven fire (1.5.1)', () => {
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 12);
    const q = (n) => Object.fromEntries(cre.slice(0, n).map((c) => [c.id, 1]));
    const V = (quantities) => validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(V(q(12)).filter((w) => w.ruleId === 'CREATURE-MIN')).toEqual([]);
    const hit = V(q(11)).filter((w) => w.ruleId === 'CREATURE-MIN');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toEqual({ count: 11, min: 12 });
  });

  it('CREATURE-MIN: halves are summed then rounded down (1.5.1)', () => {
    // 11 full creatures + one half = 11.5 -> 11, still short.
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 11);
    const quantities = { ...Object.fromEntries(cre.map((c) => [c.id, 1])), 'TW-86': 1 };
    const out = validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(out.find((w) => w.ruleId === 'CREATURE-MIN').params.count).toBe(11);
  });

  it('CREATURE-MIN: halves summed to exactly the minimum do not fire (1.5.1)', () => {
    // 11 full creatures + two distinct halves = 11 + 1.0 = 12.0 -> meets the minimum.
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 11);
    const quantities = { ...Object.fromEntries(cre.map((c) => [c.id, 1])), 'TW-86': 1, 'DM-110': 1 };
    const out = validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(out.filter((w) => w.ruleId === 'CREATURE-MIN')).toEqual([]);
  });

  it('CREATURE-MIN: halves rounded down past the minimum do not fire (1.5.1)', () => {
    // 11 full creatures + three distinct halves = 11 + 1.5 = 12.5 -> floors to 12.
    const cre = cards.filter((c) => (c.attributes || {}).subtype === 'Creature' && !(c.attributes || {}).unique).slice(0, 11);
    const quantities = { ...Object.fromEntries(cre.map((c) => [c.id, 1])), 'TW-86': 1, 'DM-110': 1, 'TW-2': 1 };
    const out = validateDeck({ side: 'wizard', length: 'standard', tournament: true, quantities, cardsById: index });
    expect(out.filter((w) => w.ruleId === 'CREATURE-MIN')).toEqual([]);
  });
});

describe('avatar rules (1.5, 1.6, 1.6.2)', () => {
  const V = (quantities, zones = {}) => validateDeck({
    side: 'wizard', length: 'standard', tournament: true,
    quantities, zones, cardsById: index,
  });
  const ids = (out, ruleId) => out.filter((w) => w.ruleId === ruleId);

  it('three copies of one avatar in the play deck is legal', () => {
    const out = V({ 'TW-156': 3 }); // Gandalf
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]);
    expect(ids(out, 'AVATAR-COPIES')).toEqual([]);
    expect(ids(out, 'AVATAR-MULTIPLES')).toEqual([]);
  });

  it('two different avatars, one duplicated, is legal', () => {
    const out = V({ 'TW-156': 2, 'TW-181': 1 }); // 2 Gandalf + 1 Saruman
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]);
  });

  it('AVATAR-COUNT.distinct: three different avatars in the play deck fires', () => {
    const out = V({ 'TW-156': 1, 'TW-181': 1, 'TW-178': 1 });
    const hit = ids(out, 'AVATAR-COUNT');
    expect(hit).toHaveLength(1);
    expect(hit[0].code).toBe('AVATAR-COUNT.distinct');
    expect(hit[0].params.distinct).toBe(3);
  });

  it('AVATAR-COUNT.total: four avatar copies in the play deck fires', () => {
    const out = V({ 'TW-156': 3, 'TW-181': 1 });
    const codes = ids(out, 'AVATAR-COUNT').map((w) => w.code);
    expect(codes).toContain('AVATAR-COUNT.total');
  });

  it('AVATAR-COPIES: a fourth copy across play deck and sideboard fires (1.6)', () => {
    // Caps are cumulative: 3 in the play deck leaves nothing for the sideboard.
    const out = V({ 'TW-156': 3 }, { sideboard: { 'TW-156': 1 }, pool: {} });
    const hit = ids(out, 'AVATAR-COPIES');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toMatchObject({ id: 'TW-156', count: 4, max: 3 });
  });

  it('AVATAR-SIDEBOARD: two copies of one avatar in the sideboard fires (1.6.2)', () => {
    const out = V({}, { sideboard: { 'TW-156': 2 }, pool: {} });
    const hit = ids(out, 'AVATAR-SIDEBOARD');
    expect(hit).toHaveLength(1);
    expect(hit[0].params).toMatchObject({ id: 'TW-156', count: 2, max: 1 });
  });

  it('AVATAR-SIDEBOARD: any number of distinct avatars in the sideboard is legal', () => {
    const out = V({}, { sideboard: { 'TW-156': 1, 'TW-181': 1, 'TW-178': 1, 'TW-117': 1 }, pool: {} });
    expect(ids(out, 'AVATAR-SIDEBOARD')).toEqual([]);
    expect(ids(out, 'AVATAR-COUNT')).toEqual([]); // 1.5 is play-deck-scoped
  });

  it('AVATAR-MULTIPLES: two avatars each split across play deck and sideboard fires', () => {
    // Gandalf 1+1 = multiples; Saruman 1+1 = multiples. Only one is allowed.
    const out = V(
      { 'TW-156': 1, 'TW-181': 1 },
      { sideboard: { 'TW-156': 1, 'TW-181': 1 }, pool: {} },
    );
    const hit = ids(out, 'AVATAR-MULTIPLES');
    expect(hit).toHaveLength(1);
    expect(hit[0].params.count).toBe(2);
  });

  it('AVATAR-MULTIPLES: one avatar with multiples is legal', () => {
    const out = V({ 'TW-156': 2, 'TW-181': 1 }, { sideboard: { 'TW-181': 0 }, pool: {} });
    expect(ids(out, 'AVATAR-MULTIPLES')).toEqual([]);
  });

  it('AVATAR-UNIQUE is retired', () => {
    expect(RULES.find((r) => r.id === 'AVATAR-UNIQUE')).toBeUndefined();
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

describe('copyCaps / remainingCopies', () => {
  const ctx = (side) => ({ side, ruleOverrides: {} });
  const state = (quantities = {}, sideboard = {}, pool = {}) => ({ quantities, zones: { sideboard, pool } });

  it('a non-unique card is capped at three, cumulative across zones (1.3.1, 1.6)', () => {
    const c = index.get('TW-104'); // Tookish Blood, non-unique hazard
    const caps = copyCaps(c, ctx('wizard'));
    expect(caps).toEqual([{ limit: 3, scope: 'total', ruleId: 'COPIES-LIMIT' }]);
    // 2 in the deck + 1 in the sideboard leaves nothing anywhere.
    const s = state({ 'TW-104': 2 }, { 'TW-104': 1 });
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'sideboard', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'pool', s, ctx('wizard')).remaining).toBe(0);
  });

  it('a unique card is capped at one across every zone (1.3.1)', () => {
    const c = cards.find((x) => (x.attributes || {}).unique && x.type === 'Resource' && x.alignment === 'Hero');
    expect(copyCaps(c, ctx('wizard'))[0]).toMatchObject({ limit: 1, scope: 'total', ruleId: 'UNIQUE-LIMIT' });
    // Held in the pool -> the deck cannot take one.
    const s = state({}, {}, { [c.id]: 1 });
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(c, 'deck', s, ctx('wizard')).ruleId).toBe('UNIQUE-LIMIT');
  });

  it('a non-haven site is capped at one; a haven of the side is uncapped (1.4)', () => {
    const site = index.get('TW-374'); // Barad-dur, Site/Hero, {D}
    expect(copyCaps(site, ctx('wizard'))[0]).toMatchObject({ limit: 1, ruleId: 'SITE-COPIES' });
    const haven = index.get('TW-421'); // Rivendell, Site/Hero, {H}
    expect(copyCaps(haven, ctx('wizard'))).toEqual([]);
    expect(remainingCopies(haven, 'deck', state({ 'TW-421': 9 }), ctx('wizard')).remaining).toBe(Infinity);
    // The same haven is not unlimited for a side whose location deck cannot
    // hold Hero sites.
    expect(copyCaps(haven, ctx('ringwraith'))[0]).toMatchObject({ limit: 1, ruleId: 'SITE-COPIES' });
  });

  it('an avatar carries two caps: three in total, one in the sideboard (1.5, 1.6, 1.6.2)', () => {
    const g = index.get('TW-156'); // Gandalf
    const caps = copyCaps(g, ctx('wizard'));
    expect(caps).toEqual([
      { limit: 3, scope: 'total', ruleId: 'AVATAR-COPIES' },
      { limit: 1, scope: { zone: 'sideboard' }, ruleId: 'AVATAR-SIDEBOARD' },
    ]);
    // 3 in the play deck spends the whole allowance.
    const full = state({ 'TW-156': 3 });
    expect(remainingCopies(g, 'deck', full, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(g, 'sideboard', full, ctx('wizard')).remaining).toBe(0);
    // 2 in the play deck: one more may go to either zone, but the sideboard
    // sub-cap stops a second one there.
    const two = state({ 'TW-156': 2 });
    expect(remainingCopies(g, 'sideboard', two, ctx('wizard')).remaining).toBe(1);
    const split = state({ 'TW-156': 1 }, { 'TW-156': 1 });
    expect(remainingCopies(g, 'sideboard', split, ctx('wizard'))).toEqual({ remaining: 0, ruleId: 'AVATAR-SIDEBOARD' });
    expect(remainingCopies(g, 'deck', split, ctx('wizard')).remaining).toBe(1);
  });

  it('a zone cap does not constrain a different zone', () => {
    const g = index.get('TW-156');
    // One in the sideboard: the sideboard is full, the deck still has room.
    const s = state({}, { 'TW-156': 1 });
    expect(remainingCopies(g, 'sideboard', s, ctx('wizard')).remaining).toBe(0);
    expect(remainingCopies(g, 'deck', s, ctx('wizard')).remaining).toBe(2);
  });

  it('disabling a rule removes its cap', () => {
    const c = index.get('TW-104');
    const off = { side: 'wizard', ruleOverrides: { 'COPIES-LIMIT': false } };
    expect(copyCaps(c, off)).toEqual([]);
    expect(remainingCopies(c, 'deck', state({ 'TW-104': 9 }), off).remaining).toBe(Infinity);
  });

  it('Fallen-wizard copy limits follow the side profile', () => {
    const heroRes = cards.find((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique);
    expect(copyCaps(heroRes, ctx('fallen-wizard'))[0].limit).toBe(2);
    const stage = cards.find((c) => c.alignment === 'Stage' && !(c.attributes || {}).unique);
    expect(copyCaps(stage, ctx('fallen-wizard'))[0].limit).toBe(3);
  });

  it('Fallen-wizard copy limits follow 1.3.F1 per category', () => {
    const ctxFw = { side: 'fallen-wizard', ruleOverrides: {} };
    const lim = (id) => copyCaps(index.get(id), ctxFw)[0].limit;
    const find = (fn) => cards.find(fn);
    // Non-unique Stage resource: 3
    expect(lim(find((c) => c.alignment === 'Stage' && c.type === 'Resource' && !(c.attributes || {}).unique).id)).toBe(3);
    // Non-unique character: 2
    expect(lim(find((c) => c.type === 'Character' && !(c.attributes || {}).unique && !(c.attributes || {}).avatar && !(c.attributes || {}).agent).id)).toBe(2);
    // Non-unique hero resource: 2
    expect(lim(find((c) => c.type === 'Resource' && c.alignment === 'Hero' && !(c.attributes || {}).unique).id)).toBe(2);
    // Non-unique minion resource: 2
    expect(lim(find((c) => c.type === 'Resource' && c.alignment === 'Minion' && !(c.attributes || {}).unique).id)).toBe(2);
    // Non-unique HAZARD: 3 -- 1.3.F1 says nothing about hazards, so 1.3.1's
    // general limit applies. The old `default: 2` capped these at 2.
    expect(lim(find((c) => c.type === 'Hazard' && !(c.attributes || {}).unique && !(c.attributes || {}).agent && !(c.attributes || {}).playableAsResource).id)).toBe(3);
  });

  it('a Fallen-wizard non-Orc, non-Troll character still caps at 2 via 1.3.F5 aliasing', () => {
    // 1.3.F5 reads such a character as Hero; the character rule matches first,
    // so the limit is 2 either way -- the alias must not raise it to 3.
    const c = cards.find((x) => x.type === 'Character' && x.alignment === 'Minion'
      && !(x.attributes || {}).avatar && !(x.attributes || {}).agent && !(x.attributes || {}).unique
      && !['Orc', 'Troll'].some((r) => matchesRace((x.attributes || {}).race, r)));
    expect(copyCaps(c, { side: 'fallen-wizard', ruleOverrides: {} })[0].limit).toBe(2);
  });

  it('the other three sides cap every non-unique card at 3', () => {
    for (const side of ['wizard', 'ringwraith', 'balrog']) {
      const c = cards.find((x) => x.type === 'Hazard' && !(x.attributes || {}).unique);
      expect(copyCaps(c, { side, ruleOverrides: {} })[0].limit).toBe(3);
    }
  });

  it('an unknown side or a missing card yields no cap rather than throwing', () => {
    expect(copyCaps(index.get('TW-104'), ctx('constructor'))).toEqual([]);
    expect(copyCaps(null, ctx('wizard'))).toEqual([]);
    expect(remainingCopies(null, 'deck', state(), ctx('wizard')).remaining).toBe(Infinity);
  });

  it('never throws over every card and side', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      for (const c of cards) {
        const caps = copyCaps(c, ctx(side));
        expect(Array.isArray(caps)).toBe(true);
        for (const cap of caps) {
          expect(cap.limit).toBeGreaterThan(0);
          expect(typeof cap.ruleId).toBe('string');
        }
        expect(remainingCopies(c, 'deck', state(), ctx(side)).remaining).toBeGreaterThan(0);
      }
    }
  });
});

describe('cap/warning agreement', () => {
  it('the cap and the warning agree: the count that blocks is the count that reports', () => {
    // Every 7th card keeps the runtime sane while still covering all types,
    // alignments and both cap scopes.
    const sample = cards.filter((_, i) => i % 7 === 0);
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      const ctx = { side, ruleOverrides: {} };
      for (const c of sample) {
        const totalCaps = copyCaps(c, ctx).filter((cap) => cap.scope === 'total');
        if (totalCaps.length === 0) continue;
        const limit = Math.min(...totalCaps.map((cap) => cap.limit));
        const at = validateDeck({
          side, length: 'standard', tournament: true,
          quantities: { [c.id]: limit }, cardsById: index,
        });
        const over = validateDeck({
          side, length: 'standard', tournament: true,
          quantities: { [c.id]: limit + 1 }, cardsById: index,
        });
        const capIds = new Set(['COPIES-LIMIT', 'UNIQUE-LIMIT', 'SITE-COPIES', 'AVATAR-COPIES']);
        const capWarns = (out) => out.filter((w) => capIds.has(w.ruleId));
        // At the limit: no copy warning, and the counter says zero left.
        expect(capWarns(at)).toEqual([]);
        expect(remainingCopies(c, 'deck', { quantities: { [c.id]: limit }, zones: {} }, ctx).remaining).toBe(0);
        // One over: exactly the rule that produced the cap reports.
        expect(capWarns(over).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('roleFor (1.3.W2/R2/B2, 1.3.F2, 1.3.F5, 1.5.1)', () => {
  it('an agent character is a hazard for Wizard and Balrog, a character for the others', () => {
    const agent = index.get('DM-3'); // Bill Ferny, Character/Minion, agent
    expect(roleFor(agent, 'wizard').bucket).toBe('hazard');
    expect(roleFor(agent, 'balrog').bucket).toBe('hazard');
    expect(roleFor(agent, 'ringwraith').bucket).toBe('character');
    expect(roleFor(agent, 'fallen-wizard').bucket).toBe('character');
  });

  it('an agent counting as a hazard is worth half a creature (1.5.1)', () => {
    const agent = index.get('DM-3');
    expect(roleFor(agent, 'wizard').creatureWeight).toBe(0.5);
    expect(roleFor(agent, 'ringwraith').creatureWeight).toBe(0);
  });

  it('the two Hazard-type agents stay hazards on every side', () => {
    // 1.3.R2 speaks of agent CHARACTER cards; DM-28 and DM-29 are hazards.
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(roleFor(index.get('DM-28'), side).bucket).toBe('hazard');
    }
  });

  it('creature weights follow 1.5.1 without double counting', () => {
    const w = (id, side = 'wizard') => roleFor(index.get(id), side).creatureWeight;
    expect(w('DM-107')).toBe(1);    // Durin's Bane, subtype "Creature"
    expect(w('TW-86')).toBe(0.5);   // Shelob, Creature/Permanent-event
    expect(w('DM-110')).toBe(0.5);  // Spider of the Morlat, Creature/Permanent-event + spawn
    expect(w('TW-12')).toBe(0.5);   // Balrog of Moria, Permanent-event + spawn
    expect(w('TD-1')).toBe(0.5);    // Agburanar Ahunt
    expect(w('TD-2')).toBe(0.5);    // Agburanar at Home
    expect(w('TD-143')).toBe(0);    // "Not at Home" -- not a manifestation
    expect(w('AS-71')).toBe(0);     // The Balrog, an Ally RESOURCE with Spawn
  });

  it('DRAGON_MANIFESTATIONS holds the 18 curated ids and excludes TD-143', () => {
    expect(DRAGON_MANIFESTATIONS.size).toBe(18);
    expect(DRAGON_MANIFESTATIONS.has('TD-143')).toBe(false);
    for (const id of DRAGON_MANIFESTATIONS) expect(index.get(id)).toBeDefined();
  });

  it('a hazard playable as a resource is flexible, capped at two for Fallen-wizard (1.3.3, 1.3.F2)', () => {
    const c = index.get('TW-104'); // Tookish Blood
    expect(roleFor(c, 'wizard').flexible).toEqual({ alt: 'resource', maxAsAlt: null });
    expect(roleFor(c, 'fallen-wizard').flexible).toEqual({ alt: 'resource', maxAsAlt: 2 });
  });

  it('a resource playable as a hazard is flexible with no Fallen-wizard cap', () => {
    // 1.3.F2 constrains only hazards playable as resources.
    expect(roleFor(index.get('LE-235'), 'fallen-wizard').flexible).toEqual({ alt: 'hazard', maxAsAlt: null });
  });

  it('Fallen-wizard non-Orc, non-Troll characters read as Hero (1.3.F5)', () => {
    const troll = index.get('AS-1');  // Burat, race Troll, Minion
    const other = cards.find((c) => c.type === 'Character' && c.alignment === 'Minion'
      && !(c.attributes || {}).avatar
      && !['Orc', 'Troll'].some((r) => matchesRace((c.attributes || {}).race, r)));
    expect(roleFor(troll, 'fallen-wizard').effectiveAlignment).toBe('Minion');
    expect(roleFor(other, 'fallen-wizard').effectiveAlignment).toBe('Hero');
    expect(roleFor(other, 'ringwraith').effectiveAlignment).toBe('Minion');
  });

  it('sites, regions and avatars get their own buckets', () => {
    expect(roleFor(index.get('TW-421'), 'wizard').bucket).toBe('site');
    expect(roleFor(cards.find((c) => c.type === 'Region'), 'wizard').bucket).toBe('region');
    expect(roleFor(index.get('TW-156'), 'wizard').bucket).toBe('avatar');
  });

  it('never throws and always yields a bucket over every card and side', () => {
    const buckets = new Set(['avatar', 'character', 'resource', 'hazard', 'site', 'region']);
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      for (const c of cards) {
        const r = roleFor(c, side);
        expect(buckets.has(r.bucket)).toBe(true);
        expect([0, 0.5, 1]).toContain(r.creatureWeight);
        expect(typeof r.effectiveAlignment).toBe('string');
      }
    }
  });
});

describe('location deck (1.4, 1.4.1, 1.4.W1/R1/F1/B1)', () => {
  const V = (side, quantities) => validateDeck({ side, length: 'standard', tournament: true, quantities, cardsById: index });
  const of = (out, id) => out.filter((w) => w.ruleId === id);

  it('the five open Balrog sites derive exactly as 1.4.1 names them', () => {
    const { openBalrog } = siteIndex(cards);
    expect([...openBalrog].sort()).toEqual(['BA-104', 'BA-83', 'BA-89', 'BA-95', 'BA-96']);
  });

  it('SITE-SIDE: a Minion site is illegal in a Wizard location deck (1.4.W1)', () => {
    expect(of(V('wizard', { 'LE-352': 1 }), 'SITE-SIDE')).toHaveLength(1);
    expect(of(V('ringwraith', { 'LE-352': 1 }), 'SITE-SIDE')).toEqual([]);
  });

  it('SITE-SIDE: the five open Balrog sites are legal for every side (1.4.1)', () => {
    for (const side of ['wizard', 'ringwraith', 'fallen-wizard', 'balrog']) {
      expect(of(V(side, { 'BA-83': 1 }), 'SITE-SIDE')).toEqual([]);
    }
  });

  it('SITE-SIDE: a Fallen-wizard location deck takes hero AND minion sites (1.4.F1)', () => {
    expect(of(V('fallen-wizard', { 'TW-374': 1, 'LE-352': 1 }), 'SITE-SIDE')).toEqual([]);
  });

  it('SITE-COPIES: Fallen-wizard sites may be repeated (1.4.F1)', () => {
    // WH-55 Deep Mines is {R}, not a haven, so the haven exemption misses it.
    expect(of(V('fallen-wizard', { 'WH-55': 3 }), 'SITE-COPIES')).toEqual([]);
    expect(copyCaps(index.get('WH-55'), { side: 'fallen-wizard', ruleOverrides: {} })).toEqual([]);
  });

  it('SITE-COPIES: a haven is unlimited only for a side that may hold its alignment', () => {
    expect(of(V('wizard', { 'TW-421': 4 }), 'SITE-COPIES')).toEqual([]);      // Rivendell, Hero
    expect(of(V('ringwraith', { 'LE-359': 4 }), 'SITE-COPIES')).toEqual([]);  // Carn Dum, Minion
  });
});
