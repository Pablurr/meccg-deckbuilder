import { describe, it, expect } from 'vitest';
import { tabPresentation } from '../web/src/components/ZoneTabs.jsx';
import { OPTIONAL_TABS, poolExtraCount } from '../web/src/components/DeckPanel.jsx';

describe('tabPresentation', () => {
  // "0 / 10" claims a budget the player never opted into. An optional zone
  // stays an invitation until a card lands in it.
  it('makes an empty optional zone an invitation with no count', () => {
    expect(tabPresentation({ count: 0, cap: 10, optional: true }))
      .toEqual({ inviting: true, over: false, showCount: false });
  });

  it('turns it into an ordinary tab, count included, on the first card', () => {
    expect(tabPresentation({ count: 1, cap: 10, optional: true }))
      .toEqual({ inviting: false, over: false, showCount: true });
  });

  it('never invites a zone that is not optional, even empty', () => {
    expect(tabPresentation({ count: 0, cap: null, optional: false }))
      .toEqual({ inviting: false, over: false, showCount: true });
  });

  it('flags a count past its cap', () => {
    expect(tabPresentation({ count: 11, cap: 10, optional: true }).over).toBe(true);
    expect(tabPresentation({ count: 11, cap: null, optional: false }).over).toBe(false);
  });

  // The Notes tab carries no count at all: count === null, which must not be
  // read as "empty".
  it('shows no count for a countless tab', () => {
    expect(tabPresentation({ count: null, cap: null, optional: false }))
      .toEqual({ inviting: false, over: false, showCount: false });
  });

  // The distinction the strict `count === 0` exists for: a tab that carries no
  // count at all is not an empty zone, even when it is optional. A falsy check
  // (`!count`) would call this an invitation and render "+ …" over a tab that
  // has nothing to invite.
  it('does not invite an optional tab that carries no count', () => {
    expect(tabPresentation({ count: null, cap: 10, optional: true }))
      .toEqual({ inviting: false, over: false, showCount: false });
  });
});

describe('OPTIONAL_TABS', () => {
  it('covers both sideboards and nothing else', () => {
    expect([...OPTIONAL_TABS].sort()).toEqual(['sideboard', 'sideboardFw']);
  });
});

describe('poolExtraCount', () => {
  // Complement of poolCharCount: starting minor items/stage events live in
  // the pool too, but answer to their own maxMinorItems cap (POOL-ITEMS),
  // not the character cap the pool pill's "n / max" already shows. This
  // feeds the pill's "(+n)" suffix instead.
  const cardsById = new Map([
    ['char-1', { type: 'Character' }],
    ['item-1', { type: 'Resource' }],
    ['item-2', { type: 'Resource' }],
  ]);

  it('counts everything in the pool that is not a Character', () => {
    expect(poolExtraCount({ 'char-1': 2, 'item-1': 1, 'item-2': 3 }, cardsById)).toBe(4);
  });

  it('is zero for a pool of characters only, and for an empty pool', () => {
    expect(poolExtraCount({ 'char-1': 5 }, cardsById)).toBe(0);
    expect(poolExtraCount({}, cardsById)).toBe(0);
    expect(poolExtraCount(undefined, cardsById)).toBe(0);
  });
});
