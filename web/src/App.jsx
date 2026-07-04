import React, { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import FilterBar from './components/FilterBar.jsx';
import CardBrowser from './components/CardBrowser.jsx';
import DeckDrawer from './components/DeckDrawer.jsx';
import DeckManager from './components/DeckManager.jsx';
import ExportDialog from './components/ExportDialog.jsx';

export default function App() {
  const [cards, setCards] = useState([]);
  const [facets, setFacets] = useState(null);
  const [defaultBacks, setDefaultBacks] = useState({});
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deck, setDeck] = useState({ id: null, name: 'Nouveau deck', backAssignments: {} });
  const [showManager, setShowManager] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getCards()
      .then(({ cards, facets, defaultBacks }) => { setCards(cards); setFacets(facets); setDefaultBacks(defaultBacks || {}); })
      .catch((e) => setError(e.message));
  }, []);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  function toggleCard(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function loadDeckIntoState(d) {
    setDeck({ id: d.id, name: d.name, backAssignments: d.backAssignments || {} });
    setSelectedIds(new Set(d.cardIds || []));
    setShowManager(false);
  }

  function newDeck() {
    setDeck({ id: null, name: 'Nouveau deck', backAssignments: {} });
    setSelectedIds(new Set());
    setShowManager(false);
  }

  if (error) return <div style={{ padding: 24 }}>Erreur : {error}. Le serveur (npm start / npm run dev) tourne-t-il ?</div>;
  if (!facets) return <div style={{ padding: 24 }}>Chargement des cartes…</div>;

  const selectedArray = [...selectedIds];

  return (
    <div className="app">
      <FilterBar facets={facets} filters={filters} onChange={setFilters} deckName={deck.name} />
      <CardBrowser cards={cards} filters={filters} selectedIds={selectedIds} onToggle={toggleCard} />
      <DeckDrawer
        cardsById={cardsById}
        cardIds={selectedArray}
        backAssignments={deck.backAssignments}
        defaultBacks={defaultBacks}
        onManage={() => setShowManager(true)}
        onExport={() => setShowExport(true)}
        onNew={newDeck}
      />
      {showManager && (
        <DeckManager
          deck={deck}
          cardIds={selectedArray}
          onClose={() => setShowManager(false)}
          onLoad={loadDeckIntoState}
          onSaved={(d) => setDeck((prev) => ({ ...prev, id: d.id, name: d.name }))}
        />
      )}
      {showExport && (
        <ExportDialog
          deck={deck}
          cardIds={selectedArray}
          defaultBacks={defaultBacks}
          onClose={() => setShowExport(false)}
          onBacksChange={(backAssignments) => setDeck((prev) => ({ ...prev, backAssignments }))}
        />
      )}
    </div>
  );
}
