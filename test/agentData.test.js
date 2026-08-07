import { describe, it, expect } from 'vitest';
import raw from '../web/public/cards.json';
import { parseCards } from '../web/src/lib/parseCards.js';

const { cards, index } = parseCards(raw);

describe('agent card data', () => {
  it('every card flagged as an agent also carries the "Agent" keyword', () => {
    const agents = cards.filter((c) => c.attributes.agent === true);
    // 30 Character/Minion de Dark Minions + les 2 agents de type Hazard
    // (DM-28, DM-29). Le keyword dit "c'est un agent", pas "c'est un
    // agent-personnage", donc les deux Hazard le portent aussi.
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
    // "Spawn" n'est pas un sous-type de carte : c'etait le seul subtype:"Spawn"
    // du jeu, une entree parasite dans la facette Subtype du navigateur.
    const balrog = index.get('BA-3');
    expect(balrog.attributes.subtype).toBeUndefined();
    expect(balrog.attributes.keywords).toContain('Spawn');
  });

  it('no card is left with a "Spawn" subtype', () => {
    expect(cards.filter((c) => c.attributes.subtype === 'Spawn')).toHaveLength(0);
  });
});
