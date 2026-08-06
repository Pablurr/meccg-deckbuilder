import { describe, it, expect } from 'vitest';
import { buildNameIndex, resolveLines, PREF_BY_SIDE } from '../web/src/lib/import/resolve.js';
import { parseDocument } from '../web/src/lib/import/document.js';

// Two cards sharing a name, the classic import ambiguity (194 English names
// name more than one card).
const HERO = { id: 'AS-58', setCode: 'AS', type: 'Character', alignment: 'Hero', name: { en: 'Angmarim', fr: 'Angmarim' } };
const MINION = { id: 'AS-62', setCode: 'AS', type: 'Hazard', alignment: 'Minion', name: { en: 'Angmarim', fr: 'Angmarim' } };
const BURAT = { id: 'TW-119', setCode: 'TW', type: 'Character', alignment: 'Hero', name: { en: 'Bûrat', fr: 'Bûrat' } };
// A name shared by a fallen-wizard card and a hero card, for the
// fallen-wizard alignment path -- the fiddliest bit of classifyHint, since
// "fallen-wizard" survives normalizeName stripping its hyphen and must be
// reconstructed with one.
const ITANGAST_FW = { id: 'BA-1', setCode: 'BA', type: 'Character', alignment: 'Fallen-wizard', name: { en: 'Itangast', fr: 'Itangast' } };
const ITANGAST_HERO = { id: 'BA-2', setCode: 'BA', type: 'Character', alignment: 'Hero', name: { en: 'Itangast', fr: 'Itangast' } };
const CARDS = [HERO, MINION, BURAT, ITANGAST_FW, ITANGAST_HERO];

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

  it('a known-but-untabled side never falls through to the manual preference', () => {
    // Simulates a typo, or a fifth side added to rules/sides.js without
    // updating PREF_BY_SIDE: the side lookup comes up empty, and that must
    // not silently promote alignPref('minion') to decide a side-bound
    // import -- if it did, this would resolve to the minion instead of
    // staying ambiguous.
    const { resolved } = one('1x Angmarim', { side: 'renegade', alignPref: 'minion' });
    expect(resolved[0].status).toBe('ambiguous');
  });

  it('the fallen-wizard preference tie between a lone hero and a lone minion stays ambiguous', () => {
    // fallenWizard's table ranks hero and minion equally (rank 2): a
    // fallen-wizard deck can play either, so the tie is the player's to
    // break, not the resolver's.
    const { resolved } = one('1x Angmarim', { side: 'fallen-wizard' });
    expect(resolved[0].status).toBe('ambiguous');
  });

  it('a (Fallen-wizard) hint narrows to the fallen-wizard reading', () => {
    expect(one('1x Itangast (Fallen-wizard)').resolved[0].matches[0].id).toBe('BA-1');
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

  // "Other characters" must be a recognised ZONE heading, not a group (like
  // plain "Characters") or an unrecognised one -- either of those leaves the
  // zone alone, which would silently keep routing characters into the pool
  // after a "## Starting"/"## Pool" section.
  it('"Other characters" closes a pool section back to the play deck', () => {
    const { resolved } = one(['## Starting', '1x Bûrat', '## Other characters', '1x Angmarim (Hero)'].join('\n'));
    expect(resolved[0]).toMatchObject({ target: 'pool' });
    expect(resolved[0].matches[0].id).toBe('TW-119');
    expect(resolved[1]).toMatchObject({ target: 'quantities' });
    expect(resolved[1].matches[0].id).toBe('AS-58');
  });
});

describe('resolveLines — a trailing parenthetical is not by itself a mark', () => {
  // line.js's peeler treats every trailing "(...)" as a hint, marked or not.
  // A remark in parentheses must still count as prose, or pasting a forum
  // post with commentary like this becomes a wall of red.
  it('prose ending in a parenthetical remark is still prose, not a reported miss', () => {
    const { resolved, prose } = one('Contrôler les havres tôt (stratégie principale)');
    expect(resolved).toHaveLength(0);
    expect(prose).toEqual(['Contrôler les havres tôt (stratégie principale)']);
  });

  // (AS) is a real set code, so classifyHint says 'set', not 'unknown' -- the
  // player plainly meant a card here, and the typo must still be reported.
  it('a real set code in parentheses proves intent, so a typo is still reported', () => {
    const { resolved, prose } = one('Machinchose (AS)');
    expect(prose).toHaveLength(0);
    expect(resolved[0].status).toBe('notfound');
  });

  it('an explicit quantity still reports a miss, unaffected by the parenthetical rule', () => {
    const { resolved, prose } = one('3x Machinchose');
    expect(prose).toHaveLength(0);
    expect(resolved[0].status).toBe('notfound');
  });
});

describe('resolveLines — decoration-only lines are dropped, not kept as prose', () => {
  // A forum/markdown divider ("----", "####", "===...") carries no
  // information a player would want back in their notes: without this it
  // would pass isMarked's checks (no digit, no qty>1, no hint) exactly like
  // real prose and end up cluttering the notes on every list copied from a
  // forum post.
  it.each(['----', '#####', '====', '****', '____', '....', '---===---'])(
    'drops %j entirely', (raw) => {
      const { resolved, prose } = one(raw);
      expect(resolved).toHaveLength(0);
      expect(prose).toHaveLength(0);
    },
  );

  it('a line that merely starts with decoration is still prose', () => {
    const { prose } = one('-- Contrôler les havres tôt');
    expect(prose).toEqual(['-- Contrôler les havres tôt']);
  });
});
