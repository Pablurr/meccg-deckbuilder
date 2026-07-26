import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';
import { zonesFor } from '../web/src/lib/rules/zones.js';
import { SIDES, isLegalForSide } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';

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
