import React, { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { maxCopies, expandQuantities, countOccurrences } from './lib/deck.js';
import FilterBar from './components/FilterBar.jsx';
import CardBrowser from './components/CardBrowser.jsx';
import DeckDrawer from './components/DeckDrawer.jsx';
import DeckManager from './components/DeckManager.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import ImportDialog from './components/ImportDialog.jsx';

export default function App() {
  const [cards, setCards] = useState([]);
  const [facets, setFacets] = useState(null);
  const [defaultBacks, setDefaultBacks] = useState({});
  const [filters, setFilters] = useState({});
  const [quantities, setQuantities] = useState({}); // id -> copy count
  const [deck, setDeck] = useState({ id: null, name: 'Nouveau deck', backAssignments: {} });
  const [showManager, setShowManager] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getCards()
      .then(({ cards, facets, defaultBacks }) => { setCards(cards); setFacets(facets); setDefaultBacks(defaultBacks || {}); })
      .catch((e) => setError(e.message));
  }, []);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

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
    setDeck({ id: null, name: 'Nouveau deck', backAssignments: {} });
    setQuantities({});
    setShowManager(false);
  }

  if (error) return <div style={{ padding: 24 }}>Erreur : {error}. Le serveur (npm start / npm run dev) tourne-t-il ?</div>;
  if (!facets) return <div style={{ padding: 24 }}>Chargement des cartes…</div>;

  const cardIds = expandQuantities(quantities);

  return (
    <div className="app">
      <FilterBar facets={facets} filters={filters} onChange={setFilters} deckName={deck.name} />
      <CardBrowser cards={cards} filters={filters} quantities={quantities} onChangeQty={changeQty} onToggle={toggleCard} />
      <DeckDrawer
        cardsById={cardsById}
        cardIds={cardIds}
        backAssignments={deck.backAssignments}
        defaultBacks={defaultBacks}
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
      {showExport && (
        <ExportDialog
          deck={deck}
          cardIds={cardIds}
          cardsById={cardsById}
          quantities={quantities}
          defaultBacks={defaultBacks}
          onClose={() => setShowExport(false)}
          onBacksChange={(backAssignments) => setDeck((prev) => ({ ...prev, backAssignments }))}
        />
      )}
      {showImport && (
        <ImportDialog
          cards={cards}
          onClose={() => setShowImport(false)}
          onImport={importQuantities}
        />
      )}
    </div>
  );
}
