import React, { useState } from 'react';
import { cardName, cardThumbSrc, cardImageEn, deckThumbWidth } from '../lib/lang.js';
import { maxCopies } from '../lib/deck.js';
import { useCardPreview, CardPreview } from './CardPreview.jsx';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';

// Deck contents are grouped and displayed in this fixed type order.
const TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];

const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 360;
// Fraction of the viewport the panel may cover at most (and the "maximize" size).
const MAX_FRACTION = 0.97;
// Natural source-image width; the zoom slider is a percentage of this.
const SOURCE_WIDTH = 570;

function warningText(t, w) {
  if (w.code === 'emptyDeck') return t('warn.emptyDeck');
  if (w.code === 'missingBack') return t('warn.missingBack', { group: t(`group.${w.group}`) });
  if (w.code === 'missingImage') return t('warn.missingImage', { n: w.count });
  return '';
}

// One selected card, shown as a compact version of a browser grid cell: same
// thumbnail + same −/count/+ control. Clicking the image asks for confirmation
// before removing the card, so a stray click can't silently empty the deck.
// Hover shows the shared full-size preview so the card stays readable at any zoom.
function MiniCard({ card, qty, lang, thumbW, onChangeQty, onToggle, trackPointer, hidePreview, isMobile, onPreview, proxyMode }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const max = maxCopies(card);
  const name = cardName(card, lang);
  return (
    <div className="cardcell deck-mini selected" title={name}>
      <img
        src={cardThumbSrc(card, lang, thumbW)}
        alt={name}
        loading="lazy"
        onClick={() => (isMobile ? onPreview(card) : setConfirming(true))}
        onMouseEnter={(e) => trackPointer(e, card)}
        onMouseMove={(e) => trackPointer(e, card)}
        onMouseLeave={hidePreview}
        onError={(e) => {
          // Missing localized thumb → English thumb → full-res English
          // (also covers the proxy being unavailable).
          const el = e.currentTarget;
          const chain = [...new Set([cardThumbSrc(card, lang, thumbW), cardThumbSrc(card, 'en', thumbW), cardImageEn(card)].filter(Boolean))];
          const next = chain[chain.indexOf(el.getAttribute('src')) + 1];
          if (next) el.src = next;
        }}
      />
      <ProxyStamp card={card} lang={lang} on={proxyMode} />
      {confirming ? (
        <div className="deck-mini-confirm">
          <button
            className="btn danger small"
            onClick={() => { setConfirming(false); onToggle(card.id); }}
          >{t('panel.remove')}</button>
          <button
            className="btn secondary small"
            onClick={() => setConfirming(false)}
          >{t('common.cancel')}</button>
        </div>
      ) : (
        <div className="qty-ctrl">
          <button
            className="qty-btn"
            onClick={() => onChangeQty(card.id, +1)}
            disabled={qty >= max}
            aria-label={t('browser.addCopy')}
          >+</button>
          <span className="qty-count">{qty}</span>
          <button
            className="qty-btn"
            onClick={() => onChangeQty(card.id, -1)}
            aria-label={t('browser.removeCopy')}
          >−</button>
        </div>
      )}
    </div>
  );
}

export default function DeckPanel({
  cardsById,
  quantities,
  lang,
  counts,
  warnings,
  collapsed,
  onToggleCollapsed,
  width = DEFAULT_WIDTH,
  onResize,
  zoom = 50,
  onZoom,
  onChangeQty,
  onToggle,
  asSheet = false,
  onClose,
  isMobile = false,
  onPreview,
  proxyMode = false,
}) {
  const t = useT();
  const { previewRef, previewImgRef, stampRef, trackPointer, hidePreview } = useCardPreview(lang, proxyMode);

  // Card width driven by the zoom slider (% of the source image). min(…,100%)
  // keeps a card from overflowing when the panel is dragged narrower than it.
  const cardW = Math.round((SOURCE_WIDTH * zoom) / 100);
  const thumbW = deckThumbWidth(cardW);
  const gridStyle = { gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardW}px, 100%), ${cardW}px))` };

  // Drag the left edge to resize; released listeners live only for the drag.
  function startResize(e) {
    e.preventDefault();
    const maxW = window.innerWidth * MAX_FRACTION;
    const onMove = (ev) => {
      const w = Math.min(maxW, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      onResize(w);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Toggle between (near) full width and the default width.
  const maxW = typeof window !== 'undefined' ? window.innerWidth * MAX_FRACTION : 1200;
  const isMaxed = width >= maxW - 2;
  function toggleMax() {
    onResize(isMaxed ? DEFAULT_WIDTH : maxW);
  }

  // Bucket selected cards by type, preserving TYPE_ORDER, sorted by name within.
  const groups = TYPE_ORDER.map((type) => {
    const items = Object.entries(quantities)
      .map(([id, qty]) => ({ card: cardsById.get(id), qty }))
      .filter((it) => it.card && it.card.type === type)
      .sort((a, b) => cardName(a.card, lang).localeCompare(cardName(b.card, lang)));
    return { type, items };
  }).filter((g) => g.items.length > 0);

  if (collapsed) {
    return (
      <div className="deckpanel collapsed">
        <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.expand')}>
          <span className="chevron">‹</span>
          <span className="deckpanel-badge">{counts.total}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`deckpanel ${asSheet ? 'sheet' : ''}`} style={asSheet ? undefined : { flexBasis: `${width}px`, width: `${width}px` }}>
      {!asSheet && <div className="deckpanel-resizer" onMouseDown={startResize} aria-hidden="true" />}
      {asSheet && (
        <button className="deckpanel-sheet-close btn secondary" onClick={onClose} aria-label={t('common.close')}>✕</button>
      )}
      <div className="deckpanel-head">
        {!asSheet && (
          <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.collapse')}>
            <span className="chevron">›</span>
          </button>
        )}
        <b>{t('panel.title')}</b>
        {!asSheet && (
          <button
            className="deckpanel-max"
            onClick={toggleMax}
            aria-label={isMaxed ? t('panel.restore') : t('panel.maximize')}
            title={isMaxed ? t('panel.restore') : t('panel.maximize')}
          >{isMaxed ? '⇥' : '⤢'}</button>
        )}
        <div className="deckpanel-counts">
          <span className="count-pill">{t('drawer.total')} <b>{counts.total}</b></span>
          <span className="count-pill">{t('drawer.playdeck')} <b>{counts.byGroup.playdeck}</b></span>
          <span className="count-pill">{t('drawer.location')} <b>{counts.byGroup.locationdeck}</b></span>
        </div>
        <label className="deckpanel-zoom">
          {t('panel.zoom')}
          <input
            type="range"
            min="15"
            max="100"
            step="5"
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
          />
          <span className="deckpanel-zoom-val">{zoom}%</span>
        </label>
      </div>

      {warnings.length > 0 && (
        <div className="warns">⚠ {warnings.map((w) => warningText(t, w)).join(' · ')}</div>
      )}

      <div className="deckpanel-body">
        {groups.map((g) => {
          const n = g.items.reduce((a, b) => a + b.qty, 0);
          return (
            <div key={g.type} className="deck-group">
              <div className="deck-group-head">
                {t(`panel.group.${g.type}`)} <span className="muted">({n})</span>
              </div>
              <div className="deck-mini-grid" style={gridStyle}>
                {g.items.map(({ card, qty }) => (
                  <MiniCard
                    key={card.id}
                    card={card}
                    qty={qty}
                    lang={lang}
                    thumbW={thumbW}
                    onChangeQty={onChangeQty}
                    onToggle={onToggle}
                    trackPointer={trackPointer}
                    hidePreview={hidePreview}
                    isMobile={isMobile}
                    onPreview={onPreview}
                    proxyMode={proxyMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Shared hover preview (hidden until a card is hovered). */}
      <CardPreview previewRef={previewRef} previewImgRef={previewImgRef} stampRef={stampRef} />
    </div>
  );
}
