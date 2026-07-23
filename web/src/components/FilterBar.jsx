import React, { useState, useEffect, useRef } from 'react';
import { UI_LANGUAGES } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

// Controlled facet dropdown: the parent owns which one is open, so opening one
// closes the others. The menu sizes to its content (see .facet-menu) so long
// options — e.g. artist names — stay readable.
function FacetDropdown({ label, options, selected = [], onChange, open, onToggle }) {
  const active = selected.length > 0;
  function toggle(value) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
  }
  return (
    <div className="facet">
      <button className={active ? 'active' : ''} onClick={onToggle}>
        {label}{active ? ` (${selected.length})` : ''} ▾
      </button>
      {open && (
        <div className="facet-menu">
          {options.map((opt) => (
            <label key={opt}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact language selector (card-name display language). Sits on the logo row.
function LangLink({ lang, onLangChange }) {
  return (
    <div className="lang-link">
      {UI_LANGUAGES.map((l) => (
        <button
          key={l.code}
          className={lang === l.code ? 'on' : ''}
          onClick={() => onLangChange(l.code)}
        >{l.label}</button>
      ))}
    </div>
  );
}

// Proxy-mode switch: stamps "Proxy" over the copyright on every card shown and
// exported. Sits beside the language selector on the logo row.
function ProxyToggle({ on, onChange }) {
  const t = useT();
  return (
    <label className={`chip-toggle proxy-toggle ${on ? 'on' : ''}`} title={t('proxy.tooltip')} style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {' '}{t('proxy.label')}
    </label>
  );
}

export default function FilterBar({ facets, filters, onChange, lang, onLangChange, isMobile, proxyMode, onProxyChange }) {
  const t = useT();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openKey, setOpenKey] = useState(null); // which facet menu is open (only one)
  const barRef = useRef(null);

  // Close the open facet menu on an outside click or Escape.
  useEffect(() => {
    if (openKey === null) return undefined;
    const onDown = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setOpenKey(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openKey]);

  const set = (key, value) => onChange({ ...filters, [key]: value });
  const anyActive =
    (filters.search && filters.search.length) ||
    (filters.cardText && filters.cardText.length) ||
    filters.unique ||
    ['sets', 'types', 'alignments', 'rarities', 'artists', 'races', 'subtypes', 'skills', 'keywords']
      .some((k) => (filters[k] || []).length);

  // Render a facet dropdown wired to the single-open state.
  const facet = (key, label) => (
    <FacetDropdown
      label={label}
      options={facets[key] || []}
      selected={filters[key]}
      onChange={(v) => set(key, v)}
      open={openKey === key}
      onToggle={() => setOpenKey((k) => (k === key ? null : key))}
    />
  );

  return (
    <div className="filterbar" ref={barRef}>
      <div className="filterbar-top">
        <img className="brand-logo" src="/meccg-logo.png" alt="MECCG" />
        <div className="search-group">
          <input
            type="search"
            placeholder={t('filter.search')}
            value={filters.search || ''}
            onChange={(e) => set('search', e.target.value)}
          />
          <input
            type="search"
            placeholder={t('filter.searchText')}
            value={filters.cardText || ''}
            onChange={(e) => set('cardText', e.target.value)}
          />
        </div>
        <ProxyToggle on={proxyMode} onChange={onProxyChange} />
        <LangLink lang={lang} onLangChange={onLangChange} />
      </div>
      {isMobile && (
        <button
          className={`chip-toggle filters-toggle ${filtersOpen ? 'on' : ''}`}
          onClick={() => setFiltersOpen((o) => !o)}
        >{t('filter.filters')} {filtersOpen ? '▴' : '▾'}</button>
      )}
      <div className="filterbar-bottom" style={isMobile && !filtersOpen ? { display: 'none' } : undefined}>
        {facet('sets', t('filter.set'))}
        {facet('types', t('filter.type'))}
        {facet('alignments', t('filter.alignment'))}
        {facet('rarities', t('filter.rarity'))}
        {facet('artists', t('filter.artist'))}
        {facet('races', t('filter.race'))}
        {facet('subtypes', t('filter.subtype'))}
        {facet('skills', t('filter.skills'))}
        {facet('keywords', t('filter.keywords'))}
        <button className={`chip-toggle ${filters.unique ? 'on' : ''}`} onClick={() => set('unique', !filters.unique)}>
          {t('filter.unique')}
        </button>
        {anyActive ? (
          <button className="linkbtn" onClick={() => onChange({})}>{t('filter.reset')}</button>
        ) : null}
      </div>
    </div>
  );
}
