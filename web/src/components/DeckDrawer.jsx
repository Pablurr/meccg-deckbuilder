import React from 'react';
import { useT } from '../i18n.jsx';

// Bottom action bar. Deck totals and warnings now live in the right-hand
// DeckPanel; this bar only carries the deck-level actions.
export default function DeckDrawer({ total, onManage, onExport, onImport, onNew }) {
  const t = useT();
  return (
    <div className="drawer">
      <div className="spacer" />
      <button className="btn secondary" onClick={onNew}>{t('drawer.new')}</button>
      <button className="btn secondary" onClick={onImport}>{t('drawer.import')}</button>
      <button className="btn secondary" onClick={onManage}>{t('drawer.myDecks')}</button>
      <button className="btn" onClick={onExport} disabled={total === 0}>{t('drawer.export')}</button>
    </div>
  );
}
