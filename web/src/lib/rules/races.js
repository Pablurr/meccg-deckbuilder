// Race normalisation. The card data mixes singular and plural forms for the
// same race ("Orc"/"Orcs", "Wolf"/"Wolves", "Animal"/"Animals") and joins
// several races with commas ("Orcs,Men", "Animals,Men,Bears", "Balrog,Spawn").
// A substring test survives "Orcs" contains "Orc" but fails on "Wolves" vs
// "Wolf" -- exactly the case CoE 1.3.B4's faction list (Orc, Troll, Wolf,
// Animal, Dragon) needs. So compare on a singularised, accent-folded form.

// NOTE: explicit \u escapes rather than literal accents so this survives
// copy/paste intact.
const IRREGULAR = {
  men: 'man',
  dunedain: 'dunadan', // D\u00fanedain / D\u00fanadan both appear in the data
};

// /([^s])s$/ rather than /s$/ so a value already ending in ss is left alone
// and a bare s is not stripped to nothing. Wose has no trailing s and is untouched.
const PLURALS = [[/ves$/, 'f'], [/ies$/, 'y'], [/([^s])s$/, '$1']];

const fold = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

// One race value may name several races, comma-separated.
export function racesOf(value) {
  return String(value === undefined || value === null ? '' : value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Folded, lowercase, singular. Comparison form only -- never displayed.
export function singularize(race) {
  const f = fold(race);
  if (!f) return '';
  if (IRREGULAR[f]) return IRREGULAR[f];
  for (const [re, rep] of PLURALS) if (re.test(f)) return f.replace(re, rep);
  return f;
}

export function matchesRace(value, wanted) {
  const w = singularize(wanted);
  if (!w) return false;
  return racesOf(value).some((r) => singularize(r) === w);
}
