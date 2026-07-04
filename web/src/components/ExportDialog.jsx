import React, { useState } from 'react';
import * as api from '../api.js';

const GROUPS = [
  { key: 'playdeck', label: 'Play deck (Character / Resource / Hazard)' },
  { key: 'locationdeck', label: 'Location deck (Site / Region)' },
];

export default function ExportDialog({ deck, cardIds, defaultBacks = {}, onClose, onBacksChange }) {
  const [backs, setBacks] = useState(deck.backAssignments || {});
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
      const r = await api.exportDeck({ deckName: deck.name, cardIds, backAssignments: backs });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export MPC</h2>
        <p className="muted">
          {cardIds.length} carte(s) → images 816×1110 px @ 300 DPI (bleed inclus), packagées par groupe de dos.
        </p>

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

        {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
        {result && (
          <p className="muted">
            ✅ ZIP généré — play deck : {result.counts.playdeck}, location : {result.counts.locationdeck}.
            {result.failures.length > 0 && ` ${result.failures.length} échec(s) (voir manifest.txt).`}
          </p>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Fermer</button>
          <button className="btn" onClick={runExport} disabled={busy || cardIds.length === 0}>
            {busy ? 'Génération…' : 'Générer le ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
}
