/**
 * Pagination EPUB type liseuse — une « page » = un viewport (colonne CSS).
 *
 * Géométrie (critique avec `rotate(90deg)` sur `.reader__plane`)
 * ---------------------------------------------------------------
 * - `pageWidth` / `pageHeight` = dimensions **locales** du stage
 *   (`clientWidth` / `clientHeight`), *avant* la rotation CSS. Ne pas
 *   utiliser getBoundingClientRect (AABB post-rotation = axes échangés).
 * - Une colonne CSS + son `column-gap` (= 2× pad horizontal) doit faire
 *   exactement `pageWidth` (stride). Sinon : liseré de la colonne
 *   suivante + dérive → pages blanches.
 *
 * Le stage mesure scrollWidth / stride après reflow multi-colonnes ;
 * la navigation applique translateX d’un cran stride.
 * Changement de police → re-mesure (reflow) + clamp / conservation ratio.
 */

/** Fond papier EPUB (indépendant des tokens UI --paper = texte menus). */
export const EPUB_PAPER_BG = '#f4efe6';
/** Encre lisible sur papier — pas de --paper (crème) ni filtres sépia. */
export const EPUB_INK = '#1a1a1a';
export const EPUB_INK_MUTED = '#4a453f';
export const EPUB_LINK = '#2f5f8f';

/** Marge intérieure horizontale / verticale (px), hors flux colonne. */
export const EPUB_PAD_X = 22;
export const EPUB_PAD_Y = 18;

/** Seuil stick pour tourner une page écran. */
export const EPUB_STICK_PAGE_THRESHOLD = 0.55;
/** Cooldown entre deux pages stick (ms). */
export const EPUB_STICK_PAGE_COOLDOWN_MS = 280;

/**
 * Géométrie page-écran : colonne + gap = stride = largeur viewport locale.
 *
 * Astuce CSS : pad horizontal via `padding-left` + `column-gap = 2×padX`
 * (pas de padding-right sur le conteneur multi-colonnes), ainsi chaque
 * « fenêtre » [n×stride, (n+1)×stride] montre pad | texte | pad.
 *
 * @param {{
 *   pageWidth: number,
 *   pageHeight: number,
 *   padX?: number,
 *   padY?: number,
 * }} opts
 */
export function resolveEpubPageGeometry(opts = {}) {
  const pageWidth = Math.max(1, Math.floor(Number(opts?.pageWidth) || 1));
  const pageHeight = Math.max(1, Math.floor(Number(opts?.pageHeight) || 1));
  const padX = Math.max(
    0,
    Math.min(
      Math.floor(pageWidth / 4),
      Math.floor(Number(opts?.padX ?? EPUB_PAD_X) || 0),
    ),
  );
  const padY = Math.max(
    0,
    Math.min(
      Math.floor(pageHeight / 4),
      Math.floor(Number(opts?.padY ?? EPUB_PAD_Y) || 0),
    ),
  );
  const colW = Math.max(1, pageWidth - 2 * padX);
  const columnGap = 2 * padX;
  const stride = colW + columnGap; // === pageWidth
  return {
    pageWidth,
    pageHeight,
    padX,
    padY,
    colW,
    columnGap,
    stride,
  };
}

/**
 * Nombre de pages-écran dans un chapitre paginé en colonnes.
 * Ignore une queue &lt; 2 % du stride (pad / subpixel) pour ne pas
 * inventer une page blanche en fin de chapitre.
 *
 * @param {number} scrollWidth
 * @param {number} pageWidth stride (= largeur viewport locale)
 */
export function computeScreenCount(scrollWidth, pageWidth) {
  const w = Number(pageWidth);
  const sw = Number(scrollWidth);
  if (!Number.isFinite(w) || w <= 0) return 1;
  if (!Number.isFinite(sw) || sw <= 0) return 1;
  return Math.max(1, Math.ceil((sw - w * 0.02) / w));
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
 * @param {number} pageWidth stride
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
 * Invariant : `column-width + column-gap === pageWidth` (stride viewport).
 *
 * @param {{
 *   fontPct?: number,
 *   pageWidth: number,
 *   pageHeight: number,
 *   padX?: number,
 *   padY?: number,
 *   columnGap?: number,
 * }} opts
 */
export function buildEpubThemeCss(opts) {
  const pct = Math.min(200, Math.max(70, Number(opts?.fontPct) || 100));
  const geo = resolveEpubPageGeometry({
    pageWidth: opts?.pageWidth,
    pageHeight: opts?.pageHeight,
    padX: opts?.padX,
    padY: opts?.padY,
  });
  const { pageWidth: w, pageHeight: h, padX, padY, colW, columnGap: gap } = geo;
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
  /* Pad vertical + inset gauche ; le gap (= 2×padX) fournit l’inset droit. */
  padding: ${padY}px 0 ${padY}px ${padX}px !important;
  height: ${h}px !important;
  /* Pas de width fixe : les colonnes overflowent horizontalement (scrollWidth). */
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  overflow: visible !important;
  column-width: ${colW}px !important;
  column-gap: ${gap}px !important;
  column-fill: auto !important;
  column-count: auto !important;
  -webkit-column-width: ${colW}px !important;
  -webkit-column-gap: ${gap}px !important;
  -webkit-column-fill: auto !important;
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
  max-width: none !important;
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
