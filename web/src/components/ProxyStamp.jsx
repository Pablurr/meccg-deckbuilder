import React from 'react';
import { swatchKeyForCard, rectForLang, PROXY_LABEL } from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay covering the copyright / set-name zone with the card-type's band
// texture and the "Proxy" label. Must live inside a positioned wrapper that
// matches the card image bounds exactly. Text scales with the box via cqh
// (see .proxy-stamp in styles.css). Renders nothing when off or for cards
// without a stamp (Regions).
export default function ProxyStamp({ card, lang, on }) {
  if (!on) return null;
  const key = swatchKeyForCard(card);
  if (!key) return null;
  const r = rectForLang(lang);
  return (
    <div
      className="proxy-stamp"
      aria-hidden="true"
      style={{
        left: pct(r.x),
        top: pct(r.y),
        width: pct(r.w),
        height: pct(r.h),
        backgroundImage: `url(/proxy-swatches/${key}.png)`,
      }}
    >
      <span>{PROXY_LABEL}</span>
    </div>
  );
}
