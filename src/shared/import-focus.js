/**
 * Focus manette — Import (liste + fiche Infos / Recherche).
 *
 * Bindings stables :
 * - Liste : A=ouvrir fiche · X=importer ce tome · Y=tout importer · B=retour biblio
 * - Fiche Infos : A=éditer champ ou CTA footer focusé (n’importe/ne ferme PAS hors CTA) ·
 *   B=retour liste · ↑↓ navigation champs
 * - Fiche Recherche : A=appliquer résultat focusé / éditer / lancer search ·
 *   B=retour Infos (champs/résultats) ou liste (CTA Retour) · Y=relancer search
 *
 * Zones : `list` | `fields` | `results` | `actions`
 * Onglets fiche : `infos` | `search`
 *
 * Voir `import-meta.js` pour metaSource / pastilles.
 */

/** Onglets de la fiche détail. */
export const IMPORT_DETAIL_TABS = Object.freeze({
  INFOS: 'infos',
  SEARCH: 'search',
});

/** Champs onglet Infos (méta éditables). */
export const IMPORT_INFOS_FIELDS = Object.freeze({
  TITLE: 0,
  SERIES: 1,
  VOLUME: 2,
  YEAR: 3,
  AUTHOR: 4,
  SYNOPSIS: 5,
  MAX: 5,
});

/** Champs / contrôles onglet Recherche. */
export const IMPORT_SEARCH_FIELDS = Object.freeze({
  QUERY: 0,
  PROVIDER: 1,
  RUN: 2,
  MAX: 2,
});

/**
 * Alias historique (liste plate avant onglets) — indices Infos + Recherche.
 * Préférer IMPORT_INFOS_FIELDS / IMPORT_SEARCH_FIELDS.
 */
export const IMPORT_DETAIL_FIELDS = Object.freeze({
  TITLE: IMPORT_INFOS_FIELDS.TITLE,
  SERIES: IMPORT_INFOS_FIELDS.SERIES,
  VOLUME: IMPORT_INFOS_FIELDS.VOLUME,
  YEAR: IMPORT_INFOS_FIELDS.YEAR,
  AUTHOR: IMPORT_INFOS_FIELDS.AUTHOR,
  SYNOPSIS: IMPORT_INFOS_FIELDS.SYNOPSIS,
  QUERY: 6,
  PROVIDER: 7,
  SEARCH: 8,
  MAX: 8,
});

/** Actions footer fiche détail. */
export const IMPORT_DETAIL_ACTIONS = Object.freeze({
  COMMIT: 0,
  BACK: 1,
  MAX: 1,
});

/** Actions footer liste (rescanner / retour — hints X/Y/A/B dans ControlHint). */
export const IMPORT_LIST_ACTIONS = Object.freeze({
  RESCAN: 0,
  BACK: 1,
  MAX: 1,
});

export const IMPORT_INFOS_FIELD_IDS = Object.freeze([
  'title',
  'series',
  'volume',
  'year',
  'author',
  'synopsis',
]);

export const IMPORT_SEARCH_FIELD_IDS = Object.freeze([
  'query',
  'provider',
  'search',
]);

/** @deprecated utiliser IMPORT_INFOS_FIELD_IDS / IMPORT_SEARCH_FIELD_IDS */
export const IMPORT_FIELD_IDS = Object.freeze([
  ...IMPORT_INFOS_FIELD_IDS,
  'query',
  'provider',
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
 * @param {string|null|undefined} tab
 * @returns {'infos'|'search'}
 */
export function normalizeImportDetailTab(tab) {
  return tab === IMPORT_DETAIL_TABS.SEARCH
    ? IMPORT_DETAIL_TABS.SEARCH
    : IMPORT_DETAIL_TABS.INFOS;
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

export function clampInfosFieldFocus(index) {
  return clampImportFocus(index, IMPORT_INFOS_FIELDS.MAX);
}

export function clampSearchFieldFocus(index) {
  return clampImportFocus(index, IMPORT_SEARCH_FIELDS.MAX);
}

/** @deprecated préférer clampInfosFieldFocus / clampSearchFieldFocus */
export function clampDetailFieldFocus(index) {
  return clampImportFocus(index, IMPORT_DETAIL_FIELDS.MAX);
}

export function clampDetailActionFocus(index) {
  return clampImportFocus(index, IMPORT_DETAIL_ACTIONS.MAX);
}

export function clampListActionFocus(index) {
  return clampImportFocus(index, IMPORT_LIST_ACTIONS.MAX);
}

/**
 * Ids DOM data-import-field pour focus programme.
 * @param {number} fieldIndex
 * @param {'infos'|'search'} [tab]
 */
export function importFieldDomId(fieldIndex, tab = IMPORT_DETAIL_TABS.INFOS) {
  if (normalizeImportDetailTab(tab) === IMPORT_DETAIL_TABS.SEARCH) {
    return (
      IMPORT_SEARCH_FIELD_IDS[clampSearchFieldFocus(fieldIndex)] || 'query'
    );
  }
  return IMPORT_INFOS_FIELD_IDS[clampInfosFieldFocus(fieldIndex)] || 'title';
}

/**
 * Résout l’action de A / confirm selon zone + onglet + focus.
 * Empêche A de fermer / importer hors CTA explicite.
 *
 * @param {{
 *   isDetail?: boolean,
 *   detailTab?: string,
 *   zone?: string,
 *   focusIndex?: number,
 *   resultCount?: number,
 * }} opts
 * @returns {
 *   | 'open-detail'
 *   | 'list-rescan'
 *   | 'list-back'
 *   | 'edit-field'
 *   | 'edit-query'
 *   | 'focus-provider'
 *   | 'run-search'
 *   | 'apply-result'
 *   | 'commit-one'
 *   | 'close-detail'
 *   | 'noop'
 * }
 */
export function resolveImportConfirmAction({
  isDetail = false,
  detailTab = IMPORT_DETAIL_TABS.INFOS,
  zone = 'list',
  focusIndex = 0,
  resultCount = 0,
} = {}) {
  const z = normalizeImportFocusZone(zone);
  const tab = normalizeImportDetailTab(detailTab);
  const idx = Number.isFinite(Number(focusIndex))
    ? Math.trunc(Number(focusIndex))
    : 0;

  if (!isDetail) {
    if (z === 'actions') {
      if (idx === IMPORT_LIST_ACTIONS.BACK) return 'list-back';
      if (idx === IMPORT_LIST_ACTIONS.RESCAN) return 'list-rescan';
      return 'noop';
    }
    return 'open-detail';
  }

  // CTA footer explicites uniquement
  if (z === 'actions') {
    if (idx === IMPORT_DETAIL_ACTIONS.COMMIT) return 'commit-one';
    if (idx === IMPORT_DETAIL_ACTIONS.BACK) return 'close-detail';
    return 'noop';
  }

  if (tab === IMPORT_DETAIL_TABS.SEARCH) {
    if (z === 'results') {
      return resultCount > 0 && idx >= 0 && idx < resultCount
        ? 'apply-result'
        : 'noop';
    }
    if (z !== 'fields') return 'noop';
    const field = clampSearchFieldFocus(idx);
    if (field === IMPORT_SEARCH_FIELDS.RUN) return 'run-search';
    if (field === IMPORT_SEARCH_FIELDS.PROVIDER) return 'focus-provider';
    if (field === IMPORT_SEARCH_FIELDS.QUERY) return 'edit-query';
    return 'noop';
  }

  // Infos : A édite le champ — jamais import / fermeture
  if (z === 'fields') return 'edit-field';
  return 'noop';
}

/**
 * Résout B / back selon contexte.
 * Recherche (champs/résultats) → Infos ; sinon → liste ; liste → biblio.
 *
 * @param {{
 *   isDetail?: boolean,
 *   detailTab?: string,
 *   zone?: string,
 * }} opts
 * @returns {'library'|'to-list'|'to-infos'}
 */
export function resolveImportBackAction({
  isDetail = false,
  detailTab = IMPORT_DETAIL_TABS.INFOS,
  zone = 'list',
} = {}) {
  if (!isDetail) return 'library';
  const z = normalizeImportFocusZone(zone);
  const tab = normalizeImportDetailTab(detailTab);
  if (tab === IMPORT_DETAIL_TABS.SEARCH && z !== 'actions') {
    return 'to-infos';
  }
  return 'to-list';
}
