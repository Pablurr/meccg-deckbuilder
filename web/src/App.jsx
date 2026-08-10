import React, { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { expandQuantities, countOccurrences, deckCounts, deckWarnings, normalizeDeck, totalCopies, emptyZones, EMPTY_NOTES, deckSignature, deckPayload } from './lib/deck.js';
import { baseOptions } from './lib/tags.js';
import { excludeSkill } from './lib/parseCards.js';
import { I18nProvider } from './i18n.jsx';
import { makeT } from './lib/i18n.js';
import { validateDeck } from './lib/rules/validate.js';
import { remainingCopies } from './lib/rules/copies.js';
import { zoneTargets } from './lib/rules/zones.js';
import { bumpCount, applyDelta, applyToggle, applySelectAll } from './lib/deckMutations.js';
import { navigateList } from './lib/cardNav.js';
import FilterBar from './components/FilterBar.jsx';
import CardBrowser from './components/CardBrowser.jsx';
import DeckDrawer from './components/DeckDrawer.jsx';
import DeckPanel from './components/DeckPanel.jsx';
import DeckManager from './components/DeckManager.jsx';
import DeckSetupDialog from './components/DeckSetupDialog.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import ImportDialog from './components/ImportDialog.jsx';
import CardPreviewModal from './components/CardPreviewModal.jsx';
import RulesDoc from './components/RulesDoc.jsx';
import { useIsMobile } from './lib/useIsMobile.js';

export default function App() {
  const [cards, setCards] = useState([]);
  const [facets, setFacets] = useState(null);
  const [setNames, setSetNames] = useState({}); // set code -> { en, es, fr }
  const [defaultBacks, setDefaultBacks] = useState({});
  const [filters, setFilters] = useState({});
  // Independent from `filters` on purpose: "Reset filters" must not also
  // reset how the grid is sorted -- see design spec 2026-08-09.
  const [sortBy, setSortBy] = useState({ primary: 'sets', secondary: null });
  const [uiLang, setUiLang] = useState('fr'); // display language for card names
  const [quantities, setQuantities] = useState({}); // id -> copy count
  const [deck, setDeck] = useState(() => normalizeDeck({ id: null, name: 'Nouveau deck', backAssignments: {} }));
  const [zones, setZones] = useState(() => emptyZones()); // id -> copy count, per zone
  // Signature of what is currently on disk for this deck. The Save button
  // compares the live deck against it; anything that is not one of the four
  // moments below (mount, load, new, successful save) must NOT touch it --
  // an import in particular leaves the deck dirty on purpose, because the
  // imported work is not stored yet.
  const [savedSignature, setSavedSignature] = useState(() => deckSignature({
    deck: normalizeDeck({ id: null, name: 'Nouveau deck', backAssignments: {} }),
    quantities: {},
    zones: emptyZones(),
  }));
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | <error message>
  const [showManager, setShowManager] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(360); // right deck panel width in px
  const isMobile = useIsMobile();
  const [error, setError] = useState(null);
  const [deckSheetOpen, setDeckSheetOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);
  // Captured once, when the modal opens, from whichever list it was opened
  // from (the filtered selector grid, or the active deck zone) -- swipe
  // navigates this frozen snapshot, so it does not need to react to filter
  // or deck changes made while the modal is open (see design spec).
  const [previewList, setPreviewList] = useState([]);
  // Proxy mode: cover the copyright/set-name with a "Proxy" stamp everywhere
  // (screen + exports). ON by default; persisted so the choice sticks.
  const [proxyMode, setProxyMode] = useState(() => {
    try { return localStorage.getItem('meccg.proxyMode') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('meccg.proxyMode', proxyMode ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [proxyMode]);

  // When the deck empties the mobile sheet unmounts; reset its flag so re-adding
  // a card doesn't pop the sheet back open unprompted.
  //
  // Asked of totalCopies rather than by listing the zones here: a zone added
  // later and forgotten in this expression would make its cards unreachable on
  // mobile, which is exactly the bug totalCopies' own comment records.
  const deckEmpty = totalCopies(quantities, zones) === 0;
  useEffect(() => { if (deckEmpty) setDeckSheetOpen(false); }, [deckEmpty]);

  useEffect(() => {
    api.getCards()
      .then(({ cards, facets, setNames, defaultBacks }) => { setCards(cards); setFacets(facets); setSetNames(setNames || {}); setDefaultBacks(defaultBacks || {}); })
      .catch((e) => setError(e.message));
  }, []);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  // uiLang is the card-name display language (fr/en/es) and, since the es
  // dictionary is now complete (Task 20), also the UI chrome language.
  const textLang = uiLang;
  const t = useMemo(() => makeT(textLang), [textLang]);

  // race/subtype/skills hold compound values; show only deduplicated base
  // options (built from the cards we already have), matching the tag filtering.
  const derivedFacets = useMemo(() => {
    if (!facets) return facets;
    return {
      ...facets,
      races: baseOptions(cards, 'races'),
      subtypes: baseOptions(cards, 'subtypes'),
      skills: excludeSkill(baseOptions(cards, 'skills'), 'Ally'),
    };
  }, [facets, cards]);

  // Copy caps are hard limits in deckbuilding mode and absent in freeform.
  // Computed inside each updater from `prev`, never from a captured render
  // value, so rapid clicks cannot race past a cap.
  const capCtx = deck.mode === 'deckbuilding' && deck.ruleset
    ? { side: deck.ruleset.side, ruleOverrides: deck.ruleset.ruleOverrides || {} }
    : null;

  // How many more copies of `id` may enter `zone`. Infinity in freeform, and
  // for an id we have no card for.
  function roomFor(id, zone, quantitiesMap, zonesMap) {
    if (!capCtx) return Infinity;
    const card = cardsById.get(id);
    if (!card) return Infinity;
    return remainingCopies(card, zone, { quantities: quantitiesMap, zones: zonesMap }, capCtx).remaining;
  }

  // delta is +1 / -1. `enforce: false` is used only by moveCopy, which cannot
  // raise a total.
  function changeQty(id, delta, { enforce = true } = {}) {
    setQuantities((prev) => applyDelta(prev, id, delta, enforce ? roomFor(id, 'deck', prev, zones) : Infinity));
  }

  // zone is 'deck' | 'sideboard' | 'pool' | 'sideboardFw'; 'deck' routes to the
  // existing quantities map rather than being a zone of its own.
  function changeZoneQty(zone, id, delta, { enforce = true } = {}) {
    if (zone === 'deck') return changeQty(id, delta, { enforce });
    setZones((prev) => {
      const room = enforce ? roomFor(id, zone, quantities, prev) : Infinity;
      if (delta > 0 && !(room > 0)) return prev;
      return { ...prev, [zone]: bumpCount(prev[zone], id, delta) };
    });
  }

  // Move one copy between zones (including 'deck'); no-op if fromZone === toZone.
  // The destination increment is NOT cap-checked: -1 then +1 leaves the total
  // untouched, and gating it would break dragging a card that sits at its cap --
  // exactly when a player most wants to move one. A zone sub-cap (1.6.2's one
  // avatar copy in the sideboard) can therefore be exceeded by a drag, and is
  // reported by AVATAR-SIDEBOARD instead: a drag that silently does nothing has
  // nowhere to explain itself, while the + button does.
  function moveCopy(id, fromZone, toZone) {
    if (fromZone === toZone) return;
    changeZoneQty(fromZone, id, -1);
    changeZoneQty(toZone, id, +1, { enforce: false });
  }

  function toggleCard(id) {
    setQuantities((prev) => applyToggle(prev, id, roomFor(id, 'deck', prev, zones)));
  }

  function selectAll(ids) {
    setQuantities((prev) => applySelectAll(prev, ids, (id, working) => roomFor(id, 'deck', working, zones)));
  }

  // Replace the current selection with an imported { quantities, zones, notes }
  // (counts floored at 1). Matches the pre-existing full-replace semantics of
  // the old importQuantities (quantities always fully replaced, never
  // merged) — zones/notes default to empty so a legacy paste (no sections,
  // no ## Notes) clears them rather than leaving stale state behind.
  //
  // `target: 'new'` builds a fresh deck rather than overwriting the open one:
  // pasting a forum list is usually "make me a deck from this", and a failed
  // import must not destroy work in progress. `target: 'replace'` keeps the
  // open deck's name -- nobody's deck gets renamed under their feet.
  function importDeckData({ quantities: imported = {}, zones: importedZones, notes: importedNotes, name, mode, ruleset, target = 'replace' }) {
    const clamp = (map) => {
      const out = {};
      for (const [id, count] of Object.entries(map || {})) out[id] = Math.max(1, count);
      return out;
    };
    setQuantities(clamp(imported));
    // Derived from normalizeDeck's own zone set (via emptyZones), not a
    // hand-listed sideboard/pool pair: the previous version silently dropped
    // any zone it didn't name, which is exactly how the Fallen-wizard
    // sideboard's imported cards used to vanish with no warning (C4, final
    // review). A zone added later needs no edit here to survive an import.
    const importedAll = normalizeDeck({ zones: importedZones }).zones;
    setZones(Object.fromEntries(Object.entries(importedAll).map(([z, m]) => [z, clamp(m)])));
    setDeck((prev) => normalizeDeck({
      ...prev,
      // A new deck drops the previous id so saving creates a record instead of
      // overwriting one.
      ...(target === 'new' ? { id: null, name: name || t('app.newDeck'), backAssignments: {} } : {}),
      mode,
      ruleset,
      notes: { ...EMPTY_NOTES, ...(importedNotes || {}) },
    }));
    setShowImport(false);
    setSaveState('idle');
  }

  function loadDeckIntoState(d) {
    const normalized = normalizeDeck(d);
    setDeck(normalized);
    setQuantities(d.quantities || countOccurrences(d.cardIds || []));
    setZones(normalized.zones);
    setShowManager(false);
    setSavedSignature(deckSignature({ deck: normalized, quantities: d.quantities || countOccurrences(d.cardIds || []), zones: normalized.zones }));
    setSaveState('idle');
  }

  // "New" resets quantities/zones/notes first so the setup dialog (and the
  // deck it produces) never inherits the previous deck's cards.
  function newDeck() {
    setDeck(normalizeDeck({ id: null, name: t('app.newDeck'), backAssignments: {} }));
    setQuantities({});
    setZones(emptyZones());
    setShowManager(false);
    setShowSetup(true);
    setSavedSignature(deckSignature({ deck: normalizeDeck({ id: null, name: t('app.newDeck'), backAssignments: {} }), quantities: {}, zones: emptyZones() }));
    setSaveState('idle');
  }

  // Called by DeckSetupDialog.onConfirm with { mode, ruleset }.
  function applySetup(partial) {
    setDeck((prev) => normalizeDeck({ ...prev, id: prev.id, ...partial }));
    setShowSetup(false);
  }

  // The header's Save button. An unsaved deck goes through the manager
  // instead: creating a record is where the name and the exact deck settings
  // get decided, and that form already exists there.
  async function saveDeck() {
    if (!deck.id) { setSaveState('idle'); setShowManager(true); return; }
    setSaveState('saving');
    try {
      const saved = await api.updateDeck(deck.id, deckPayload({ deck, cardIds, quantities, zones }));
      setDeck((prev) => normalizeDeck({ ...prev, ...saved }));
      setSavedSignature(deckSignature({ deck, quantities, zones }));
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (e) {
      setSaveState(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
    }
  }

  // Live rule warnings for deckbuilding decks (validateDeck is pure and runs
  // on every edit, so it's memoized; freeform decks always have ruleset ===
  // null and therefore produce no warnings — nothing blocks either way).
  const ruleWarnings = useMemo(() => (
    deck.mode === 'deckbuilding' && deck.ruleset
      ? validateDeck({
          side: deck.ruleset.side,
          length: deck.ruleset.length,
          tournament: deck.ruleset.tournament,
          ruleOverrides: deck.ruleset.ruleOverrides,
          quantities,
          zones,
          cardsById,
        })
      : []
  ), [deck.mode, deck.ruleset, quantities, zones, cardsById]);

  // "Ignore this rule": writes the override on the current deck's ruleset so
  // it's per-deck (persists with the deck on save) and never global.
  function onToggleRule(ruleId, enabled) {
    setDeck((prev) => (prev.ruleset
      ? { ...prev, ruleset: { ...prev.ruleset, ruleOverrides: { ...prev.ruleset.ruleOverrides, [ruleId]: enabled } } }
      : prev));
  }

  // Notes tab: one of the four free-text fields changed. Deck is small
  // (four short strings), so a plain functional setState per keystroke is
  // cheap — no debounce needed, since nothing writes to storage until the
  // user explicitly saves via DeckManager.
  function changeNote(field, value) {
    setDeck((prev) => ({ ...prev, notes: { ...prev.notes, [field]: value } }));
  }

  function openPreview(card, list) {
    setPreviewCard(card);
    setPreviewList(list);
  }

  if (error) return <div style={{ padding: 24 }}>{t('app.loadError', { error })}</div>;
  if (!facets) return <div style={{ padding: 24 }}>{t('app.loading')}</div>;

  const cardIds = expandQuantities(quantities);
  const counts = deckCounts(cardsById, cardIds);
  const warnings = deckWarnings(cardsById, cardIds, deck.backAssignments, defaultBacks);
  const hasSelection = totalCopies(quantities, zones) > 0;
  const dirty = deckSignature({ deck, quantities, zones }) !== savedSignature;

  return (
    <I18nProvider lang={textLang}>
    <div className="app">
      <FilterBar facets={derivedFacets} setNames={setNames} filters={filters} onChange={setFilters} lang={uiLang} onLangChange={setUiLang} isMobile={isMobile} proxyMode={proxyMode} onProxyChange={setProxyMode} onOpenDocs={() => setShowDocs(true)} sortBy={sortBy} onSortChange={setSortBy} />
      <div className="main-row">
        <CardBrowser cards={cards} filters={filters} sortBy={sortBy} quantities={quantities} lang={uiLang} onChangeQty={changeQty} onToggle={toggleCard} onSelectAll={selectAll} isMobile={isMobile} onPreview={openPreview} proxyMode={proxyMode} setNames={setNames} deckMode={deck.mode} side={deck.mode === 'deckbuilding' ? deck.ruleset?.side ?? null : null} zones={zones} changeZoneQty={changeZoneQty} capCtx={capCtx} />
        {hasSelection && !isMobile && (
          <DeckPanel
            cardsById={cardsById}
            quantities={quantities}
            zones={zones}
            deck={deck}
            changeZoneQty={changeZoneQty}
            moveCopy={moveCopy}
            lang={uiLang}
            counts={counts}
            warnings={warnings}
            ruleWarnings={ruleWarnings}
            onToggleRule={onToggleRule}
            collapsed={panelCollapsed}
            onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
            width={panelWidth}
            onResize={setPanelWidth}
            onChangeQty={changeQty}
            onToggle={toggleCard}
            onChangeNote={changeNote}
            proxyMode={proxyMode}
            setNames={setNames}
            capCtx={capCtx}
            dirty={dirty}
            onSave={saveDeck}
            saveState={saveState}
          />
        )}
      </div>
      {isMobile && deckSheetOpen && hasSelection && (
        <DeckPanel
          asSheet
          isMobile
          cardsById={cardsById}
          quantities={quantities}
          zones={zones}
          deck={deck}
          changeZoneQty={changeZoneQty}
          moveCopy={moveCopy}
          lang={uiLang}
          counts={counts}
          warnings={warnings}
          ruleWarnings={ruleWarnings}
          onToggleRule={onToggleRule}
          collapsed={false}
          onChangeQty={changeQty}
          onToggle={toggleCard}
          onChangeNote={changeNote}
          onPreview={openPreview}
          onClose={() => setDeckSheetOpen(false)}
          proxyMode={proxyMode}
          setNames={setNames}
          capCtx={capCtx}
          dirty={dirty}
          onSave={saveDeck}
          saveState={saveState}
        />
      )}
      <DeckDrawer
        // Every zone, not counts.total: the drawer disables "view deck" and
        // "export" on this number, and both are wrong for a deck whose cards
        // sit only in the pool or the sideboard. The export already prints
        // those zones (deckSections reads them), so the button was refusing
        // work it could do.
        total={totalCopies(quantities, zones)}
        onManage={() => setShowManager(true)}
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
        onNew={newDeck}
        onSettings={() => setShowSetup(true)}
        isMobile={isMobile}
        onViewDeck={() => setDeckSheetOpen(true)}
      />
      {showSetup && (
        <DeckSetupDialog
          initial={deck}
          onConfirm={applySetup}
          onClose={() => setShowSetup(false)}
        />
      )}
      {showManager && (
        <DeckManager
          deck={deck}
          cardIds={cardIds}
          quantities={quantities}
          zones={zones}
          cardsById={cardsById}
          uiLang={uiLang}
          onClose={() => setShowManager(false)}
          onLoad={loadDeckIntoState}
          onSaved={(d) => {
            setDeck((prev) => normalizeDeck({ ...prev, ...d }));
            setSavedSignature(deckSignature({ deck: { ...deck, ...d }, quantities, zones }));
            setSaveState('idle');
          }}
          onRenamed={(saved) => {
            setDeck((prev) => ({ ...prev, name: saved.name }));
            // Baseline rebuilt from the STORED record, never from the live deck:
            // a rename must not certify card edits the user has not saved.
            setSavedSignature(deckSignature({
              deck: { ...deck, ...saved },
              quantities: saved.quantities || {},
              zones: normalizeDeck(saved).zones,
            }));
          }}
        />
      )}
      {showImport && (
        <ImportDialog
          cards={cards}
          lang={uiLang}
          deck={deck}
          setNames={setNames}
          onClose={() => setShowImport(false)}
          onImport={importDeckData}
        />
      )}
      {showExport && (
        <ExportDialog
          deck={deck}
          cardsById={cardsById}
          quantities={quantities}
          zones={zones}
          defaultBacks={defaultBacks}
          uiLang={uiLang}
          onClose={() => setShowExport(false)}
          onBacksChange={(backAssignments) => setDeck((prev) => ({ ...prev, backAssignments }))}
          proxyMode={proxyMode}
        />
      )}
      {showDocs && (
        <RulesDoc
          deck={deck}
          onToggleRule={onToggleRule}
          onClose={() => setShowDocs(false)}
        />
      )}
      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          lang={uiLang}
          // One counter per zone this card may legally occupy, from the same
          // zoneTargets list drag-and-drop validates against, so the modal can
          // never offer a zone a drop would have refused.
          //
          // Deckbuilding only: freeform has no zones -- it routes every card to
          // the deck and shows a Pool/Sideboard tab solely when a deck switched
          // out of deckbuilding left cards there. Offering all three here was
          // inviting a freeform deck to grow zone data no other freeform
          // surface can see or edit.
          rows={(deck.mode === 'deckbuilding' ? zoneTargets(previewCard, deck.ruleset.side) : ['deck']).map((zone) => ({
            zone,
            qty: (zone === 'deck' ? quantities : zones[zone] || {})[previewCard.id] || 0,
            room: capCtx
              ? remainingCopies(previewCard, zone, { quantities, zones }, capCtx)
              : { remaining: Infinity, ruleId: null },
          }))}
          onChangeZoneQty={changeZoneQty}
          onNav={(delta) => {
            const next = navigateList(previewList, previewCard, delta);
            if (next) setPreviewCard(next);
          }}
          onClose={() => { setPreviewCard(null); setPreviewList([]); }}
          proxyMode={proxyMode}
          setNames={setNames}
        />
      )}
    </div>
    </I18nProvider>
  );
}
