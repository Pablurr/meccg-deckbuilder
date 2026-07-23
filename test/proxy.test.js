import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards } from '../web/src/lib/parseCards.js';
import {
  isStampable,
  rectForLang,
  cloneSrcForLang,
  PROXY_RECT,
  CLONE_SRC,
  PROXY_LABEL,
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

describe('geometry', () => {
  it('exposes sane fractional cover rects and a matching clone source', () => {
    for (const lang of ['en', 'es', 'fr']) {
      const r = rectForLang(lang);
      const s = cloneSrcForLang(lang);
      for (const k of ['x', 'y', 'w', 'h']) {
        expect(r[k]).toBeGreaterThan(0);
        expect(r[k]).toBeLessThan(1);
      }
      expect(r.x + r.w).toBeLessThan(1);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
      // Clone source is a clean strip that must not overlap the covered zone.
      expect(s.x).toBeGreaterThan(0);
      expect(s.w).toBeGreaterThan(0);
      expect(s.w).toBeLessThan(1);
      const srcRight = s.x + s.w;
      const disjoint = srcRight <= r.x || s.x >= r.x + r.w;
      expect(disjoint).toBe(true);
    }
  });

  it('routes fr vs en/es correctly', () => {
    expect(rectForLang('fr')).toBe(PROXY_RECT.fr);
    expect(rectForLang('en')).toBe(PROXY_RECT.enes);
    expect(rectForLang('es')).toBe(PROXY_RECT.enes);
    expect(rectForLang(undefined)).toBe(PROXY_RECT.enes);
    expect(cloneSrcForLang('fr')).toBe(CLONE_SRC.fr);
    expect(cloneSrcForLang('en')).toBe(CLONE_SRC.enes);
    expect(PROXY_LABEL).toBe('Proxy');
  });
});
