// Site derivations for the location-deck rules. Built once per card array and
// memoised on its identity -- validateDeck runs on every deck edit, the same
// reason bannedFor caches.
const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u2019\u02bc]/g, "'")
  .toLowerCase()
  .trim();

// 1.4.B1 -- a Balrog player needs the Balrog version of Moria, Carn Dum, Dol
// Guldur, Minas Morgul, any Under-deeps site and any Dark-hold.
const B1_NAMES = new Set(['moria', 'carn dum', 'dol guldur', 'minas morgul']);

let _cache = { key: null, value: null };

export function siteIndex(cards) {
  if (_cache.key === cards) return _cache.value;
  const sites = cards.filter((c) => c.type === 'Site');
  const namesBy = (alignment) => new Set(sites.filter((c) => c.alignment === alignment).map((c) => fold(c.name && c.name.en)));
  const hero = namesBy('Hero');
  const minion = namesBy('Minion');
  const balrog = namesBy('Balrog');

  // 1.4.1 -- "one copy of each Balrog site for which there is no corresponding
  // hero or minion site". Derived rather than hardcoded; a test asserts it
  // yields exactly the five sites the rule names.
  const openBalrog = new Set(
    sites
      .filter((c) => c.alignment === 'Balrog')
      .filter((c) => { const k = fold(c.name && c.name.en); return !hero.has(k) && !minion.has(k); })
      .map((c) => c.id),
  );

  const needsBalrogVersion = (card) => {
    if (!card || card.type !== 'Site' || card.alignment === 'Balrog') return false;
    const a = card.attributes || {};
    return a.underDeeps === true || a.siteType === '{D}' || B1_NAMES.has(fold(card.name && card.name.en));
  };
  const hasBalrogVersion = (card) => balrog.has(fold(card && card.name && card.name.en));

  const value = { openBalrog, needsBalrogVersion, hasBalrogVersion };
  _cache = { key: cards, value };
  return value;
}
