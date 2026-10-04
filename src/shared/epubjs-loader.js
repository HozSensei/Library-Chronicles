/**
 * Interop + helpers pour **epub.js** (`epubjs`, BSD-2-Clause).
 */

/**
 * Résout la factory `ePub()` depuis un import CJS/ESM (default imbriqué).
 * @param {unknown} mod
 * @returns {Function}
 */
export function resolveEpubFactory(mod) {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  if (mod && mod.default && typeof mod.default.default === 'function') {
    return mod.default.default;
  }
  if (mod && typeof mod.ePub === 'function') return mod.ePub;
  throw new Error('epubjs: factory introuvable');
}

/**
 * Décode un payload IPC base64 → ArrayBuffer (copie exacte des octets).
 * @param {string} b64
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(b64) {
  const bin = atob(String(b64 || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
