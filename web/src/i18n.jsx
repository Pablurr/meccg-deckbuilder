import React, { createContext, useContext, useMemo } from 'react';
import { makeT } from './lib/i18n.js';

const I18nContext = createContext(makeT('fr'));

export function I18nProvider({ lang, children }) {
  const t = useMemo(() => makeT(lang), [lang]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

// Returns the translator function t(key, params).
export function useT() {
  return useContext(I18nContext);
}
