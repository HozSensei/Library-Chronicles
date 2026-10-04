/**
 * Chemin manette — lecteur EPUB (texte reflow).
 *
 * Stick = scroll du conteneur `.reader__epub`.
 * D-Pad ←/→ = chapitre/spine ±1 (page-prev / page-next).
 * D-Pad ↑/↓ = taille police ± (zoom-in / zoom-out).
 * L3 / R3 = reset taille police.
 * LB fit-width = no-op (pas d’image à fitter).
 */

import { applyStickToStripScroll } from './reader-stick.js';

/** Fit-width image : sans objet en EPUB. */
export const EPUB_ZOOM_NOOP_ACTIONS = Object.freeze(['fit-width']);

const ZOOM_NOOP = new Set(EPUB_ZOOM_NOOP_ACTIONS);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isEpubZoomNoop(action) {
  return ZOOM_NOOP.has(action);
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
 * @param {{ scrollLeft: number, scrollTop: number } | null} [epubEl]
 * @returns {boolean} true si consommé
 */
export function applyEpubReaderAction(
  reader,
  action,
  stickLocal = null,
  epubEl = null,
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
    return applyStickToStripScroll(epubEl, stickLocal.x, stickLocal.y);
  }
  return false;
}
