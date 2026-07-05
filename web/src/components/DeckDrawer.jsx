import React from 'react';
import { deckCounts, deckWarnings } from '../lib/deck.js';
import { useT } from '../i18n.jsx';

function warningText(t, w) {
  if (w.code === 'emptyDeck') return t('warn.emptyDeck');
  if (w.code === 'missingBack') return t('warn.missingBack', { group: t(`group.${w.group}`) });
  if (w.code === 'missingImage') return t('warn.missingImage', { n: w.count });
  return '';
}

export default function DeckDrawer({ cardsById, cardIds, backAssignments, defaultBacks, onManage, onExport, onImport, onNew }) {
  const t = useT();
  const counts = deckCounts(cardsById, cardIds);
  const warnings = deckWarnings(cardsById, cardIds, backAssignments, defaultBacks);

  return (
    <div className="drawer">
      <div className="counts">
        <span className="count-pill">{t('drawer.total')} <b>{counts.total}</b></span>
        <span className="count-pill">{t('drawer.playdeck')} <b>{counts.byGroup.playdeck}</b></span>
        <span className="count-pill">{t('drawer.location')} <b>{counts.byGroup.locationdeck}</b></span>
        {Object.entries(counts.byType).map(([type, n]) => (
          <span key={type} className="count-pill muted">{type}: {n}</span>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="warns">⚠ {warnings.map((w) => warningText(t, w)).join(' · ')}</div>
      )}
      <div className="spacer" />
      <button className="btn secondary" onClick={onNew}>{t('drawer.new')}</button>
      <button className="btn secondary" onClick={onImport}>{t('drawer.import')}</button>
      <button className="btn secondary" onClick={onManage}>{t('drawer.myDecks')}</button>
      <button className="btn" onClick={onExport} disabled={counts.total === 0}>{t('drawer.export')}</button>
    </div>
  );
}
