import React from 'react';
import { useT } from '../i18n.jsx';

// Bottom action bar. On mobile it also surfaces the deck count and a button to
// open the deck sheet (the right-hand DeckPanel is hidden on mobile).
//
// Every button carries both an icon and its label. The label is hidden on
// mobile (see .drawer .lbl), where the six labels measured 588px against 355
// of room and so wrapped onto a second row. The label element stays in the
// DOM rather than being dropped: it is what names the button, and the icons
// are marked aria-hidden, so the accessible name is the same text on both
// layouts and does not depend on a title= that touch cannot surface.
export default function DeckDrawer({ total, onManage, onExport, onImport, onNew, onSettings, isMobile, onViewDeck }) {
  const t = useT();
  // One place for the glyphs, so a swap is a one-line edit rather than a hunt
  // through the markup.
  const ICON = { viewDeck: '▤', settings: '⚙', new: '✚', import: '↓', myDecks: '☰', export: '↑' };
  return (
    <div className="drawer">
      {isMobile && (
        <button className="btn secondary drawer-viewdeck" onClick={onViewDeck} disabled={total === 0}>
          <span className="ico" aria-hidden="true">{ICON.viewDeck}</span>
          <span className="lbl">{t('drawer.viewDeck')}</span>
          <span className="deckpanel-badge">{total}</span>
        </button>
      )}
      <div className="spacer" />
      <button className="btn secondary" onClick={onSettings} title={t('setup.title')}>
        <span className="ico" aria-hidden="true">{ICON.settings}</span>
        <span className="lbl">{t('drawer.settings')}</span>
      </button>
      <button className="btn secondary" onClick={onNew}>
        <span className="ico" aria-hidden="true">{ICON.new}</span>
        <span className="lbl">{t('drawer.new')}</span>
      </button>
      <button className="btn secondary" onClick={onImport}>
        <span className="ico" aria-hidden="true">{ICON.import}</span>
        <span className="lbl">{t('drawer.import')}</span>
      </button>
      <button className="btn secondary" onClick={onManage}>
        <span className="ico" aria-hidden="true">{ICON.myDecks}</span>
        <span className="lbl">{t('drawer.myDecks')}</span>
      </button>
      <button className="btn" onClick={onExport} disabled={total === 0}>
        <span className="ico" aria-hidden="true">{ICON.export}</span>
        <span className="lbl">{t('drawer.export')}</span>
      </button>
    </div>
  );
}
