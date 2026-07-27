// Rule metadata, separate from the validator so copies.js can read
// isRuleEnabled without importing validate.js (which imports copies.js --
// that would be a cycle).
//
// Every rule cites the clause it comes from: `ref` for one clause, `refs` for
// a rule covering several, and `house: true` for the advisories that are ours
// rather than the source's -- those must never display a citation.
// `hard: true` marks a per-card copy cap the + button enforces (lot 1b).
//
// Severity follows the citation: section 1 is hard deck-construction
// legality, so any rule citing a clause is `error`. House advisories are our
// own judgement calls rather than the source's, so they stay `warning`.
// Casual mode already downgrades every severity one notch (see validate.js),
// so that's the soft path -- no separate warning-vs-error toggle is needed.
export const COE = 'https://www.councilofelrond.org/rules/#Section1';

export const RULES = [
  // -- avatars --
  { id: 'AVATAR-PRESENT', severity: 'warning', status: 'verified', house: true, source: COE },
  // 1.5 + 1.6 -- per-avatar copy cap, cumulative across every zone. Hard.
  { id: 'AVATAR-COPIES', severity: 'error', status: 'verified', refs: ['1.5', '1.6'], hard: true, source: COE },
  // 1.6.2 -- one copy of each avatar in the sideboard, on top of the total
  // cap above. Owner's reading (2026-07-26); stricter than the printed
  // sentence, which permits two copies of one avatar there.
  { id: 'AVATAR-SIDEBOARD', severity: 'error', status: 'verified', ref: '1.6.2', hard: true, interpretation: true, source: COE },
  // 1.5 -- play-deck composition: a sum over different cards, not a copy cap.
  { id: 'AVATAR-COUNT', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'AVATAR-MULTIPLES', severity: 'error', status: 'verified', ref: '1.6.2', source: COE },
  { id: 'AVATAR-SIDE', severity: 'error', status: 'verified', refs: ['1.3.W1', '1.3.R1', '1.3.F3', '1.3.B1'], source: COE },

  // -- card legality --
  { id: 'ALIGN-LEGAL', severity: 'error', status: 'verified', refs: ['1.3.W3', '1.3.R3', '1.3.F4', '1.3.B3'], source: COE },
  // The Fallen-wizard list is printed as 1.5.F6, a numbering typo for 1.3.F6.
  { id: 'BANNED', severity: 'error', status: 'verified', refs: ['1.3.F6', '1.3.B5'], printedAs: { '1.3.F6': '1.5.F6' }, source: COE },
  { id: 'SPECIFIC-AVATAR', severity: 'error', status: 'verified', ref: '1.3.4', source: COE },
  { id: 'SPECIFIC-SIDE', severity: 'error', status: 'verified', ref: '1.3.4', source: COE },
  { id: 'AGENT-MIND', severity: 'error', status: 'verified', ref: '1.3.2', source: COE },

  // -- copy caps, hard-enforced from lot 1b --
  { id: 'COPIES-LIMIT', severity: 'error', status: 'verified', refs: ['1.3.1', '1.3.F1'], hard: true, source: COE },
  { id: 'UNIQUE-LIMIT', severity: 'error', status: 'verified', ref: '1.3.1', hard: true, source: COE },
  { id: 'SITE-COPIES', severity: 'error', status: 'verified', refs: ['1.4', '1.4.F1'], hard: true, source: COE },
  { id: 'REGION-EXCLUDED', severity: 'error', status: 'verified', ref: '1.4', source: COE },

  // -- Balrog-specific --
  { id: 'BALROG-RACE', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },
  { id: 'BALROG-MIND', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },

  // -- deck sizes --
  // 1.5 -- the play deck's four independent budgets: resources, hazards
  // (exactly matching resources), non-avatar characters, avatars. Replaces
  // DECKSIZE-PLAY, which wrongly applied one 25-50 range to every card.
  { id: 'DECKSIZE-RESOURCES', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'DECKSIZE-HAZARDS', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'DECKSIZE-CHARS', severity: 'error', status: 'verified', ref: '1.5', source: COE },
  { id: 'DECKSIZE-LOCATION', severity: 'warning', status: 'verified', house: true, source: COE },
  { id: 'SIDEBOARD-MAX', severity: 'error', status: 'verified', ref: '1.6.1', source: COE },

  // -- starting pool --
  { id: 'POOL-CHARS', severity: 'error', status: 'verified', ref: '1.7', source: COE },
  { id: 'POOL-ITEMS', severity: 'error', status: 'verified', ref: '1.7', source: COE },
  { id: 'POOL-ELIGIBLE', severity: 'error', status: 'verified', ref: '1.7', source: COE },
].map((r) => ({ ...r, defaultEnabled: r.status === 'verified' }));

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// The clauses a rule cites, normalised to an array. Empty for house rules.
export function ruleRefs(rule) {
  if (!rule || rule.house) return [];
  if (rule.refs) return rule.refs;
  return rule.ref ? [rule.ref] : [];
}

export function isRuleEnabled(ruleId, ruleOverrides = {}) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return false; // unknown / retired ids are ignored
  return ruleOverrides[ruleId] ?? rule.defaultEnabled;
}
