import React from 'react';
import { deckCounts, deckWarnings } from '../lib/deck.js';

export default function DeckDrawer({ cardsById, cardIds, backAssignments, defaultBacks, onManage, onExport, onImport, onNew }) {
  const counts = deckCounts(cardsById, cardIds);
  const warnings = deckWarnings(cardsById, cardIds, backAssignments, defaultBacks);

  return (
    <div className="drawer">
      <div className="counts">
        <span className="count-pill">Total <b>{counts.total}</b></span>
        <span className="count-pill">Play deck <b>{counts.byGroup.playdeck}</b></span>
        <span className="count-pill">Location <b>{counts.byGroup.locationdeck}</b></span>
        {Object.entries(counts.byType).map(([t, n]) => (
          <span key={t} className="count-pill muted">{t}: {n}</span>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="warns">⚠ {warnings.join(' · ')}</div>
      )}
      <div className="spacer" />
      <button className="btn secondary" onClick={onNew}>Nouveau</button>
      <button className="btn secondary" onClick={onImport}>Importer</button>
      <button className="btn secondary" onClick={onManage}>Mes decks</button>
      <button className="btn" onClick={onExport} disabled={counts.total === 0}>Exporter</button>
    </div>
  );
}
