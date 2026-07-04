import React, { useState } from 'react';
import * as api from '../api.js';

const GROUPS = [
  { key: 'playdeck', label: 'Play deck (Character / Resource / Hazard)' },
  { key: 'locationdeck', label: 'Location deck (Site / Region)' },
];

export default function ExportDialog({ deck, cardIds, defaultBacks = {}, onClose, onBacksChange }) {
  const [backs, setBacks] = useState(deck.backAssignments || {});
  const [format, setFormat] = useState('mpc'); // 'mpc' | 'pdf'
  const [includeBacks, setIncludeBacks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
      } else {
        const r = await api.exportPdf({ deckName: deck.name, cardIds, backAssignments: backs, includeBacks });
        setResult(`PDF US Letter généré — ${r.pages} page(s), 3×3 cartes à taille réelle.` +
          (r.failures.length ? ` ${r.failures.length} échec(s).` : ''));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

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
            {' '}Planches PDF US Letter — 3×3 cartes à taille réelle, traits de coupe
          </label>
        </div>

        <p className="muted">{cardIds.length} carte(s) sélectionnée(s).</p>

        {GROUPS.map((g) => (
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
            {busy ? 'Génération…' : format === 'mpc' ? 'Générer le ZIP' : 'Générer le PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
