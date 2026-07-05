// Build a human-readable, re-importable deck list grouped by card type.
// cardsById: Map<id, card>; quantities: { id: count }.
//
//   # Deck name
//
//   ## Characters (3)
//   1x Bûrat
//   2x ...
//
//   ## Sites (2)
//   ...

const TYPE_ORDER = ['Character', 'Resource', 'Hazard', 'Site', 'Region'];

function displayName(card) {
  return (card.name && (card.name.fr || card.name.en)) || card.id;
}

export function buildDeckListText(cardsById, quantities = {}, deckName = 'Deck') {
  const byType = {};
  for (const [id, count] of Object.entries(quantities)) {
    const card = cardsById.get(id);
    if (!card) continue;
    const type = card.type || 'Autre';
    (byType[type] = byType[type] || []).push({ card, count });
  }

  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => byType[t]),
    ...Object.keys(byType).filter((t) => !TYPE_ORDER.includes(t)).sort(),
  ];

  const lines = [`# ${deckName}`, ''];
  for (const type of orderedTypes) {
    const entries = byType[type].sort((a, b) => displayName(a.card).localeCompare(displayName(b.card)));
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    lines.push(`## ${type}s (${total})`);
    for (const e of entries) lines.push(`${e.count}x ${displayName(e.card)}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
