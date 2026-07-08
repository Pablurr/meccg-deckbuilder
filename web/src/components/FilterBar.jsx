import React, { useState } from 'react';
import { UI_LANGUAGES } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

function FacetDropdown({ label, options, selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;
  function toggle(value) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
  }
  return (
    <div className="facet">
      <button className={active ? 'active' : ''} onClick={() => setOpen((o) => !o)}>
        {label}{active ? ` (${selected.length})` : ''} ▾
      </button>
      {open && (
        <div className="facet-menu" onMouseLeave={() => setOpen(false)}>
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

export default function FilterBar({ facets, filters, onChange, lang, onLangChange }) {
  const t = useT();
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const anyActive =
    (filters.search && filters.search.length) ||
    (filters.cardText && filters.cardText.length) ||
    filters.unique ||
    ['sets', 'types', 'alignments', 'rarities', 'races', 'subtypes', 'skills', 'keywords'].some((k) => (filters[k] || []).length);

  return (
    <div className="filterbar">
      <div className="filterbar-top">
        <img className="brand-logo" src="/meccg-logo.png" alt="MECCG" />
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
        <div className="lang-toggle">
          {UI_LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={lang === l.code ? 'on' : ''}
              onClick={() => onLangChange(l.code)}
            >{l.label}</button>
          ))}
        </div>
      </div>
      <div className="filterbar-bottom">
        <FacetDropdown label={t('filter.set')} options={facets.sets} selected={filters.sets} onChange={(v) => set('sets', v)} />
        <FacetDropdown label={t('filter.type')} options={facets.types} selected={filters.types} onChange={(v) => set('types', v)} />
        <FacetDropdown label={t('filter.alignment')} options={facets.alignments} selected={filters.alignments} onChange={(v) => set('alignments', v)} />
        <FacetDropdown label={t('filter.rarity')} options={facets.rarities} selected={filters.rarities} onChange={(v) => set('rarities', v)} />
        <FacetDropdown label={t('filter.race')} options={facets.races} selected={filters.races} onChange={(v) => set('races', v)} />
        <FacetDropdown label={t('filter.subtype')} options={facets.subtypes} selected={filters.subtypes} onChange={(v) => set('subtypes', v)} />
        <FacetDropdown label={t('filter.skills')} options={facets.skills} selected={filters.skills} onChange={(v) => set('skills', v)} />
        <FacetDropdown label={t('filter.keywords')} options={facets.keywords} selected={filters.keywords} onChange={(v) => set('keywords', v)} />
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
