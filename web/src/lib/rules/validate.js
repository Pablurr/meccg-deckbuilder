// Pure deck validator. Emits translatable descriptors, never sentences.
// A rule that is disabled (per-deck override, or unverified by default)
// is not evaluated at all. The app advises; it never blocks.
import { SIDES } from './sides.js';
import { LENGTHS } from './formats.js';
import { resolveBanned } from './banned.js';
import { backGroupForType } from '../deck.js';
import { zonesFor } from './zones.js';

const SRC = 'https://councilofelrond.org/'; // stub source; refined per rule during sourcing

export const RULES = [
  { id: 'AVATAR-PRESENT',  severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'AVATAR-UNIQUE',   severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'AVATAR-SIDE',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'ALIGN-LEGAL',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'BANNED',          severity: 'error',   status: 'unverified', source: SRC },
  { id: 'COPIES-LIMIT',    severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'UNIQUE-LIMIT',    severity: 'error',   status: 'unverified', source: SRC },
  { id: 'SITE-COPIES',     severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'SPECIFIC-AVATAR', severity: 'error',   status: 'verified',   source: SRC },
  { id: 'BALROG-RACE',     severity: 'error',   status: 'unverified', source: SRC },
  { id: 'BALROG-MIND',     severity: 'error',   status: 'unverified', source: SRC },
  { id: 'DECKSIZE-PLAY',   severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'DECKSIZE-LOCATION', severity: 'warning', status: 'unverified', source: SRC },
  { id: 'SIDEBOARD-MAX',   severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'POOL-CHARS',      severity: 'warning', status: 'verified',   source: 'https://meccg.com/rules/' },
  { id: 'POOL-MIND',       severity: 'warning', status: 'unverified', source: SRC },
  { id: 'POOL-ITEMS',      severity: 'warning', status: 'unverified', source: SRC },
  { id: 'POOL-ELIGIBLE',   severity: 'error',   status: 'verified',   source: 'https://meccg.com/rules/' },
].map((r) => ({ ...r, defaultEnabled: r.status === 'verified' }));

const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

export function isRuleEnabled(ruleId, ruleOverrides = {}) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return false; // unknown / retired ids are ignored
  return ruleOverrides[ruleId] ?? rule.defaultEnabled;
}

const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

// resolveBanned walks all 1683 cards; validateDeck runs on every deck edit, so
// cache the resolution against the card index identity (a Map built once in App).
let _banned = { key: null, value: null };
function bannedFor(cardsById, side) {
  if (_banned.key !== cardsById) _banned = { key: cardsById, value: resolveBanned([...cardsById.values()]) };
  return _banned.value.bySide[side] || new Set();
}

export function validateDeck({ side, length, tournament, ruleOverrides = {}, quantities = {}, zones = {}, cardsById }) {
  // Reject inherited keys ('constructor', 'toString', ...): SIDES is a plain
  // object literal, so SIDES['constructor'] would otherwise resolve to
  // Object() rather than undefined and blow up the checks below.
  const profile = Object.prototype.hasOwnProperty.call(SIDES, side) ? SIDES[side] : undefined;
  if (!profile) return [];
  const caps = LENGTHS[length] || LENGTHS.standard;
  const sb = zones.sideboard || {};
  const pool = zones.pool || {};
  const out = [];
  // code defaults to ruleId; POOL-MIND and POOL-ELIGIBLE use distinct dotted
  // codes for their message shapes (POOL-MIND: per-character vs pool total;
  // POOL-ELIGIBLE: wrong card type vs forbidden race) while keeping one
  // ruleId so a single checkbox governs both.
  const emit = (ruleId, params = {}, code = ruleId) => {
    if (!isRuleEnabled(ruleId, ruleOverrides)) return;
    let severity = RULE_BY_ID.get(ruleId).severity;
    if (!tournament) severity = severity === 'error' ? 'warning' : 'info'; // casual: one notch down
    out.push({ ruleId, code, severity, params });
  };

  // Total copies per card across every zone; missing cards are skipped.
  const totals = new Map();
  for (const zoneMap of [quantities, sb, pool]) {
    for (const [id, n] of Object.entries(zoneMap)) {
      if (!cardsById.get(id)) continue;
      totals.set(id, (totals.get(id) || 0) + n);
    }
  }
  const entries = [...totals.entries()].map(([id, count]) => ({ id, count, card: cardsById.get(id) }));
  const name = (c) => (c.name && (c.name.en || Object.values(c.name)[0])) || c.id;

  // --- avatar ---
  const avatars = entries.filter((e) => (e.card.attributes || {}).avatar === true);
  if (avatars.length === 0) emit('AVATAR-PRESENT', { side });
  const avatarCount = avatars.reduce((s, e) => s + e.count, 0);
  // Fires on total copies, not distinct avatar cards: 3 copies of one avatar
  // is exactly as illegal as 2 different avatars. `names` is left as an
  // array — joining into a sentence is a UI/i18n concern, not this layer's.
  if (avatarCount > 1) emit('AVATAR-UNIQUE', { count: avatarCount, names: avatars.map((e) => name(e.card)), ids: avatars.map((e) => e.id) });
  for (const e of avatars) {
    if (e.card.alignment !== profile.avatarAlignment) emit('AVATAR-SIDE', { id: e.id, name: name(e.card), side });
  }
  const avatarName = avatars.length === 1 ? name(avatars[0].card) : null;
  const avatarId = avatars.length === 1 ? avatars[0].id : null;

  // --- per-card checks ---
  const bannedSet = bannedFor(cardsById, side);
  for (const e of entries) {
    const c = e.card; const a = c.attributes || {};
    const balrogExempt = profile.specificMode === 'balrog-exempt' && a.specific === 'Balrog';

    if (bannedSet.has(e.id)) emit('BANNED', { id: e.id, name: name(c), side });

    if (!a.avatar && !balrogExempt && !profile.alignments.includes(c.alignment)) {
      emit('ALIGN-LEGAL', { id: e.id, name: name(c), alignment: c.alignment, side });
    }

    if (profile.specificMode === 'avatar-match' && a.specific && a.specific !== 'Balrog' && avatarName && !avatarName.includes(a.specific)) {
      emit('SPECIFIC-AVATAR', { id: e.id, name: name(c), wizard: a.specific, avatar: avatarName, avatarId });
    }

    if (c.type === 'Site') {
      // 1 copy per site; a Darkhaven/Wizardhaven ({H} siteType) is unlimited,
      // but only for the side whose alignment it matches (e.g. a Minion-
      // alignment haven is unlimited for ringwraith, not for wizard).
      const unlimited = a.siteType === '{H}' && profile.alignments.concat(profile.avatarAlignment).includes(c.alignment);
      if (e.count > 1 && !unlimited) emit('SITE-COPIES', { id: e.id, name: name(c), count: e.count });
    } else if (!a.avatar) {
      const limit = profile.copies.byAlignment[c.alignment] ?? profile.copies.default;
      if (!a.unique && e.count > limit) emit('COPIES-LIMIT', { id: e.id, name: name(c), count: e.count, limit, excess: e.count - limit, side });
      if (a.unique && e.count > 1) emit('UNIQUE-LIMIT', { id: e.id, name: name(c), count: e.count });
    }

    if (side === 'balrog' && c.type === 'Character' && !a.avatar && !balrogExempt) {
      const race = String(a.race || '');
      if (profile.pool.requireRaces && !profile.pool.requireRaces.some((r) => race.includes(r))) {
        emit('BALROG-RACE', { id: e.id, name: name(c), race });
      }
      const mind = toInt(a.mind);
      if (mind != null && profile.pool.balrogMindPerCharacterLimit != null && mind >= profile.pool.balrogMindPerCharacterLimit) {
        emit('BALROG-MIND', { id: e.id, name: name(c), mind, limit: profile.pool.balrogMindPerCharacterLimit });
      }
    }
  }

  // --- deck sizes ---
  let playCount = 0, locationCount = 0;
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    if (backGroupForType(c.type) === 'locationdeck') locationCount += n; else playCount += n;
  }
  if (profile.playDeck && (playCount < profile.playDeck.min || playCount > profile.playDeck.max)) {
    emit('DECKSIZE-PLAY', { count: playCount, min: profile.playDeck.min, max: profile.playDeck.max, side });
  }
  if (locationCount === 0 && playCount > 0) emit('DECKSIZE-LOCATION', { count: locationCount, min: 1 });

  // --- sideboard ---
  const sbCount = Object.entries(sb).reduce((s, [id, n]) => s + (cardsById.get(id) ? n : 0), 0);
  if (sbCount > caps.sideboardMax) emit('SIDEBOARD-MAX', { count: sbCount, max: caps.sideboardMax, length });

  // --- pool ---
  let poolChars = 0, poolItems = 0, poolMind = 0;
  for (const [id, n] of Object.entries(pool)) {
    const c = cardsById.get(id); if (!c) continue;
    const a = c.attributes || {};
    // zonesFor (zones.js) is the single source of truth for what may sit in
    // the pool — the same function Phase 3's drag-and-drop will consult —
    // so eligibility is derived from it rather than re-decided here.
    const z = zonesFor(c);
    const poolEligible = z.primary === 'pool' || z.extra.includes('pool');
    if (!poolEligible) {
      emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'type' }, 'POOL-ELIGIBLE.type');
      continue;
    }
    if (c.type === 'Character') {
      poolChars += n; poolMind += (toInt(a.mind) || 0) * n;
      // Race exclusion is a separate rule concern from zone eligibility:
      // a character can be pool-eligible by type yet still forbidden by race.
      if (profile.pool.forbidRaces.some((r) => String(a.race || '').includes(r))) {
        emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'race', race: String(a.race || '') }, 'POOL-ELIGIBLE.race');
      }
      if (profile.pool.mindPerCharacterMax != null && (toInt(a.mind) || 0) > profile.pool.mindPerCharacterMax) {
        emit('POOL-MIND', { id, name: name(c), mind: toInt(a.mind), limit: profile.pool.mindPerCharacterMax }, 'POOL-MIND.char');
      }
    } else if (c.type === 'Resource' && a.playableAsStartingMinorItem === true) {
      poolItems += n;
    }
  }
  if (poolChars > profile.pool.maxCharacters) emit('POOL-CHARS', { count: poolChars, max: profile.pool.maxCharacters, side });
  if (profile.pool.mindCap != null && poolMind > profile.pool.mindCap) emit('POOL-MIND', { total: poolMind, max: profile.pool.mindCap }, 'POOL-MIND.total');
  if (poolItems > profile.pool.maxMinorItems) emit('POOL-ITEMS', { count: poolItems, max: profile.pool.maxMinorItems, side });

  const rank = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
