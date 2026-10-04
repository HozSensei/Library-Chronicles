/**
 * Helpers EPUB — thème encre/papier + navigation manette.
 *
 * La pagination viewport n’est plus maison (colonnes CSS + translateX) :
 * elle est déléguée à **epub.js** (`EpubReaderStage`). Ce module ne fournit
 * plus de géométrie multi-colonnes ni d’offset translateX.
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

/** Moteur de pagination viewport (dépendance npm). */
export const EPUB_ENGINE = 'epubjs';

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
 * Résout un pas D-Pad / stick dans le chapitre, sinon chapitre voisin.
 * Conservé pour tests / fallback ; le stage epub.js utilise next()/prev().
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
 * Sélecteurs chapitre — saut de page avant titres / blocs chapitre
 * (intra-spine : plusieurs chapitres dans un même XHTML).
 * Injectés via `rendition.themes.default()`.
 */
export const EPUB_CHAPTER_BREAK_SELECTORS =
  'h1, h2, .chapter, section[epub|type~="chapter"]';

/**
 * Évite une page blanche en tête de document spine
 * (le premier enfant a déjà un début de section).
 */
export const EPUB_CHAPTER_BREAK_SKIP_SELECTORS = 'body > :first-child';

/** Propriétés CSS saut de page (CSS3 + legacy). */
export const EPUB_CHAPTER_BREAK_PROPS = Object.freeze({
  'break-before': 'page',
  'page-break-before': 'always',
});

/** Neutralise le saut pour le premier enfant du body. */
export const EPUB_CHAPTER_BREAK_SKIP_PROPS = Object.freeze({
  'break-before': 'auto',
  'page-break-before': 'auto',
});

/**
 * Règles CSS pour `rendition.themes.default()` — encre lisible, sans
 * colonnes maison ni translateX. Inclut sauts de page avant titres chapitre.
 *
 * @param {{ fontPct?: number }} [opts]
 * @returns {Record<string, Record<string, string>>}
 */
export function buildEpubJsThemeRules(opts = {}) {
  const pct = Math.min(200, Math.max(70, Number(opts?.fontPct) || 100));
  return {
    html: {
      background: EPUB_PAPER_BG,
    },
    body: {
      color: EPUB_INK,
      background: EPUB_PAPER_BG,
      'font-family': "Georgia, 'Times New Roman', serif",
      'font-size': `${pct}%`,
      'line-height': '1.55',
      'overflow-wrap': 'anywhere',
    },
    a: { color: EPUB_LINK },
    'a:visited': { color: EPUB_LINK },
    'h1, h2, h3, h4, h5, h6': {
      color: EPUB_INK,
    },
    [EPUB_CHAPTER_BREAK_SELECTORS]: { ...EPUB_CHAPTER_BREAK_PROPS },
    [EPUB_CHAPTER_BREAK_SKIP_SELECTORS]: { ...EPUB_CHAPTER_BREAK_SKIP_PROPS },
    'img, svg': {
      'max-width': '100%',
      height: 'auto',
    },
  };
}

/**
 * @deprecated Ancienne pagination colonnes — neutralisée (no-op géométrie).
 * Conservée pour ne pas casser d’imports résiduels ; ne plus utiliser.
 */
export function resolveEpubPageGeometry(opts = {}) {
  const pageWidth = Math.max(1, Math.floor(Number(opts?.pageWidth) || 1));
  const pageHeight = Math.max(1, Math.floor(Number(opts?.pageHeight) || 1));
  return {
    pageWidth,
    pageHeight,
    padX: 0,
    padY: 0,
    colW: pageWidth,
    columnGap: 0,
    stride: pageWidth,
    engine: EPUB_ENGINE,
  };
}

/**
 * @deprecated Neutralisé — epub.js fournit displayed.total.
 */
export function computeScreenCount(scrollWidth, pageWidth) {
  const w = Number(pageWidth);
  const sw = Number(scrollWidth);
  if (!Number.isFinite(w) || w <= 0) return 1;
  if (!Number.isFinite(sw) || sw <= 0) return 1;
  return Math.max(1, Math.ceil((sw - w * 0.02) / w));
}

/**
 * @deprecated Neutralisé — plus de translateX maison.
 */
export function screenOffsetX() {
  return 0;
}

/**
 * @deprecated Neutralisé — préférer buildEpubJsThemeRules + epub.js themes.
 * Ne génère plus de column-width / translateX.
 */
export function buildEpubThemeCss(opts = {}) {
  const pct = Math.min(200, Math.max(70, Number(opts?.fontPct) || 100));
  return `
html, body {
  background: ${EPUB_PAPER_BG} !important;
  color: ${EPUB_INK} !important;
  font-family: Georgia, 'Times New Roman', serif !important;
  font-size: ${pct}% !important;
  line-height: 1.55 !important;
  overflow-wrap: anywhere !important;
}
a, a:visited { color: ${EPUB_LINK} !important; }
${EPUB_CHAPTER_BREAK_SELECTORS} {
  break-before: page !important;
  page-break-before: always !important;
}
${EPUB_CHAPTER_BREAK_SKIP_SELECTORS} {
  break-before: auto !important;
  page-break-before: auto !important;
}
img, svg { max-width: 100% !important; height: auto !important; }
`;
}
