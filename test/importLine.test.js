import { describe, it, expect } from 'vitest';
import { normalizeName } from '../web/src/lib/import/normalize.js';
import { stripDecoration, parseLineCandidates } from '../web/src/lib/import/line.js';

const best = (s) => parseLineCandidates(s)[0];
const last = (s) => parseLineCandidates(s).slice(-1)[0];

describe('normalizeName', () => {
  it('reduces a name to bare alphanumerics, so accents and punctuation cannot miss a match', () => {
    expect(normalizeName('Bûrat')).toBe('burat');
    expect(normalizeName('Burat')).toBe('burat');
    expect(normalizeName("Thrór’s Map")).toBe('throrsmap');
    expect(normalizeName('Star-glass')).toBe('starglass');
    expect(normalizeName('Beorn & Co')).toBe('beornandco');
  });
});

describe('stripDecoration', () => {
  it('drops bullets and enumerators, including one after the other', () => {
    expect(stripDecoration('- Bûrat')).toBe('Bûrat');
    expect(stripDecoration('* Bûrat')).toBe('Bûrat');
    expect(stripDecoration('• Bûrat')).toBe('Bûrat');
    expect(stripDecoration('1. Bûrat')).toBe('Bûrat');
    expect(stripDecoration('2) Bûrat')).toBe('Bûrat');
    expect(stripDecoration('- 1) Bûrat')).toBe('Bûrat');
  });

  it('unwraps markdown emphasis only when it wraps the whole line', () => {
    expect(stripDecoration('**Bûrat**')).toBe('Bûrat');
    expect(stripDecoration('_Bûrat_')).toBe('Bûrat');
    expect(stripDecoration('`Bûrat`')).toBe('Bûrat');
    expect(stripDecoration('Doors of *Night*')).toBe('Doors of *Night*');
  });
});

describe('parseLineCandidates — quantity in front', () => {
  it('reads every spelling of a leading quantity', () => {
    for (const s of ['3 Bûrat', '3x Bûrat', '3X Bûrat', '3 x Bûrat', '3× Bûrat']) {
      expect(best(s)).toMatchObject({ qty: 3, name: 'Bûrat' });
    }
  });

  it('defaults to one copy', () => {
    expect(best('Bûrat')).toMatchObject({ qty: 1, name: 'Bûrat' });
  });

  it('an enumerator is never read as a quantity', () => {
    expect(best('2. Beautiful Gold Ring')).toMatchObject({ qty: 1, name: 'Beautiful Gold Ring' });
    expect(best('1) 3x Bûrat')).toMatchObject({ qty: 3, name: 'Bûrat' });
  });
});

describe('parseLineCandidates — quantity at the end', () => {
  it('reads every spelling of a trailing quantity', () => {
    for (const s of ['Bûrat (1x)', 'Bûrat [1]', 'Bûrat x1', 'Bûrat - 1', 'Bûrat -1x', 'Bûrat 1']) {
      expect(best(s)).toMatchObject({ qty: 1, name: 'Bûrat' });
    }
    expect(best('Bûrat - 2')).toMatchObject({ qty: 2, name: 'Bûrat' });
    expect(best('Bûrat -2x')).toMatchObject({ qty: 2, name: 'Bûrat' });
  });

  it('keeps the un-peeled reading as a fallback, so a name ending in a digit can still win', () => {
    const cands = parseLineCandidates('Bûrat 2');
    expect(cands[0]).toMatchObject({ qty: 2, name: 'Bûrat' });
    expect(cands.some((c) => c.name === 'Bûrat 2' && c.qty === 1)).toBe(true);
  });
});

describe('parseLineCandidates — parenthetical hints', () => {
  it('peels a hint off the name and keeps it for the resolver', () => {
    expect(best('Angmarim (AS)')).toMatchObject({ qty: 1, name: 'Angmarim', hints: ['AS'] });
    expect(best('2x Angmarim (AS-58)')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS-58'] });
    expect(best("Angmarim (Contre l'Ombre)")).toMatchObject({ name: 'Angmarim', hints: ["Contre l'Ombre"] });
  });

  it('a parenthesis holding only a quantity is a quantity, not a hint', () => {
    expect(best('Bûrat (2x)')).toMatchObject({ qty: 2, name: 'Bûrat', hints: [] });
  });

  it('reads a hint and a trailing quantity together, in either order', () => {
    expect(best('Angmarim (AS) x2')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS'] });
    expect(best('Angmarim x2 (AS)')).toMatchObject({ qty: 2, name: 'Angmarim', hints: ['AS'] });
  });
});

describe('parseLineCandidates — the facade contract', () => {
  it('the LAST candidate is always the old parseLine reading: leading quantity only', () => {
    expect(last('Bûrat - 2')).toMatchObject({ qty: 1, name: 'Bûrat - 2' });
    expect(last('3x Angmarim (AS)')).toMatchObject({ qty: 3, name: 'Angmarim (AS)' });
    expect(last('Doors of Night')).toMatchObject({ qty: 1, name: 'Doors of Night' });
  });

  it('a quantity of zero or less floors at one', () => {
    expect(best('0x Bûrat')).toMatchObject({ qty: 1, name: 'Bûrat' });
  });
});
