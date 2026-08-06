import React, { useState, useEffect, useRef } from 'react';
import { UI_LANGUAGES, setLabel } from '../lib/lang.js';
import { useT } from '../i18n.jsx';
import { localize } from '../lib/rules/docText.js';
import { sortFacetOptions } from '../lib/filter.js';
import { TYPE_ORDER, REPORT_ISSUES_URL } from '../lib/constants.js';

// Facet values come straight from cards.json, so they are English data --
// "Hazard", "Minion" -- and showed as such in a French or Spanish UI, the last
// place the retired vocabulary was still visible. Only these three families
// have dictionary entries; localize() hands back the raw value for anything
// else, which is required for set codes and artist names since those are
// proper nouns and must not be "translated".
//
// The terminology guard in test/i18n.test.js cannot see this: it inspects
// translations.fr, and these strings were never in it.
const FACET_PREFIX = { types: 'panel.group', alignments: 'alignment', races: 'race' };

// Controlled facet dropdown: the parent owns which one is open, so opening one
// closes the others. The menu sizes to its content (see .facet-menu) so long
// options — e.g. artist names — stay readable.
function FacetDropdown({ label, options, selected = [], onChange, open, onToggle, optionLabel, order }) {
  const active = selected.length > 0;
  function toggle(value) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
  }
  const show = optionLabel || ((v) => v);
  // Sorted on what is displayed, not on the raw data value: the menu is read,
  // so "Périls" belongs under P even though the value behind it is "Hazard".
  const ordered = sortFacetOptions(options, { order, label: show });
  return (
    <div className="facet">
      <button className={active ? 'active' : ''} onClick={onToggle}>
        {label}{active ? ` (${selected.length})` : ''} ▾
      </button>
      {open && (
        <div className="facet-menu">
          {ordered.map((opt) => (
            <label key={opt}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              {show(opt)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Card-name display language. A dropdown rather than three side-by-side
// buttons: those cost ~94px, which on a narrow phone filled the logo row and
// pushed the "?" button onto a row of its own. The trigger shows the flag
// alone (the menu spells each language out), so the control costs about half
// as much and the row holds every item again.
//
// It borrows the facet dropdown's markup and its `openKey` slot, so opening it
// closes any open facet and it inherits the outside-click/Escape handling
// already wired for those -- one mechanism, not a second one to keep in step.
function LangPicker({ lang, onLangChange, open, onToggle }) {
  const t = useT();
  const current = UI_LANGUAGES.find((l) => l.code === lang) || UI_LANGUAGES[0];
  return (
    <div className="facet lang-facet">
      <button onClick={onToggle} aria-label={t('lang.pick')} aria-expanded={open}>
        <span className="lang-flag">{current.flag}</span> ▾
      </button>
      {open && (
        <div className="facet-menu lang-menu">
          {UI_LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={l.code === lang ? 'on' : ''}
              onClick={() => { onLangChange(l.code); onToggle(); }}
            >
              <span className="lang-flag">{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      )}
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

export default function FilterBar({ facets, setNames = {}, filters, onChange, lang, onLangChange, isMobile, proxyMode, onProxyChange, onOpenDocs }) {
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

  // How a facet's raw data value is turned into what the menu shows. Two
  // different sources, on purpose: types/alignments/races are closed
  // vocabularies and live in the dictionary, whereas set names ship inside
  // cards.json in all three languages — so a new set names itself rather than
  // waiting on an i18n key. Facets with no entry here (artists, rarities,
  // subtypes, skills, keywords) show their raw value, which is required for
  // artist names and is the existing behaviour for the rest.
  const optionLabel = (key) => {
    if (key === 'sets') return (v) => setLabel(setNames, v, lang);
    if (FACET_PREFIX[key]) return (v) => localize(t, FACET_PREFIX[key], v);
    return undefined;
  };

  // Render a facet dropdown wired to the single-open state.
  const facet = (key, label, order) => (
    <FacetDropdown
      label={label}
      options={facets[key] || []}
      selected={filters[key]}
      onChange={(v) => set(key, v)}
      open={openKey === key}
      onToggle={() => setOpenKey((k) => (k === key ? null : key))}
      optionLabel={optionLabel(key)}
      order={order}
    />
  );

  return (
    <div className="filterbar" ref={barRef}>
      <div className="filterbar-top">
        <img className="brand-logo" src="/meccg-logo.png" alt="MECCG" />
        {/* .search-row is `display: contents` on desktop (see styles.css) --
            purely a grouping node for mobile, where it becomes the actual
            flex line search-group used to own alone. That split (a wrapper
            that owns "does this pair get its own row" vs. the plain flex
            children inside sharing that row's width) sidesteps a flexbox
            trap: giving search-group itself a forced-wrap basis (100%, as it
            had before) means the WRAP decision places it alone on its line
            before flex-grow/shrink ever run, so filters-toggle can never
            join that same line no matter how either one is later sized. */}
        <div className="search-row">
          <div className="search-group">
            <input
              type="search"
              placeholder={t(isMobile ? 'filter.searchShort' : 'filter.search')}
              value={filters.search || ''}
              onChange={(e) => set('search', e.target.value)}
            />
            <input
              type="search"
              placeholder={t(isMobile ? 'filter.searchTextShort' : 'filter.searchText')}
              value={filters.cardText || ''}
              onChange={(e) => set('cardText', e.target.value)}
            />
          </div>
          {/* Mobile only: icon + fold arrow only -- "Filtres" stays as the
              button's accessible name via the visually-hidden span, not as
              visible text (see .sr-only), which is what actually frees the
              width the search boxes needed. */}
          {isMobile && (
            <button
              className={`chip-toggle filters-toggle ${filtersOpen ? 'on' : ''}`}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              <span aria-hidden="true">▽ {filtersOpen ? '▴' : '▾'}</span>
              <span className="sr-only">{t('filter.filters')}</span>
            </button>
          )}
        </div>
        <ProxyToggle on={proxyMode} onChange={onProxyChange} />
        <LangPicker
          lang={lang}
          onLangChange={onLangChange}
          open={openKey === 'lang'}
          onToggle={() => setOpenKey((k) => (k === 'lang' ? null : 'lang'))}
        />
        <button className="chip-toggle docs-btn" onClick={onOpenDocs} title={t('docs.title')} aria-label={t('docs.title')}>?</button>
        {/* A link, not a button: the destination is a URL, so it opens in a new
            tab, copies, and announces itself correctly. Built the same way as
            the per-rule "report" links in RulesDoc. */}
        <a
          className="chip-toggle suggest-btn"
          href={`${REPORT_ISSUES_URL}?labels=enhancement&title=${encodeURIComponent(t('suggest.issueTitle'))}&body=${encodeURIComponent(t('suggest.bodyTemplate'))}`}
          target="_blank"
          rel="noreferrer"
          title={t('suggest.label')}
          aria-label={t('suggest.label')}
        >💡</a>
      </div>
      <div className="filterbar-bottom" style={isMobile && !filtersOpen ? { display: 'none' } : undefined}>
        {facet('sets', t('filter.set'))}
        {facet('types', t('filter.type'), TYPE_ORDER)}
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
