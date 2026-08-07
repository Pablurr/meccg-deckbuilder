import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';

const { cards, index } = parseCards(raw);

describe('agent card data', () => {
  it('every card flagged as an agent also carries the "Agent" keyword', () => {
    const agents = cards.filter((c) => c.attributes.agent === true);
    // 30 Character/Minion agents from Dark Minions + 2 Hazard-type agents
    // (DM-28, DM-29). The keyword means "this is an agent", not "this is
    // an agent character", so both Hazards carry it too.
    expect(agents).toHaveLength(32);
    for (const c of agents) expect(c.attributes.keywords).toContain('Agent');
  });

  it('the "Agent" keyword is on agents and nowhere else', () => {
    const keyworded = cards.filter((c) => (c.attributes.keywords || []).includes('Agent'));
    expect(keyworded.map((c) => c.id).sort()).toEqual(
      cards.filter((c) => c.attributes.agent === true).map((c) => c.id).sort(),
    );
  });

  it('The Balrog (BA-3) carries Spawn as a keyword, not as a subtype', () => {
    // Spawn is not a card subtype: it was the only subtype:"Spawn" in the
    // game, a stray entry in the browser's Subtype facet.
    const balrog = index.get('BA-3');
    expect(balrog.attributes.subtype).toBeUndefined();
    expect(balrog.attributes.keywords).toContain('Spawn');
  });

  it('no card is left with a "Spawn" subtype', () => {
    expect(cards.filter((c) => c.attributes.subtype === 'Spawn')).toHaveLength(0);
  });
});
