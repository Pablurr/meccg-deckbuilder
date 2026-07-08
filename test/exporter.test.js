import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import sharp from 'sharp';
import AdmZip from 'adm-zip';
import { backGroupForType, slug, buildDeckZip } from '../src/exporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_ROOT = path.join(__dirname, '..', 'cards', 'remastered-all');

describe('backGroupForType', () => {
  it('maps types to back groups with a playdeck default', () => {
    expect(backGroupForType('Resource')).toBe('playdeck');
    expect(backGroupForType('Character')).toBe('playdeck');
    expect(backGroupForType('Hazard')).toBe('playdeck');
    expect(backGroupForType('Site')).toBe('locationdeck');
    expect(backGroupForType('Region')).toBe('locationdeck');
    expect(backGroupForType('Whatever')).toBe('playdeck');
  });
});

describe('slug', () => {
  it('strips accents and non-alphanumerics', () => {
    expect(slug('Bûrat')).toBe('Burat');
    expect(slug('All the Bells Ringing')).toBe('All-the-Bells-Ringing');
    expect(slug('')).toBe('card');
  });
});

describe('buildDeckZip', () => {
  let tmpDir;
  let backPath;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'meccg-'));
    backPath = path.join(tmpDir, 'back.png');
    const back = await sharp({ create: { width: 100, height: 140, channels: 3, background: '#333' } }).png().toBuffer();
    await writeFile(backPath, back);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('produces a zip with grouped fronts, backs and a manifest', async () => {
    const cards = [
      { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
      { id: 'AS-7', type: 'Hazard', name: { en: 'Alatar the Hunter' }, relativePath: 'as/perils/AlatartheHunter.jpg' },
      { id: 'AS-44', type: 'Resource', name: { en: 'All the Bells Ringing' }, relativePath: 'as/resources/heroes/AlltheBellsRinging.jpg' },
    ];
    const { buffer, counts, failures } = await buildDeckZip({
      deckName: 'Test Deck',
      cards,
      getImage: (card) => path.join(IMAGES_ROOT, card.relativePath),
      backPaths: { playdeck: backPath },
    });

    expect(failures).toEqual([]);
    expect(counts.playdeck).toBe(3);
    expect(counts.locationdeck).toBe(0);

    const entries = new AdmZip(buffer).getEntries().map((e) => e.entryName);
    expect(entries).toContain('playdeck/fronts/AS-1_Burat.png');
    expect(entries).toContain('playdeck/back.png');
    expect(entries).toContain('manifest.txt');
    // no location back appended when that group is empty
    expect(entries.some((e) => e.startsWith('locationdeck/'))).toBe(false);
  });

  it('gives each copy of a repeated card a unique filename', async () => {
    const cards = [
      { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
      { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
      { id: 'AS-1', type: 'Character', name: { en: 'Bûrat' }, relativePath: 'as/minions/Burat.jpg' },
    ];
    const { buffer, counts } = await buildDeckZip({ deckName: 'Copies', cards, getImage: (c) => path.join(IMAGES_ROOT, c.relativePath) });
    expect(counts.playdeck).toBe(3);
    const entries = new AdmZip(buffer).getEntries().map((e) => e.entryName).filter((e) => e.includes('/fronts/'));
    expect(entries.sort()).toEqual([
      'playdeck/fronts/AS-1_Burat_c1.png',
      'playdeck/fronts/AS-1_Burat_c2.png',
      'playdeck/fronts/AS-1_Burat_c3.png',
    ]);
  });
});
