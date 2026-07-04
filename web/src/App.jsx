import React, { useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { maxCopies, expandQuantities, countOccurrences } from './lib/deck.js';
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
  const [quantities, setQuantities] = useState({}); // id -> copy count
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
      <CardBrowser cards={cards} filters={filters} quantities={quantities} onChangeQty={changeQty} />
      <DeckDrawer
        cardsById={cardsById}
        cardIds={cardIds}
        backAssignments={deck.backAssignments}
        defaultBacks={defaultBacks}
        onManage={() => setShowManager(true)}
        onExport={() => setShowExport(true)}
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
          defaultBacks={defaultBacks}
          onClose={() => setShowExport(false)}
          onBacksChange={(backAssignments) => setDeck((prev) => ({ ...prev, backAssignments }))}
        />
      )}
    </div>
  );
}
