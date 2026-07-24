import React, { useState, useEffect } from 'react';
import { isStampable, rectFor, cloneSrcFor, labelColor, PROXY_LABEL } from '../lib/proxy.js';
import { cachedLabelColor, ensureLabelColor } from '../lib/frameLuminance.js';
import { cardThumbSrc } from '../lib/lang.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay covering the copyright / set-name zone (SELF-CLONE variant): the
// background is the card's OWN image (same URL the sibling <img> already
// loaded, so no extra fetch), scaled and positioned so a clean band strip is
// stretched across the zone. Must live inside a positioned wrapper matching the
// card image bounds. Renders nothing when off, for Regions, or without a src.
//
// Background math: to stretch the source strip [s.x, s.x+s.w] × [s.y, s.y+s.h]
// (card fractions) across this box, the image is sized to (1/s.w) box-widths and
// (1/s.h) box-heights; background-position aligns the strip's top-left to the
// box. (Torn-edge sites sample a clean row above the zone, so s.y/s.h differ
// from the covered rect; other cards sample the same row, so s.y/s.h == r.y/r.h.)
export default function ProxyStamp({ card, lang, on, src, sample = false }) {
  const active = !!(on && src && isStampable(card));
  // Category colour immediately; when `sample` is set (large, readable views like
  // the modal), refine it from the card's real frame luminance once sampled.
  const [color, setColor] = useState(() => (card && cachedLabelColor(card)) || labelColor(card));
  useEffect(() => {
    if (!active || !sample) return undefined;
    let alive = true;
    ensureLabelColor(card, lang, cardThumbSrc(card, lang)).then((c) => alive && setColor(c));
    return () => {
      alive = false;
    };
  }, [active, sample, card && card.id, lang]);
  if (!active) return null;
  const r = rectFor(card, lang);
  const s = cloneSrcFor(card, lang);
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
        backgroundSize: `${100 / s.w}% ${100 / s.h}%`,
        backgroundPosition: `${(100 * s.x) / (1 - s.w)}% ${(100 * s.y) / (1 - s.h)}%`,
      }}
    >
      <span style={{ color }}>{PROXY_LABEL}</span>
    </div>
  );
}
