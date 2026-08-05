import React from 'react';
import {
  proxyStampFor, PROXY_PATCH_RECT,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay repainting the copyright / set-name zone with the card frame's own
// patch, plus the label. Must live inside a positioned wrapper that matches the
// card image bounds exactly. The label scales with the box via cqw and is nudged
// onto the reference band via cqh (see .proxy-stamp in styles.css).
// What is drawn -- and whether anything is drawn at all -- is proxyStampFor's
// call, not this component's: `on` is the proxy-mode flag, not a visibility flag.
export default function ProxyStamp({ card, lang, on, setNames }) {
  const stamp = proxyStampFor(card, lang, on, setNames);
  if (!stamp) return null;
  const r = PROXY_PATCH_RECT;
  return (
    <div
      className="proxy-stamp"
      aria-hidden="true"
      style={{
        left: pct(r.x),
        top: pct(r.y),
        width: pct(r.w),
        height: pct(r.h),
        backgroundImage: `url(${patchUrl(stamp.key, lang)})`,
      }}
    >
      <span
        style={{
          color: stamp.color,
          fontSize: `${PROXY_LABEL_FONT_CQW}cqw`,
          transform: `translateY(${PROXY_LABEL_DY_CQH}cqh)`,
        }}
      >
        {stamp.text}
      </span>
    </div>
  );
}
