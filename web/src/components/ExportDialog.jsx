import React, { useState } from 'react';
import * as api from '../api.js';
import { buildDeckListText } from '../lib/deckList.js';
import { LIST_LANGUAGES, IMAGE_LANGUAGES } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

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

export default function ExportDialog({ deck, cardIds, cardsById, quantities, defaultBacks = {}, uiLang = 'fr', onClose, onBacksChange, proxyMode = false }) {
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

  const GROUPS = [
    { key: 'playdeck', label: t('export.group.playdeck') },
    { key: 'locationdeck', label: t('export.group.locationdeck') },
  ];

  const showBackPickers = format === 'mpc' || format === 'pdf';

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
        const r = await api.exportDeck({ deckName: deck.name, cardIds, backAssignments: backs, lang: imageLang, proxyMode });
        setResult(
          t('export.result.zip', { playdeck: r.counts.playdeck, locationdeck: r.counts.locationdeck }) +
          (r.failures.length ? t('export.result.failuresManifest', { n: r.failures.length }) : '')
        );
      } else if (format === 'pdf') {
        const r = await api.exportPdf({ deckName: deck.name, cardIds, backAssignments: backs, includeBacks, format: pageFormat, lang: imageLang, proxyMode });
        setResult(
          t('export.result.pdf', { fmt: pageFormat.toUpperCase(), pages: r.pages }) +
          (r.failures.length ? t('export.result.failures', { n: r.failures.length }) : '')
        );
      } else {
        const text = buildDeckListText(cardsById, quantities, deck.name, listLang);
        downloadText(text, `${(deck.name || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_')}.txt`);
        setResult(t('export.result.list'));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const runLabel = busy ? t('export.run.generating') : format === 'mpc' ? t('export.run.zip') : format === 'pdf' ? t('export.run.pdf') : t('export.run.list');

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

        <p className="muted">{t('export.selected', { n: cardIds.length })}</p>

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
          <button className="btn" onClick={runExport} disabled={busy || cardIds.length === 0}>
            {runLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
