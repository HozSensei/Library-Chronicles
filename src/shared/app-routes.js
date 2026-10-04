/**
 * Hiérarchie des routes VDR — B = route parent explicite.
 *
 * Arbre :
 *   /library
 *     /library/book/:id
 *       /library/book/:id/meta
 *     /library/series/:seriesId
 *   /import
 *     /import/item/:itemKey
 *       /import/item/:itemKey/meta
 *     /import/book/:id
 *       /import/book/:id/meta
 *
 * Plus de `?from=import` / entryIntent pour le retour B.
 */

export const ROUTE = Object.freeze({
  LIBRARY: 'library',
  LIBRARY_BOOK: 'library-book',
  LIBRARY_BOOK_META: 'library-book-meta',
  LIBRARY_SERIES: 'library-series',
  IMPORT: 'import',
  IMPORT_ITEM: 'import-item',
  IMPORT_ITEM_META: 'import-item-meta',
  IMPORT_BOOK: 'import-book',
  IMPORT_BOOK_META: 'import-book-meta',
  /** Alias historique → redirect library-book */
  BOOK: 'book',
  SERIES: 'series',
  READER: 'reader',
  SETTINGS: 'settings',
  SETUP: 'setup',
  PROFILES: 'profiles',
  BOOT: 'boot',
});

/** Parent nommé pour chaque route enfant (B). */
export const ROUTE_PARENT = Object.freeze({
  [ROUTE.LIBRARY_BOOK]: ROUTE.LIBRARY,
  [ROUTE.LIBRARY_BOOK_META]: ROUTE.LIBRARY_BOOK,
  [ROUTE.LIBRARY_SERIES]: ROUTE.LIBRARY,
  [ROUTE.IMPORT_ITEM]: ROUTE.IMPORT,
  [ROUTE.IMPORT_ITEM_META]: ROUTE.IMPORT_ITEM,
  [ROUTE.IMPORT_BOOK]: ROUTE.IMPORT,
  [ROUTE.IMPORT_BOOK_META]: ROUTE.IMPORT_BOOK,
});

/**
 * Contexte bindings / focus (agrège les noms de routes enfants).
 * @param {string|null|undefined} routeName
 * @returns {'boot'|'library'|'book'|'import'|'reader'|'setup'|'settings'|'profiles'}
 */
export function uiContextForRoute(routeName) {
  const name = String(routeName || '');
  if (name === ROUTE.LIBRARY) return 'library';
  if (
    name === ROUTE.LIBRARY_BOOK ||
    name === ROUTE.IMPORT_BOOK ||
    name === ROUTE.BOOK
  ) {
    return 'book';
  }
  if (name === ROUTE.LIBRARY_SERIES || name === ROUTE.SERIES) return 'book';
  if (
    name === ROUTE.IMPORT ||
    name === ROUTE.IMPORT_ITEM ||
    name === ROUTE.IMPORT_ITEM_META ||
    name === ROUTE.IMPORT_BOOK_META ||
    name === ROUTE.LIBRARY_BOOK_META
  ) {
    return 'import';
  }
  if (name === ROUTE.READER) return 'reader';
  if (name === ROUTE.SETUP) return 'setup';
  if (name === ROUTE.SETTINGS) return 'settings';
  if (name === ROUTE.PROFILES) return 'profiles';
  if (name === ROUTE.BOOT) return 'boot';
  return 'boot';
}

export function isBookDetailRoute(routeName) {
  return (
    uiContextForRoute(routeName) === 'book' &&
    (routeName === ROUTE.LIBRARY_BOOK ||
      routeName === ROUTE.IMPORT_BOOK ||
      routeName === ROUTE.BOOK ||
      routeName === ROUTE.LIBRARY_SERIES ||
      routeName === ROUTE.SERIES)
  );
}

export function isImportUiRoute(routeName) {
  return uiContextForRoute(routeName) === 'import';
}

export function isMetaSearchRoute(routeName) {
  return (
    routeName === ROUTE.IMPORT_ITEM_META ||
    routeName === ROUTE.IMPORT_BOOK_META ||
    routeName === ROUTE.LIBRARY_BOOK_META
  );
}

export function isImportSheetRoute(routeName) {
  return routeName === ROUTE.IMPORT_ITEM;
}

export function isImportListRoute(routeName) {
  return routeName === ROUTE.IMPORT;
}

/**
 * Clé stable pour un item import (path encodé).
 * @param {string} filePath
 */
export function itemKeyFromPath(filePath) {
  return encodeURIComponent(String(filePath || ''));
}

/**
 * @param {string} itemKey
 * @returns {string}
 */
export function pathFromItemKey(itemKey) {
  try {
    return decodeURIComponent(String(itemKey || ''));
  } catch {
    return String(itemKey || '');
  }
}

/**
 * Résout la destination B (route parent) avec params nécessaires.
 *
 * @param {{ name?: string, params?: Record<string, string> }|string|null|undefined} route
 * @returns {{ name: string, params?: Record<string, string> }|null}
 */
export function resolveParentLocation(route) {
  const name = typeof route === 'string' ? route : route?.name;
  if (!name) return null;
  const parent = ROUTE_PARENT[name];
  if (!parent) return null;
  const params =
    typeof route === 'object' && route?.params
      ? { ...route.params }
      : {};

  if (parent === ROUTE.LIBRARY_BOOK || parent === ROUTE.IMPORT_BOOK) {
    if (params.id == null || params.id === '') return { name: ROUTE.LIBRARY };
    return { name: parent, params: { id: String(params.id) } };
  }
  if (parent === ROUTE.IMPORT_ITEM) {
    if (params.itemKey == null || params.itemKey === '') {
      return { name: ROUTE.IMPORT };
    }
    return {
      name: parent,
      params: { itemKey: String(params.itemKey) },
    };
  }
  return { name: parent };
}

/**
 * Location fiche livre selon le contexte (biblio vs import).
 * @param {string|number} bookId
 * @param {'library'|'import'} [context]
 */
export function bookDetailLocation(bookId, context = 'library') {
  const id = String(bookId);
  if (context === 'import') {
    return { name: ROUTE.IMPORT_BOOK, params: { id } };
  }
  return { name: ROUTE.LIBRARY_BOOK, params: { id } };
}

/**
 * Location recherche méta depuis une fiche livre.
 * @param {string|number} bookId
 * @param {'library'|'import'} [context]
 */
export function bookMetaLocation(bookId, context = 'library') {
  const id = String(bookId);
  if (context === 'import') {
    return { name: ROUTE.IMPORT_BOOK_META, params: { id } };
  }
  return { name: ROUTE.LIBRARY_BOOK_META, params: { id } };
}

/**
 * @param {string} filePath
 * @param {{ meta?: boolean }} [opts]
 */
export function importItemLocation(filePath, { meta = false } = {}) {
  const itemKey = itemKeyFromPath(filePath);
  return {
    name: meta ? ROUTE.IMPORT_ITEM_META : ROUTE.IMPORT_ITEM,
    params: { itemKey },
  };
}

/**
 * Contexte biblio vs import pour une route fiche / méta livre.
 * @param {string|null|undefined} routeName
 * @returns {'library'|'import'}
 */
export function bookRouteContext(routeName) {
  if (
    routeName === ROUTE.IMPORT_BOOK ||
    routeName === ROUTE.IMPORT_BOOK_META
  ) {
    return 'import';
  }
  return 'library';
}

/**
 * Clé `<RouterView>` stable : garde ImportView monté sur liste/sheet/méta
 * pour éviter remount + flash de l’écran précédent (out-in + fullPath).
 *
 * @param {{ name?: string, params?: Record<string, unknown>, fullPath?: string }|null|undefined} route
 * @returns {string}
 */
export function viewTransitionKey(route) {
  const name = route?.name;
  if (
    name === ROUTE.IMPORT ||
    name === ROUTE.IMPORT_ITEM ||
    name === ROUTE.IMPORT_ITEM_META ||
    name === ROUTE.IMPORT_BOOK_META ||
    name === ROUTE.LIBRARY_BOOK_META
  ) {
    return 'import-shell';
  }
  if (name === ROUTE.LIBRARY_BOOK || name === ROUTE.IMPORT_BOOK) {
    return `book-detail:${String(route?.params?.id ?? '')}:${name}`;
  }
  return route?.fullPath || String(name || '');
}

/**
 * Compare name + params (ignore query/hash) — évite navigations idempotentes.
 *
 * @param {{ name?: string, params?: Record<string, unknown> }|null|undefined} a
 * @param {{ name?: string, params?: Record<string, unknown> }|null|undefined} b
 */
export function isSameAppLocation(a, b) {
  if (!a || !b) return false;
  if (a.name !== b.name) return false;
  const ap = a.params || {};
  const bp = b.params || {};
  const keys = new Set([...Object.keys(ap), ...Object.keys(bp)]);
  for (const key of keys) {
    if (String(ap[key] ?? '') !== String(bp[key] ?? '')) return false;
  }
  return true;
}
