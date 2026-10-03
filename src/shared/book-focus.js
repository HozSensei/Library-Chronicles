/**
 * Indices focus manette — fiche livre (BookDetailView).
 * 0–2 : blocs scrollables (identité, méta, synopsis)
 * 3–5 : CTA footer fixe (Lire, Retour, Options)
 */
export const BOOK_FOCUS = {
  IDENTITY: 0,
  META: 1,
  SYNOPSIS: 2,
  READ: 3,
  BACK: 4,
  OPTIONS: 5,
  MAX: 5,
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
