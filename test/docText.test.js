import { describe, it, expect } from 'vitest';
import { SIDES } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { localize, copiesText, poolText, playDeckText } from '../web/src/lib/rules/docText.js';

// t stub: returns the key plus its params (when given) rather than translated
// prose, so assertions below are about *which key was chosen with which
// numbers*, not about hand-written wording in any language.
function stubT(key, params) {
  return params ? `${key}::${JSON.stringify(params)}` : key;
}

describe('copiesText', () => {
  it('wizard: default only, no per-alignment override', () => {
    const text = copiesText(stubT, SIDES.wizard);
    expect(text).toBe(`docs.copies.default::{"n":${SIDES.wizard.copies.default}}`);
  });

  it('fallen-wizard: default plus a Stage override, using the localized alignment', () => {
    const text = copiesText(stubT, SIDES['fallen-wizard']);
    const [alignment, n] = Object.entries(SIDES['fallen-wizard'].copies.byAlignment)[0];
    expect(text).toContain(`docs.copies.default::{"n":${SIDES['fallen-wizard'].copies.default}}`);
    // localize() falls back to the raw value when the stub's untranslated echo
    // matches the key template, so the raw alignment string surfaces here.
    expect(text).toContain(`docs.copies.override::{"n":${n},"alignment":"${alignment}"}`);
  });
});

describe('playDeckText', () => {
  it('wizard: a sourced min/max range renders docs.playDeck.range', () => {
    const text = playDeckText(stubT, SIDES.wizard.playDeck);
    expect(text).toBe(`docs.playDeck.range::{"min":${SIDES.wizard.playDeck.min},"max":${SIDES.wizard.playDeck.max}}`);
  });

  it('ringwraith: an unsourced (null) playDeck falls back to status.unverified', () => {
    expect(SIDES.ringwraith.playDeck).toBeNull();
    expect(playDeckText(stubT, SIDES.ringwraith.playDeck)).toBe('status.unverified');
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

  it('ringwraith: a total mindCap (no per-character cap) plus forbidden races', () => {
    const pool = SIDES.ringwraith.pool;
    expect(pool.mindCap).not.toBeNull();
    expect(pool.mindPerCharacter).toBeNull();
    const text = poolText(stubT, pool);
    expect(text).toContain(`docs.pool.mindCap::{"n":${pool.mindCap}}`);
    expect(text).not.toContain('docs.pool.mindPerCharacter');
    expect(text).toContain(`docs.pool.forbidRaces::{"races":"${pool.forbidRaces.join(', ')}"}`);
    expect(text).not.toContain('docs.pool.requireRaces');
  });

  it('fallen-wizard: a per-character mindPerCharacter (no total mindCap)', () => {
    const pool = SIDES['fallen-wizard'].pool;
    expect(pool.mindCap).toBeNull();
    expect(pool.mindPerCharacter).not.toBeNull();
    const text = poolText(stubT, pool);
    expect(text).not.toContain('docs.pool.mindCap::');
    expect(text).toContain(`docs.pool.mindPerCharacter::{"n":${pool.mindPerCharacter}}`);
  });

  it('balrog: a per-character mindPerCharacter plus required races', () => {
    const pool = SIDES.balrog.pool;
    expect(pool.mindPerCharacter).not.toBeNull();
    expect(pool.requireRaces).toEqual(['Orc', 'Troll']);
    const text = poolText(stubT, pool);
    expect(text).toContain(`docs.pool.mindPerCharacter::{"n":${pool.mindPerCharacter}}`);
    expect(text).toContain(`docs.pool.requireRaces::{"races":"${pool.requireRaces.join(', ')}"}`);
    expect(text).not.toContain('docs.pool.forbidRaces');
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
      expect(() => playDeckText(stubT, side.playDeck)).not.toThrow();
      expect(copiesText(stubT, side).length).toBeGreaterThan(0);
      expect(poolText(stubT, side.pool).length).toBeGreaterThan(0);
      expect(playDeckText(stubT, side.playDeck).length).toBeGreaterThan(0);
    }
  });
});

describe('LENGTHS sanity (used elsewhere on the same doc page)', () => {
  it('exposes sideboardMax for every length id', () => {
    for (const length of Object.values(LENGTHS)) {
      expect(typeof length.sideboardMax).toBe('number');
    }
  });
});
