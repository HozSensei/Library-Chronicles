/**
 * Modes d’ouverture du lecteur depuis la fiche livre.
 * - page  : une page à la fois (défaut, zoom/pan D-Pad)
 * - strip : toutes les pages à la suite (scroll vertical continu)
 *
 * Strip = formats page-image uniquement (CBZ/CBR/PDF). Les formats texte
 * futurs (ex. EPUB) restent en page-only → CTA strip disabled.
 */

export const READING_MODE = Object.freeze({
  PAGE: 'page',
  STRIP: 'strip',
});

/** Formats image/page supportés pour le strip vertical continu. */
export const STRIP_SUPPORTED_FORMATS = Object.freeze([
  'cbz',
  'cbr',
  'pdf',
  'zip',
  'rar',
]);

const STRIP_FORMAT_SET = new Set(STRIP_SUPPORTED_FORMATS);

/**
 * @param {unknown} value
 * @returns {'page'|'strip'}
 */
export function normalizeReadingMode(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return raw === READING_MODE.STRIP ? READING_MODE.STRIP : READING_MODE.PAGE;
}

/**
 * @param {unknown} format
 * @returns {string}
 */
export function normalizeBookFormat(format) {
  return String(format || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
}

/**
 * Strip continu pour CBZ/CBR/PDF (et zip/rar traités comme archives).
 * Disabled pour formats texte futurs (epub, mobi, txt…).
 * @param {unknown} format
 * @returns {boolean}
 */
export function supportsStripReading(format) {
  const f = normalizeBookFormat(format);
  if (!f) return false;
  if (f === 'epub' || f === 'mobi' || f === 'azw' || f === 'azw3' || f === 'txt') {
    return false;
  }
  return STRIP_FORMAT_SET.has(f);
}
