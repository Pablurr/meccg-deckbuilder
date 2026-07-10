import JSZip from 'jszip';
import { CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { backGroupForType, slug } from './backGroups.js';

// Browser port of the old server exporter: identical tree, filenames and
// manifest. getFrontPng/getBackPng return MPC-ready PNG bytes (the caller
// wires fetching + bleed; this layer never touches pixels).
export async function buildDeckZip({ deckName = 'deck', cards = [], getFrontPng, getBackPng }) {
  const zip = new JSZip();
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
      const png = await getFrontPng(card);
      seenPerId[card.id] = (seenPerId[card.id] || 0) + 1;
      const suffix = totalPerId[card.id] > 1 ? `_c${seenPerId[card.id]}` : '';
      zip.file(`${group}/fronts/${card.id}_${slug(card.name && card.name.en)}${suffix}.png`, png);
      counts[group] += 1;
      manifest.push(`${group}\t${card.id}\t${(card.name && card.name.en) || ''}`);
    } catch (e) {
      failures.push({ id: card.id, error: e.message });
    }
  }

  for (const group of ['playdeck', 'locationdeck']) {
    if (counts[group] > 0) {
      try {
        const back = await getBackPng(group);
        if (back) zip.file(`${group}/back.png`, back);
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
  zip.file('manifest.txt', manifest.join('\n'));

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes, counts, failures };
}
