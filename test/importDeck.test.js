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
    expect(zones).toEqual({ pool: {}, sideboard: {} });
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
