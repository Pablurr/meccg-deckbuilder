import { describe, it, expect } from 'vitest';
import { SIDES } from '../web/src/lib/rules/sides.js';
import { LENGTHS } from '../web/src/lib/rules/formats.js';
import { localize, copiesText, poolText, playDeckText, refText } from '../web/src/lib/rules/docText.js';
import { RULES } from '../web/src/lib/rules/catalog.js';

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
  it('wizard: an unsourced (null) playDeck falls back to status.unverified', () => {
    // 1.5 specifies four separate play-deck budgets (resources, hazards,
    // non-avatar characters, avatars), not one min/max range -- SIDES.wizard.playDeck
    // is deliberately null until that lands, same as every other side.
    expect(SIDES.wizard.playDeck).toBeNull();
    expect(playDeckText(stubT, SIDES.wizard.playDeck)).toBe('status.unverified');
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

  it('ringwraith: only the universal character and minor-item caps (section 1 states no mind cap or race restriction for this side)', () => {
    const pool = SIDES.ringwraith.pool;
    expect(pool.balrogMindPerCharacterLimit).toBeNull();
    expect(pool.requireRaces).toBeNull();
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('fallen-wizard: only the universal character and minor-item caps (section 1 states no mind cap or race restriction for this side)', () => {
    const pool = SIDES['fallen-wizard'].pool;
    expect(pool.balrogMindPerCharacterLimit).toBeNull();
    expect(pool.requireRaces).toBeNull();
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}}`
    );
  });

  it('balrog: the universal caps plus the per-character mind-below-9 clause (1.3.B4) and the required-races clause', () => {
    const pool = SIDES.balrog.pool;
    expect(pool.balrogMindPerCharacterLimit).toBe(9);
    expect(pool.requireRaces).toEqual(['Orc', 'Troll']);
    const text = poolText(stubT, pool);
    expect(text).toBe(
      `docs.pool.maxCharacters::{"n":${pool.maxCharacters}} · ` +
      `docs.pool.maxMinorItems::{"n":${pool.maxMinorItems}} · ` +
      `docs.pool.balrogMindBelow::{"n":${pool.balrogMindPerCharacterLimit}} · ` +
      `docs.pool.requireRaces::{"races":"${pool.requireRaces.join(', ')}"}`
    );
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

describe('LENGTHS sanity (used elsewhere on the same doc page)', () => {
  it('exposes sideboardMax for every length id', () => {
    for (const length of Object.values(LENGTHS)) {
      expect(typeof length.sideboardMax).toBe('number');
    }
  });
});
