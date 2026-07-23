import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards } from '../web/src/lib/parseCards.js';
import {
  isStampable,
  isLightFrame,
  labelColor,
  rectForLang,
  rectFor,
  cloneSrcFor,
  PROXY_RECT,
  PROXY_RECT_SITE_FR,
  CLONE_SRC,
  CLONE_SRC_SITE,
  PROXY_LABEL,
  LABEL_ON_DARK,
  LABEL_ON_LIGHT,
} from '../web/src/lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'web', 'public', 'cards.json');

async function loadCards() {
  return flattenCards(JSON.parse(await readFile(CARDS_JSON, 'utf-8')));
}

describe('isStampable', () => {
  it('stamps every non-Region card and skips Regions, across all 1683 cards', async () => {
    const cards = await loadCards();
    expect(cards.length).toBe(1683);
    for (const c of cards) {
      expect(isStampable(c)).toBe(c.type !== 'Region');
    }
    // 52 Region cards are the only ones skipped.
    expect(cards.filter((c) => !isStampable(c)).length).toBe(52);
  });

  it('is null-safe', () => {
    expect(isStampable(null)).toBe(false);
    expect(isStampable(undefined)).toBe(false);
    expect(isStampable({ type: 'Character' })).toBe(true);
    expect(isStampable({ type: 'Region' })).toBe(false);
  });
});

describe('isLightFrame / labelColor', () => {
  it('marks the light-framed categories, and only those', async () => {
    const cards = await loadCards();
    const byId = new Map(cards.map((c) => [c.id, c]));
    const light = (id) => isLightFrame(byId.get(id));
    // hero characters, hero sites, fallen-wizard sites → light
    expect(light('BA-1')).toBe(true); // Strider (hero character)
    const heroSite = cards.find((c) => c.type === 'Site' && c.alignment === 'Hero');
    expect(isLightFrame(heroSite)).toBe(true);
    expect(light('WH-55')).toBe(true); // Deep Mines (fallen-wizard site)
    // the pale-stone wizards (both Wizard and Fallen-wizard versions) → light
    for (const id of ['TW-117', 'TW-156', 'TW-178', 'TW-181', 'WH-1', 'WH-4', 'WH-8', 'WH-9']) {
      expect(light(id)).toBe(true); // alatar/gandalf/radagast/saruman
    }
    // Pallando (indigo), reds, minions, hazards, resources → NOT light
    expect(light('TW-175')).toBe(false); // Pallando
    expect(light('WH-7')).toBe(false); // Pallando (fallen)
    expect(light('LE-50')).toBe(false); // a Ringwraith
    expect(light('BA-3')).toBe(false); // The Balrog
    expect(light('AS-1')).toBe(false); // Bûrat (minion character)
    const balrogSite = cards.find((c) => c.type === 'Site' && c.alignment === 'Balrog');
    expect(isLightFrame(balrogSite)).toBe(false);
    const hazard = cards.find((c) => c.type === 'Hazard');
    expect(isLightFrame(hazard)).toBe(false);
  });

  it('labelColor picks the dark label on light frames', () => {
    expect(labelColor({ type: 'Character', alignment: 'Hero' })).toBe(LABEL_ON_LIGHT);
    expect(labelColor({ type: 'Character', alignment: 'Minion' })).toBe(LABEL_ON_DARK);
    expect(labelColor(null)).toBe(LABEL_ON_DARK);
  });
});

// A source rect never shares pixels with the covered rect: either it is a clean
// strip beside the zone (x-disjoint) or a clean row above it (y-disjoint).
function disjoint(s, r) {
  const xGap = s.x + s.w <= r.x || s.x >= r.x + r.w;
  const yGap = s.y + s.h <= r.y || s.y >= r.y + r.h;
  return xGap || yGap;
}

describe('geometry', () => {
  it('exposes sane fractional cover rects and a matching (default) clone source', () => {
    for (const lang of ['en', 'es', 'fr']) {
      const r = rectForLang(lang);
      const s = cloneSrcFor(null, lang); // non-site → same-row strip beside the zone
      for (const k of ['x', 'y', 'w', 'h']) {
        expect(r[k]).toBeGreaterThan(0);
        expect(r[k]).toBeLessThan(1);
        expect(s[k]).toBeGreaterThan(0);
        expect(s[k]).toBeLessThan(1);
      }
      expect(r.x + r.w).toBeLessThan(1);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
      // Default source shares the covered row, so it must be x-disjoint.
      expect(s.y).toBe(r.y);
      expect(s.h).toBe(r.h);
      expect(disjoint(s, r)).toBe(true);
    }
  });

  it('gives torn-edge sites a clean higher strip that clears the black edge', async () => {
    const cards = await loadCards();
    const byId = new Map(cards.map((c) => [c.id, c]));
    for (const lang of ['en', 'es', 'fr']) {
      // Hero site (AS-137 Cirith Gorgor) and fallen-wizard site (WH-55 Deep Mines).
      for (const id of ['AS-137', 'WH-55']) {
        const s = cloneSrcFor(byId.get(id), lang);
        expect(s).toEqual(CLONE_SRC_SITE);
        expect(disjoint(s, rectForLang(lang))).toBe(true);
      }
      // A minion character keeps the same-row default (not a torn site).
      const s = cloneSrcFor(byId.get('AS-1'), lang);
      expect(s).not.toEqual(CLONE_SRC_SITE);
      expect(s.y).toBe(rectForLang(lang).y);
    }
  });

  it('drops the covered rect for FR torn-edge sites to clear the number box', async () => {
    const cards = await loadCards();
    const byId = new Map(cards.map((c) => [c.id, c]));
    const heroSite = byId.get('AS-137'); // Cirith Gorgor
    const fwSite = byId.get('WH-55'); // Deep Mines
    // FR: hero & fallen-wizard sites use the lowered rect (top below the box).
    expect(rectFor(heroSite, 'fr')).toBe(PROXY_RECT_SITE_FR);
    expect(rectFor(fwSite, 'fr')).toBe(PROXY_RECT_SITE_FR);
    expect(PROXY_RECT_SITE_FR.y).toBeGreaterThan(PROXY_RECT.fr.y);
    // en/es sites and non-sites keep the base rect for the language.
    expect(rectFor(heroSite, 'en')).toBe(PROXY_RECT.enes);
    expect(rectFor(heroSite, 'es')).toBe(PROXY_RECT.enes);
    expect(rectFor(byId.get('AS-1'), 'fr')).toBe(PROXY_RECT.fr); // minion character
    // The lowered rect still clears the clone source (source sits well above it).
    expect(disjoint(CLONE_SRC_SITE, PROXY_RECT_SITE_FR)).toBe(true);
  });

  it('routes fr vs en/es correctly', () => {
    expect(rectForLang('fr')).toBe(PROXY_RECT.fr);
    expect(rectForLang('en')).toBe(PROXY_RECT.enes);
    expect(rectForLang('es')).toBe(PROXY_RECT.enes);
    expect(rectForLang(undefined)).toBe(PROXY_RECT.enes);
    expect(cloneSrcFor(null, 'fr').x).toBe(CLONE_SRC.fr.x);
    expect(cloneSrcFor(null, 'en').x).toBe(CLONE_SRC.enes.x);
    expect(PROXY_LABEL).toBe('Proxy');
  });
});
