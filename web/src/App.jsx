import React, { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { maxCopies, expandQuantities, countOccurrences, deckCounts, deckWarnings } from './lib/deck.js';
import { I18nProvider } from './i18n.jsx';
import { makeT } from './lib/i18n.js';
import FilterBar from './components/FilterBar.jsx';
import CardBrowser from './components/CardBrowser.jsx';
import DeckDrawer from './components/DeckDrawer.jsx';
import DeckPanel from './components/DeckPanel.jsx';
import DeckManager from './components/DeckManager.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import ImportDialog from './components/ImportDialog.jsx';

export default function App() {
  const [cards, setCards] = useState([]);
  const [facets, setFacets] = useState(null);
  const [defaultBacks, setDefaultBacks] = useState({});
  const [filters, setFilters] = useState({});
  const [uiLang, setUiLang] = useState('fr'); // display language for card names
  const [quantities, setQuantities] = useState({}); // id -> copy count
  const [deck, setDeck] = useState({ id: null, name: 'Nouveau deck', backAssignments: {} });
  const [showManager, setShowManager] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(360); // right deck panel width in px
  const [cardZoom, setCardZoom] = useState(50); // deck-panel card size, % of original image
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getCards()
      .then(({ cards, facets, defaultBacks }) => { setCards(cards); setFacets(facets); setDefaultBacks(defaultBacks || {}); })
      .catch((e) => setError(e.message));
  }, []);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const t = useMemo(() => makeT(uiLang), [uiLang]);

  // delta is +1 / -1; clamps to [0, maxCopies(card)].
  function changeQty(id, delta) {
    setQuantities((prev) => {
      const max = maxCopies(cardsById.get(id));
      const next = Math.max(0, Math.min(max, (prev[id] || 0) + delta));
      const out = { ...prev };
      if (next <= 0) delete out[id];
      else out[id] = next;
      return out;
    });
  }

  // First click selects (1 copy), second click deselects.
  function toggleCard(id) {
    setQuantities((prev) => {
      const out = { ...prev };
      if (out[id]) delete out[id];
      else out[id] = 1;
      return out;
    });
  }

  // Add one copy of every currently-filtered card that isn't selected yet.
  function selectAll(ids) {
    setQuantities((prev) => {
      const out = { ...prev };
      for (const id of ids) if (!out[id]) out[id] = 1;
      return out;
    });
  }

  // Replace the current selection with an imported { id: count } map (clamped).
  function importQuantities(imported) {
    const clamped = {};
    for (const [id, count] of Object.entries(imported)) {
      const max = maxCopies(cardsById.get(id));
      clamped[id] = Math.max(1, Math.min(max, count));
    }
    setQuantities(clamped);
    setShowImport(false);
  }

  function loadDeckIntoState(d) {
    setDeck({ id: d.id, name: d.name, backAssignments: d.backAssignments || {} });
    setQuantities(d.quantities || countOccurrences(d.cardIds || []));
    setShowManager(false);
  }

  function newDeck() {
    setDeck({ id: null, name: t('app.newDeck'), backAssignments: {} });
    setQuantities({});
    setShowManager(false);
  }

  if (error) return <div style={{ padding: 24 }}>{t('app.loadError', { error })}</div>;
  if (!facets) return <div style={{ padding: 24 }}>{t('app.loading')}</div>;

  const cardIds = expandQuantities(quantities);
  const counts = deckCounts(cardsById, cardIds);
  const warnings = deckWarnings(cardsById, cardIds, deck.backAssignments, defaultBacks);
  const hasSelection = counts.total > 0;

  return (
    <I18nProvider lang={uiLang}>
    <div className="app">
      <FilterBar facets={facets} filters={filters} onChange={setFilters} lang={uiLang} onLangChange={setUiLang} />
      <div className="main-row">
        <CardBrowser cards={cards} filters={filters} quantities={quantities} lang={uiLang} onChangeQty={changeQty} onToggle={toggleCard} onSelectAll={selectAll} />
        {hasSelection && (
          <DeckPanel
            cardsById={cardsById}
            quantities={quantities}
            lang={uiLang}
            counts={counts}
            warnings={warnings}
            collapsed={panelCollapsed}
            onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
            width={panelWidth}
            onResize={setPanelWidth}
            zoom={cardZoom}
            onZoom={setCardZoom}
            onChangeQty={changeQty}
            onToggle={toggleCard}
          />
        )}
      </div>
      <DeckDrawer
        total={counts.total}
        onManage={() => setShowManager(true)}
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
        onNew={newDeck}
      />
      {showManager && (
        <DeckManager
          deck={deck}
          cardIds={cardIds}
          quantities={quantities}
          onClose={() => setShowManager(false)}
          onLoad={loadDeckIntoState}
          onSaved={(d) => setDeck((prev) => ({ ...prev, id: d.id, name: d.name }))}
        />
      )}
      {showImport && (
        <ImportDialog
          cards={cards}
          lang={uiLang}
          onClose={() => setShowImport(false)}
          onImport={importQuantities}
        />
      )}
      {showExport && (
        <ExportDialog
          deck={deck}
          cardIds={cardIds}
          cardsById={cardsById}
          quantities={quantities}
          defaultBacks={defaultBacks}
          uiLang={uiLang}
          onClose={() => setShowExport(false)}
          onBacksChange={(backAssignments) => setDeck((prev) => ({ ...prev, backAssignments }))}
        />
      )}
    </div>
    </I18nProvider>
  );
}
