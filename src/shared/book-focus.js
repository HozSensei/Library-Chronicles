/**
 * Indices focus manette — fiche livre (BookDetailView).
 * 0–8 : champs méta readonly focusables (+ synopsis)
 * 9–11 : CTA footer fixe (Lire, Retour, Options)
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
  BACK: 10,
  OPTIONS: 11,
  MAX: 11,
};

/** Premier index des actions footer. */
export const BOOK_FOCUS_ACTIONS_START = BOOK_FOCUS.READ;

export function clampBookFocus(index) {
  const n = Number(index);
  if (!Number.isFinite(n)) return BOOK_FOCUS.READ;
  return Math.max(0, Math.min(BOOK_FOCUS.MAX, Math.trunc(n)));
}

export function isBookActionFocus(index) {
  return clampBookFocus(index) >= BOOK_FOCUS_ACTIONS_START;
}
