import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadCards } from './cards.js';
import { createDeckStore } from './deckStore.js';
import { buildDeckZip } from './exporter.js';
import { buildSheetPdf } from './sheetPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IMAGES_ROOT = path.join(ROOT, 'remastered-all');
const CARDS_JSON = path.join(IMAGES_ROOT, 'cards.json');
const DECKS_DIR = path.join(ROOT, 'data', 'decks');
const BACKS_DIR = path.join(ROOT, 'data', 'backs');
const CARD_BACKS_DIR = path.join(ROOT, 'card-backs');
const WEB_DIST = path.join(ROOT, 'web', 'dist');

// Default backs shipped with the project (used when a group has no explicit back).
const DEFAULT_BACKS = {
  playdeck: path.join(CARD_BACKS_DIR, 'CardBack300dpi.png'),
  locationdeck: path.join(CARD_BACKS_DIR, 'SiteCardBack300dpi.png'),
};

export async function buildServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyMultipart, { limits: { fileSize: 30 * 1024 * 1024 } });

  const { cards, facets, index } = await loadCards(CARDS_JSON);
  const store = createDeckStore(DECKS_DIR);
  await store.init();
  await mkdir(BACKS_DIR, { recursive: true });

  // Source card images.
  await app.register(fastifyStatic, { root: IMAGES_ROOT, prefix: '/images/' });
  // Uploaded back images.
  await app.register(fastifyStatic, { root: BACKS_DIR, prefix: '/backs/', decorateReply: false });

  const defaultBacks = {
    playdeck: existsSync(DEFAULT_BACKS.playdeck),
    locationdeck: existsSync(DEFAULT_BACKS.locationdeck),
  };

  app.get('/api/cards', async () => ({ cards, facets, defaultBacks }));

  app.get('/api/decks', async () => store.list());
  app.get('/api/decks/:id', async (req, reply) => {
    try {
      return await store.get(req.params.id);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
  });
  app.post('/api/decks', async (req) => store.create(req.body || {}));
  app.put('/api/decks/:id', async (req, reply) => {
    try {
      return await store.update(req.params.id, req.body || {});
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
  });
  app.delete('/api/decks/:id', async (req) => {
    await store.remove(req.params.id).catch(() => {});
    return { ok: true };
  });

  // Upload a back image, returns its serveable path.
  app.post('/api/backs', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'no file' });
    const ext = path.extname(data.filename) || '.png';
    const name = `back_${Date.now()}${ext}`;
    await writeFile(path.join(BACKS_DIR, name), await data.toBuffer());
    return { path: `backs/${name}` };
  });

  // Resolve back-image paths, applying shipped defaults for any group not overridden.
  function resolveBackPaths(backAssignments = {}) {
    const backPaths = { ...DEFAULT_BACKS };
    for (const [group, rel] of Object.entries(backAssignments)) {
      // rel looks like "backs/back_123.png"; resolve under data/.
      if (rel) backPaths[group] = path.join(ROOT, 'data', path.normalize(String(rel)).replace(/^(\.\.[/\\])+/, ''));
    }
    return backPaths;
  }

  const safeName = (s) => String(s || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_');

  // Export selected cards as an MPC ZIP (individual images, bleed included).
  app.post('/api/export', async (req, reply) => {
    const { cardIds = [], deckName = 'deck', backAssignments = {} } = req.body || {};
    const selected = cardIds.map((id) => index.get(id)).filter(Boolean);
    const { buffer, counts, failures } = await buildDeckZip({
      deckName,
      cards: selected,
      imagesRoot: IMAGES_ROOT,
      backPaths: resolveBackPaths(backAssignments),
    });
    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${safeName(deckName)}_MPC.zip"`)
      .header('X-Export-Counts', JSON.stringify(counts))
      .header('X-Export-Failures', JSON.stringify(failures));
    return reply.send(buffer);
  });

  // Export selected cards as a US-Letter PDF, 3x3 poker cards per page at true
  // size with crop marks; optional mirrored backs pages for duplex printing.
  app.post('/api/export-pdf', async (req, reply) => {
    const { cardIds = [], deckName = 'deck', backAssignments = {}, includeBacks = true, format = 'letter' } = req.body || {};
    const selected = cardIds.map((id) => index.get(id)).filter(Boolean);
    const { buffer, failures, pageCount } = await buildSheetPdf({
      cards: selected,
      imagesRoot: IMAGES_ROOT,
      backPaths: resolveBackPaths(backAssignments),
      includeBacks,
      format,
    });
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${safeName(deckName)}_${format}_sheets.pdf"`)
      .header('X-Export-Pages', String(pageCount))
      .header('X-Export-Failures', JSON.stringify(failures));
    return reply.send(buffer);
  });

  // Built front-end (production). Harmless if web/dist is absent during dev.
  try {
    await app.register(fastifyStatic, { root: WEB_DIST, prefix: '/', decorateReply: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url.startsWith('/api') || req.raw.url.startsWith('/images') || req.raw.url.startsWith('/backs')) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // web/dist not built yet — API-only mode.
  }

  return app;
}

async function start() {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`MECCG deck builder → http://localhost:${port}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
