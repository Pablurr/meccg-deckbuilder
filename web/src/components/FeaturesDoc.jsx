import React from 'react';
import { useT } from '../i18n.jsx';

// Part 1 of the help page: what the application does, in the order a new user
// meets it. Renders sections only -- RulesDoc owns the modal, its title and its
// close button, and part 2 (the rule tables) stays there.
//
// The list is data rather than hand-written JSX so a new feature is one entry
// plus its two i18n keys, and so nothing can render a title without its body.
const TOPICS = ['search', 'decks', 'import', 'export', 'proxy', 'lang'];

export default function FeaturesDoc() {
  const t = useT();
  return (
    <section className="doc-prose">
      <h3>{t('setup.mode.freeform')}</h3>
      <p>{t('docs.freeform')}</p>
      <h3>{t('setup.mode.deckbuilding')}</h3>
      <p>{t('docs.deckbuilding')}</p>
      <h3>{t('docs.zonesTitle')}</h3>
      <p>{t('docs.zones')}</p>
      {TOPICS.map((k) => (
        <React.Fragment key={k}>
          <h3>{t(`docs.feat.${k}Title`)}</h3>
          <p>{t(`docs.feat.${k}`)}</p>
        </React.Fragment>
      ))}
    </section>
  );
}
