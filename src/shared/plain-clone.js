/**
 * Clone JSON-safe pour IPC Electron (structured clone).
 *
 * Les Proxies Vue / Pinia (et tableaux imbriqués réactifs) ne sont pas
 * structurément clonables → « An object could not be cloned ».
 * JSON.parse(JSON.stringify) marche sur ces Proxies et produit des plain objects.
 */

/**
 * True si on est en mode developer (renderer Vite ou main Electron).
 * @param {{ force?: boolean }} [opts]
 */
export function isDevMode(opts = {}) {
  if (opts.force === true) return true;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  } catch {
    /* hors bundler */
  }
  if (typeof process !== 'undefined') {
    if (process.env?.ELECTRON_IS_DEV === '1') return true;
    if (process.env?.VDR_META_APPLY_DEBUG === '1') return true;
    if (process.env?.NODE_ENV === 'development') return true;
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeForIpc(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

/**
 * Vérifie qu’une valeur est structclone-able (hors Proxies Vue).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStructuredCloneable(value) {
  try {
    if (typeof structuredClone === 'function') {
      structuredClone(value);
      return true;
    }
    // Fallback environnements sans structuredClone
    JSON.parse(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone plain d’un NormalizedMeta / patch méta (primitives + tableaux).
 * @template T
 * @param {T} value
 * @returns {T|null}
 */
export function clonePlainMeta(value) {
  const plain = sanitizeForIpc(value);
  if (!plain || typeof plain !== 'object') return null;
  return /** @type {T} */ (plain);
}
