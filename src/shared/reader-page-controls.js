/**
 * Chemin manette — mode page par page.
 *
 * L3 / R3 reset (page entière), LB fit-width, D-Pad ↑/↓ zoom, ←/→ pages,
 * stick = pan tant qu’il y a du débordement, sinon changement de page.
 * Aucune logique strip ici — branche distincte de `reader-strip-controls.js`.
 */

import { STICK_INTENT } from './page-view-transform.js';

/** Actions D-Pad du mode page (zoom + pages). */
export const PAGE_DPAD_ACTIONS = Object.freeze([
  'zoom-in',
  'zoom-out',
  'page-prev',
  'page-next',
]);

const PAGE_DPAD_SET = new Set(PAGE_DPAD_ACTIONS);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isPageDpadAction(action) {
  return PAGE_DPAD_SET.has(action);
}

/**
 * Applique une action manette en mode page.
 *
 * Le stick ne reste **jamais** inerte : si la page tient entièrement dans le
 * stage (pan sans objet), `reader.stickIntent` renvoie `page-prev` / `page-next`
 * et l’appelant tourne la page via `onStickPage` (edge + repeat côté boucle).
 *
 * @param {{
 *   resetZoom: () => void,
 *   setFitWidth: () => void,
 *   zoomBy: (n: number) => void,
 *   stepPage: (which: 'prev'|'next') => unknown,
 *   pan: (x: number, y: number) => unknown,
 *   stickIntent?: (stick: { x: number, y: number }) => string,
 * }} reader
 * @param {string} action
 * @param {{ x: number, y: number } | null} [stickLocal]
 * @param {{ onStickPage?: (which: 'prev'|'next') => unknown }} [opts]
 * @returns {boolean} true si l’action a été consommée
 */
export function applyPageReaderAction(
  reader,
  action,
  stickLocal = null,
  opts = {},
) {
  if (!reader) return false;

  if (action === 'reset-zoom' || action === 'toggle-zoom') {
    reader.resetZoom();
    return true;
  }
  if (action === 'fit-width') {
    reader.setFitWidth();
    return true;
  }
  if (action === 'zoom-in') {
    reader.zoomBy(1);
    return true;
  }
  if (action === 'zoom-out') {
    reader.zoomBy(-1);
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
    const intent =
      typeof reader.stickIntent === 'function'
        ? reader.stickIntent(stickLocal)
        : STICK_INTENT.PAN;
    if (intent === STICK_INTENT.PAN) {
      reader.pan(stickLocal.x, stickLocal.y);
      return true;
    }
    if (
      intent === STICK_INTENT.PAGE_PREV ||
      intent === STICK_INTENT.PAGE_NEXT
    ) {
      const which = intent === STICK_INTENT.PAGE_NEXT ? 'next' : 'prev';
      if (typeof opts?.onStickPage === 'function') opts.onStickPage(which);
      else reader.stepPage(which);
      return true;
    }
    return false;
  }
  return false;
}
