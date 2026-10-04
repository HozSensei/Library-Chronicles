/**
 * Machine d’état du flux Import ↔ fiche ↔ recherche méta.
 *
 * États :
 * - `list`        — liste des fichiers à importer (`/import`)
 * - `sheet`       — fiche brouillon (`/import/item/:itemKey`)
 * - `meta-search` — Recherche API (`…/meta`)
 *
 * Le retour B est porté par la hiérarchie de routes (`app-routes.js`) :
 * meta → fiche parent · sheet → liste · liste → biblio.
 * `META_RETURN` reste pour dériver le flow depuis l’URL / tests.
 */

import {
  ROUTE,
  isImportListRoute,
  isImportSheetRoute,
  isMetaSearchRoute,
  resolveParentLocation,
} from './app-routes.js';

export const IMPORT_FLOW = Object.freeze({
  LIST: 'list',
  SHEET: 'sheet',
  META_SEARCH: 'meta-search',
});

/**
 * @deprecated Préférer la hiérarchie de routes (`resolveParentLocation`).
 * Conservé pour dériver le flow / tests rétrocompat.
 */
export const META_RETURN = Object.freeze({
  LIST: 'list',
  SHEET: 'sheet',
  BOOK: 'book',
});

export function normalizeImportFlow(flow) {
  if (flow === IMPORT_FLOW.SHEET || flow === IMPORT_FLOW.META_SEARCH) {
    return flow;
  }
  return IMPORT_FLOW.LIST;
}

export function normalizeMetaReturn(ret) {
  if (ret === META_RETURN.SHEET || ret === META_RETURN.BOOK) return ret;
  return META_RETURN.LIST;
}

export function flowFromViewState({ viewMode, detailTab } = {}) {
  if (viewMode !== 'detail') return IMPORT_FLOW.LIST;
  return detailTab === 'search' ? IMPORT_FLOW.META_SEARCH : IMPORT_FLOW.SHEET;
}

export function flowFromRouteName(routeName) {
  if (isMetaSearchRoute(routeName)) return IMPORT_FLOW.META_SEARCH;
  if (isImportSheetRoute(routeName)) return IMPORT_FLOW.SHEET;
  if (isImportListRoute(routeName)) return IMPORT_FLOW.LIST;
  return null;
}

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

export function resolveImportFlowBack({
  flow,
  metaReturn = META_RETURN.LIST,
  isDetail,
  detailTab,
  routeName,
} = {}) {
  if (routeName && resolveParentLocation({ name: routeName })) {
    if (routeName === ROUTE.LIBRARY_BOOK_META) return 'to-book';
    if (routeName === ROUTE.IMPORT_BOOK_META) return 'to-book';
    if (routeName === ROUTE.IMPORT_ITEM_META) return 'to-sheet';
    if (routeName === ROUTE.IMPORT_ITEM) return 'to-list';
    if (routeName === ROUTE.IMPORT) return 'library';
  }

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
