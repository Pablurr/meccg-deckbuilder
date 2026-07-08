import React, { useMemo, useRef, useEffect } from 'react';
import { filterCards } from '../lib/filter.js';
import { maxCopies } from '../lib/deck.js';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

const CAP = 600; // safety cap on rendered cells

// Natural source image dimensions (see README). The hover preview shows the
// image at full size, scaled down only if it would overflow the viewport.
const PREVIEW_W = 570;
const PREVIEW_H = 796;

// The preview only appears once the pointer has held still over a card for this
// long, so scrolling/scanning the grid doesn't flash tooltips.
const PREVIEW_DELAY_MS = 600;

export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll }) {
  const t = useT();
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  const shown = filtered.slice(0, CAP);

  // Single shared preview element, driven imperatively via refs so that moving
  // the mouse never re-renders the (up to 600) cells.
  const previewRef = useRef(null);
  const previewImgRef = useRef(null);
  const timerRef = useRef(null);      // pending "show after idle" timer
  const shownIdRef = useRef(null);    // id of the card currently previewed
  const posRef = useRef({ x: 0, y: 0 });

  function positionPreview(x, y) {
    const box = previewRef.current;
    if (!box) return;
    const scale = Math.min(1, (window.innerHeight * 0.9) / PREVIEW_H);
    const w = PREVIEW_W * scale;
    const h = PREVIEW_H * scale;
    const margin = 16;
    let left = x + margin;
    if (left + w > window.innerWidth - margin) left = x - margin - w;
    if (left < margin) left = margin;
    let top = y - h / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
    box.style.width = `${w}px`;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function showPreview(c) {
    const box = previewRef.current;
    const img = previewImgRef.current;
    if (!box || !img) return;
    const en = cardImageEn(c);
    img.onerror = () => { if (img.getAttribute('src') !== en) img.src = en; };
    img.src = cardImageSrc(c, lang);
    box.style.display = 'block';
    shownIdRef.current = c.id;
    positionPreview(posRef.current.x, posRef.current.y);
  }

  function hidePreview() {
    clearTimeout(timerRef.current);
    shownIdRef.current = null;
    const box = previewRef.current;
    if (box) box.style.display = 'none';
  }

  // Show the preview only once the pointer has held still over the same card for
  // PREVIEW_DELAY_MS. Every move to a new card (including cards sliding under a
  // stationary cursor while scrolling) re-arms the timer, so it never flashes.
  function trackPointer(e, c) {
    posRef.current = { x: e.clientX, y: e.clientY };
    if (shownIdRef.current === c.id) {
      positionPreview(e.clientX, e.clientY); // already up: just follow the cursor
      return;
    }
    if (shownIdRef.current !== null) hidePreview(); // a different card was showing
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => showPreview(c), PREVIEW_DELAY_MS);
  }

  // Cancel any pending/shown preview the moment the grid scrolls. Scrolling
  // doesn't reliably fire mouse events, so a timer armed while hovering a card
  // before the scroll would otherwise fire over a card no longer under the
  // cursor. capture=true catches scroll from the inner container (scroll events
  // don't bubble). Also drops the timer if we unmount mid-hover.
  useEffect(() => {
    const cancel = () => hidePreview();
    // 'wheel' fires on the very first scroll tick (before scrollTop even moves);
    // 'scroll' covers scrollbar drag, keyboard and touch scrolling too.
    window.addEventListener('wheel', cancel, true);
    window.addEventListener('scroll', cancel, true);
    return () => {
      window.removeEventListener('wheel', cancel, true);
      window.removeEventListener('scroll', cancel, true);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="browser">
      <div className="browser-meta">
        <span>
          {t('browser.count', { n: filtered.length })}{filtered.length > CAP ? t('browser.capped', { cap: CAP }) : ''}
        </span>
        {filtered.length > 0 && (
          <button className="btn secondary small" onClick={() => onSelectAll(filtered.map((c) => c.id))}>
            {t('browser.selectAll', { n: filtered.length })}
          </button>
        )}
      </div>
      <div className="grid">
        {shown.map((c) => {
          const qty = quantities[c.id] || 0;
          const max = maxCopies(c);
          const name = cardName(c, lang);
          return (
            <div
              key={c.id}
              className={`cardcell ${qty > 0 ? 'selected' : ''}`}
            >
              {/* Click image to select (qty 1) / deselect. Use −/+ for copies once selected.
                  Hover shows a full-size preview. */}
              <img
                src={cardImageSrc(c, lang)}
                alt={name}
                loading="lazy"
                onClick={() => onToggle(c.id)}
                onMouseEnter={(e) => trackPointer(e, c)}
                onMouseMove={(e) => trackPointer(e, c)}
                onMouseLeave={hidePreview}
                onError={(e) => {
                  // Fall back to the English image if the localized one is missing.
                  const el = e.currentTarget;
                  const en = cardImageEn(c);
                  if (el.getAttribute('src') !== en) el.src = en;
                }}
              />
              {qty > 0 && (
                <div className="qty-ctrl">
                  <button
                    className="qty-btn"
                    onClick={() => onChangeQty(c.id, +1)}
                    disabled={qty >= max}
                    aria-label={t('browser.addCopy')}
                  >+</button>
                  <span className="qty-count">{qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => onChangeQty(c.id, -1)}
                    aria-label={t('browser.removeCopy')}
                  >−</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Shared hover preview (hidden until a card is hovered). */}
      <div className="card-preview" ref={previewRef} style={{ display: 'none' }} aria-hidden="true">
        <img ref={previewImgRef} alt="" />
      </div>
    </div>
  );
}
