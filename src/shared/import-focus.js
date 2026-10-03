/**
 * Focus manette — Import (liste simple + fiche détail méta / search API).
 *
 * Liste : zone `list` (curseur store) ou `actions` (footer réservé).
 * Détail : zones `fields` | `results` | `actions`.
 */

/** Champs / contrôles de la fiche détail (hors résultats API). */
export const IMPORT_DETAIL_FIELDS = Object.freeze({
  TITLE: 0,
  SERIES: 1,
  VOLUME: 2,
  YEAR: 3,
  AUTHOR: 4,
  SYNOPSIS: 5,
  PROVIDER: 6,
  QUERY: 7,
  SEARCH: 8,
  MAX: 8,
});

/** Actions footer fiche détail. */
export const IMPORT_DETAIL_ACTIONS = Object.freeze({
  COMMIT: 0,
  BACK: 1,
  MAX: 1,
});

/** Actions footer liste (rescanner / retour — hints Y/A/B sont dans ControlHint). */
export const IMPORT_LIST_ACTIONS = Object.freeze({
  RESCAN: 0,
  BACK: 1,
  MAX: 1,
});

export const IMPORT_FIELD_IDS = Object.freeze([
  'title',
  'series',
  'volume',
  'year',
  'author',
  'synopsis',
  'provider',
  'query',
  'search',
]);

/**
 * @param {string|null|undefined} zone
 * @returns {'list'|'fields'|'results'|'actions'}
 */
export function normalizeImportFocusZone(zone) {
  if (zone === 'fields' || zone === 'results' || zone === 'actions') return zone;
  return 'list';
}

/**
 * @param {number} index
 * @param {number} max
 */
export function clampImportFocus(index, max) {
  const n = Number(index);
  const m = Math.max(0, Number(max) || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(m, Math.trunc(n)));
}

export function clampDetailFieldFocus(index) {
  return clampImportFocus(index, IMPORT_DETAIL_FIELDS.MAX);
}

export function clampDetailActionFocus(index) {
  return clampImportFocus(index, IMPORT_DETAIL_ACTIONS.MAX);
}

export function clampListActionFocus(index) {
  return clampImportFocus(index, IMPORT_LIST_ACTIONS.MAX);
}

/** Ids DOM data-import-field pour focus programme. */
export function importFieldDomId(fieldIndex) {
  return IMPORT_FIELD_IDS[clampDetailFieldFocus(fieldIndex)] || 'title';
}
