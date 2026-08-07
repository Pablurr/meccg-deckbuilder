import { describe, it, expect } from 'vitest';
import { SIDES, GENERAL } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { localize, copiesText, poolText, sideText, playDeckText, refText, capTitle } from '../web/src/lib/rules/docText.js';
import { RULES } from '../web/src/lib/rules/catalog.js';
import { makeT } from '../web/src/lib/i18n.js';

// t stub: returns the key plus its params (when given) rather than translated
// prose, so assertions below are about *which key was chosen with which
// numbers*, not about hand-written wording in any language.
function stubT(key, params) {
  return params ? `${key}::${JSON.stringify(params)}` : key;
}

describe('copiesText', () => {
  it('wizard: a single-entry catch-all table renders as the default only', () => {
    // wizard.copies is [{ limit: 3 }] -- one entry, no bucket/alignment, so
    // it IS the catch-all and there are no override entries to render.
    expect(SIDES.wizard.copies).toEqual([{ limit: 3 }]);
    const text = copiesText(stubT, SIDES.wizard);
    expect(text).toBe(`docs.copies.default::{"n":${SIDES.wizard.copies[0].limit}}`);
  });

  it('fallen-wizard: catch-all first, then each 1.3.F1 category in table order, using localized labels', () => {
    const [stageResource, character, heroResource, minionResource, catchAll] = SIDES['fallen-wizard'].copies;
    // Sanity on the shape this test's expectation is built from: a catch-all
    // (no bucket/alignment) last, three resource+alignment rows and one
    // bucket-only row before it.
    expect(catchAll).toEqual({ limit: catchAll.limit });
    expect(stageResource).toMatchObject({ bucket: 'resource', alignment: 'Stage' });
    expect(character).toMatchObject({ bucket: 'character' });
    expect(character.alignment).toBeUndefined();
    expect(heroResource).toMatchObject({ bucket: 'resource', alignment: 'Hero' });
    expect(minionResource).toMatchObject({ bucket: 'resource', alignment: 'Minion' });

    const text = copiesText(stubT, SIDES['fallen-wizard']);
    // Each (bucket, alignment) combination resolves to its own full-phrase
    // dictionary key -- docs.copies.category.<bucket>[-<alignment>] -- rather
    // than a bucket label and an alignment label concatenated in code.
    expect(text).toBe([
      `docs.copies.default::{"n":${catchAll.limit}}`,
      `docs.copies.category.${stageResource.bucket}-${stageResource.alignment}::{"n":${stageResource.limit}}`,
      `docs.copies.category.${character.bucket}::{"n":${character.limit}}`,
      `docs.copies.category.${heroResource.bucket}-${heroResource.alignment}::{"n":${heroResource.limit}}`,
      `docs.copies.category.${minionResource.bucket}-${minionResource.alignment}::{"n":${minionResource.limit}}`,
    ].join(', '));
  });
});

describe('playDeckText', () => {
  // 1.5 / 1.5.1 -- four budgets, not a min/max range, and camp-independent:
  // every side reads the same GENERAL.playDeck numbers, so the helper takes
  // no per-side profile argument at all.
  it('playDeckText states all four budgets', () => {
    const s = playDeckText(makeT('en'));
    expect(s).toContain('30');
    expect(s).toContain('50');
    expect(s).toContain('10');
    expect(s).toContain('12');
  });
});

describe('GENERAL.playDeck (1.5, 1.5.1 -- camp-independent play-deck budgets)', () => {
  it('carries the resource range, character cap and creature minimum every camp shares', () => {
    expect(GENERAL.playDeck).toEqual({
      resourcesMin: 30,
      resourcesMax: 50,
      maxCharacters: 10,
      minCreatures: 12,
    });
  });
});

describe('poolText', () => {
  it('wizard: no mindCap, no mindPerCharacter, no race clauses', () => {
    const text = poolText(stubT, SIDES.wizard.pool);
    expect(text).toContain(`docs.pool.maxCharacters::{"n":${SIDES.wizard.pool.maxCharacters}}`);
    expect(text).toContain(`docs.pool.maxMinorItems::{"n":${SIDES.wizard.pool.maxMinorItems}}`);
    expect(text).not.toContain('docs.pool.mindCap');
    expect(text).not.toContain('docs.pool.mindPerCharacter');
    expect(text).not.toContain('docs.pool.forbidRaces');
    expect(text).not.toContain('docs.pool.requireRaces');
  });

  it('ringwraith: only the universal character and minor-item caps (section 1 states no mind cap or race restriction for this side)', () => {
    const pool = SIDES.ringwraith.pool;
    expect(pool.balrogMindPerCharacterLimit).toBeUndefined();
    expect(pool.requireRaces).toBeUndefined();
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('fallen-wizard: only the universal character and minor-item caps (section 1 states no mind cap or race restriction for this side)', () => {
    const pool = SIDES['fallen-wizard'].pool;
    expect(pool.balrogMindPerCharacterLimit).toBeUndefined();
    expect(pool.requireRaces).toBeUndefined();
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('balrog: the pool text keeps only the universal caps, 1.3.B4 having moved to the camp', () => {
    const pool = SIDES.balrog.pool;
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · ` +
      `docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('balrog: the camp text carries the 1.3.B4 race and mind clauses', () => {
    const side = SIDES.balrog;
    expect(side.characterRaces).toEqual(['Orc', 'Troll']);
    expect(side.characterMindLimit).toBe(9);
    expect(sideText(stubT, side)).toBe(
      `docs.side.characterRaces::{"races":"${side.characterRaces.join(', ')}"} · ` +
      `docs.side.characterMindBelow::{"n":${side.characterMindLimit}}`
    );
  });

  it('a camp without 1.3.B4 constraints has no camp text at all', () => {
    expect(sideText(stubT, SIDES.wizard)).toBe('');
  });
});

describe('localize', () => {
  it('falls back to the raw value when the stub has no real translation for the key', () => {
    expect(localize(stubT, 'alignment', 'Hero')).toBe('Hero');
  });

  it('uses the translated form when it differs from the untranslated key template', () => {
    const t = (key) => (key === 'alignment.Hero' ? 'Héros' : key);
    expect(localize(t, 'alignment', 'Hero')).toBe('Héros');
  });
});

describe('four sides sanity (docText covers every side rendered by the doc page)', () => {
  it('SIDES exposes exactly the four sides the doc table iterates', () => {
    expect(Object.keys(SIDES).sort()).toEqual(['balrog', 'fallen-wizard', 'ringwraith', 'wizard']);
  });

  it('every side produces non-empty copiesText, poolText and playDeckText without throwing', () => {
    for (const side of Object.values(SIDES)) {
      expect(() => copiesText(stubT, side)).not.toThrow();
      expect(() => poolText(stubT, side.pool)).not.toThrow();
      expect(() => playDeckText(stubT)).not.toThrow();
      expect(copiesText(stubT, side).length).toBeGreaterThan(0);
      expect(poolText(stubT, side.pool).length).toBeGreaterThan(0);
      expect(playDeckText(stubT).length).toBeGreaterThan(0);
    }
  });
});

describe('refText', () => {
  it('renders one citation per cited clause', () => {
    expect(refText(stubT, { ref: '1.3.2' })).toBe(stubT('rules.coeRef', { ref: '1.3.2' }));
    expect(refText(stubT, { refs: ['1.4', '1.4.F1'] })).toBe(
      `${stubT('rules.coeRef', { ref: '1.4' })}, ${stubT('rules.coeRef', { ref: '1.4.F1' })}`
    );
  });

  it('renders nothing for a house rule', () => {
    expect(refText(stubT, { house: true })).toBe('');
  });

  it('notes the printed clause number when the source has a typo', () => {
    const r = { refs: ['1.3.F6'], printedAs: { '1.3.F6': '1.5.F6' } };
    expect(refText(stubT, r)).toContain(stubT('rules.coeRefPrinted', { ref: '1.5.F6' }));
  });

  it('every non-house rule produces a non-empty citation', () => {
    for (const r of RULES) {
      if (r.house) continue;
      expect(refText(stubT, r).length).toBeGreaterThan(0);
    }
  });
});

// Real translations (not stubT) so the assertions below check actual
// rendered prose -- the same convention test/i18n-rules-contract.test.js
// uses when a test needs to see genuine wording rather than an echoed key.
describe('capTitle', () => {
  const t = makeT('en');
  it('names the rule that blocks and cites it', () => {
    const s = capTitle(t, 'COPIES-LIMIT', 0);
    expect(s).toContain('CoE');
    expect(s.length).toBeGreaterThan(0);
  });
  it('is empty when there is room', () => {
    expect(capTitle(t, 'COPIES-LIMIT', 2)).toBe('');
    expect(capTitle(t, null, Infinity)).toBe('');
  });
});

describe('LENGTHS sanity (used elsewhere on the same doc page)', () => {
  it('exposes sideboardMax for every length id', () => {
    for (const length of Object.values(LENGTHS)) {
      expect(typeof length.sideboardMax).toBe('number');
    }
  });
});
