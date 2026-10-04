/**
 * Machine d’état du flux Import ↔ fiche ↔ recherche méta.
 *
 * États :
 * - `list`        — liste des fichiers à importer
 * - `sheet`       — fiche brouillon (onglet Infos, look BookDetail)
 * - `meta-search` — Recherche API (provider + query + résultats)
 *
 * Contexte de retour depuis meta-search / sheet :
 * - `list`  — B → bibliothèque (depuis liste) ; défaut
 * - `sheet` — B depuis meta-search → fiche brouillon
 * - `book`  — B depuis meta-search → BookDetail (`?from=import`)
 *
 * Bindings liste (rappel) :
 * - A = ouvrir fiche (BookDetail si ✓, sinon sheet)
 * - X = importer ce tome / retirer de la bibliothèque si déjà importé (toggle)
 * - Y = tout importer
 * - B = retour biblio
 */

export const IMPORT_FLOW = Object.freeze({
  LIST: 'list',
  SHEET: 'sheet',
  META_SEARCH: 'meta-search',
});

export const META_RETURN = Object.freeze({
  LIST: 'list',
  SHEET: 'sheet',
  BOOK: 'book',
});

/**
 * @param {string|null|undefined} flow
 * @returns {'list'|'sheet'|'meta-search'}
 */
export function normalizeImportFlow(flow) {
  if (flow === IMPORT_FLOW.SHEET || flow === IMPORT_FLOW.META_SEARCH) {
    return flow;
  }
  return IMPORT_FLOW.LIST;
}

/**
 * @param {string|null|undefined} ret
 * @returns {'list'|'sheet'|'book'}
 */
export function normalizeMetaReturn(ret) {
  if (ret === META_RETURN.SHEET || ret === META_RETURN.BOOK) return ret;
  return META_RETURN.LIST;
}

/**
 * Dérive le flow depuis l’ancien couple viewMode + detailTab.
 * @param {{ viewMode?: string, detailTab?: string }} state
 */
export function flowFromViewState({ viewMode, detailTab } = {}) {
  if (viewMode !== 'detail') return IMPORT_FLOW.LIST;
  return detailTab === 'search' ? IMPORT_FLOW.META_SEARCH : IMPORT_FLOW.SHEET;
}

/**
 * @param {string} flow
 * @returns {{ viewMode: 'list'|'detail', detailTab: 'infos'|'search' }}
 */
export function viewStateFromFlow(flow) {
  const f = normalizeImportFlow(flow);
  if (f === IMPORT_FLOW.META_SEARCH) {
    return { viewMode: 'detail', detailTab: 'search' };
  }
  if (f === IMPORT_FLOW.SHEET) {
    return { viewMode: 'detail', detailTab: 'infos' };
  }
  return { viewMode: 'list', detailTab: 'infos' };
}

/**
 * Intent d’entrée consommé au mount d’ImportView.
 * Évite la régression : onMounted ne doit pas écraser meta-search → list.
 *
 * @param {string|null|undefined} intent
 * @returns {'list'|'sheet'|'meta-search'|null}
 */
export function normalizeEntryIntent(intent) {
  if (
    intent === IMPORT_FLOW.LIST ||
    intent === IMPORT_FLOW.SHEET ||
    intent === IMPORT_FLOW.META_SEARCH
  ) {
    return intent;
  }
  return null;
}

/**
 * Résout B / back selon le flow + contexte de retour.
 *
 * @param {{
 *   flow?: string,
 *   metaReturn?: string,
 *   isDetail?: boolean,
 *   detailTab?: string,
 * }} opts
 * @returns {'library'|'to-list'|'to-sheet'|'to-book'}
 */
export function resolveImportFlowBack({
  flow,
  metaReturn = META_RETURN.LIST,
  isDetail,
  detailTab,
} = {}) {
  const f =
    flow != null
      ? normalizeImportFlow(flow)
      : flowFromViewState({
          viewMode: isDetail ? 'detail' : 'list',
          detailTab,
        });
  const ret = normalizeMetaReturn(metaReturn);

  if (f === IMPORT_FLOW.META_SEARCH) {
    if (ret === META_RETURN.BOOK) return 'to-book';
    return 'to-sheet';
  }
  if (f === IMPORT_FLOW.SHEET) {
    if (ret === META_RETURN.BOOK) return 'to-book';
    return 'to-list';
  }
  return 'library';
}
