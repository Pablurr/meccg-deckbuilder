import { describe, it, expect } from 'vitest';
import {
  parseDeckList,
  parseDeckListDocument,
  importDeckList,
  buildNameIndex,
  resolveDeckList,
  normalizeName,
  preferredMatchId,
} from '../web/src/lib/importDeck.js';
import { buildDeckListText } from '../web/src/lib/deckList.js';

const cards = [
  { id: 'AS-1', name: { en: 'Bûrat', fr: 'Bûrat' } },
  { id: 'AS-58', name: { en: 'Angmarim', fr: 'Angmarim' }, alignment: 'Hero' },
  { id: 'AS-62', name: { en: 'Angmarim', fr: 'Angmarim' }, alignment: 'Minion' },
  { id: 'AS-44', name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin' } },
  { id: 'TW-1', name: { en: 'Star-glass', fr: 'Verre-étoile' } },
  { id: 'DM-1', name: { en: 'Thrór’s Map', fr: 'Carte de Thrór' } },
  { id: 'TW-350', name: { en: 'Bag End', fr: 'Cul-de-Sac' }, type: 'Site' },
];

describe('parseDeckList', () => {
  it('parses "Nx name", "N x name" and bare names', () => {
    const parsed = parseDeckList('1x burat\n2 x angmarim\n  \n3x All the Bells Ringing\nglamour');
    expect(parsed).toEqual([
      { raw: '1x burat', qty: 1, name: 'burat' },
      { raw: '2 x angmarim', qty: 2, name: 'angmarim' },
      { raw: '3x All the Bells Ringing', qty: 3, name: 'All the Bells Ringing' },
      { raw: 'glamour', qty: 1, name: 'glamour' },
    ]);
  });
});

describe('resolveDeckList', () => {
  const idx = buildNameIndex(cards);

  it('matches full names ignoring accents and case', () => {
    const [line] = resolveDeckList(parseDeckList('1x burat'), idx);
    expect(line.status).toBe('ok');
    expect(line.matches.map((c) => c.id)).toEqual(['AS-1']);
  });

  it('matches a French name', () => {
    const [line] = resolveDeckList(parseDeckList('2x sonner le tocsin'), idx);
    expect(line.status).toBe('ok');
    expect(line.matches[0].id).toBe('AS-44');
    expect(line.qty).toBe(2);
  });

  it('flags ambiguous names (hero/minion) with all matches', () => {
    const [line] = resolveDeckList(parseDeckList('2x angmarim'), idx);
    expect(line.status).toBe('ambiguous');
    expect(line.matches.map((c) => c.id).sort()).toEqual(['AS-58', 'AS-62']);
  });

  it('flags unknown names as notfound', () => {
    const [line] = resolveDeckList(parseDeckList('1x nonexistent card'), idx);
    expect(line.status).toBe('notfound');
    expect(line.matches).toEqual([]);
  });

  it('treats hyphen and space as interchangeable', () => {
    expect(resolveDeckList(parseDeckList('1x star glass'), idx)[0].matches[0]?.id).toBe('TW-1');
    expect(resolveDeckList(parseDeckList('1x star-glass'), idx)[0].matches[0]?.id).toBe('TW-1');
    expect(resolveDeckList(parseDeckList('1x STARGLASS'), idx)[0].matches[0]?.id).toBe('TW-1');
  });

  it('ignores apostrophes and punctuation', () => {
    expect(resolveDeckList(parseDeckList("1x thrors map"), idx)[0].matches[0]?.id).toBe('DM-1');
    expect(resolveDeckList(parseDeckList("1x thror's map"), idx)[0].matches[0]?.id).toBe('DM-1');
  });
});

describe('preferredMatchId', () => {
  const H = { id: 'H', alignment: 'Hero' };
  const M = { id: 'M', alignment: 'Minion' };
  const N = { id: 'N', alignment: 'Neutral' };
  const D = { id: 'D', alignment: 'Dual' };
  const B = { id: 'B', alignment: 'Balrog' };
  const F = { id: 'F', alignment: 'Fallen-wizard' };
  const S = { id: 'S', alignment: 'Stage' };

  it('returns null when there is no preference', () => {
    expect(preferredMatchId([H, M], '')).toBe(null);
    expect(preferredMatchId([H, M], null)).toBe(null);
  });

  it('Hero prefers hero over minion', () => {
    expect(preferredMatchId([M, H], 'hero')).toBe('H');
  });

  it('Hero prefers hero over neutral/dual', () => {
    expect(preferredMatchId([N, H, D], 'hero')).toBe('H');
  });

  it('Minion prefers minion over hero', () => {
    expect(preferredMatchId([H, M], 'minion')).toBe('M');
  });

  it('Balrog prefers balrog, then minion, then neutral/dual', () => {
    expect(preferredMatchId([N, M, B], 'balrog')).toBe('B');
    expect(preferredMatchId([N, M], 'balrog')).toBe('M');
    expect(preferredMatchId([N, H], 'balrog')).toBe('N'); // hero excluded, neutral wins
  });

  it('Fallen Wizard prefers fallen-wizard/stage', () => {
    expect(preferredMatchId([H, F], 'fallenWizard')).toBe('F');
    expect(preferredMatchId([M, S], 'fallenWizard')).toBe('S');
  });

  it('Fallen Wizard leaves a hero/minion pair for manual choice (tie -> null)', () => {
    expect(preferredMatchId([H, M], 'fallenWizard')).toBe(null);
  });

  it('returns null on a tie between equally-ranked matches', () => {
    expect(preferredMatchId([N, D], 'hero')).toBe(null);
  });

  it('returns null when no match qualifies under the preference', () => {
    expect(preferredMatchId([H], 'minion')).toBe(null); // only hero, excluded
    expect(preferredMatchId([H, S], 'minion')).toBe(null); // hero + stage, neither qualifies
  });
});

describe('normalizeName', () => {
  it('reduces names to bare alphanumerics, equivalently', () => {
    expect(normalizeName('Star-glass')).toBe(normalizeName('star glass'));
    expect(normalizeName('Thrór’s Map')).toBe(normalizeName('thrors map'));
    expect(normalizeName('Fire & Ice')).toBe(normalizeName('fire and ice'));
  });
});

// Legacy-compatibility gate on the REACHABLE path. ImportDialog.jsx calls
// parseDeckListDocument/importDeckList, never parseDeckList directly (it has
// zero production callers) — so that is what must be gated against these
// classic flat-paste shapes, not parseDeckList. Each case below mirrors a
// case above, run through the real entry point instead.
describe('parseDeckListDocument / importDeckList (reachable path — legacy compatibility)', () => {
  // The exact headingless input from the top of this file (line 15 in the
  // original layout): "Nx name" / "N x name" / bare-name lines, no "##"
  // heading anywhere. This is also exactly the shape ImportDialog.jsx's own
  // PLACEHOLDER advertises. A prior regression made parseDeckListDocument
  // start in a mode that only collects card lines once inside 'cards' mode,
  // which only triggers on a "##" heading — so a headingless paste like this
  // produced zero lines. See the report for the deliberate pre-fix failure
  // this test was used to prove.
  it('collects a bare headingless paste as main-deck card lines (the critical regression)', () => {
    const { notes, lines } = parseDeckListDocument('1x burat\n2 x angmarim\n  \n3x All the Bells Ringing\nglamour');
    expect(lines).toEqual([
      { raw: '1x burat', qty: 1, name: 'burat', target: 'quantities' },
      { raw: '2 x angmarim', qty: 2, name: 'angmarim', target: 'quantities' },
      { raw: '3x All the Bells Ringing', qty: 3, name: 'All the Bells Ringing', target: 'quantities' },
      { raw: 'glamour', qty: 1, name: 'glamour', target: 'quantities' },
    ]);
    expect(notes).toEqual({ starting: '', resourceStrategy: '', hazardStrategy: '', other: '' });
  });

  it('resolves that same headingless paste to real cards via importDeckList (the actual ImportDialog path)', () => {
    const { quantities, zones, unmatched } = importDeckList('1x burat\n2 x angmarim\n  \n3x All the Bells Ringing\nglamour', cards);
    // "glamour" alone has no matching card in this fixture set — notfound, not imported.
    expect(quantities).toEqual({ 'AS-1': 1, 'AS-58': 2, 'AS-44': 3 });
    // zones now always carries sideboardFw too (emptyZones(), final review C1-C4).
    expect(zones).toEqual({ pool: {}, sideboard: {}, sideboardFw: {} });
    expect(unmatched.map((l) => l.name)).toEqual(['glamour']);
  });

  it('never lets a site into the sideboard or the pool, whatever the paste says', () => {
    // Belt to the vocabulary's braces: even a list that spells the section
    // out ("## Sideboard" then a site by name) cannot produce an illegal
    // deck, because the zone a card may occupy is a rule, not a heading.
    const sb = importDeckList(['## Sideboard', '1x Bag End', '1x burat'].join('\n'), cards);
    expect(sb.zones.sideboard).toEqual({ 'AS-1': 1 });
    expect(sb.quantities).toEqual({ 'TW-350': 1 });

    const pool = importDeckList(['## Pool', '1x Bag End'].join('\n'), cards);
    expect(pool.zones.pool).toEqual({});
    expect(pool.quantities).toEqual({ 'TW-350': 1 });
  });

  it('reads a "Sites" section as the location deck, not as the section above it', () => {
    const { quantities, zones } = importDeckList(
      ['## Sideboard', '1x burat', '## Sites', '1x Bag End'].join('\n'),
      cards,
    );
    expect(zones.sideboard).toEqual({ 'AS-1': 1 });
    expect(quantities).toEqual({ 'TW-350': 1 });
  });

  it('matches a French name through the reachable path', () => {
    const { quantities } = importDeckList('2x sonner le tocsin', cards, 'fr');
    expect(quantities).toEqual({ 'AS-44': 2 });
  });

  it('flags ambiguous names (hero/minion) with all matches through the reachable path', () => {
    const { lines } = parseDeckListDocument('2x angmarim');
    const [line] = resolveDeckList(lines, buildNameIndex(cards));
    expect(line.status).toBe('ambiguous');
    expect(line.matches.map((c) => c.id).sort()).toEqual(['AS-58', 'AS-62']);
  });

  it('flags unknown names as notfound through the reachable path', () => {
    const { unmatched } = importDeckList('1x nonexistent card', cards);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].matches).toEqual([]);
  });

  it('treats hyphen and space as interchangeable through the reachable path', () => {
    expect(importDeckList('1x star glass', cards).quantities).toEqual({ 'TW-1': 1 });
    expect(importDeckList('1x star-glass', cards).quantities).toEqual({ 'TW-1': 1 });
    expect(importDeckList('1x STARGLASS', cards).quantities).toEqual({ 'TW-1': 1 });
  });

  it('ignores apostrophes and punctuation through the reachable path', () => {
    expect(importDeckList("1x thrors map", cards).quantities).toEqual({ 'DM-1': 1 });
    expect(importDeckList("1x thror's map", cards).quantities).toEqual({ 'DM-1': 1 });
  });

  it('still supports a "# title" line before the headingless body, dropping only the title', () => {
    const { lines } = parseDeckListDocument('# My Deck\n\n1x burat\n2x angmarim');
    expect(lines).toEqual([
      { raw: '1x burat', qty: 1, name: 'burat', target: 'quantities' },
      { raw: '2x angmarim', qty: 2, name: 'angmarim', target: 'quantities' },
    ]);
  });

  it('does not drop a note line that happens to start with "# " once a heading has been seen', () => {
    // Minor fix: the deck-title skip must only apply *before* any heading is
    // seen. A note body line starting with "# " (e.g. a user's own outline
    // syntax) must survive once we're inside a real section.
    const { notes } = parseDeckListDocument('# Deck Title\n\n## Notes\n\n### Other notes\n\n# 1 goal: ramp\nthen attack');
    expect(notes.other).toBe('# 1 goal: ramp\nthen attack');
  });
});

// Task 4 (agent-card-management) regression: importDeckList's bucketFor call
// gained a fourth argument, the camp read from the paste's own "Side:" line,
// so an agent card routes to the zone THAT camp actually gives it instead of
// the side-blind default. A call site that compiles fine and silently keeps
// the old side-blind behaviour is exactly the failure mode that already
// shipped once in this task (DeckPanel.jsx's two call sites, caught in
// review) -- this pins the import path against the same regression.
describe('agent camp routing via importDeckList (task 4 regression)', () => {
  // Hand-built, like every other fixture in this file: this suite tests text
  // parsing, not rules, and 'type'/'attributes.agent' are the only fields
  // zonesFor's agent branch reads.
  const agent = { id: 'AS-99', name: { en: 'Test Agent', fr: 'Agent test' }, type: 'Character', attributes: { agent: true } };
  const withAgent = [...cards, agent];

  it('a Wizard-side paste that files an agent under "## Pool" still lands it in the main deck (1.3.W2)', () => {
    const { quantities, zones } = importDeckList(
      ['## Metadata', '- Side: Wizard', '## Pool', '1x Test Agent'].join('\n'),
      withAgent,
    );
    expect(quantities).toEqual({ 'AS-99': 1 });
    expect(zones.pool).toEqual({});
  });

  it('a Ringwraith-side paste keeps the same agent in the pool (1.3.R2)', () => {
    const { quantities, zones } = importDeckList(
      ['## Metadata', '- Side: Ringwraith', '## Pool', '1x Test Agent'].join('\n'),
      withAgent,
    );
    expect(zones.pool).toEqual({ 'AS-99': 1 });
    expect(quantities).toEqual({});
  });

  it('a paste with no "Side:" line (freeform) is unchanged: the agent stays wherever it was filed', () => {
    const { quantities, zones } = importDeckList(['## Pool', '1x Test Agent'].join('\n'), withAgent);
    expect(zones.pool).toEqual({ 'AS-99': 1 });
    expect(quantities).toEqual({});
  });
});

// Final review, C1-C4: the export half of the Fallen-wizard sideboard worked
// (## Sideboard vs FW was written correctly), but the import half crashed --
// bucketFor(card, 'sideboardFw', { quantities, zones }) returned
// zones.sideboardFw === undefined whenever the caller's `zones` literal named
// only `sideboard`/`pool` (importDeck.js's own `importDeckList`, and
// ImportDialog.jsx's live preview), and the following `bucket[id] = …` threw.
// These two tests cover the crash directly and the full round trip: export a
// deck with cards in sideboardFw, re-import the text, and get the same cards
// back in the same zone. Before the fix (emptyZones() used everywhere a
// `zones` object is built), both failed -- see the report for the captured
// failing run.
describe('round trip through the Fallen-wizard sideboard (C1-C4 reproduction)', () => {
  const cardsById = new Map(cards.map((c) => [c.id, c]));

  it('does not throw importing a list with a "## Sideboard vs FW" section (the C1/C2 crash)', () => {
    const text = ['## Sideboard vs FW', '1x burat'].join('\n');
    expect(() => importDeckList(text, cards)).not.toThrow();
    expect(importDeckList(text, cards).zones.sideboardFw).toEqual({ 'AS-1': 1 });
  });

  it('exports cards routed to sideboardFw and re-imports them into the same zone with the same counts', () => {
    const zones = { sideboard: {}, pool: {}, sideboardFw: { 'AS-1': 2, 'TW-1': 1 } };
    const text = buildDeckListText(cardsById, {}, 'RT Deck', 'en', { zones, notes: {}, mode: 'freeform', ruleset: null });
    expect(text).toContain('## Sideboard vs FW');

    const result = importDeckList(text, cards, 'en');
    expect(result.zones.sideboardFw).toEqual({ 'AS-1': 2, 'TW-1': 1 });
    // And nothing spilled into the ordinary sideboard/pool/main deck.
    expect(result.zones.sideboard).toEqual({});
    expect(result.zones.pool).toEqual({});
    expect(result.quantities).toEqual({});
  });
});
