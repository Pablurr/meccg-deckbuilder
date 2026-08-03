import { describe, it, expect } from 'vitest';
import { parseDocument } from '../web/src/lib/import/document.js';

const at = (doc, name) => doc.lines.find((l) => l.candidates[0].name === name);

describe('parseDocument — zones', () => {
  it('a headingless list is all play deck, exactly as before', () => {
    const doc = parseDocument('3x Bûrat\n2x Beautiful Gold Ring');
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines.every((l) => l.target === 'quantities')).toBe(true);
  });

  it('routes each section to its zone, in any order', () => {
    const doc = parseDocument([
      '## Talon', '1x Bûrat',
      '## Réserve', '1x Beautiful Gold Ring',
      '## Pioche', '1x Doors of Night',
    ].join('\n'));
    expect(at(doc, 'Bûrat').target).toBe('sideboard');
    expect(at(doc, 'Beautiful Gold Ring').target).toBe('pool');
    expect(at(doc, 'Doors of Night').target).toBe('quantities');
  });

  it('a group heading posts a type hint without changing the zone', () => {
    const doc = parseDocument(['## Sideboard', '### Hazards', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat')).toMatchObject({ target: 'sideboard', typeHint: 'Hazard' });
  });

  // Blocked on Task 7, like the two below: "Plan de jeu" has no digit
  // anywhere and matches no vocabulary entry, so from document.js's side it
  // is structurally identical to a bare card name typed with an implicit
  // quantity of 1 (e.g. "Bûrat" alone -- a supported reading per line.js).
  // Only cards.json can tell them apart. The zone-preservation half of this
  // guarantee already holds today (see the passing assertion below); only
  // the notes-capture half needs the card index.
  it('an unknown heading leaves the zone alone', () => {
    const doc = parseDocument(['## Talon', 'Plan de jeu', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat').target).toBe('sideboard');
  });

  it.todo('an unknown heading goes to the notes and leaves the zone alone');

  it('a zone heading clears the previous type hint', () => {
    const doc = parseDocument(['### Hazards', '## Pool', '1x Bûrat'].join('\n'));
    expect(at(doc, 'Bûrat')).toMatchObject({ target: 'pool', typeHint: null });
  });
});

describe('parseDocument — nothing is lost', () => {
  // Blocked on Task 7: document.js has no card index, so it cannot tell
  // "Contrôler les havres tôt" from a bare card name. Reactivate in
  // test/importResolve.test.js once resolve.js exists.
  it.todo('prose with no quantity and no match becomes notes, not a card line');

  it.todo('a line WITH an explicit quantity stays a card line, so a typo is still reported');

  it('notes mode is absolute: even "3x Gandalf is the plan" is never a card line', () => {
    const doc = parseDocument(['## Notes', '3x Gandalf is the plan'].join('\n'));
    expect(doc.lines).toHaveLength(0);
    expect(doc.notes.other).toContain('3x Gandalf is the plan');
  });

  it('a named note heading routes to its own field', () => {
    const doc = parseDocument(['## Notes', '### Resource strategy', 'ramper sur les objets'].join('\n'));
    expect(doc.notes.resourceStrategy).toBe('ramper sur les objets');
  });

  it('notes can open the document or close it', () => {
    const first = parseDocument(['Notes:', 'un plan', '## Pioche', '1x Bûrat'].join('\n'));
    expect(first.notes.other).toContain('un plan');
    expect(first.lines).toHaveLength(1);

    const last = parseDocument(['## Pioche', '1x Bûrat', 'Description', 'un plan'].join('\n'));
    expect(last.notes.other).toContain('un plan');
    expect(last.lines).toHaveLength(1);
  });
});

describe('parseDocument — title and metadata', () => {
  it('reads the deck name off the title line', () => {
    expect(parseDocument('# Mon deck\n\n1x Bûrat').name).toBe('Mon deck');
  });

  it('a "# " line after the first heading is note text, not a second title', () => {
    const doc = parseDocument(['# Mon deck', '## Notes', '# 1 objectif : ramper'].join('\n'));
    expect(doc.name).toBe('Mon deck');
    expect(doc.notes.other).toContain('# 1 objectif : ramper');
  });

  it('reads the metadata block, and never as cards', () => {
    const doc = parseDocument([
      '# Mon deck', '## Metadata',
      '- Mode: Deckbuilding', '- Side: Balrog', '- Game length: Standard',
      '## Pioche', '1x Bûrat',
    ].join('\n'));
    expect(doc.meta).toEqual({ mode: 'deckbuilding', side: 'balrog', length: 'standard' });
    expect(doc.lines).toHaveLength(1);
  });

  it('reads a hand-written localized block', () => {
    const doc = parseDocument(['Infos', 'Camp : Spectre de l’Anneau', 'Longueur de partie : Campagne'].join('\n'));
    expect(doc.meta.side).toBe('ringwraith');
    expect(doc.meta.length).toBe('campaign');
  });

  it('an unknown metadata key is ignored, not turned into a card', () => {
    const doc = parseDocument(['## Metadata', '- Auteur: Pablo'].join('\n'));
    expect(doc.meta).toEqual({ mode: null, side: null, length: null });
    expect(doc.lines).toHaveLength(0);
  });
});

describe('parseDocument — the facade contract', () => {
  it('qty/name mirror the LAST candidate, which is the pre-refactor reading', () => {
    const doc = parseDocument('Bûrat - 2');
    expect(doc.lines[0]).toMatchObject({ qty: 1, name: 'Bûrat - 2' });
    expect(doc.lines[0].candidates[0]).toMatchObject({ qty: 2, name: 'Bûrat' });
  });
});
