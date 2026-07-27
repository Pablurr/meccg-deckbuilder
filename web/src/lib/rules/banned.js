// Ban lists sourced from councilofelrond.org Section 1: the Fallen-wizard list
// is printed as 1.5.F6 (a numbering typo for 1.3.F6) and the Balrog list as
// 1.3.B5.
//
// An entry is one of:
//   'Card Name'            -- matched by name.en, accent/case/apostrophe-insensitive
//   { name, id }           -- id-qualified: use when two cards share a name
//   { label, ids: [...] }  -- a family the rules name collectively
export const BANNED = {
  'fallen-wizard': {
    status: 'verified',
    source: 'https://www.councilofelrond.org/rules/#Section1',
    ref: '1.3.F6',
    printedAs: '1.5.F6',
    names: [
      'Bade to Rule',
      // "The Balrog (Ally)": the "(Ally)" disambiguates AS-71 from BA-3, the
      // Balrog player's avatar, which shares the name and must not be banned.
      { name: 'The Balrog (Ally)', id: 'AS-71' },
      'Cracks of Doom', 'Favor of the Valar', 'Gollum\u2019s Fate', 'Hour of Need',
      'Kill All But NOT the Halflings', 'The Lidless Eye',
      // remastered card data itself spells this "Excellance" (not "Excellence")
      'Glamour of Surpassing Excellance', 'Messenger of Mordor',
      // remastered card data itself spells this "Trough" (not "Through")
      'News Must Get Trough',
      'News of the Shire', 'Old Road', 'The Sun Unveiled', 'Use Your Legs',
      'The Windlord Found Me', 'Wizard Uncloaked',
    ],
  },
  balrog: {
    status: 'verified',
    source: 'https://www.councilofelrond.org/rules/#Section1',
    ref: '1.3.B5',
    names: [
      'Above the Abyss', 'Bade to Rule',
      { name: 'The Balrog (Ally)', id: 'AS-71' },
      'Balrog of Moria', 'The Black Council', 'Black Horse', 'Black Rider',
      'By the Ringwraith\u2019s Word', 'Creature of an Older World', "Durin's Bane",
      'Fell Rider', 'The Fiery Blade', 'Helm of Fear', 'Heralded Lord',
      'Kill All But NOT the Halflings', 'The Lidless Eye', 'Morgul-blade',
      'News of the Shire', 'Open to the Summons', 'Orders from Lugb\u00farz',
      'Padding Feet', 'The Ring Leaves Its Mark',
      {
        label: 'Ringwraith Unleashed cards',
        ids: ['LE-161', 'LE-162', 'LE-182', 'LE-193', 'LE-198', 'LE-200', 'LE-222', 'LE-248', 'LE-257'],
      },
      'Sauron', 'They Ride Together', 'Use Your Legs', 'While the Yellow Face Sleeps',
    ],
  },
};

// NOTE: explicit \u escapes (not the literal combining-diacritics characters)
// so this survives copy/paste intact -- see task-7 known traps.
// Apostrophes are folded too: the card data spells one name with ASCII "'"
// (DM-107 "Durin's Bane") and 82 with U+2019, while names pasted from the CoE
// page always use U+2019. Without this, such an entry resolves to nothing and
// fails silently.
const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019\u02bc\u00b4]/g, "'")
  .toLowerCase()
  .trim();

export function resolveBanned(cards, lists = BANNED) {
  const byName = new Map();
  const knownIds = new Set();
  for (const c of cards) {
    knownIds.add(c.id);
    const k = fold(c.name && c.name.en);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(c.id);
  }
  const bySide = {};
  const unresolved = [];
  for (const [side, entry] of Object.entries(lists)) {
    bySide[side] = new Set();
    for (const item of entry.names) {
      if (typeof item === 'string') {
        const ids = byName.get(fold(item));
        if (!ids) unresolved.push({ side, name: item });
        else for (const id of ids) bySide[side].add(id);
        continue;
      }
      // id-qualified or family: trust the ids, but report any that no longer
      // exist so a card-data update cannot silently drop a ban.
      const ids = item.ids || [item.id];
      for (const id of ids) {
        if (knownIds.has(id)) bySide[side].add(id);
        else unresolved.push({ side, name: item.label || item.name, id });
      }
    }
  }
  return { bySide, unresolved };
}
