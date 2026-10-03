/**
 * Focus manette — Import (liste + fiche Infos / Recherche).
 *
 * Bindings stables :
 * - Liste : A=ouvrir fiche · X=importer ce tome · Y=tout importer · B=retour biblio
 * - Fiche Infos : A=éditer champ · B=retour liste · ↑↓ navigation champs ·
 *   LB/RB=onglets · X=importer ce tome
 * - Fiche Recherche : A=appliquer résultat focusé / éditer ·
 *   B=retour Infos · Y=lancer search · Enter/clavier=lancer search · LB/RB=onglets
 *
 * Zones : `list` | `fields` | `results`
 * Onglets fiche : `infos` | `search`
 *
 * Pas de rangée de boutons footer (hints manette seulement, comme Bibliothèque).
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

/**
 * Champs / contrôles onglet Recherche.
 * Plus de bouton « Lancer » focusable — Y / Enter suffisent.
 */
export const IMPORT_SEARCH_FIELDS = Object.freeze({
  QUERY: 0,
  PROVIDER: 1,
  MAX: 1,
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

/**
 * @deprecated Plus de footer actions — X/B manette uniquement.
 * Conservé pour compat scripts.
 */
export const IMPORT_DETAIL_ACTIONS = Object.freeze({
  COMMIT: 0,
  BACK: 1,
  MAX: 1,
});

/**
 * @deprecated Plus de footer liste — B manette / watcher rescan.
 * Conservé pour compat scripts.
 */
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

export const IMPORT_SEARCH_FIELD_IDS = Object.freeze(['query', 'provider']);

/** @deprecated utiliser IMPORT_INFOS_FIELD_IDS / IMPORT_SEARCH_FIELD_IDS */
export const IMPORT_FIELD_IDS = Object.freeze([
  ...IMPORT_INFOS_FIELD_IDS,
  'query',
  'provider',
  'search',
]);

/**
 * @param {string|null|undefined} zone
 * @returns {'list'|'fields'|'results'}
 */
export function normalizeImportFocusZone(zone) {
  if (zone === 'fields' || zone === 'results') return zone;
  // `actions` legacy → list (plus de footer boutons)
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
 * Empêche A de fermer / importer hors CTA explicite (X = import).
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
 *   | 'edit-field'
 *   | 'edit-query'
 *   | 'focus-provider'
 *   | 'run-search'
 *   | 'apply-result'
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
    return 'open-detail';
  }

  if (tab === IMPORT_DETAIL_TABS.SEARCH) {
    if (z === 'results') {
      return resultCount > 0 && idx >= 0 && idx < resultCount
        ? 'apply-result'
        : 'noop';
    }
    if (z !== 'fields') return 'noop';
    const field = clampSearchFieldFocus(idx);
    if (field === IMPORT_SEARCH_FIELDS.PROVIDER) return 'focus-provider';
    if (field === IMPORT_SEARCH_FIELDS.QUERY) return 'edit-query';
    return 'noop';
  }

  // Infos : A édite le champ — jamais import / fermeture (X / B)
  if (z === 'fields') return 'edit-field';
  return 'noop';
}

/**
 * Résout B / back selon contexte.
 * Recherche → Infos ; Infos → liste ; liste → biblio.
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
  void zone;
  const tab = normalizeImportDetailTab(detailTab);
  if (tab === IMPORT_DETAIL_TABS.SEARCH) {
    return 'to-infos';
  }
  return 'to-list';
}
