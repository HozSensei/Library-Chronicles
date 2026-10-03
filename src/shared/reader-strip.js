/**
 * Fenêtre glissante du strip vertical (lecture par défaut).
 * ~4–5 pages montées dans le DOM ; prefetch voisines hors fenêtre.
 */

/** Pages avant l’index courant dans le strip DOM. */
export const STRIP_BEHIND = 1;
/** Pages après l’index courant dans le strip DOM (inclusif avec courant → ~5). */
export const STRIP_AHEAD = 3;
/** Pages supplémentaires chargées hors fenêtre (cache / scroll fluide). */
export const STRIP_PREFETCH = 2;

/**
 * Plage d’indices montés dans le strip (DOM).
 * @param {number} pageIndex
 * @param {number} pageCount
 * @param {{ behind?: number, ahead?: number }} [opts]
 * @returns {{ start: number, end: number }}
 */
export function stripWindowRange(pageIndex, pageCount, opts = {}) {
  const behind = opts.behind ?? STRIP_BEHIND;
  const ahead = opts.ahead ?? STRIP_AHEAD;
  if (!pageCount || pageCount < 1) return { start: 0, end: -1 };
  const i = Math.min(Math.max(0, pageIndex), pageCount - 1);
  return {
    start: Math.max(0, i - behind),
    end: Math.min(pageCount - 1, i + ahead),
  };
}

/**
 * Plage à garder en cache (fenêtre + prefetch).
 * @param {number} pageIndex
 * @param {number} pageCount
 * @param {{ behind?: number, ahead?: number, prefetch?: number }} [opts]
 * @returns {{ start: number, end: number }}
 */
export function stripPrefetchRange(pageIndex, pageCount, opts = {}) {
  const prefetch = opts.prefetch ?? STRIP_PREFETCH;
  const { start, end } = stripWindowRange(pageIndex, pageCount, opts);
  if (end < start) return { start: 0, end: -1 };
  return {
    start: Math.max(0, start - prefetch),
    end: Math.min(pageCount - 1, end + prefetch),
  };
}

/**
 * Nombre de pages dans la fenêtre DOM.
 * @param {number} pageIndex
 * @param {number} pageCount
 * @param {{ behind?: number, ahead?: number }} [opts]
 */
export function stripWindowSize(pageIndex, pageCount, opts = {}) {
  const { start, end } = stripWindowRange(pageIndex, pageCount, opts);
  if (end < start) return 0;
  return end - start + 1;
}
