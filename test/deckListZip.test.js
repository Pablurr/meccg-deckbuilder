import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDeckListZip, safeFileName } from '../web/src/lib/export/deckListZip.js';

async function namesIn(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  return Object.keys(zip.files).sort();
}

describe('safeFileName', () => {
  it('keeps the sanitising the single-deck export already applies', () => {
    expect(safeFileName('Mon deck #1')).toBe('Mon_deck_1');
    expect(safeFileName('')).toBe('deck');
    expect(safeFileName('***')).toBe('_');
  });
});

describe('buildDeckListZip', () => {
  it('writes one .txt per entry', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Alpha', text: 'a' },
      { name: 'Beta', text: 'b' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Alpha.txt', 'Beta.txt']);
  });

  it('preserves each entry text', async () => {
    const bytes = await buildDeckListZip([{ name: 'Alpha', text: 'ligne 1\nligne 2' }]);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file('Alpha.txt').async('string')).toBe('ligne 1\nligne 2');
  });

  // JSZip silently OVERWRITES a duplicate path, so without this two decks
  // called "Draft" would ship as one file and the user would never be told
  // which one survived.
  it('suffixes colliding names instead of losing a deck', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Draft', text: '1' },
      { name: 'Draft', text: '2' },
      { name: 'Draft', text: '3' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Draft-2.txt', 'Draft-3.txt', 'Draft.txt']);
  });

  // Sanitising is what CREATES most collisions: "Deck #1" and "Deck (1)" are
  // one filename once punctuation is stripped.
  it('detects collisions after sanitising, not before', async () => {
    const bytes = await buildDeckListZip([
      { name: 'Deck #1', text: '1' },
      { name: 'Deck (1)', text: '2' },
    ]);
    expect(await namesIn(bytes)).toEqual(['Deck_1-2.txt', 'Deck_1.txt']);
  });

  it('produces a readable archive for an empty selection', async () => {
    const bytes = await buildDeckListZip([]);
    expect(await namesIn(bytes)).toEqual([]);
  });
});
