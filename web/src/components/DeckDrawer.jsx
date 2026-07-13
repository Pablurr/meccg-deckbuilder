import React from 'react';
import { useT } from '../i18n.jsx';

// Bottom action bar. On mobile it also surfaces the deck count and a button to
// open the deck sheet (the right-hand DeckPanel is hidden on mobile).
export default function DeckDrawer({ total, onManage, onExport, onImport, onNew, isMobile, onViewDeck }) {
  const t = useT();
  return (
    <div className="drawer">
      {isMobile && (
        <button className="btn secondary drawer-viewdeck" onClick={onViewDeck} disabled={total === 0}>
          {t('drawer.viewDeck')} <span className="deckpanel-badge">{total}</span>
        </button>
      )}
      <div className="spacer" />
      <button className="btn secondary" onClick={onNew}>{t('drawer.new')}</button>
      <button className="btn secondary" onClick={onImport}>{t('drawer.import')}</button>
      <button className="btn secondary" onClick={onManage}>{t('drawer.myDecks')}</button>
      <button className="btn" onClick={onExport} disabled={total === 0}>{t('drawer.export')}</button>
    </div>
  );
}
