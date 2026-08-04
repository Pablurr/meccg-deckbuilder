import JSZip from 'jszip';

// Same sanitising as the single-deck text export (ExportDialog.runExport), so
// a deck exported alone and the same deck exported in a batch land on the same
// filename.
export function safeFileName(name) {
  return String(name || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'deck';
}

// One .txt per deck. The dedup pass is the whole point of this module:
// zip.file() on an existing path OVERWRITES it without a word, so two decks
// named "Draft" -- or "Deck #1" and "Deck (1)", which sanitise to one name --
// would ship as a single file and the user would have no way to know. Numbering
// starts at -2 because the first holder keeps the bare name.
export async function buildDeckListZip(entries = []) {
  const zip = new JSZip();
  const used = new Map(); // sanitised base -> how many entries have claimed it
  for (const { name, text } of entries) {
    const base = safeFileName(name);
    const seen = (used.get(base) || 0) + 1;
    used.set(base, seen);
    zip.file(`${base}${seen > 1 ? `-${seen}` : ''}.txt`, text ?? '');
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
