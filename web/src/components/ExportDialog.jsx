import React, { useState } from 'react';
import * as api from '../api.js';
import { buildDeckListText } from '../lib/deckList.js';
import { deckSections } from '../lib/export/deckSections.js';
import { emptyZones } from '../lib/deck.js';
import { LIST_LANGUAGES, IMAGE_LANGUAGES } from '../lib/lang.js';
import { useT } from '../i18n.jsx';
import CardSelectionDialog from './CardSelectionDialog.jsx';
import { buildSlots, allKeys, selectedCardIds, selectedQuantitiesZones } from '../lib/export/selection.js';

// cards per page at true poker size, per format. Labels are proper nouns (kept).
const PAGE_FORMATS = [
  { key: 'letter', label: 'US Letter', perPage: '3×3 = 9' },
  { key: 'a4', label: 'A4', perPage: '3×3 = 9' },
  { key: 'a3', label: 'A3', perPage: '6×3 = 18' },
];

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportDialog({ deck, cardsById, quantities, zones = emptyZones(), defaultBacks = {}, uiLang = 'fr', onClose, onBacksChange, proxyMode = false }) {
  const t = useT();
  const [backs, setBacks] = useState(deck.backAssignments || {});
  const [format, setFormat] = useState('mpc'); // 'mpc' | 'pdf' | 'list'
  const [pageFormat, setPageFormat] = useState('letter');
  const [listLang, setListLang] = useState(uiLang);
  const imgDefault = IMAGE_LANGUAGES.some((l) => l.code === uiLang) ? uiLang : 'en';
  const [imageLang, setImageLang] = useState(imgDefault);
  const [includeBacks, setIncludeBacks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [partial, setPartial] = useState(false);
  const [selected, setSelected] = useState(null); // null = never confirmed
  const [picking, setPicking] = useState(false);

  const GROUPS = [
    { key: 'playdeck', label: t('export.group.playdeck') },
    { key: 'locationdeck', label: t('export.group.locationdeck') },
  ];

  const showBackPickers = format === 'mpc' || format === 'pdf';

  // Single source of print/zip order: Pool → Play deck → Locations →
  // Sideboard (deckSections.js), expanded to one entry per physical copy so
  // a card in two zones (e.g. 2 in the play deck, 1 in the sideboard) prints
  // once per copy, in every section it appears in. Computed here (not just
  // inside runExport) so the "selected" count and the run-button's disabled
  // state also reflect zone cards, not just the main deck.
  const sections = deckSections({ quantities, zones, cardsById, lang: uiLang });
  const slots = buildSlots(sections);
  // Same list as before: slots are the canonical order expanded per copy.
  const orderedCardIds = slots.map((s) => s.cardId);

  // A subset only applies once one has actually been confirmed. Unticking
  // "partial" keeps `selected` alive so re-ticking it does not throw away the
  // ticking work -- it disables a filter, it does not undo it.
  const activeSelection = partial && selected ? selected : null;
  const exportCardIds = activeSelection ? selectedCardIds(slots, activeSelection) : orderedCardIds;

  async function pickBack(group, file) {
    if (!file) return;
    setError(null);
    try {
      const { path } = await api.uploadBack(file);
      const next = { ...backs, [group]: path };
      setBacks(next);
      onBacksChange(next);
    } catch {
      // accept="image/*" is only advisory: an SVG, a corrupt file, or a renamed
      // non-image passes it and makes createImageBitmap reject. Surface it.
      setError(t('export.back.uploadError'));
    }
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (format === 'mpc') {
        const r = await api.exportDeck({ deckName: deck.name, cardIds: exportCardIds, backAssignments: backs, lang: imageLang, proxyMode });
        setResult(
          t('export.result.zip', { playdeck: r.counts.playdeck, locationdeck: r.counts.locationdeck }) +
          (r.failures.length ? t('export.result.failuresManifest', { n: r.failures.length }) : '')
        );
      } else if (format === 'pdf') {
        const r = await api.exportPdf({ deckName: deck.name, cardIds: exportCardIds, backAssignments: backs, includeBacks, format: pageFormat, lang: imageLang, proxyMode });
        setResult(
          t('export.result.pdf', { fmt: pageFormat.toUpperCase(), pages: r.pages }) +
          (r.failures.length ? t('export.result.failures', { n: r.failures.length }) : '')
        );
      } else {
        // The text list never took an id list: buildDeckListText re-derives its
        // own sections from raw quantities/zones, so the subset has to reach it
        // in that shape or the .txt would come out complete.
        const src = activeSelection
          ? selectedQuantitiesZones(slots, activeSelection)
          : { quantities, zones };
        const text = buildDeckListText(cardsById, src.quantities, deck.name, listLang, { zones: src.zones, notes: deck.notes, mode: deck.mode, ruleset: deck.ruleset });
        downloadText(text, `${(deck.name || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_')}.txt`);
        setResult(t('export.result.list'));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const needsPicking = partial && !selected;
  const runLabel = needsPicking
    ? t('export.partial.run')
    : busy ? t('export.run.generating') : format === 'mpc' ? t('export.run.zip') : format === 'pdf' ? t('export.run.pdf') : t('export.run.list');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('export.title')}</h2>

        <div className="options" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label className={`chip-toggle ${format === 'mpc' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'mpc'} onChange={() => setFormat('mpc')} />
            {' '}{t('export.fmt.mpc')}
          </label>
          <label className={`chip-toggle ${format === 'pdf' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
            {' '}{t('export.fmt.pdf')}
          </label>
          <label className={`chip-toggle ${format === 'list' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'list'} onChange={() => setFormat('list')} />
            {' '}{t('export.fmt.list')}
          </label>
        </div>

        {format === 'pdf' && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {PAGE_FORMATS.map((p) => (
              <label key={p.key} className={`chip-toggle ${pageFormat === p.key ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="radio" name="page" checked={pageFormat === p.key} onChange={() => setPageFormat(p.key)} />
                {' '}{p.label} <span className="muted">{t('export.perPage', { info: p.perPage })}</span>
              </label>
            ))}
          </div>
        )}

        {format === 'list' && (
          <div className="row">
            <span>{t('export.listLanguage')}</span>
            <select value={listLang} onChange={(e) => setListLang(e.target.value)}>
              {LIST_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        {showBackPickers && (
          <div className="row">
            <span>{t('export.imageLanguage')}</span>
            <select value={imageLang} onChange={(e) => setImageLang(e.target.value)}>
              {IMAGE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        <p className="muted">{t('export.selected', { n: exportCardIds.length })}</p>

        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
          {t('export.partial.toggle')}
        </label>
        {partial && selected && (
          <div className="row">
            <button className="btn secondary small" onClick={() => setPicking(true)}>
              {t('export.partial.edit')}
            </button>
          </div>
        )}

        {showBackPickers && GROUPS.map((g) => (
          <div className="row" key={g.key}>
            <div style={{ flex: 1 }}>
              <div>{g.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {backs[g.key]
                  ? t('export.back.custom')
                  : defaultBacks[g.key]
                    ? t('export.back.default')
                    : t('export.back.none')}
              </div>
            </div>
            <label className="btn secondary" style={{ cursor: 'pointer' }}>
              {t('export.chooseBack')}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => pickBack(g.key, e.target.files?.[0])}
              />
            </label>
          </div>
        ))}

        {format === 'pdf' && (
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={includeBacks} onChange={(e) => setIncludeBacks(e.target.checked)} />
            {t('export.includeBacks')}
          </label>
        )}

        {error && <p style={{ color: 'var(--danger)' }}>{t('common.error', { msg: error })}</p>}
        {result && <p className="muted">✅ {result}</p>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.close')}</button>
          <button
            className="btn"
            onClick={() => (needsPicking ? setPicking(true) : runExport())}
            disabled={busy || exportCardIds.length === 0}
          >
            {runLabel}
          </button>
        </div>

        {picking && (
          <CardSelectionDialog
            sections={sections}
            slots={slots}
            initialSelected={selected || allKeys(slots)}
            lang={uiLang}
            onConfirm={(next) => { setSelected(next); setPicking(false); }}
            onCancel={() => setPicking(false)}
          />
        )}
      </div>
    </div>
  );
}
