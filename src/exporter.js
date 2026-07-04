import archiver from 'archiver';
import path from 'node:path';
import { toMpcBuffer } from './imageProcessor.js';
import { CARD_W_BLEED, CARD_H_BLEED, DPI } from './constants.js';

// Which back a card uses, by card type. Editable default.
export const BACK_GROUPS = {
  Character: 'playdeck',
  Resource: 'playdeck',
  Hazard: 'playdeck',
  Site: 'locationdeck',
  Region: 'locationdeck',
};

export function backGroupForType(type) {
  return BACK_GROUPS[type] || 'playdeck';
}

export function slug(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'card'
  );
}

// Build a ZIP buffer containing MPC-ready fronts grouped by back group,
// the back image per used group, and a manifest.
// - cards: array of flattened card objects (already resolved from ids)
// - imagesRoot: folder that relativePath is relative to
// - backPaths: { playdeck?: absPath, locationdeck?: absPath }
export async function buildDeckZip({ deckName = 'deck', cards = [], imagesRoot, backPaths = {} }) {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks = [];
  archive.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
  });

  const counts = { playdeck: 0, locationdeck: 0 };
  const failures = [];
  const manifest = [
    `Deck: ${deckName}`,
    `MPC format: ${CARD_W_BLEED}x${CARD_H_BLEED}px @ ${DPI} DPI (with bleed)`,
    '',
    'group\tid\tname',
  ];

  // A card may appear multiple times (copies); give each copy a unique filename.
  const totalPerId = {};
  for (const card of cards) totalPerId[card.id] = (totalPerId[card.id] || 0) + 1;
  const seenPerId = {};

  for (const card of cards) {
    const group = backGroupForType(card.type);
    try {
      const buf = await toMpcBuffer(path.join(imagesRoot, card.relativePath));
      seenPerId[card.id] = (seenPerId[card.id] || 0) + 1;
      const suffix = totalPerId[card.id] > 1 ? `_c${seenPerId[card.id]}` : '';
      const name = `${group}/fronts/${card.id}_${slug(card.name && card.name.en)}${suffix}.png`;
      archive.append(buf, { name });
      counts[group] += 1;
      manifest.push(`${group}\t${card.id}\t${(card.name && card.name.en) || ''}`);
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
    }
  }

  for (const group of ['playdeck', 'locationdeck']) {
    if (counts[group] > 0 && backPaths[group]) {
      try {
        const backBuf = await toMpcBuffer(backPaths[group]);
        archive.append(backBuf, { name: `${group}/back.png` });
      } catch (e) {
        failures.push({ id: `${group}-back`, error: e.message });
      }
    }
  }

  manifest.push('', `Counts: playdeck=${counts.playdeck}, locationdeck=${counts.locationdeck}`);
  if (failures.length) {
    manifest.push('', 'FAILURES:');
    for (const f of failures) manifest.push(`  ${f.id}: ${f.error}`);
  }
  archive.append(manifest.join('\n'), { name: 'manifest.txt' });

  archive.finalize();
  await finished;
  return { buffer: Buffer.concat(chunks), counts, failures };
}
