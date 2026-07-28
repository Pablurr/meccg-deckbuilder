// Per-card copy caps -- the single source of truth, read by both the validator
// (which reports) and the + buttons (which refuse). Keeping one function means
// the counter and the warning can never drift apart; the agreement test in
// test/rules.test.js is what holds that guarantee.
//
// Caps are CUMULATIVE across zones. 1.6 says a sideboard must not exceed "the
// allowed maximum number of each specific card across the whole deck", and 1.7
// says the same for the pool while carving out only the character COUNT, never
// a copy cap. So scope 'total' is the default: a unique card in the sideboard
// cannot also be in the play deck.
//
// A { zone } scope is an ADDITIONAL restriction layered on top of a total cap,
// never a replacement for it. Only 1.6.2 needs one: one copy of each avatar in
// the sideboard, out of the three that avatar may have in the whole deck.
import { SIDES, GENERAL } from './sides.js';
import { isRuleEnabled } from './catalog.js';
import { roleFor } from './roles.js';

// 1.3.1 / 1.3.F1 -- the first entry whose bucket and alignment both match.
// An entry with neither is the catch-all.
export function copyLimitFor(profile, role) {
  for (const rule of profile.copies) {
    if (rule.bucket && rule.bucket !== role.bucket) continue;
    if (rule.alignment && rule.alignment !== role.effectiveAlignment) continue;
    return rule.limit;
  }
  return GENERAL.copiesDefault;
}

export function copyCaps(card, { side, ruleOverrides = {} } = {}) {
  // Reject inherited keys ('constructor', 'toString', ...): SIDES is a plain
  // object literal, so SIDES['constructor'] would resolve to Object().
  const profile = Object.prototype.hasOwnProperty.call(SIDES, side) ? SIDES[side] : undefined;
  if (!profile || !card) return [];
  const a = card.attributes || {};
  const on = (id) => isRuleEnabled(id, ruleOverrides);
  const caps = [];

  // 1.3.1 exempts avatars from the unique rule ("each unique NON-avatar card"),
  // so they have their own pair of caps.
  if (a.avatar === true) {
    if (on('AVATAR-COPIES')) {
      caps.push({ limit: GENERAL.avatarMaxCopies, scope: 'total', ruleId: 'AVATAR-COPIES' });
    }
    if (on('AVATAR-SIDEBOARD')) {
      caps.push({ limit: GENERAL.avatarMaxInSideboard, scope: { zone: 'sideboard' }, ruleId: 'AVATAR-SIDEBOARD' });
    }
    return caps;
  }

  // 1.4 -- one copy of each non-haven site. A haven ({H}) is unlimited, but
  // only for a side whose location deck may hold that alignment: a Minion
  // Darkhaven is unlimited for a Ringwraith, not for a Wizard.
  if (card.type === 'Site') {
    const unlimited = a.siteType === '{H}'
      && profile.alignments.concat(profile.avatarAlignment).includes(card.alignment);
    if (!unlimited && on('SITE-COPIES')) {
      caps.push({ limit: GENERAL.siteMax, scope: 'total', ruleId: 'SITE-COPIES' });
    }
    return caps;
  }

  if (a.unique) {
    if (on('UNIQUE-LIMIT')) {
      caps.push({ limit: GENERAL.uniqueMax, scope: 'total', ruleId: 'UNIQUE-LIMIT' });
    }
    return caps;
  }

  if (on('COPIES-LIMIT')) {
    const limit = copyLimitFor(profile, roleFor(card, side));
    caps.push({ limit, scope: 'total', ruleId: 'COPIES-LIMIT' });
  }
  return caps;
}

// How many more copies of `card` may be added to `zone`, and which rule stops
// it. `remaining` is Infinity when nothing caps the card at all.
export function remainingCopies(card, zone, { quantities = {}, zones = {} } = {}, ctx = {}) {
  if (!card) return { remaining: Infinity, ruleId: null };
  const caps = copyCaps(card, ctx);
  if (caps.length === 0) return { remaining: Infinity, ruleId: null };
  const countIn = (z) => ((z === 'deck' ? quantities : (zones[z] || {}))[card.id] || 0);
  const total = countIn('deck') + countIn('sideboard') + countIn('pool');
  let remaining = Infinity;
  let ruleId = null;
  for (const cap of caps) {
    let used;
    if (cap.scope === 'total') used = total;
    else if (cap.scope.zone === zone) used = countIn(zone);
    else continue; // a zone cap on another zone does not constrain this one
    const left = cap.limit - used;
    if (left < remaining) { remaining = left; ruleId = cap.ruleId; }
  }
  return { remaining: remaining === Infinity ? Infinity : Math.max(0, remaining), ruleId };
}
