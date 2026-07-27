// Rule metadata, separate from the validator so copies.js can read
// isRuleEnabled without importing validate.js (which imports copies.js --
// that would be a cycle).
//
// Every rule cites the clause it comes from: `ref` for one clause, `refs` for
// a rule covering several, and `house: true` for the advisories that are ours
// rather than the source's -- those must never display a citation.
// `hard: true` marks a per-card copy cap the + button enforces (lot 1b).
export const COE = 'https://www.councilofelrond.org/rules/#Section1';

export const RULES = [
  // -- avatars --
  { id: 'AVATAR-PRESENT', severity: 'warning', status: 'verified', house: true, source: COE },
  // Contradicts 1.5 (up to three avatars, any combination but three different).
  // Disabled here, retired in lot 2 in favour of AVATAR-COUNT / AVATAR-COPIES.
  { id: 'AVATAR-UNIQUE', severity: 'error', status: 'unverified', house: true, source: COE },
  { id: 'AVATAR-SIDE', severity: 'error', status: 'verified', refs: ['1.3.W1', '1.3.R1', '1.3.F3', '1.3.B1'], source: COE },

  // -- card legality --
  { id: 'ALIGN-LEGAL', severity: 'error', status: 'verified', refs: ['1.3.W3', '1.3.R3', '1.3.F4', '1.3.B3'], source: COE },
  // The Fallen-wizard list is printed as 1.5.F6, a numbering typo for 1.3.F6.
  { id: 'BANNED', severity: 'error', status: 'verified', refs: ['1.3.F6', '1.3.B5'], printedAs: { '1.3.F6': '1.5.F6' }, source: COE },
  { id: 'SPECIFIC-AVATAR', severity: 'error', status: 'verified', ref: '1.3.4', source: COE },

  // -- copy caps, hard-enforced from lot 1b --
  { id: 'COPIES-LIMIT', severity: 'error', status: 'verified', refs: ['1.3.1', '1.3.F1'], hard: true, source: COE },
  { id: 'UNIQUE-LIMIT', severity: 'error', status: 'verified', ref: '1.3.1', hard: true, source: COE },
  { id: 'SITE-COPIES', severity: 'error', status: 'verified', refs: ['1.4', '1.4.F1'], hard: true, source: COE },

  // -- Balrog-specific --
  { id: 'BALROG-RACE', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },
  { id: 'BALROG-MIND', severity: 'error', status: 'verified', ref: '1.3.B4', source: COE },

  // -- deck sizes --
  // Contradicts 1.5. Disabled here, retired in lot 2.
  { id: 'DECKSIZE-PLAY', severity: 'warning', status: 'unverified', house: true, source: COE },
  { id: 'DECKSIZE-LOCATION', severity: 'warning', status: 'verified', house: true, source: COE },
  { id: 'SIDEBOARD-MAX', severity: 'error', status: 'verified', ref: '1.6.1', source: COE },

  // -- starting pool --
  { id: 'POOL-CHARS', severity: 'error', status: 'verified', ref: '1.7', source: COE },
  { id: 'POOL-MIND', severity: 'warning', status: 'unverified', house: true, source: COE },
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
