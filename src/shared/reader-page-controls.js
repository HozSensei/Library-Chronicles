/**
 * Chemin manette — mode page par page (pré-strip-cta).
 *
 * D-Pad ↑/↓ zoom, ←/→ pages, L3 reset, LB fit-width, stick pan clampé.
 * Aucune logique strip ici — branche distincte de `reader-strip-controls.js`.
 */

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
 * @param {{
 *   resetZoom: () => void,
 *   setFitWidth: () => void,
 *   zoomBy: (n: number) => void,
 *   stepPage: (which: 'prev'|'next') => unknown,
 *   pan: (x: number, y: number) => void,
 * }} reader
 * @param {string} action
 * @param {{ x: number, y: number } | null} [stickLocal]
 * @returns {boolean} true si l’action a été consommée
 */
export function applyPageReaderAction(reader, action, stickLocal = null) {
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
    reader.pan(stickLocal.x, stickLocal.y);
    return true;
  }
  return false;
}
