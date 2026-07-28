import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards } from '../web/src/lib/parseCards.js';
import {
  swatchKeyForCard, PROXY_PATCH_RECT, PROXY_LABEL, SWATCH_KEYS,
  PROXY_LABEL_COLOR, PROXY_LABEL_FONT_FRAC, PROXY_LABEL_POS,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../web/src/lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'web', 'public', 'cards.json');

async function loadCards() {
  return flattenCards(JSON.parse(await readFile(CARDS_JSON, 'utf-8')));
}

describe('swatchKeyForCard', () => {
  it('classifies every card as a valid key or null, never throws', async () => {
    const cards = await loadCards();
    expect(cards.length).toBe(1683);
    const valid = new Set(SWATCH_KEYS);
    for (const c of cards) {
      const key = swatchKeyForCard(c);
      if (c.type === 'Region') expect(key).toBeNull();
      else expect(key === null || valid.has(key)).toBe(true);
    }
    // every non-Region card must get a stamp (no silent null gaps)
    const unstamped = cards.filter((c) => c.type !== 'Region' && swatchKeyForCard(c) === null);
    expect(unstamped.map((c) => c.id)).toEqual([]);
  });

  it('classifies the verified reference cards', async () => {
    const cards = await loadCards();
    const byId = new Map(cards.map((c) => [c.id, c]));
    const key = (id) => swatchKeyForCard(byId.get(id));
    // wizards: TW frame == WH (fallen) frame
    expect(key('TW-156')).toBe('gandalf');
    expect(key('WH-4')).toBe('gandalf');
    expect(key('TW-181')).toBe('saruman');
    expect(key('WH-9')).toBe('saruman');
    expect(key('TW-117')).toBe('alatar');
    expect(key('TW-175')).toBe('pallando');
    expect(key('TW-178')).toBe('radagast');
    // ringwraiths + the Balrog character share one red frame
    expect(key('LE-50')).toBe('red');
    expect(key('LE-58')).toBe('red');
    expect(key('BA-3')).toBe('red');
    // sites: the 22 Site/Balrog must NOT be red
    const balrogSite = cards.find((c) => c.type === 'Site' && c.alignment === 'Balrog');
    expect(swatchKeyForCard(balrogSite)).toBe('balrog-site');
    expect(key('WH-55')).toBe('fw-site');
    // dual resources are mapped by name
    expect(key('LE-245')).toBe('minion-resource'); // Tidings of Death
    expect(key('LE-419')).toBe('minion-resource'); // Deadly Dart
    expect(key('WH-38')).toBe('hero-resource');    // Beasts of the Wood
    expect(key('WH-40')).toBe('hero-resource');    // Wild Hounds
    // the 10 plain type keys
    expect(key('AS-1')).toBe('minion-character');  // Bûrat
    expect(key('BA-1')).toBe('hero-character');    // Strider
    const stage = cards.find((c) => c.type === 'Resource' && c.alignment === 'Stage');
    expect(swatchKeyForCard(stage)).toBe('stage-resource');
    const hazard = cards.find((c) => c.type === 'Hazard');
    expect(swatchKeyForCard(hazard)).toBe('hazard');
    const region = cards.find((c) => c.type === 'Region');
    expect(swatchKeyForCard(region)).toBeNull();
  });
});

describe('geometry', () => {
  it('exposes one fractional draw rect inside the card', () => {
    const r = PROXY_PATCH_RECT;
    for (const k of ['x', 'y', 'w', 'h']) {
      expect(r[k]).toBeGreaterThan(0);
      expect(r[k]).toBeLessThan(1);
    }
    expect(r.x + r.w).toBeLessThan(1);
    expect(r.y + r.h).toBeLessThanOrEqual(1);
    expect(PROXY_LABEL).toBe('Proxy');
    expect(SWATCH_KEYS).toHaveLength(16);
  });

  it('covers the measured copyright and set-name extents in every language', () => {
    const r = PROXY_PATCH_RECT;
    // en/es "(c)19xx Tolkien Enterprises" and the widest fr set name
    const notices = [
      { x0: 0.1632, x1: 0.4246, y0: 0.951, y1: 0.971 },
      { x0: 0.1789, x1: 0.3561, y0: 0.942, y1: 0.957 },
    ];
    for (const n of notices) {
      expect(r.x).toBeLessThan(n.x0);
      expect(r.x + r.w).toBeGreaterThan(n.x1);
      expect(r.y).toBeLessThan(n.y0);
      expect(r.y + r.h).toBeGreaterThan(n.y1);
    }
  });

  it('stops short of the fr "Remastérisé" credit', () => {
    // First glyph of "Remastérisé - Traduction non officielle" on fr cards.
    // Overlapping it clips the R — the defect this rect was recalibrated for.
    expect(PROXY_PATCH_RECT.x + PROXY_PATCH_RECT.w).toBeLessThan(0.4684);
  });

  it('centres the label horizontally in the draw rect', () => {
    expect(PROXY_LABEL_POS.cx).toBeCloseTo(PROXY_PATCH_RECT.x + PROXY_PATCH_RECT.w / 2, 6);
  });

  it('derives the css container-query units from the rect', () => {
    expect(PROXY_LABEL_FONT_CQW).toBeCloseTo((PROXY_LABEL_FONT_FRAC / PROXY_PATCH_RECT.w) * 100, 6);
    const boxMid = PROXY_PATCH_RECT.y + PROXY_PATCH_RECT.h / 2;
    expect(PROXY_LABEL_DY_CQH).toBeCloseTo(((PROXY_LABEL_POS.cy - boxMid) / PROXY_PATCH_RECT.h) * 100, 6);
  });

  it('gives every key exactly one of the two allowed label colours', () => {
    expect(Object.keys(PROXY_LABEL_COLOR).sort()).toEqual([...SWATCH_KEYS].sort());
    for (const key of SWATCH_KEYS) {
      expect(['#191919', '#F0F0EA']).toContain(PROXY_LABEL_COLOR[key]);
    }
  });

  it('selects the fr patch variant only for fr', () => {
    expect(patchUrl('hazard', 'fr')).toBe('/proxy-patches/hazard-fr.png');
    expect(patchUrl('hazard', 'en')).toBe('/proxy-patches/hazard.png');
    expect(patchUrl('hazard', 'es')).toBe('/proxy-patches/hazard.png');
    expect(patchUrl('hazard', undefined)).toBe('/proxy-patches/hazard.png');
  });
});
