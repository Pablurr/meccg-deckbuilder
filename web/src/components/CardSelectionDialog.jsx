import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cardThumbSrc, cardName } from '../lib/lang.js';
import { useT } from '../i18n.jsx';
import { allKeys, toggle, setMany, selectRange, groupState } from '../lib/export/selection.js';

const THUMB_W = 90;

// Section and group titles reuse the keys the rest of the app already shows,
// so a section cannot be called one thing here and another in the deck panel.
const SECTION_KEY = {
  pool: 'zones.pool',
  play: 'zones.play',
  locations: 'zones.location',
  sideboard: 'zones.sideboard',
  sideboardFw: 'zones.sideboardFw',
};
const GROUP_KEY = {
  characters: 'panel.group.Character',
  resources: 'panel.group.Resource',
  hazards: 'panel.group.Hazard',
  sites: 'panel.group.Site',
  regions: 'panel.group.Region',
  avatars: 'select.group.avatars',
  other: 'select.group.other',
};

// `indeterminate` is a DOM property, not an HTML attribute: React will not set
// it from JSX. Written as <input indeterminate={…}> it fails silently -- no
// warning, and the partial state simply never shows.
function TriBox({ state, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'partial';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'all'}
      aria-label={label}
      onChange={() => onChange(state !== 'all')}
    />
  );
}

export default function CardSelectionDialog({ sections, slots, initialSelected, lang, onConfirm, onCancel }) {
  const t = useT();
  const [working, setWorking] = useState(() => new Set(initialSelected));
  const [collapsed, setCollapsed] = useState(() => new Set());
  // The shift-click anchor is a ref, not state: it steers the next click and
  // nothing renders from it, so storing it in state would only add renders.
  const anchorRef = useRef(null);

  const sectionId = (id) => `sec:${id}`;
  const groupId = (sec, grp) => `grp:${sec}:${grp}`;
  const isCollapsed = (id) => collapsed.has(id);
  const toggleCollapse = (id) => setCollapsed((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Only what is on screen can be shift-ranged. Folding is a view concern, so
  // it is filtered here and selection.js never hears about it.
  const visibleSlots = useMemo(
    () => slots.filter((s) => !isCollapsed(sectionId(s.sectionId)) && !isCollapsed(groupId(s.sectionId, s.groupId))),
    [slots, collapsed],
  );

  // Ctrl/Cmd+A deliberately spans the whole deck, collapsed sections included:
  // folding is navigation, not a filter. Only shift-click ranges are spatial.
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
      // Safe only because this dialog has no text field. If a search box is
      // ever added, this must stop swallowing the browser's own select-all.
      e.preventDefault();
      setWorking((cur) => (cur.size === slots.length ? new Set() : allKeys(slots)));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots]);

  function clickBox(e, slot) {
    const value = !working.has(slot.key);
    if (e.shiftKey && anchorRef.current) {
      setWorking(selectRange(working, visibleSlots, anchorRef.current, slot.key, value));
    } else {
      setWorking(toggle(working, slot.key));
    }
    anchorRef.current = slot.key;
  }

  const keysOf = (pred) => slots.filter(pred).map((s) => s.key);
  const bulk = (pred, value) => setWorking(setMany(working, keysOf(pred), value));

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t('select.title')}</h2>
        <p className="muted">{t('select.count', { n: working.size, total: slots.length })}</p>
        <p className="muted" style={{ fontSize: 12 }}>{t('select.hint')}</p>

        <div className="select-grid">
          {sections.map((section) => {
            const secKey = sectionId(section.id);
            const secPred = (s) => s.sectionId === section.id;
            return (
              <div className="select-section" key={section.id}>
                <div className="select-head">
                  <button
                    className="select-chevron"
                    onClick={() => toggleCollapse(secKey)}
                    aria-expanded={!isCollapsed(secKey)}
                  >{isCollapsed(secKey) ? '▶' : '▼'}</button>
                  <TriBox
                    state={groupState(working, keysOf(secPred))}
                    label={t(SECTION_KEY[section.id] || section.id)}
                    onChange={(v) => bulk(secPred, v)}
                  />
                  <span>{t(SECTION_KEY[section.id] || section.id)}</span>
                </div>

                {!isCollapsed(secKey) && section.groups.map((group) => {
                  const grpKey = groupId(section.id, group.id);
                  const grpPred = (s) => s.sectionId === section.id && s.groupId === group.id;
                  return (
                    <div className="select-group" key={group.id}>
                      <div className="select-head sub">
                        <button
                          className="select-chevron"
                          onClick={() => toggleCollapse(grpKey)}
                          aria-expanded={!isCollapsed(grpKey)}
                        >{isCollapsed(grpKey) ? '▶' : '▼'}</button>
                        <TriBox
                          state={groupState(working, keysOf(grpPred))}
                          label={t(GROUP_KEY[group.id] || group.id)}
                          onChange={(v) => bulk(grpPred, v)}
                        />
                        <span>{t(GROUP_KEY[group.id] || group.id)}</span>
                      </div>

                      {!isCollapsed(grpKey) && (
                        <div className="select-cards">
                          {group.entries.map((entry) => {
                            const cardSlots = slots.filter(
                              (s) => s.sectionId === section.id && s.groupId === group.id && s.cardId === entry.card.id,
                            );
                            return (
                              <div className="select-card" key={entry.card.id}>
                                <img
                                  src={cardThumbSrc(entry.card, lang, THUMB_W)}
                                  alt={cardName(entry.card, lang)}
                                  loading="lazy"
                                  width={THUMB_W}
                                />
                                <div className="select-card-name">{cardName(entry.card, lang)}</div>
                                <div className="select-boxes">
                                  {cardSlots.map((slot) => (
                                    <input
                                      key={slot.key}
                                      type="checkbox"
                                      checked={working.has(slot.key)}
                                      aria-label={`${cardName(entry.card, lang)} ${slot.copyIndex + 1}`}
                                      onChange={() => {}}
                                      onClick={(e) => clickBox(e, slot)}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <button className="btn secondary" onClick={() => setWorking(allKeys(slots))}>{t('select.all')}</button>
            <button className="btn secondary" onClick={() => setWorking(new Set())}>{t('select.none')}</button>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="btn" onClick={() => onConfirm(working)}>{t('select.confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
