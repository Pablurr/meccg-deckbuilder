import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards } from '../web/src/lib/parseCards.js';
import { swatchKeyForCard, rectForLang, PROXY_RECT, PROXY_LABEL, SWATCH_KEYS } from '../web/src/lib/proxy.js';

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
  it('exposes sane fractional rects and label', () => {
    for (const r of [PROXY_RECT.enes, PROXY_RECT.fr]) {
      for (const k of ['x', 'y', 'w', 'h']) {
        expect(r[k]).toBeGreaterThan(0);
        expect(r[k]).toBeLessThan(1);
      }
      expect(r.x + r.w).toBeLessThan(1);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
    }
    expect(rectForLang('fr')).toBe(PROXY_RECT.fr);
    expect(rectForLang('en')).toBe(PROXY_RECT.enes);
    expect(rectForLang('es')).toBe(PROXY_RECT.enes);
    expect(rectForLang(undefined)).toBe(PROXY_RECT.enes);
    expect(PROXY_LABEL).toBe('Proxy');
    expect(SWATCH_KEYS).toHaveLength(16);
  });
});
