import { describe, it, expect } from 'vitest';
import { capNotices } from '../web/src/components/CardPreviewModal.jsx';

// The modal prints one cap sentence per DISTINCT reason instead of one per
// zone. This repo has no jsdom and never mounts a component, so the component
// is covered by testing the pure function it renders from -- same idiom as
// tabPresentation in test/zoneTabs.test.js.
describe('capNotices', () => {
  it('collapses the same reason on every zone into a single notice', () => {
    // The case that motivated this: nearly every cap counts copies across all
    // zones at once, so a unique card at its cap is blocked everywhere for the
    // very same reason, and the sentence was printed three times.
    const unique = 'Carte unique — un seul exemplaire dans tout le deck.';
    expect(capNotices([
      { zone: 'deck', reason: unique },
      { zone: 'sideboard', reason: unique },
      { zone: 'sideboardFw', reason: unique },
    ])).toEqual([{ reason: unique, zones: ['deck', 'sideboard', 'sideboardFw'] }]);
  });

  it('keeps two genuinely different reasons apart, each with its zones', () => {
    // A per-zone sub-cap does exist (1.6.2's one avatar copy per sideboard),
    // so collapsing everything to one string would lose information.
    expect(capNotices([
      { zone: 'deck', reason: 'A' },
      { zone: 'sideboard', reason: 'B' },
      { zone: 'sideboardFw', reason: 'A' },
    ])).toEqual([
      { reason: 'A', zones: ['deck', 'sideboardFw'] },
      { reason: 'B', zones: ['sideboard'] },
    ]);
  });

  it('ignores zones that are not blocked', () => {
    // capTitle returns '' when a + is still allowed; those rows must not
    // produce an empty notice line.
    expect(capNotices([
      { zone: 'deck', reason: '' },
      { zone: 'pool', reason: 'X' },
    ])).toEqual([{ reason: 'X', zones: ['pool'] }]);
  });

  it('returns nothing when no zone is blocked', () => {
    expect(capNotices([{ zone: 'deck', reason: '' }, { zone: 'pool', reason: '' }])).toEqual([]);
    expect(capNotices([])).toEqual([]);
  });
});
