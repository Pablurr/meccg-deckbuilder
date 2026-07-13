import { useEffect, useState } from 'react';
import { MOBILE_QUERY } from './mobile.js';

// Boolean that tracks whether the mobile layout is active, driven by the same
// media query the CSS uses. Updates on resize/orientation change.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    // addEventListener is the modern API; fall back to addListener for older
    // engines (e.g. iOS Safari < 14) where the former is undefined.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isMobile;
}
