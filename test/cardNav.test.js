import { describe, it, expect } from 'vitest';
import { navigateList, swipeDirection } from '../web/src/lib/cardNav.js';

describe('navigateList', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('moves forward within the list', () => {
    expect(navigateList(list, { id: 'a' }, 1)).toEqual({ id: 'b' });
  });

  it('moves backward within the list', () => {
    expect(navigateList(list, { id: 'c' }, -1)).toEqual({ id: 'b' });
  });

  it('returns null past the last card (no wrap-around)', () => {
    expect(navigateList(list, { id: 'c' }, 1)).toBeNull();
  });

  it('returns null before the first card (no wrap-around)', () => {
    expect(navigateList(list, { id: 'a' }, -1)).toBeNull();
  });

  it('returns null when the current card is not in the list', () => {
    expect(navigateList(list, { id: 'z' }, 1)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(navigateList([], { id: 'a' }, 1)).toBeNull();
  });
});

describe('swipeDirection', () => {
  it('detects a left swipe as next (1)', () => {
    expect(swipeDirection(-80, 0)).toBe(1);
  });

  it('detects a right swipe as previous (-1)', () => {
    expect(swipeDirection(80, 0)).toBe(-1);
  });

  it('ignores a swipe shorter than the threshold', () => {
    expect(swipeDirection(20, 0)).toBe(0);
    expect(swipeDirection(-20, 0)).toBe(0);
  });

  it('ignores a mostly-vertical drag even if horizontal distance is large', () => {
    expect(swipeDirection(80, 60)).toBe(0);
    expect(swipeDirection(-80, -60)).toBe(0);
  });

  it('accepts a horizontal swipe with a little vertical drift', () => {
    expect(swipeDirection(-80, 15)).toBe(1);
  });
});
