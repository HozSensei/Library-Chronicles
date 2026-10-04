/**
 * Chemin manette — mode strip continu (vertical).
 *
 * Stick = scroll 4 directions (voir `applyStickToStripScroll`).
 * D-Pad (zoom / pages) = no-op — plus d’intérêt en lecture continue.
 * L3 / LB zoom = no-op (pas de zoom CSS scale en strip).
 */

import { applyStickToStripScroll } from './reader-stick.js';

/** D-Pad directionnel : zoom + pages — ignorés en strip. */
export const STRIP_DPAD_NOOP_ACTIONS = Object.freeze([
  'zoom-in',
  'zoom-out',
  'page-prev',
  'page-next',
]);

/** Actions zoom page-mode sans effet en strip. */
export const STRIP_ZOOM_NOOP_ACTIONS = Object.freeze([
  'reset-zoom',
  'toggle-zoom',
  'fit-width',
]);

const DPAD_NOOP = new Set(STRIP_DPAD_NOOP_ACTIONS);
const ZOOM_NOOP = new Set(STRIP_ZOOM_NOOP_ACTIONS);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isStripDpadNoop(action) {
  return DPAD_NOOP.has(action);
}

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isStripZoomNoop(action) {
  return ZOOM_NOOP.has(action);
}

/**
 * Applique une action manette en mode strip.
 * @param {unknown} _reader réservé (pas de zoom/pan store)
 * @param {string} action
 * @param {{ x: number, y: number } | null} [stickLocal]
 * @param {{ scrollLeft: number, scrollTop: number } | null} [stripEl]
 * @returns {boolean} true si consommé (y compris no-op D-Pad / zoom)
 */
export function applyStripReaderAction(
  _reader,
  action,
  stickLocal = null,
  stripEl = null,
) {
  // D-Pad ↑↓←→ : no-op explicite (ne pas mapper vers pages / zoom).
  if (isStripDpadNoop(action)) return true;
  // L3 / LB : pas de zoom CSS en strip.
  if (isStripZoomNoop(action)) return true;

  if (stickLocal) {
    return applyStickToStripScroll(stripEl, stickLocal.x, stickLocal.y);
  }
  return false;
}
