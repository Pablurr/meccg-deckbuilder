import React, { useState } from 'react';

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

export default function FilterBar({ facets, filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const anyActive =
    (filters.search && filters.search.length) ||
    filters.unique ||
    ['sets', 'types', 'alignments', 'rarities', 'races', 'subtypes', 'skills', 'keywords'].some((k) => (filters[k] || []).length);

  return (
    <div className="filterbar">
      <span className="brand">MECCG</span>
      <input
        type="search"
        placeholder="Rechercher un nom (en / fr)…"
        value={filters.search || ''}
        onChange={(e) => set('search', e.target.value)}
      />
      <FacetDropdown label="Set" options={facets.sets} selected={filters.sets} onChange={(v) => set('sets', v)} />
      <FacetDropdown label="Type" options={facets.types} selected={filters.types} onChange={(v) => set('types', v)} />
      <FacetDropdown label="Alignement" options={facets.alignments} selected={filters.alignments} onChange={(v) => set('alignments', v)} />
      <FacetDropdown label="Rareté" options={facets.rarities} selected={filters.rarities} onChange={(v) => set('rarities', v)} />
      <FacetDropdown label="Race" options={facets.races} selected={filters.races} onChange={(v) => set('races', v)} />
      <FacetDropdown label="Sous-type" options={facets.subtypes} selected={filters.subtypes} onChange={(v) => set('subtypes', v)} />
      <FacetDropdown label="Compétences" options={facets.skills} selected={filters.skills} onChange={(v) => set('skills', v)} />
      <FacetDropdown label="Mots-clés" options={facets.keywords} selected={filters.keywords} onChange={(v) => set('keywords', v)} />
      <button className={`chip-toggle ${filters.unique ? 'on' : ''}`} onClick={() => set('unique', !filters.unique)}>
        Unique
      </button>
      {anyActive ? (
        <button className="linkbtn" onClick={() => onChange({})}>réinitialiser</button>
      ) : null}
    </div>
  );
}
