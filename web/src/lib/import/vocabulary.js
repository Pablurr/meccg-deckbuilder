// What a heading line means. Four families:
//   zone   -- changes the target zone
//   group  -- does NOT change the zone; posts a type hint for disambiguation
//   notes  -- switches to notes mode; no line is ever read as a card again
//   meta   -- "Key: Value" lines; never read as a card either
//
// A heading is recognised by its NORMALIZED CONTENT, never by its markdown
// level: "## Talon", "### Talon", "Talon:" and "**Talon**" are one heading.
// That is what lets sections arrive in any order and in any formatting.
//
// The canonical English titles are IMPORTED from deckList.js rather than
// copied, so the writer and the reader of our own export format can never
// drift apart.
//
// TRAP, from ARCHITECTURE.md §9: "réserve" changed referent on 2026-07-29 --
// it used to mean the sideboard and now means the pool. This table holds the
// CURRENT meaning only. That is a decision, not an oversight: no hand-written
// list uses the old sense. Do not "fix" this by adding the old one.
import { normalizeName } from './normalize.js';
import { SECTION_TITLES, GROUP_TITLES, NOTE_TITLES, METADATA_TITLE, META_KEYS } from '../deckList.js';

// A zone heading may carry a type hint too, for the sections whose own name
// already names one type -- see the Sites/Regions rows below.
const zone = (z, type = null) => ({ family: 'zone', zone: z, type });
const group = (type) => ({ family: 'group', type });
const notes = (field) => ({ family: 'notes', field });
const meta = () => ({ family: 'meta' });

// Two kinds of word in this table, and they are sourced differently.
// - Translations of an existing UI concept (zone names, group names, note
//   field names) are taken from i18n.js (zones.*, zoneShort.*,
//   panel.group.*, notes.*) and not written from memory, so the parser's
//   vocabulary and the interface's cannot diverge.
// - Community aliases (e.g. the generic notes openers "Description",
//   "Strategy"/"Stratégie"/"Estrategia", "Comments"/"Commentaires", "Intro",
//   "Overview"/"Résumé"/"Resumen", and the "Length"/"Longueur"/"Duración"
//   metadata shorthands below) have no UI concept to translate: they exist
//   only so a pasted forum post or LLM-generated list is understood. They
//   are additive and deliberate, not sourced from i18n.
export const TABLE = [
  // -- zone: play deck. `quantities` also holds the location deck; play deck
  // vs locations is derived from the card type (ARCHITECTURE.md §4), so both
  // point here.
  [['Playdeck', 'Play deck', 'Deck', 'Main deck', 'Maindeck', 'Pioche', 'Mazo', 'Mazo de juego', 'Baraja', SECTION_TITLES.play], zone('quantities')],
  [['Locations', 'Location deck', 'Location', 'Site deck', 'Lieux', 'Localizaciones', SECTION_TITLES.locations], zone('quantities')],
  // -- zone AND group: "Sites" and "Regions" name a section in half the lists
  // in the wild ("## Sideboard ... ## Sites ...") and a sub-group of the
  // Locations section in our own exports ("## Locations / ### Sites (12)").
  // Reading them as a group only -- which is what they were -- meant the
  // first shape left every site in whatever section came before it, usually
  // the sideboard. Reading them as a zone costs nothing in the second shape:
  // the zone they select is the one the enclosing Locations heading already
  // selected, and the type hint they carry is the one they always carried.
  // Their type can live in exactly one zone, which is what makes this safe
  // and is why Characters/Resources/Hazards stay plain groups.
  [['Sites', 'Sitios', GROUP_TITLES.sites], zone('quantities', 'Site')],
  [['Regions', 'Régions', 'Regiones', GROUP_TITLES.regions], zone('quantities', 'Region')],
  // -- zone: sideboard. Spanish keeps the English word (i18n zones.sideboard).
  [['Sideboard', 'Side', 'SB', 'Talon', SECTION_TITLES.sideboard], zone('sideboard')],
  // -- zone: the 1.6.1 Fallen-wizard sideboard. Its canonical title comes from
  // SECTION_TITLES like every other section's, so our own export re-imports.
  // The rest are community shapes; "vs" and "vs." normalize alike, so both
  // spellings are one word here rather than two entries.
  //
  // These all CONTAIN the word "Sideboard", which is safe only because the
  // lookup matches a whole normalized heading and never a prefix -- see the
  // "leaves a bare Sideboard heading alone" test in importVocabulary.test.js,
  // which is what stops a future "startsWith" refactor from merging the two.
  [['Sideboard vs FW', 'Sideboard vs. FW', 'Sideboard vs Fallen-wizard',
    'FW sideboard', 'Fallen-wizard opponent sideboard', 'Anti-FW sideboard', 'SB vs FW',
    'Talon vs SD', 'Talon contre Sorcier déchu', 'SB vs MC',
    SECTION_TITLES.sideboardFw], zone('sideboardFw')],
  // -- zone: pool
  [['Pool', 'Starting pool', 'Réserve', 'Reserva', SECTION_TITLES.pool], zone('pool')],

  // -- groups: the hint is always a TYPE_ORDER value, never a finer category.
  [['Characters', 'Personnages', 'Personajes', GROUP_TITLES.characters], group('Character')],
  [['Resources', 'Ressources', 'Recursos', GROUP_TITLES.resources], group('Resource')],
  [['Hazards', 'Périls', 'Peligros', GROUP_TITLES.hazards], group('Hazard')],
  [['Minor objects', 'Minor items', 'Objets mineurs', 'Objetos menores'], group('Resource')],
  [['Stage events', 'Permanent events', 'Progressions', 'Eventos de etapa'], group('Resource')],
  // No type hint: these do not reduce to one type, and no hint beats a wrong one.
  [['Avatars', 'Avatares', GROUP_TITLES.avatars], group(null)],
  [['Other', 'Autres', 'Otros', GROUP_TITLES.other], group(null)],

  // -- notes: generic openers select no field; named ones select theirs.
  [['Notes', 'Notas', 'Description', 'Descripción', 'Strategy', 'Stratégie', 'Estrategia',
    'Comments', 'Commentaires', 'Comentarios', 'Intro', 'Introduction', 'Introducción',
    'Overview', 'Résumé', 'Resumen'], notes(null)],
  [[NOTE_TITLES.starting, 'Notes de départ', 'Notas iniciales'], notes('starting')],
  [[NOTE_TITLES.resourceStrategy, 'Stratégie ressources', 'Estrategia de recursos'], notes('resourceStrategy')],
  [[NOTE_TITLES.hazardStrategy, 'Stratégie périls', 'Estrategia de peligros'], notes('hazardStrategy')],
  [[NOTE_TITLES.other, 'Autres notes', 'Otras notas'], notes('other')],

  // -- metadata. NOT "Deck": that word is already the play deck above.
  [[METADATA_TITLE, 'Métadonnées', 'Deck info', 'Infos', 'Información'], meta()],
];

export const HEADINGS = new Map();
for (const [words, entry] of TABLE) {
  for (const w of words) {
    const key = normalizeName(w);
    // First writer wins, so a canonical title repeated in its own list (e.g.
    // GROUP_TITLES.sites === 'Sites') is a no-op rather than a duplicate.
    // Whether two DIFFERENT rows can safely share a word is a build-time
    // question, not a production one -- see the "one reading per word" test
    // in importVocabulary.test.js, which checks TABLE itself rather than
    // this already-deduplicated map.
    if (key && !HEADINGS.has(key)) HEADINGS.set(key, entry);
  }
}

// Strip the markdown level, a trailing colon and a trailing "(12)" count --
// the last one is what our own exports write on group headings.
function headingWord(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
    .replace(/\s*:\s*$/, '')
    .trim();
}

export function lookupHeading(raw) {
  const word = headingWord(raw);
  if (!word) return null;
  return HEADINGS.get(normalizeName(word)) || null;
}

// -- metadata keys and values -------------------------------------------------
// Keys use i18n's setup.side / setup.length wording; note that setup.length in
// English is already "Game length", the canonical key.
const META_KEY_WORDS = [
  [[META_KEYS.mode, 'Mode', 'Modo'], 'mode'],
  [[META_KEYS.side, 'Side', 'Camp', 'Bando'], 'side'],
  [[META_KEYS.length, 'Game length', 'Length', 'Longueur', 'Longueur de partie', 'Duración', 'Duración de partida'], 'length'],
];

const META_KEY_BY_WORD = new Map();
for (const [words, field] of META_KEY_WORDS) {
  for (const w of words) META_KEY_BY_WORD.set(normalizeName(w), field);
}

export function lookupMetaKey(raw) {
  return META_KEY_BY_WORD.get(normalizeName(raw)) || null;
}

// Accept the canonical English value, the raw id, and the localized label.
// `length.standard` displays as "Short" in all three languages while its
// canonical value is "Standard" -- both have to resolve, which is exactly why
// this is a table and not a toLowerCase().
const META_VALUES = {
  mode: [
    [['Freeform', 'freeform', 'Libre'], 'freeform'],
    [['Deckbuilding', 'deckbuilding'], 'deckbuilding'],
  ],
  side: [
    [['Wizard', 'wizard', 'Sorcier', 'Mago'], 'wizard'],
    [['Ringwraith', 'ringwraith', "Spectre de l'Anneau", 'Espectro del Anillo'], 'ringwraith'],
    [['Fallen-wizard', 'fallen-wizard', 'Sorcier déchu', 'Mago caído'], 'fallen-wizard'],
    [['Balrog', 'balrog'], 'balrog'],
  ],
  length: [
    [['Starter', 'starter'], 'starter'],
    [['Standard', 'standard', 'Short'], 'standard'],
    [['Long', 'long', 'Longue', 'Larga'], 'long'],
    [['Campaign', 'campaign', 'Campagne', 'Campaña'], 'campaign'],
  ],
};

const META_VALUE_INDEX = {};
for (const [field, rows] of Object.entries(META_VALUES)) {
  META_VALUE_INDEX[field] = new Map();
  for (const [words, id] of rows) {
    for (const w of words) META_VALUE_INDEX[field].set(normalizeName(w), id);
  }
}

export function parseMetaValue(field, raw) {
  const idx = META_VALUE_INDEX[field];
  if (!idx) return null;
  return idx.get(normalizeName(raw)) || null;
}
