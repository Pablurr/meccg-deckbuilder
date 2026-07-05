import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';

describe('server', () => {
  let app;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/cards returns all cards, facets and default-back availability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cards).toHaveLength(1683);
    expect(body.facets.sets).toEqual(['AS', 'BA', 'DM', 'LE', 'TD', 'TW', 'WH']);
    expect(body.defaultBacks).toHaveProperty('playdeck');
    expect(body.defaultBacks).toHaveProperty('locationdeck');
  });

  it('includes a default back for a group even when none is explicitly assigned', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: { deckName: 'Default Back', cardIds: ['AS-1'] },
    });
    expect(res.statusCode).toBe(200);
    // AS-1 is a playdeck card; if the shipped default back exists it should be bundled.
    const cards = await app.inject({ method: 'GET', url: '/api/cards' });
    if (cards.json().defaultBacks.playdeck) {
      const AdmZip = (await import('adm-zip')).default;
      const entries = new AdmZip(res.rawPayload).getEntries().map((e) => e.entryName);
      expect(entries).toContain('playdeck/back.png');
    }
  });

  it('supports deck CRUD round-trip', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/decks',
      payload: { name: 'Server Test Deck', cardIds: ['AS-1'] },
    });
    expect(create.statusCode).toBe(200);
    const deck = create.json();
    expect(deck.id).toMatch(/^d_/);

    const get = await app.inject({ method: 'GET', url: `/api/decks/${deck.id}` });
    expect(get.json().name).toBe('Server Test Deck');

    const list = await app.inject({ method: 'GET', url: '/api/decks' });
    expect(list.json().some((d) => d.id === deck.id)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/api/decks/${deck.id}` });
    expect(del.json().ok).toBe(true);

    const gone = await app.inject({ method: 'GET', url: `/api/decks/${deck.id}` });
    expect(gone.statusCode).toBe(404);
  });

  it('exports a zip for selected cards', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: { deckName: 'Zip Test', cardIds: ['AS-1', 'AS-7'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    const counts = JSON.parse(res.headers['x-export-counts']);
    expect(counts.playdeck).toBe(2);
    expect(Number(res.headers['content-length'])).toBeGreaterThan(1000);
  });

  it('exports a US-Letter PDF for selected cards', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export-pdf',
      payload: { deckName: 'PDF Test', cardIds: ['AS-1', 'AS-7'], includeBacks: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    // 2 cards → 1 fronts page + 1 backs page (default backs applied)
    expect(res.headers['x-export-pages']).toBe('2');
  });

  it('exports an A3 PDF when format=a3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/export-pdf',
      payload: { deckName: 'A3 Test', cardIds: ['AS-1', 'AS-7'], includeBacks: false, format: 'a3' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('_a3_sheets.pdf');
    expect(res.rawPayload.toString('latin1')).toContain('MediaBox');
  });
});
