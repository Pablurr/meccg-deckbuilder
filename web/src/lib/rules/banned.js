// STUB lists seeded from the local KB (wh-the-white-hand.md, ba-the-balrog.md);
// names to be re-verified against councilofelrond.org. Matching is by name.en,
// accent/case-insensitive.
export const BANNED = {
  'fallen-wizard': {
    status: 'unverified',
    source: 'https://councilofelrond.org/',
    names: [
      'Bade to Rule', 'Cracks of Doom', 'Favor of the Valar', 'Gollum’s Fate', 'Hour of Need',
      'Kill All But NOT the Halflings', 'The Lidless Eye', 'The Sun Unveiled',
      // remastered card data itself spells this "Excellance" (not "Excellence")
      'Glamour of Surpassing Excellance', 'Messenger of Mordor',
      // remastered card data itself spells this "Trough" (not "Through")
      'News Must Get Trough',
      'News of the Shire', 'Old Road', 'The Windlord Found Me', 'Wizard Uncloaked', 'Use Your Legs',
    ],
  },
  balrog: {
    status: 'unverified',
    source: 'https://councilofelrond.org/',
    names: [
      'Above the Abyss', 'Bade to Rule', 'The Black Council', 'Black Horse', 'Black Rider',
      'By the Ringwraith’s Word', 'Creature of an Older World', "Durin's Bane", 'The Fiery Blade',
      'Helm of Fear', 'Heralded Lord', 'Kill All But NOT the Halflings', 'The Lidless Eye',
      'Morgul-blade', 'News of the Shire', 'Open to the Summons', 'Orders From Lugbúrz',
      'Padding Feet', 'The Ring Leaves its Mark', 'Sauron', 'They Ride Together',
      'Use Your Legs', 'While the Yellow Face Sleeps',
    ],
  },
};

// NOTE: explicit \u escapes (not the literal combining-diacritics characters)
// so this survives copy/paste intact -- see task-7 known traps.
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function resolveBanned(cards) {
  const byName = new Map();
  for (const c of cards) {
    const k = fold(c.name && c.name.en);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(c.id);
  }
  const bySide = {};
  const unresolved = [];
  for (const [side, entry] of Object.entries(BANNED)) {
    bySide[side] = new Set();
    for (const name of entry.names) {
      const ids = byName.get(fold(name));
      if (!ids) unresolved.push({ side, name });
      else for (const id of ids) bySide[side].add(id);
    }
  }
  return { bySide, unresolved };
}
