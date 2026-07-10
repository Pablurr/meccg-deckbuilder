// Which back a card uses, by card type. Ported verbatim from the old
// server exporter so ZIP/PDF output stays identical.
export const BACK_GROUPS = {
  Character: 'playdeck',
  Resource: 'playdeck',
  Hazard: 'playdeck',
  Site: 'locationdeck',
  Region: 'locationdeck',
};

export function backGroupForType(type) {
  return BACK_GROUPS[type] || 'playdeck';
}

export function slug(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'card'
  );
}
