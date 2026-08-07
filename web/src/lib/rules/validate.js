// Pure deck validator. Emits translatable descriptors, never sentences.
// A rule that is disabled (per-deck override, or unverified by default)
// is not evaluated at all. validateDeck itself never blocks -- it only
// reports. The one thing that blocks is a per-card copy cap: copies.js's
// remainingCopies is consulted directly by the + button, which refuses a
// copy past the limit, independently of this file.
import { SIDES, GENERAL, SPECIFIC_TO_SIDES, raceAllowed } from './sides.js';
import { LENGTHS, SIDEBOARD_FW_MAX } from './formats.js';
import { resolveBanned } from './banned.js';
import { backGroupForType } from '../deck.js';
import { zonesFor } from './zones.js';
import { RULES, RULE_BY_ID, isRuleEnabled } from './catalog.js';
import { copyCaps } from './copies.js';
import { roleFor } from './roles.js';
import { siteIndex } from './sites.js';
import { matchesRace } from './races.js';

// Re-exported so importers keep one entry point into the rules layer.
export { RULES, isRuleEnabled };

const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

// 1.5 -- the play deck's four budgets, over disjoint buckets derived from
// roleFor (so a Wizard's agents land in `hazards`, not `characters`).
//
// Flexible cards (1.3.3: playable as resource or hazard) are assigned the way
// that keeps the deck legal, rather than asking the user to declare each one.
// Only 6 cards carry the flags, so a linear scan over the possible splits is
// ample. 1.3.F2 caps how many copies of each may count as a resource.
export function bucketCounts(quantities, cardsById, side) {
  const counts = { resources: 0, hazards: 0, characters: 0, avatars: 0, flexAssignedToResource: 0 };
  const flex = []; // { count, maxAsResource, minAsResource }
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    const r = roleFor(c, side);
    if (r.bucket === 'site' || r.bucket === 'region') continue;
    if (r.bucket === 'avatar') { counts.avatars += n; continue; }
    if (r.bucket === 'character') { counts.characters += n; continue; }
    if (r.flexible) {
      const cap = r.flexible.maxAsAlt == null ? n : Math.min(n, r.flexible.maxAsAlt);
      // `alt` is the bucket the card may move TO; the rest stay in `bucket`.
      if (r.flexible.alt === 'resource') flex.push({ count: n, maxAsResource: cap, minAsResource: 0 });
      else flex.push({ count: n, maxAsResource: n, minAsResource: n - cap });
      continue;
    }
    if (r.bucket === 'resource') counts.resources += n;
    else counts.hazards += n;
  }
  const flexTotal = flex.reduce((s, f) => s + f.count, 0);
  const minR = flex.reduce((s, f) => s + f.minAsResource, 0);
  const maxR = flex.reduce((s, f) => s + f.maxAsResource, 0);
  const { resourcesMin, resourcesMax } = GENERAL.playDeck;
  let best = null;
  for (let r = minR; r <= maxR; r++) {
    const resources = counts.resources + r;
    const hazards = counts.hazards + (flexTotal - r);
    const violation = (resources < resourcesMin ? resourcesMin - resources : 0)
      + (resources > resourcesMax ? resources - resourcesMax : 0)
      + Math.abs(hazards - resources);
    if (best === null || violation < best.violation) best = { r, resources, hazards, violation };
    if (violation === 0) break;
  }
  if (best) {
    counts.resources = best.resources;
    counts.hazards = best.hazards;
    counts.flexAssignedToResource = best.r;
  }
  return counts;
}

// resolveBanned walks all 1683 cards; validateDeck runs on every deck edit, so
// cache the resolution against the card index identity (a Map built once in App).
let _banned = { key: null, value: null };
function bannedFor(cardsById, side) {
  if (_banned.key !== cardsById) _banned = { key: cardsById, value: resolveBanned([...cardsById.values()]) };
  return _banned.value.bySide[side] || new Set();
}

// [...cardsById.values()] allocates a new array each call, which would defeat
// siteIndex's own memo (keyed on array identity). Cache on cardsById itself,
// the same trick bannedFor uses above.
let _siteInfo = { key: null, value: null };
function siteInfoFor(cardsById) {
  if (_siteInfo.key !== cardsById) _siteInfo = { key: cardsById, value: siteIndex([...cardsById.values()]) };
  return _siteInfo.value;
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
  const sbFw = zones.sideboardFw || {};
  const zoneMaps = { sideboard: sb, pool, sideboardFw: sbFw };
  const out = [];
  // code defaults to ruleId; POOL-ITEMS and POOL-ELIGIBLE use a dotted code
  // for their message shape (POOL-ELIGIBLE currently fires only for the
  // wrong-card-type reason) while keeping one ruleId so a single checkbox
  // governs each.
  const emit = (ruleId, params = {}, code = ruleId) => {
    if (!isRuleEnabled(ruleId, ruleOverrides)) return;
    let severity = RULE_BY_ID.get(ruleId).severity;
    if (!tournament) severity = severity === 'error' ? 'warning' : 'info'; // casual: one notch down
    out.push({ ruleId, code, severity, params });
  };

  // Total copies per card across every zone; missing cards are skipped.
  const totals = new Map();
  for (const zoneMap of [quantities, sb, pool, sbFw]) {
    for (const [id, n] of Object.entries(zoneMap)) {
      if (!cardsById.get(id)) continue;
      totals.set(id, (totals.get(id) || 0) + n);
    }
  }
  const entries = [...totals.entries()].map(([id, count]) => ({ id, count, card: cardsById.get(id) }));
  const name = (c) => (c.name && (c.name.en || Object.values(c.name)[0])) || c.id;

  // --- avatars ---
  const avatarEntries = entries.filter((e) => (e.card.attributes || {}).avatar === true);
  if (avatarEntries.length === 0) emit('AVATAR-PRESENT', { side });
  for (const e of avatarEntries) {
    if (e.card.alignment !== profile.avatarAlignment) emit('AVATAR-SIDE', { id: e.id, name: name(e.card), side });
  }

  // 1.5 + 1.6 + 1.6.2 -- AVATAR-COPIES (whole-deck cap) and AVATAR-SIDEBOARD
  // (sideboard sub-cap) are emitted from the unified copyCaps loop below, the
  // same source the + buttons consult -- not duplicated here.

  // 1.5 -- the PLAY DECK holds up to three avatars, "any combination allowed
  // except for three different avatars". Scoped to `quantities`; the sideboard
  // has its own allowance (1.6.2).
  const playAvatars = avatarEntries
    .map((e) => ({ e, count: quantities[e.id] || 0 }))
    .filter((x) => x.count > 0);
  const playNames = playAvatars.map((x) => name(x.e.card));
  const playIds = playAvatars.map((x) => x.e.id);
  const playTotal = playAvatars.reduce((s, x) => s + x.count, 0);
  if (playTotal > GENERAL.avatarMaxInPlayDeck) {
    emit('AVATAR-COUNT', { count: playTotal, max: GENERAL.avatarMaxInPlayDeck, names: playNames, ids: playIds }, 'AVATAR-COUNT.total');
  }
  if (playAvatars.length > GENERAL.avatarMaxDistinct) {
    emit('AVATAR-COUNT', { distinct: playAvatars.length, max: GENERAL.avatarMaxDistinct, names: playNames, ids: playIds }, 'AVATAR-COUNT.distinct');
  }

  // 1.6.2 -- at most one avatar may have multiple copies across the play deck
  // and the sideboard combined. With the sideboard capped at one copy, the
  // allowance is spent either by an avatar held 2-3x in the play deck or by the
  // same avatar appearing once in each zone.
  const multiples = avatarEntries.filter((e) => (quantities[e.id] || 0) + (sb[e.id] || 0) >= 2);
  if (multiples.length > GENERAL.avatarMaxWithMultiples) {
    emit('AVATAR-MULTIPLES', {
      count: multiples.length, max: GENERAL.avatarMaxWithMultiples,
      names: multiples.map((e) => name(e.card)), ids: multiples.map((e) => e.id),
    });
  }

  // SPECIFIC-AVATAR needs "the" declared avatar, which is only unambiguous
  // when the deck names exactly one distinct avatar card.
  const avatarName = avatarEntries.length === 1 ? name(avatarEntries[0].card) : null;
  const avatarId = avatarEntries.length === 1 ? avatarEntries[0].id : null;

  // --- per-card checks ---
  const bannedSet = bannedFor(cardsById, side);
  const siteInfo = siteInfoFor(cardsById);
  for (const e of entries) {
    const c = e.card; const a = c.attributes || {};
    const balrogExempt = profile.specificMode === 'balrog-exempt' && a.specific === 'Balrog';
    // 1.4.1 -- the five Balrog sites with no hero/minion counterpart are open
    // to every camp. Both SITE-SIDE and ALIGN-LEGAL must honour the exemption
    // (sides.js isLegalForSide already does, for the browser filter) or a
    // card the browser presents as legal gets contradicted by the validator.
    const openBalrogSite = c.type === 'Site' && siteInfo.openBalrog.has(e.id);

    if (bannedSet.has(e.id)) emit('BANNED', { id: e.id, name: name(c), side });

    if (!a.avatar && !balrogExempt && !openBalrogSite && !profile.alignments.includes(c.alignment)) {
      emit('ALIGN-LEGAL', { id: e.id, name: name(c), alignment: c.alignment, side });
    }

    // 1.3.4 -- a card specific to an avatar this side cannot declare at all.
    // Distinct from SPECIFIC-AVATAR, which is the finer per-avatar check for a
    // side that *can* declare the named avatar. Avatars are excluded: BA-3
    // (the Balrog avatar) is the only avatar carrying `specific`, and a
    // mismatched avatar is already reported, more clearly, by AVATAR-SIDE.
    if (a.specific && !a.avatar && !(SPECIFIC_TO_SIDES[a.specific] || []).includes(side)) {
      emit('SPECIFIC-SIDE', { id: e.id, name: name(c), specific: a.specific, side });
    }

    // 1.4 -- "no region cards, which are generally replaced with a map for
    // tournament play".
    if (c.type === 'Region') emit('REGION-EXCLUDED', { id: e.id, name: name(c) });

    // 1.4.W1/R1/F1/B1 -- a location deck holds only the side's own sites, plus
    // the five Balrog sites 1.4.1 opens to everyone.
    if (c.type === 'Site'
        && !profile.locationDeck.alignments.includes(c.alignment)
        && !openBalrogSite) {
      emit('SITE-SIDE', { id: e.id, name: name(c), alignment: c.alignment, side });
    }

    // 1.4.B1 -- a Balrog player must use the Balrog version of Moria, Carn Dum,
    // Dol Guldur, Minas Morgul, every Under-deeps site and every Dark-hold.
    // Urlurtsu Nurn (LE-409) has no Balrog version, so it is unavailable rather
    // than swappable -- two different messages.
    if (profile.locationDeck.requireBalrogVersion && siteInfo.needsBalrogVersion(c)) {
      const code = siteInfo.hasBalrogVersion(c) ? 'SITE-BALROG-VERSION.swap' : 'SITE-BALROG-VERSION.none';
      emit('SITE-BALROG-VERSION', { id: e.id, name: name(c) }, code);
    }

    if (profile.specificMode === 'avatar-match' && a.specific && a.specific !== 'Balrog' && avatarName && !avatarName.includes(a.specific)) {
      emit('SPECIFIC-AVATAR', { id: e.id, name: name(c), wizard: a.specific, avatar: avatarName, avatarId });
    }

    // Copy caps all come from copies.js -- the same function the + buttons
    // consult -- so a card the counter refuses is exactly a card this reports.
    // `e.count` is already the deck + both sideboards + pool total.
    for (const cap of copyCaps(c, { side, ruleOverrides })) {
      const used = cap.scope === 'total'
        ? e.count
        : cap.scope.zones.reduce((n, z) => n + ((zoneMaps[z] || {})[e.id] || 0), 0);
      if (used <= cap.limit) continue;
      emit(cap.ruleId, {
        id: e.id, name: name(c), count: used,
        limit: cap.limit, max: cap.limit, excess: used - cap.limit, side,
      });
    }

    if (side === 'balrog' && c.type === 'Character' && !a.avatar && !balrogExempt) {
      const race = String(a.race || '');
      if (profile.characterRaces && !raceAllowed(c, side)) {
        emit('BALROG-RACE', { id: e.id, name: name(c), race });
      }
      const mind = toInt(a.mind);
      if (mind != null && profile.characterMindLimit != null && mind >= profile.characterMindLimit) {
        emit('BALROG-MIND', { id: e.id, name: name(c), mind, limit: profile.characterMindLimit });
      }
    }

    // 1.3.B4 -- faction races. "Faction" here is the game's card category
    // (marshallingPointsType 'faction'), never a player camp.
    if (profile.factionRaces && a.marshallingPointsType === 'faction'
        && !profile.factionRaces.some((r) => matchesRace(a.race, r))) {
      emit('FACTION-RACE', { id: e.id, name: name(c), race: String(a.race || '') });
    }
  }

  // --- agents (1.3.2) ---
  // "The total mind of all agent cards in the entirety of a player's deck
  // (i.e. their play deck, sideboard, and pool combined) cannot exceed 36."
  // Counts agent cards however a side later classifies them (character for
  // Ringwraith/Fallen-wizard, hazard for Wizard/Balrog), so it needs no role
  // derivation -- attributes.agent is enough.
  let agentMind = 0;
  for (const e of entries) {
    const a = e.card.attributes || {};
    if (a.agent === true) agentMind += (toInt(a.mind) || 0) * e.count;
  }
  if (agentMind > GENERAL.agentMindMax) emit('AGENT-MIND', { total: agentMind, max: GENERAL.agentMindMax });

  // --- deck sizes ---
  let locationCount = 0;
  let playCount = 0;
  for (const [id, n] of Object.entries(quantities)) {
    const c = cardsById.get(id); if (!c) continue;
    if (backGroupForType(c.type) === 'locationdeck') locationCount += n; else playCount += n;
  }
  const b = bucketCounts(quantities, cardsById, side);
  const pd = GENERAL.playDeck;
  if (playCount > 0) {
    if (b.resources < pd.resourcesMin || b.resources > pd.resourcesMax) {
      emit('DECKSIZE-RESOURCES', { count: b.resources, min: pd.resourcesMin, max: pd.resourcesMax });
    }
    if (b.hazards !== b.resources) emit('DECKSIZE-HAZARDS', { hazards: b.hazards, resources: b.resources });
    if (b.characters > pd.maxCharacters) emit('DECKSIZE-CHARS', { count: b.characters, max: pd.maxCharacters });

    // 1.5.1 -- "The hazard portion of a play deck must include at least 12
    // creatures", with the listed hazards worth half a creature each. The
    // rounding applies to the summed halves, not to each card.
    let creatureWeightSum = 0;
    for (const [id, n] of Object.entries(quantities)) {
      const c = cardsById.get(id); if (!c) continue;
      creatureWeightSum += roleFor(c, side).creatureWeight * n;
    }
    const creatures = Math.floor(creatureWeightSum);
    if (creatures < pd.minCreatures) emit('CREATURE-MIN', { count: creatures, min: pd.minCreatures });
  }
  if (locationCount === 0 && playCount > 0) emit('DECKSIZE-LOCATION', { count: locationCount, min: 1 });

  // --- sideboard ---
  const sbCount = Object.entries(sb).reduce((s, [id, n]) => s + (cardsById.get(id) ? n : 0), 0);
  if (sbCount > caps.sideboardMax) emit('SIDEBOARD-MAX', { count: sbCount, max: caps.sideboardMax, length });

  // --- Fallen-wizard sideboard (1.6.1) ---
  // Counted and capped on its own: these ten cards are "additional", so they
  // never enter sbCount and SIDEBOARD-MAX never sees them.
  const sbFwCount = Object.entries(sbFw).reduce((s, [id, n]) => s + (cardsById.get(id) ? n : 0), 0);
  if (sbFwCount > SIDEBOARD_FW_MAX) emit('SIDEBOARD-FW-MAX', { count: sbFwCount, max: SIDEBOARD_FW_MAX });

  // --- pool ---
  let poolChars = 0, poolItems = 0;
  for (const [id, n] of Object.entries(pool)) {
    const c = cardsById.get(id); if (!c) continue;
    // zonesFor (zones.js) is the single source of truth for what may sit in
    // the pool -- the same function drag-and-drop consults -- so eligibility
    // is derived from it rather than re-decided here.
    const z = zonesFor(c);
    const poolEligible = z.primary === 'pool' || z.extra.includes('pool');
    if (!poolEligible) {
      emit('POOL-ELIGIBLE', { id, name: name(c), reason: 'type' }, 'POOL-ELIGIBLE.type');
      continue;
    }
    if (c.type === 'Character') poolChars += n;
    else if (c.type === 'Resource') {
      // 1.7 -- "up to two non-unique, non-hoard minor items". The qualifier is
      // about minor items; the six permanent-events playable "in lieu of a
      // minor item" enter on their own card text, so it does not apply to
      // them, but they still occupy an item slot and must count toward the
      // cap below. 1.7.F1's Stage resource permanent-events are a separate
      // family with their own budget (POOL-STAGE below) and must NOT also
      // count here -- same minor-item-family test zonesFor uses to route a
      // card to the pool at all, minus the Stage branch.
      const a = c.attributes || {};
      const isMinorItemFamily = a.subtype === 'Minor Item' || a.playableAsStartingMinorItem === true;
      if (isMinorItemFamily) {
        poolItems += n;
        if (a.subtype === 'Minor Item') {
          if (a.unique) emit('POOL-ITEMS', { id, name: name(c) }, 'POOL-ITEMS.unique');
          if ((a.keywords || []).includes('Hoard Item')) emit('POOL-ITEMS', { id, name: name(c) }, 'POOL-ITEMS.hoard');
        }
      }
    }
  }
  if (poolChars > profile.pool.maxCharacters) emit('POOL-CHARS', { count: poolChars, max: profile.pool.maxCharacters, side });
  if (poolItems > profile.pool.maxMinorItems) emit('POOL-ITEMS', { count: poolItems, max: profile.pool.maxMinorItems, side }, 'POOL-ITEMS.count');

  // 1.7.F1 -- the Fallen-wizard stage pool.
  const stageReq = profile.pool.stagePoints;
  if (stageReq) {
    // I4 -- a brand-new deck (pool untouched) must not greet the player with
    // a "0 of 3 stage points" error before they've added a single card.
    // Gated on the pool zone holding ANY recognized card, not on `count`
    // below (qualifying Permanent-event Stage resources only): a pool full
    // of wrong-type stage cards -- WH-86/87/88, or the WH-55 site case below
    // -- must still be reported non-compliant, since the player has started
    // building it and simply has zero real stage points banked.
    const poolNonEmpty = Object.entries(pool).some(([id, n]) => n > 0 && cardsById.get(id));
    let points = 0, count = 0, nonUnique = 0;
    for (const [id, n] of Object.entries(pool)) {
      const c = cardsById.get(id); if (!c) continue;
      const a = c.attributes || {};
      // stagePoints also appears on Fallen-wizard SITES (WH-55 Deep Mines = 3,
      // WH-57 Rhosgobel = 1), which are not stage resources. It also appears
      // on five Stage resources that are not Permanent-events (WH-86/WH-87
      // subtype Faction, WH-88/WH-89 subtype Special Item, WH-114 subtype
      // Ally) -- CoE 1.7.F1 names "Stage resource permanent-events"
      // specifically, so the subtype must be checked too, not just alignment
      // and type.
      if (c.alignment !== 'Stage' || c.type !== 'Resource' || a.subtype !== 'Permanent-event') continue;
      // WH-22 spells its value "2(3)" -- take the leading integer.
      points += (toInt(a.stagePoints) || 0) * n;
      count += n;
      if (!a.unique) nonUnique += n;
    }
    if (poolNonEmpty && points !== stageReq.total) emit('POOL-STAGE', { total: points, required: stageReq.total }, 'POOL-STAGE.points');
    if (count > stageReq.maxCards) emit('POOL-STAGE', { count, max: stageReq.maxCards }, 'POOL-STAGE.count');
    if (count > 0 && nonUnique < stageReq.minNonUnique) emit('POOL-STAGE', { min: stageReq.minNonUnique }, 'POOL-STAGE.nonUnique');
  }

  const rank = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
