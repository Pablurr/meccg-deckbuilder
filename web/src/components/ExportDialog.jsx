import React, { useState } from 'react';
import * as api from '../api.js';
import { buildDeckListText } from '../lib/deckList.js';
import { LIST_LANGUAGES } from '../lib/lang.js';

const GROUPS = [
  { key: 'playdeck', label: 'Play deck (Character / Resource / Hazard)' },
  { key: 'locationdeck', label: 'Location deck (Site / Region)' },
];

// cards per page at true poker size, per format.
const PAGE_FORMATS = [
  { key: 'letter', label: 'US Letter', perPage: '3×3 = 9' },
  { key: 'a4', label: 'A4', perPage: '3×3 = 9' },
  { key: 'a3', label: 'A3 paysage', perPage: '6×3 = 18' },
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

export default function ExportDialog({ deck, cardIds, cardsById, quantities, defaultBacks = {}, uiLang = 'fr', onClose, onBacksChange }) {
  const [backs, setBacks] = useState(deck.backAssignments || {});
  const [format, setFormat] = useState('mpc'); // 'mpc' | 'pdf' | 'list'
  const [pageFormat, setPageFormat] = useState('letter');
  const [listLang, setListLang] = useState(uiLang);
  const [includeBacks, setIncludeBacks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const showBackPickers = format === 'mpc' || format === 'pdf';

  async function pickBack(group, file) {
    if (!file) return;
    const { path } = await api.uploadBack(file);
    const next = { ...backs, [group]: path };
    setBacks(next);
    onBacksChange(next);
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (format === 'mpc') {
        const r = await api.exportDeck({ deckName: deck.name, cardIds, backAssignments: backs });
        setResult(`ZIP MPC généré — play deck : ${r.counts.playdeck}, location : ${r.counts.locationdeck}.` +
          (r.failures.length ? ` ${r.failures.length} échec(s) (voir manifest.txt).` : ''));
      } else if (format === 'pdf') {
        const r = await api.exportPdf({ deckName: deck.name, cardIds, backAssignments: backs, includeBacks, format: pageFormat });
        setResult(`PDF ${pageFormat.toUpperCase()} généré — ${r.pages} page(s), cartes à taille réelle.` +
          (r.failures.length ? ` ${r.failures.length} échec(s).` : ''));
      } else {
        const text = buildDeckListText(cardsById, quantities, deck.name, listLang);
        downloadText(text, `${(deck.name || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_')}.txt`);
        setResult('Liste texte téléchargée.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const runLabel = busy ? 'Génération…' : format === 'mpc' ? 'Générer le ZIP' : format === 'pdf' ? 'Générer le PDF' : 'Télécharger la liste';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>

        <div className="options" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label className={`chip-toggle ${format === 'mpc' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'mpc'} onChange={() => setFormat('mpc')} />
            {' '}Images individuelles MPC (ZIP) — 822×1122 px, bleed inclus
          </label>
          <label className={`chip-toggle ${format === 'pdf' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
            {' '}Planches PDF — cartes à taille réelle, traits de coupe
          </label>
          <label className={`chip-toggle ${format === 'list' ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="fmt" checked={format === 'list'} onChange={() => setFormat('list')} />
            {' '}Deck list (texte) — cartes triées par type
          </label>
        </div>

        {format === 'pdf' && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {PAGE_FORMATS.map((p) => (
              <label key={p.key} className={`chip-toggle ${pageFormat === p.key ? 'on' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="radio" name="page" checked={pageFormat === p.key} onChange={() => setPageFormat(p.key)} />
                {' '}{p.label} <span className="muted">({p.perPage} cartes/page)</span>
              </label>
            ))}
          </div>
        )}

        {format === 'list' && (
          <div className="row">
            <span>Langue de la liste :</span>
            <select value={listLang} onChange={(e) => setListLang(e.target.value)}>
              {LIST_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        <p className="muted">{cardIds.length} carte(s) sélectionnée(s).</p>

        {showBackPickers && GROUPS.map((g) => (
          <div className="row" key={g.key}>
            <div style={{ flex: 1 }}>
              <div>{g.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {backs[g.key]
                  ? `Dos : ${backs[g.key]}`
                  : defaultBacks[g.key]
                    ? 'Dos par défaut du projet (card-backs/)'
                    : 'Aucun dos sélectionné'}
              </div>
            </div>
            <label className="btn secondary" style={{ cursor: 'pointer' }}>
              Choisir un dos
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
            Inclure les planches de dos (miroir, pour impression recto-verso)
          </label>
        )}

        {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
        {result && <p className="muted">✅ {result}</p>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Fermer</button>
          <button className="btn" onClick={runExport} disabled={busy || cardIds.length === 0}>
            {runLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
