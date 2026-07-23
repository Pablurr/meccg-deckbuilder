import { useRef, useEffect } from 'react';
import { cardImageSrc, cardImageEn } from '../lib/lang.js';
import { swatchKeyForCard, rectForLang, PROXY_LABEL } from '../lib/proxy.js';

// Natural source image dimensions (see README). The hover preview shows the
// image at full size, scaled down only if it would overflow the viewport.
const PREVIEW_W = 570;
const PREVIEW_H = 796;

// The preview only appears once the pointer has held still over a card for this
// long, so scrolling/scanning never flashes tooltips.
const PREVIEW_DELAY_MS = 600;

// Shared full-size hover preview for card images, driven imperatively via refs
// so moving the mouse never re-renders the (potentially hundreds of) cells that
// use it. Consumed by both the browser grid and the deck panel.
export function useCardPreview(lang, proxyOn = false) {
  const previewRef = useRef(null);
  const previewImgRef = useRef(null);
  const stampRef = useRef(null);
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
    // The preview box is imperative (no re-render per hover), so the stamp is
    // positioned imperatively too; .proxy-stamp CSS handles the label scaling.
    const stamp = stampRef.current;
    if (stamp) {
      const key = proxyOn ? swatchKeyForCard(c) : null;
      if (key) {
        const r = rectForLang(lang);
        stamp.style.left = `${r.x * 100}%`;
        stamp.style.top = `${r.y * 100}%`;
        stamp.style.width = `${r.w * 100}%`;
        stamp.style.height = `${r.h * 100}%`;
        stamp.style.backgroundImage = `url(/proxy-swatches/${key}.png)`;
        stamp.style.display = 'flex';
      } else {
        stamp.style.display = 'none';
      }
    }
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

  // Cancel any pending/shown preview the moment anything scrolls. Scrolling
  // doesn't reliably fire mouse events, so a timer armed while hovering a card
  // before the scroll would otherwise fire over a card no longer under the
  // cursor. capture=true catches scroll from inner containers (scroll events
  // don't bubble). Also drops the timer if we unmount mid-hover.
  useEffect(() => {
    const cancel = () => hidePreview();
    window.addEventListener('wheel', cancel, true);
    window.addEventListener('scroll', cancel, true);
    return () => {
      window.removeEventListener('wheel', cancel, true);
      window.removeEventListener('scroll', cancel, true);
      clearTimeout(timerRef.current);
    };
  }, []);

  return { previewRef, previewImgRef, stampRef, trackPointer, hidePreview };
}

// The shared preview box element. Render exactly once per component that uses
// the hook, passing the refs it returned.
export function CardPreview({ previewRef, previewImgRef, stampRef }) {
  return (
    <div className="card-preview" ref={previewRef} style={{ display: 'none' }} aria-hidden="true">
      <img ref={previewImgRef} alt="" />
      <div className="proxy-stamp" ref={stampRef} style={{ display: 'none' }}>
        <span>{PROXY_LABEL}</span>
      </div>
    </div>
  );
}
