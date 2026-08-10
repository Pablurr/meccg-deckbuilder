import React, { useRef } from 'react';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { capTitle } from '../lib/rules/docText.js';
import { ZONE_LABEL_KEY } from '../lib/rules/zones.js';
import { swipeDirection } from '../lib/cardNav.js';

// Full-screen card preview for touch (desktop uses the hover CardPreview).
// The image is constrained to fit ENTIRELY within the viewport (see styles):
// the wrapper takes the space above the control bar and the img uses
// object-fit:contain, so the whole card is always visible without scrolling.
//
// `rows` is one entry per zone THIS card may occupy, built by App from
// zoneTargets -- never a fixed deck/sideboard/pool triple, since a Site has
// only the deck and an avatar may never enter the pool. On a phone, tapping a
// card tile opens this modal instead of toggling the card, so these counters
// are the primary way to add a copy anywhere; a single deck-only counter left
// the sideboard and the pool unreachable by touch. It is also the only touch
// route for MOVING a copy (-1 here, +1 there): the deck tile's own ⇄ button
// was removed on mobile, since it offered the same destinations through a
// cramped overlay of zone buttons sized to a ~105px thumbnail.

// Group blocked zones by the REASON they are blocked, so one sentence is
// printed once instead of once per zone.
//
// Nearly every cap counts copies across all zones at once (a unique card is
// one copy in the whole deck), so a blocked card is normally blocked
// everywhere for the same reason -- which rendered the identical sentence on
// every row: three copies of "Carte unique - un seul exemplaire dans tout le
// deck. (CoE §1.3.1)" cost 58px of a bar that has to share the screen with
// the card image it explains.
//
// Kept as a list rather than collapsed to a single string because a per-zone
// sub-cap does exist (1.6.2's one avatar copy per sideboard), so two zones can
// genuinely be blocked for different reasons; the caller labels each entry
// with its zones only when there is more than one to tell apart.
export function capNotices(rows) {
  const byReason = new Map();
  for (const { zone, reason } of rows) {
    if (!reason) continue;
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(zone);
  }
  return [...byReason].map(([reason, zones]) => ({ reason, zones }));
}

export default function CardPreviewModal({ card, lang, rows = [], onChangeZoneQty, onClose, onNav, proxyMode, setNames }) {
  const t = useT();
  const touchStart = useRef(null);
  // A real touchend synthesizes a compatibility click on the same target
  // afterwards; without swallowing it, a swipe's trailing click bubbles to
  // the backdrop's onClose and the gesture that navigates also closes the
  // modal. Set only when onNav actually fired, so a plain tap (no swipe)
  // still bubbles through and closes the modal as before.
  const swiped = useRef(false);
  if (!card) return null;
  const name = cardName(card, lang);

  function handleTouchStart(e) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  // Reads the recorded start point rather than accumulating deltas across
  // touchmove: a single start/end comparison is enough for a swipe gesture
  // and skips a stream of intermediate state updates on every frame.
  function handleTouchEnd(e) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !onNav) return;
    const touch = e.changedTouches[0];
    const dir = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (dir) {
      swiped.current = true;
      onNav(dir);
    }
  }

  // The OS can interrupt a touch mid-gesture (incoming call, notification
  // pull-down, scroll takeover) without ever firing touchend. Without this,
  // touchStart.current would stay stale until some later, unrelated touchend
  // paired it with a mismatched end point and misfired onNav.
  function handleTouchCancel() {
    touchStart.current = null;
  }

  // Consumes the compatibility click a real touchscreen fires right after
  // touchend, on whatever element was under the finger (usually the image).
  // stopPropagation keeps it from reaching the backdrop's onClose; a plain
  // tap leaves swiped.current false and falls through to close as usual.
  function handleImgwrapClick(e) {
    if (swiped.current) {
      swiped.current = false;
      e.stopPropagation();
    }
  }

  return (
    // Clicking anywhere (the card image or the letterbox around it) closes the
    // modal; only the quantity bar swallows the click so ＋/− don't dismiss it.
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal">
        <div
          className="card-modal-imgwrap"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClick={handleImgwrapClick}
        >
          <div className="proxy-wrap">
            <img
              src={cardImageSrc(card, lang)}
              alt={name}
              onError={(e) => {
                const el = e.currentTarget;
                const en = cardImageEn(card);
                if (en && el.getAttribute('src') !== en) el.src = en;
              }}
            />
            <ProxyStamp card={card} lang={lang} on={proxyMode} setNames={setNames} />
          </div>
        </div>
        <div className="card-modal-bar" onClick={(e) => e.stopPropagation()}>
          {rows.map(({ zone, qty, room }) => (
            <div className="card-modal-zone" key={zone}>
              {/* The row is the labelled group, so the two buttons keep their
                  plain "add a copy" / "remove a copy" names instead of a
                  concatenated per-zone string that would force English word
                  order onto every language. */}
              <div className="card-modal-zone-row" role="group" aria-label={t(ZONE_LABEL_KEY[zone])}>
                <span className="card-modal-zone-name">{t(ZONE_LABEL_KEY[zone])}</span>
                <button
                  className="qty-btn big"
                  onClick={() => onChangeZoneQty(zone, card.id, -1)}
                  disabled={qty <= 0}
                  aria-label={t('browser.removeCopy')}
                >−</button>
                <span className="card-modal-count">{qty}</span>
                <button
                  className="qty-btn big"
                  onClick={() => onChangeZoneQty(zone, card.id, +1)}
                  disabled={room.remaining <= 0}
                  aria-label={t('browser.addCopy')}
                >+</button>
              </div>
            </div>
          ))}
          {/* A blocked + must SAY why on screen. capTitle's sentence used to be
              a title= tooltip only, which touch can never surface, and a
              disabled button is not focusable either -- so the cap was
              invisible and the button looked simply broken. Printed once per
              DISTINCT reason at the foot of the bar rather than under each row
              (see capNotices), and named by zone only when two reasons have to
              be told apart. */}
          {(() => {
            const notices = capNotices(
              rows.map(({ zone, room }) => ({ zone, reason: capTitle(t, room.ruleId, room.remaining) })),
            );
            return notices.map(({ reason, zones }) => (
              <div className="card-modal-zone-reason" key={reason}>
                {notices.length > 1 && (
                  <b>{zones.map((z) => t(ZONE_LABEL_KEY[z])).join(', ')} : </b>
                )}
                {reason}
              </div>
            ));
          })()}
          <button className="btn" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  );
}
