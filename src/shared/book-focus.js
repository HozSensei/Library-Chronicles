/**
 * Indices focus manette — fiche livre (BookDetailView).
 * 0–8 : champs méta focusables (+ synopsis) — éditables sauf statut/pages/provider
 * 9–11 : CTA footer fixe (Lire, Lire en continu, Importer des méta)
 * Pas de bouton Retour — B manette gère le retour (biblio ou liste import).
 */
export const BOOK_FOCUS = {
  TITLE: 0,
  SERIES: 1,
  VOLUME: 2,
  YEAR: 3,
  AUTHOR: 4,
  STATUS: 5,
  PAGES: 6,
  PROVIDER: 7,
  SYNOPSIS: 8,
  READ: 9,
  READ_STRIP: 10,
  META: 11,
  MAX: 11,
};

/** @deprecated alias — OPTIONS = Importer des méta */
export const BOOK_FOCUS_OPTIONS = BOOK_FOCUS.META;

/** Premier index des actions footer. */
export const BOOK_FOCUS_ACTIONS_START = BOOK_FOCUS.READ;

/** Champs éditables (persistés via library.updateBook). */
export const BOOK_EDITABLE_FOCUS = Object.freeze([
  BOOK_FOCUS.TITLE,
  BOOK_FOCUS.SERIES,
  BOOK_FOCUS.VOLUME,
  BOOK_FOCUS.YEAR,
  BOOK_FOCUS.AUTHOR,
  BOOK_FOCUS.SYNOPSIS,
]);

/** data-book-field → index focus */
export const BOOK_FIELD_IDS = Object.freeze({
  [BOOK_FOCUS.TITLE]: 'title',
  [BOOK_FOCUS.SERIES]: 'series',
  [BOOK_FOCUS.VOLUME]: 'volume',
  [BOOK_FOCUS.YEAR]: 'year',
  [BOOK_FOCUS.AUTHOR]: 'author',
  [BOOK_FOCUS.STATUS]: 'status',
  [BOOK_FOCUS.PAGES]: 'pages',
  [BOOK_FOCUS.PROVIDER]: 'provider',
  [BOOK_FOCUS.SYNOPSIS]: 'synopsis',
});

export function clampBookFocus(index) {
  const n = Number(index);
  if (!Number.isFinite(n)) return BOOK_FOCUS.READ;
  return Math.max(0, Math.min(BOOK_FOCUS.MAX, Math.trunc(n)));
}

export function isBookActionFocus(index) {
  return clampBookFocus(index) >= BOOK_FOCUS_ACTIONS_START;
}

export function isBookEditableFocus(index) {
  const i = clampBookFocus(index);
  return BOOK_EDITABLE_FOCUS.includes(i);
}

/**
 * data-book-field DOM id pour un index focus éditable / méta.
 * @param {number} index
 * @returns {string|null}
 */
export function bookFieldDomId(index) {
  return BOOK_FIELD_IDS[clampBookFocus(index)] ?? null;
}

/**
 * Intent bouton A / confirm sur fiche livre.
 * @param {number} focusIndex
 * @returns {'activate-action'|'edit-field'|'noop'}
 */
export function resolveBookConfirmAction(focusIndex) {
  if (isBookActionFocus(focusIndex)) return 'activate-action';
  if (isBookEditableFocus(focusIndex)) return 'edit-field';
  return 'noop';
}
