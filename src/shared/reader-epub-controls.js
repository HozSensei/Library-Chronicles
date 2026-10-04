/**
 * Chemin manette — lecteur EPUB (texte reflow paginé via epub.js).
 *
 * Contrôles actifs uniquement :
 *   D-Pad ←→ = page-écran ±1 (rendition next/prev)
 *   D-Pad ↑↓ = taille police ± (reflow epub.js)
 *
 * No-op en mode EPUB :
 *   Stick / pan, L3 / R3 (reset), LT / RT (chapitre), LB fit-width.
 * Pas de scroll continu ni de filtres sépia manga sur le HTML.
 */

/** Actions image / zoom page sans effet en EPUB. */
export const EPUB_ZOOM_NOOP_ACTIONS = Object.freeze([
  'fit-width',
  'reset-zoom',
  'toggle-zoom',
]);

/** Stick / pan : pas de nav page en EPUB (D-Pad seulement). */
export const EPUB_STICK_NOOP_ACTIONS = Object.freeze(['pan', 'stick']);

const ZOOM_NOOP = new Set(EPUB_ZOOM_NOOP_ACTIONS);
const STICK_NOOP = new Set(EPUB_STICK_NOOP_ACTIONS);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isEpubZoomNoop(action) {
  return ZOOM_NOOP.has(action);
}

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isEpubStickNoop(action) {
  return STICK_NOOP.has(action);
}

/**
 * @deprecated Stick page désactivé — conservé pour tests / imports historiques.
 */
export function resetEpubStickPageClock() {
  /* no-op : plus de cooldown stick en EPUB */
}

/**
 * Stick → no-op en EPUB (pages uniquement via D-Pad ←→).
 *
 * @param {unknown} _reader
 * @param {number} [_localX]
 * @param {number} [_localY]
 * @param {number} [_now]
 * @returns {boolean} true = consommé (no-op)
 */
export function applyEpubStickPage(_reader, _localX, _localY, _now) {
  return true;
}

/**
 * Applique une action manette en mode EPUB.
 *
 * @param {{
 *   adjustFontSize?: (delta: number) => void,
 *   zoomBy?: (n: number) => void,
 *   stepPage: (which: 'prev'|'next') => unknown,
 * }} reader
 * @param {string} action
 * @param {{ x: number, y: number } | null} [stickLocal]
 * @param {unknown} [_epubEl] réservé
 * @returns {boolean} true si consommé (y compris no-op)
 */
export function applyEpubReaderAction(
  reader,
  action,
  stickLocal = null,
  _epubEl = null,
) {
  if (!reader) return false;

  if (isEpubZoomNoop(action)) return true;
  if (isEpubStickNoop(action) || stickLocal) return true;

  if (action === 'zoom-in') {
    if (typeof reader.adjustFontSize === 'function') reader.adjustFontSize(1);
    else if (typeof reader.zoomBy === 'function') reader.zoomBy(1);
    return true;
  }
  if (action === 'zoom-out') {
    if (typeof reader.adjustFontSize === 'function') reader.adjustFontSize(-1);
    else if (typeof reader.zoomBy === 'function') reader.zoomBy(-1);
    return true;
  }
  if (action === 'page-prev') {
    reader.stepPage('prev');
    return true;
  }
  if (action === 'page-next') {
    reader.stepPage('next');
    return true;
  }
  return false;
}
