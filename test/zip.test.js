import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildDeckZip } from '../web/src/lib/export/zip.js';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const cards = [
  { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } },
  { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } }, // second copy
  { id: 'BA-1', type: 'Site', name: { en: 'Moria' } },
  { id: 'XX-9', type: 'Hazard', name: { en: 'Broken' } }, // will fail
];

const getFrontPng = async (card) => {
  if (card.id === 'XX-9') throw new Error('404');
  return FAKE_PNG;
};
const getBackPng = async () => FAKE_PNG;

describe('buildDeckZip', () => {
  it('builds the same tree as the server exporter: fronts per group, back, manifest', async () => {
    const { bytes, counts, failures } = await buildDeckZip({ deckName: 'Test', cards, getFrontPng, getBackPng });
    expect(counts).toEqual({ playdeck: 2, locationdeck: 1 });
    expect(failures).toEqual([{ id: 'XX-9', error: '404' }]);

    const zip = await JSZip.loadAsync(bytes);
    const fileNames = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(fileNames).toEqual([
      'locationdeck/back.png',
      'locationdeck/fronts/BA-1_Moria.png',
      'manifest.txt',
      'playdeck/back.png',
      'playdeck/fronts/AS-1_Burat_c1.png',
      'playdeck/fronts/AS-1_Burat_c2.png',
    ]);

    const manifest = await zip.file('manifest.txt').async('string');
    expect(manifest).toContain('Deck: Test');
    expect(manifest).toContain('MPC format: 822x1122px @ 300 DPI (with bleed)');
    expect(manifest).toContain('Counts: playdeck=2, locationdeck=1');
    expect(manifest).toContain('XX-9: 404');
  });

  it('omits a group back when the group is empty', async () => {
    const { bytes } = await buildDeckZip({
      deckName: 'OnlyPlay',
      cards: [{ id: 'AS-1', type: 'Character', name: { en: 'Bûrat' } }],
      getFrontPng,
      getBackPng,
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('locationdeck/back.png')).toBeNull();
    expect(zip.file('playdeck/back.png')).not.toBeNull();
  });
});
