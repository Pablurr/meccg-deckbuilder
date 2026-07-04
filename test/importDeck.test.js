import { describe, it, expect } from 'vitest';
import { parseDeckList, buildNameIndex, resolveDeckList } from '../web/src/lib/importDeck.js';

const cards = [
  { id: 'AS-1', name: { en: 'Bûrat', fr: 'Bûrat' } },
  { id: 'AS-58', name: { en: 'Angmarim', fr: 'Angmarim' }, alignment: 'Hero' },
  { id: 'AS-62', name: { en: 'Angmarim', fr: 'Angmarim' }, alignment: 'Minion' },
  { id: 'AS-44', name: { en: 'All the Bells Ringing', fr: 'Sonner le tocsin' } },
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
});
