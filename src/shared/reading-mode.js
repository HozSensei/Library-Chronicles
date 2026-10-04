/**
 * Modes d’ouverture du lecteur depuis la fiche livre.
 * - page  : une page à la fois (défaut, zoom/pan D-Pad) — CBZ/CBR/PDF
 * - strip : toutes les pages à la suite (scroll vertical continu) — images
 * - epub  : chemin texte reflow (EpubReaderStage) — forcé si format=epub
 *
 * Fiche livre : toujours 3 CTA visibles.
 * Images (CBZ/CBR/PDF) → page+strip actifs, EPUB grisé.
 * EPUB → EPUB actif, page+strip grisés (« format non compatible »).
 */

export const READING_MODE = Object.freeze({
  PAGE: 'page',
  STRIP: 'strip',
  EPUB: 'epub',
});

/** Formats image/page supportés pour le strip vertical continu. */
export const STRIP_SUPPORTED_FORMATS = Object.freeze([
  'cbz',
  'cbr',
  'pdf',
  'zip',
  'rar',
]);

/** Formats texte reflow (lecteur EPUB dédié). */
export const EPUB_FORMATS = Object.freeze(['epub']);

const STRIP_FORMAT_SET = new Set(STRIP_SUPPORTED_FORMATS);
const EPUB_FORMAT_SET = new Set(EPUB_FORMATS);

/**
 * @param {unknown} value
 * @returns {'page'|'strip'|'epub'}
 */
export function normalizeReadingMode(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === READING_MODE.STRIP) return READING_MODE.STRIP;
  if (raw === READING_MODE.EPUB) return READING_MODE.EPUB;
  return READING_MODE.PAGE;
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
 * @param {unknown} format
 * @returns {boolean}
 */
export function isEpubFormat(format) {
  return EPUB_FORMAT_SET.has(normalizeBookFormat(format));
}

/**
 * Formats page-image (CBZ/CBR/PDF / zip/rar) — page par page et strip.
 * @param {unknown} format
 * @returns {boolean}
 */
export function isImagePageFormat(format) {
  const f = normalizeBookFormat(format);
  if (!f) return false;
  if (isEpubFormat(f) || f === 'mobi' || f === 'azw' || f === 'azw3' || f === 'txt') {
    return false;
  }
  return STRIP_FORMAT_SET.has(f);
}

/**
 * Lecture page par page (images) — CBZ/CBR/PDF.
 * Grisé pour EPUB (« format non compatible »).
 * @param {unknown} format
 * @returns {boolean}
 */
export function supportsPageReading(format) {
  return isImagePageFormat(format);
}

/**
 * Strip continu pour CBZ/CBR/PDF (et zip/rar traités comme archives).
 * Disabled pour formats texte (epub, mobi, txt…).
 * @param {unknown} format
 * @returns {boolean}
 */
export function supportsStripReading(format) {
  return isImagePageFormat(format);
}

/**
 * Lecture EPUB reflow — uniquement format epub.
 * Grisé pour CBZ/CBR/PDF (« format non compatible »).
 * @param {unknown} format
 * @returns {boolean}
 */
export function supportsEpubReading(format) {
  return isEpubFormat(format);
}

/**
 * Mode d’ouverture effectif : EPUB force le chemin reflow.
 * @param {unknown} format
 * @param {unknown} requestedMode
 * @returns {'page'|'strip'|'epub'}
 */
export function resolveReadingMode(format, requestedMode) {
  if (isEpubFormat(format)) return READING_MODE.EPUB;
  return normalizeReadingMode(requestedMode);
}
