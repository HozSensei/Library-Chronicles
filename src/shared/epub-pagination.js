/**
 * Pagination EPUB type liseuse — une « page » = un viewport (colonne CSS).
 *
 * Le stage mesure scrollWidth / pageWidth après reflow multi-colonnes ;
 * la navigation applique translateX (ou scrollLeft) d’un cran viewport.
 * Changement de police → re-mesure (reflow) + clamp / conservation ratio.
 */

/** Fond papier EPUB (indépendant des tokens UI --paper = texte menus). */
export const EPUB_PAPER_BG = '#f4efe6';
/** Encre lisible sur papier — pas de --paper (crème) ni filtres sépia. */
export const EPUB_INK = '#1a1a1a';
export const EPUB_INK_MUTED = '#4a453f';
export const EPUB_LINK = '#2f5f8f';

/** Seuil stick pour tourner une page écran. */
export const EPUB_STICK_PAGE_THRESHOLD = 0.55;
/** Cooldown entre deux pages stick (ms). */
export const EPUB_STICK_PAGE_COOLDOWN_MS = 280;

/**
 * Nombre de pages-écran dans un chapitre paginé en colonnes.
 * @param {number} scrollWidth
 * @param {number} pageWidth
 */
export function computeScreenCount(scrollWidth, pageWidth) {
  const w = Number(pageWidth);
  const sw = Number(scrollWidth);
  if (!Number.isFinite(w) || w <= 0) return 1;
  if (!Number.isFinite(sw) || sw <= 0) return 1;
  return Math.max(1, Math.round(sw / w));
}

/**
 * @param {number} index
 * @param {number} count
 */
export function clampScreenIndex(index, count) {
  const n = Math.max(1, Number(count) || 1);
  const i = Math.floor(Number(index) || 0);
  return Math.min(Math.max(0, i), n - 1);
}

/**
 * Conserve la position relative après reflow (zoom police).
 * @param {number} prevIndex
 * @param {number} prevCount
 * @param {number} nextCount
 */
export function remapScreenIndex(prevIndex, prevCount, nextCount) {
  const next = Math.max(1, Number(nextCount) || 1);
  const prev = Math.max(1, Number(prevCount) || 1);
  const idx = Math.max(0, Number(prevIndex) || 0);
  if (prev <= 1) return clampScreenIndex(0, next);
  const ratio = idx / prev;
  return clampScreenIndex(Math.round(ratio * next), next);
}

/**
 * Offset horizontal (px) pour afficher l’écran `index`.
 * @param {number} index
 * @param {number} pageWidth
 */
export function screenOffsetX(index, pageWidth) {
  const i = Math.max(0, Number(index) || 0);
  const w = Number(pageWidth) || 0;
  return i * w;
}

/**
 * Résout un pas D-Pad / stick dans le chapitre, sinon chapitre voisin.
 *
 * @param {{
 *   screenIndex: number,
 *   screenCount: number,
 *   which: 'prev'|'next',
 *   rtl?: boolean,
 * }} opts
 * @returns
 *   | { type: 'screen', index: number }
 *   | { type: 'chapter', which: 'prev'|'next', landOn: 'start'|'end' }
 *   | { type: 'noop' }
 */
export function resolveEpubPageStep(opts) {
  const count = Math.max(1, Number(opts?.screenCount) || 1);
  const index = clampScreenIndex(opts?.screenIndex, count);
  const rtl = Boolean(opts?.rtl);
  let which = opts?.which === 'prev' ? 'prev' : 'next';
  if (rtl) which = which === 'next' ? 'prev' : 'next';

  if (which === 'next') {
    if (index + 1 < count) return { type: 'screen', index: index + 1 };
    return { type: 'chapter', which: 'next', landOn: 'start' };
  }
  if (index > 0) return { type: 'screen', index: index - 1 };
  return { type: 'chapter', which: 'prev', landOn: 'end' };
}

/**
 * Direction de page depuis un stick local (axes déjà remappés).
 * @param {number} localX
 * @param {number} localY
 * @param {number} [threshold]
 * @returns {'prev'|'next'|null}
 */
export function stickToEpubPageWhich(
  localX,
  localY,
  threshold = EPUB_STICK_PAGE_THRESHOLD,
) {
  const x = Number(localX) || 0;
  const y = Number(localY) || 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const thr = Number(threshold);
  const t = Number.isFinite(thr) && thr > 0 ? thr : EPUB_STICK_PAGE_THRESHOLD;
  if (ax < t && ay < t) return null;
  // Dominant : horizontal prioritaire ; droite / bas = page suivante.
  if (ax >= ay) return x > 0 ? 'next' : 'prev';
  return y > 0 ? 'next' : 'prev';
}

/**
 * CSS injecté dans l’iframe chapitre — pagination colonnes + encre lisible.
 * Pas de filtres brightness/sepia (réservés images manga).
 *
 * @param {{
 *   fontPct?: number,
 *   pageWidth: number,
 *   pageHeight: number,
 *   columnGap?: number,
 * }} opts
 */
export function buildEpubThemeCss(opts) {
  const pct = Math.min(200, Math.max(70, Number(opts?.fontPct) || 100));
  const w = Math.max(1, Math.floor(Number(opts?.pageWidth) || 1));
  const h = Math.max(1, Math.floor(Number(opts?.pageHeight) || 1));
  const gap = Math.max(0, Math.floor(Number(opts?.columnGap) || 0));
  return `
html {
  height: ${h}px !important;
  width: ${w}px !important;
  overflow: hidden !important;
  background: ${EPUB_PAPER_BG} !important;
}
body {
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 1.1rem 1.35rem !important;
  height: ${h}px !important;
  width: ${w}px !important;
  max-width: none !important;
  overflow: hidden !important;
  column-width: ${w}px !important;
  column-gap: ${gap}px !important;
  column-fill: auto !important;
  -webkit-column-width: ${w}px !important;
  -webkit-column-gap: ${gap}px !important;
  font-family: Georgia, 'Times New Roman', serif !important;
  font-size: ${pct}% !important;
  line-height: 1.55 !important;
  color: ${EPUB_INK} !important;
  background: ${EPUB_PAPER_BG} !important;
  overflow-wrap: anywhere !important;
  /* Décale le contenu horizontalement (pages-écran). */
  transform: translateX(0);
  will-change: transform;
}
body * {
  color: inherit;
}
a, a:visited {
  color: ${EPUB_LINK} !important;
}
h1, h2, h3, h4, h5, h6 {
  color: ${EPUB_INK} !important;
  break-inside: avoid;
  page-break-inside: avoid;
}
p, li {
  orphans: 2;
  widows: 2;
}
img, svg {
  max-width: 100% !important;
  height: auto !important;
  break-inside: avoid;
}
`;
}
