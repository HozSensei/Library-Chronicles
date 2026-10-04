/**
 * Chemin manette — lecteur EPUB (texte reflow paginé via epub.js).
 *
 * Stick / D-Pad ←→ = page-écran ±1 (rendition next/prev), puis chapitre voisin.
 * D-Pad ↑/↓ = taille police ± (reflow epub.js).
 * L3 / R3 = reset taille police.
 * LB fit-width = no-op (pas d’image à fitter).
 * Pas de scroll continu ni de filtres sépia manga sur le HTML.
 */

import {
  EPUB_STICK_PAGE_COOLDOWN_MS,
  stickToEpubPageWhich,
} from './epub-pagination.js';

/** Fit-width image : sans objet en EPUB. */
export const EPUB_ZOOM_NOOP_ACTIONS = Object.freeze(['fit-width']);

const ZOOM_NOOP = new Set(EPUB_ZOOM_NOOP_ACTIONS);

/** @type {number} */
let lastStickPageAt = 0;

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isEpubZoomNoop(action) {
  return ZOOM_NOOP.has(action);
}

/**
 * Reset cooldown stick (tests).
 */
export function resetEpubStickPageClock() {
  lastStickPageAt = 0;
}

/**
 * Stick → page-écran (discret + cooldown), pas de scroll.
 *
 * @param {{ stepPage: (which: 'prev'|'next') => unknown }} reader
 * @param {number} localX
 * @param {number} localY
 * @param {number} [now]
 * @returns {boolean}
 */
export function applyEpubStickPage(reader, localX, localY, now = Date.now()) {
  if (!reader || typeof reader.stepPage !== 'function') return false;
  const which = stickToEpubPageWhich(localX, localY);
  if (!which) return false;
  if (now - lastStickPageAt < EPUB_STICK_PAGE_COOLDOWN_MS) return true;
  lastStickPageAt = now;
  reader.stepPage(which);
  return true;
}

/**
 * Applique une action manette en mode EPUB.
 *
 * @param {{
 *   resetFontSize?: () => void,
 *   resetZoom?: () => void,
 *   adjustFontSize?: (delta: number) => void,
 *   zoomBy?: (n: number) => void,
 *   stepPage: (which: 'prev'|'next') => unknown,
 * }} reader
 * @param {string} action
 * @param {{ x: number, y: number } | null} [stickLocal]
 * @param {unknown} [_epubEl] réservé (plus de scroll conteneur)
 * @returns {boolean} true si consommé
 */
export function applyEpubReaderAction(
  reader,
  action,
  stickLocal = null,
  _epubEl = null,
) {
  if (!reader) return false;

  if (isEpubZoomNoop(action)) return true;

  if (action === 'reset-zoom' || action === 'toggle-zoom') {
    if (typeof reader.resetFontSize === 'function') reader.resetFontSize();
    else if (typeof reader.resetZoom === 'function') reader.resetZoom();
    return true;
  }
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
  if (stickLocal) {
    return applyEpubStickPage(reader, stickLocal.x, stickLocal.y);
  }
  return false;
}
