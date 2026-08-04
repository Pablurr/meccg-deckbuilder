import { describe, it, expect } from 'vitest';
import { targetForCard, bucketFor } from '../web/src/lib/import/target.js';

const site = { id: 'TW-350', type: 'Site' };
const region = { id: 'TW-235', type: 'Region' };
const hazard = { id: 'TW-99', type: 'Hazard' };
const character = { id: 'TW-10', type: 'Character', attributes: {} };
const avatar = { id: 'TW-1', type: 'Character', attributes: { avatar: true } };
const minorItem = { id: 'TW-50', type: 'Resource', attributes: { subtype: 'Minor Item' } };

describe('targetForCard', () => {
  it('leaves a legal section alone', () => {
    expect(targetForCard(character, 'pool')).toBe('pool');
    expect(targetForCard(character, 'sideboard')).toBe('sideboard');
    expect(targetForCard(minorItem, 'pool')).toBe('pool');
    expect(targetForCard(hazard, 'sideboard')).toBe('sideboard');
    expect(targetForCard(site, 'quantities')).toBe('quantities');
  });

  it('sends a site or a region back to the main deck, from any section', () => {
    // The reported bug, at its root: a pasted list said "sideboard", and the
    // sideboard is not a place a site may be.
    expect(targetForCard(site, 'sideboard')).toBe('quantities');
    expect(targetForCard(site, 'pool')).toBe('quantities');
    expect(targetForCard(region, 'sideboard')).toBe('quantities');
    expect(targetForCard(region, 'pool')).toBe('quantities');
  });

  it('applies every other zone rule too, because it asks rules/zones.js', () => {
    expect(targetForCard(hazard, 'pool')).toBe('quantities');
    expect(targetForCard(avatar, 'pool')).toBe('quantities');
    expect(targetForCard(avatar, 'sideboard')).toBe('sideboard');
  });

  it('falls back to the main deck for an unknown section or a missing card', () => {
    expect(targetForCard(character, 'nowhere')).toBe('quantities');
    expect(targetForCard(null, 'sideboard')).toBe('quantities');
    expect(targetForCard(undefined, 'pool')).toBe('quantities');
  });
});

describe('bucketFor', () => {
  const fresh = () => ({ quantities: {}, zones: { pool: {}, sideboard: {} } });

  it('hands back the very map the copies belong in', () => {
    const deck = fresh();
    expect(bucketFor(character, 'pool', deck)).toBe(deck.zones.pool);
    expect(bucketFor(character, 'sideboard', deck)).toBe(deck.zones.sideboard);
    expect(bucketFor(hazard, 'quantities', deck)).toBe(deck.quantities);
    expect(bucketFor(site, 'sideboard', deck)).toBe(deck.quantities);
  });
});
