import { describe, it, expect } from 'vitest';
import { buildNameIndex, resolveLines, PREF_BY_SIDE } from '../web/src/lib/import/resolve.js';
import { parseDocument } from '../web/src/lib/import/document.js';

// Two cards sharing a name, the classic import ambiguity (194 English names
// name more than one card).
const HERO = { id: 'AS-58', setCode: 'AS', type: 'Character', alignment: 'Hero', name: { en: 'Angmarim', fr: 'Angmarim' } };
const MINION = { id: 'AS-62', setCode: 'AS', type: 'Hazard', alignment: 'Minion', name: { en: 'Angmarim', fr: 'Angmarim' } };
const BURAT = { id: 'TW-119', setCode: 'TW', type: 'Character', alignment: 'Hero', name: { en: 'Bûrat', fr: 'Bûrat' } };
const CARDS = [HERO, MINION, BURAT];

const ctx = (over = {}) => ({
  nameIndex: buildNameIndex(CARDS, 'fr'),
  cardsById: new Map(CARDS.map((c) => [c.id, c])),
  setNames: { AS: { en: 'Against the Shadow', fr: "Contre l'Ombre", es: 'Contra la Sombra' } },
  side: null,
  ...over,
});

const one = (text, over) => {
  const doc = parseDocument(text);
  return resolveLines(doc.lines, ctx(over));
};

describe('resolveLines — rank 0, candidate readings', () => {
  it('keeps the reading that matches a real card', () => {
    const { resolved } = one('Bûrat 2');
    expect(resolved[0]).toMatchObject({ status: 'ok', qty: 2 });
    expect(resolved[0].matches[0].id).toBe('TW-119');
  });

  it('matches without accents', () => {
    expect(one('2x Burat').resolved[0].matches[0].id).toBe('TW-119');
  });
});

describe('resolveLines — rank 1, the parenthesis is sovereign', () => {
  it('an id in parentheses decides outright', () => {
    expect(one('1x Angmarim (AS-62)').resolved[0].matches).toHaveLength(1);
    expect(one('1x Angmarim (AS-62)').resolved[0].matches[0].id).toBe('AS-62');
  });

  it('an alignment in parentheses narrows', () => {
    expect(one('1x Angmarim (Hero)').resolved[0].matches[0].id).toBe('AS-58');
  });

  it('a set name or code narrows, in any UI language', () => {
    expect(one("1x Bûrat (Contre l'Ombre)").resolved[0].matches[0].id).toBe('TW-119');
  });

  it('beats the side, even when the result is illegal for it', () => {
    const { resolved } = one('1x Angmarim (Hero)', { side: 'ringwraith' });
    expect(resolved[0].matches[0].id).toBe('AS-58');
  });
});

describe('resolveLines — rank 2, the sub-section', () => {
  it('a group heading narrows by type', () => {
    const { resolved } = one(['### Hazards', '1x Angmarim'].join('\n'));
    expect(resolved[0].matches[0].id).toBe('AS-62');
  });
});

describe('resolveLines — rank 3, the side', () => {
  it('the side narrows by alignment when nothing finer applies', () => {
    expect(one('1x Angmarim', { side: 'ringwraith' }).resolved[0].matches[0].id).toBe('AS-62');
    expect(one('1x Angmarim', { side: 'wizard' }).resolved[0].matches[0].id).toBe('AS-58');
  });

  it('with no side, the ambiguity survives for the player to settle', () => {
    expect(one('1x Angmarim').resolved[0].status).toBe('ambiguous');
  });

  it('maps every side to an alignment preference', () => {
    expect(PREF_BY_SIDE).toEqual({ wizard: 'hero', ringwraith: 'minion', balrog: 'balrog', 'fallen-wizard': 'fallenWizard' });
  });

  it('with no side, the manual preference is what settles it — the freeform path', () => {
    expect(one('1x Angmarim', { alignPref: 'minion' }).resolved[0].matches[0].id).toBe('AS-62');
    expect(one('1x Angmarim', { alignPref: 'hero' }).resolved[0].matches[0].id).toBe('AS-58');
  });

  it('a side supersedes the manual preference rather than fighting it', () => {
    const { resolved } = one('1x Angmarim', { side: 'wizard', alignPref: 'minion' });
    expect(resolved[0].matches[0].id).toBe('AS-58');
  });
});

describe('resolveLines — a rank that would empty the set is ignored', () => {
  it('a wrong hint does not turn an existing card into a missing one', () => {
    const { resolved } = one('1x Bûrat (WH)');
    expect(resolved[0].status).toBe('ok');
    expect(resolved[0].matches[0].id).toBe('TW-119');
  });

  it('a wrong type hint is dropped rather than applied', () => {
    const { resolved } = one(['### Regions', '1x Bûrat'].join('\n'));
    expect(resolved[0].status).toBe('ok');
  });
});

describe('resolveLines — prose', () => {
  // Covers Task 6's parked 'prose with no quantity and no match becomes
  // notes, not a card line': same behaviour, told from resolve.js's side.
  it('an unmarked line that matches nothing is prose, and is returned as such', () => {
    const { resolved, prose } = one('Contrôler les havres tôt');
    expect(resolved).toHaveLength(0);
    expect(prose).toEqual(['Contrôler les havres tôt']);
  });

  // Covers Task 6's parked 'a line WITH an explicit quantity stays a card
  // line, so a typo is still reported': same behaviour, told from resolve.js's side.
  it('a marked line that matches nothing stays a reported miss', () => {
    const { resolved, prose } = one('3x Machinchose');
    expect(prose).toHaveLength(0);
    expect(resolved[0].status).toBe('notfound');
  });

  // Moved from test/importDocument.test.js's parked
  // 'an unknown heading goes to the notes and leaves the zone alone'.
  // document.js cannot tell "Plan de jeu" from a bare card name typed with an
  // implicit quantity of 1 -- only the card index resolve.js now has can.
  // The zone-preservation half already has its own passing test in
  // importDocument.test.js; this one is about the notes half.
  it('an unknown heading goes to the notes and leaves the zone alone', () => {
    const { resolved, prose } = one(['## Talon', 'Plan de jeu', '1x Bûrat'].join('\n'));
    expect(prose).toEqual(['Plan de jeu']);
    expect(resolved[0]).toMatchObject({ target: 'sideboard' });
    expect(resolved[0].matches[0].id).toBe('TW-119');
  });
});
