import React from 'react';
import { isStampable, rectForLang, cloneSrcForLang, labelColor, PROXY_LABEL } from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay covering the copyright / set-name zone (SELF-CLONE variant): the
// background is the card's OWN image (same URL the sibling <img> already
// loaded, so no extra fetch), scaled and positioned so a clean band strip is
// stretched across the zone. Must live inside a positioned wrapper matching the
// card image bounds. Renders nothing when off, for Regions, or without a src.
//
// Background math: to stretch the source strip [s.x, s.x+s.w] (card fractions)
// across this box, the image is sized to (1/s.w) box-widths and (1/r.h)
// box-heights; background-position aligns the strip's top-left to the box.
export default function ProxyStamp({ card, lang, on, src }) {
  if (!on || !src || !isStampable(card)) return null;
  const r = rectForLang(lang);
  const s = cloneSrcForLang(lang);
  return (
    <div
      className="proxy-stamp"
      aria-hidden="true"
      style={{
        left: pct(r.x),
        top: pct(r.y),
        width: pct(r.w),
        height: pct(r.h),
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${100 / s.w}% ${100 / r.h}%`,
        backgroundPosition: `${(100 * s.x) / (1 - s.w)}% ${(100 * r.y) / (1 - r.h)}%`,
      }}
    >
      <span style={{ color: labelColor(card) }}>{PROXY_LABEL}</span>
    </div>
  );
}
