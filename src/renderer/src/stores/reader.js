import { defineStore } from 'pinia';
import {
  stripPrefetchRange,
  stripWindowRange,
} from '../../../shared/reader-strip.js';
import {
  READING_MODE,
  isEpubFormat,
  resolveReadingMode,
} from '../../../shared/reading-mode.js';
import {
  PAGE_PAN_SPEED,
  STICK_INTENT,
  clampOffset,
  clampZoom,
  computeFit,
  hasOverflow,
  overflowFor,
  pageTransform,
  panBy,
  resetView,
  resolveStickIntent,
  scaleForZoom,
  zoomAboutCenter,
  zoomForFitHeight,
  zoomForFitWidth,
  zoomStep,
} from '../../../shared/page-view-transform.js';
import {
  clampScreenIndex,
  resolveEpubPageStep,
} from '../../../shared/epub-pagination.js';
import { findAdjacentVolume } from '../../../shared/series.js';
import { t as i18nT } from '../../../shared/i18n.js';
import { useLibraryStore } from './library.js';

const NIGHT_PRESET = { brightness: 0.78, contrast: 1.12, sepia: 0.35 };
const RESET_FILTERS = { brightness: 1, contrast: 1, sepia: 0 };
/** Durée de la transition CSS transform (zoom D-Pad / L3 / LB). */
const ZOOM_ANIM_MS = 180;
/** Voisines gardées en cache ObjectURL (prefetch page ±N) — mode page. */
const PAGE_CACHE_RADIUS = 2;
/** Taille police EPUB (%). */
const EPUB_FONT_DEFAULT = 100;
const EPUB_FONT_MIN = 70;
const EPUB_FONT_MAX = 200;
const EPUB_FONT_STEP = 10;

export const useReaderStore = defineStore('reader', {
  state: () => ({
    filePath: null,
    bookId: null,
    title: '',
    format: null,
    series: null,
    seriesId: null,
    volume: null,
    pageIndex: 0,
    pageCount: 0,
    direction: 'ltr',
    /** Libellé du preset page courant : fit-page | fit-width | fit-height | zoom. */
    fitMode: 'fit-page',
    /** Préférence profil (`defaultFitMode`) appliquée à la 1re mesure de page. */
    defaultFitMode: 'fit-page',
    /**
     * Mode d’ouverture : page | strip | epub.
     * Posé à open() depuis la fiche / format ; pas de préférence globale.
     */
    readingMode: READING_MODE.PAGE,
    /** Taille police EPUB (% de la base document). */
    fontSize: EPUB_FONT_DEFAULT,
    /**
     * Pagination liseuse EPUB : index / total des pages-écran du chapitre.
     * Mesuré par EpubReaderStage (colonnes CSS) ; indépendant du spine.
     */
    epubScreenIndex: 0,
    epubScreenCount: 1,
    /** À l’ouverture d’un chapitre : atterrir début ou fin (page-prev). */
    epubLandOn: 'start',
    /** Facteur de zoom ∈ [1, 4] — 1 = page entière (fitScale). */
    zoom: 1,
    /** Offset de pan en px stage locaux (centré = 0). */
    offsetX: 0,
    offsetY: 0,
    /** Dimensions locales du stage page (clientWidth/Height, pré-rotation). */
    stageW: 0,
    stageH: 0,
    /** Dimensions naturelles de la page affichée. */
    pageW: 0,
    pageH: 0,
    /** Pulse CSS pour la transition transform (zoom D-Pad / L3 / LB). */
    zoomTransition: false,
    /** Modal pause Select (persistante jusqu’à B / Select). */
    hudVisible: false,
    hudPanel: 'main', // main | bookmarks | filters
    /** Index focus manette dans la modal pause. */
    hudFocusIndex: 0,
    /** Toast progression (page ±) — distinct de la modal. */
    toastVisible: false,
    pageUrl: null,
    /** Pages empilées strip vertical { index, url } — fenêtre ~4–5. */
    stripPages: [],
    chapters: [],
    chapterIndex: 0,
    bookmarks: [],
    bookmarkFlash: null,
    /** Tome adjacent volume−1 (même series_id), null si absent. */
    prevVolumeOffer: null,
    /** Tome adjacent volume+1 (même series_id), null si absent. */
    nextVolumeOffer: null,
    /** Index focus manette sur l’écran de fin de tome. */
    endFocusIndex: 0,
    brightness: 1,
    contrast: 1,
    sepia: 0,
    loading: false,
    error: null,
    renderEngine: null,
    _hudTimer: null,
    _zoomTransitionTimer: null,
    /** Prochaine mesure de page → reset vue (nouvelle page / nouveau livre). */
    _refitPending: true,
    /** Demande scrollIntoView après nav programmatique (pas scroll utilisateur). */
    stripScrollToken: 0,
    /** Cache ObjectURL pages { index → url } (courante + prefetch). */
    _pageUrlCache: {},
    /** @type {Record<number, Promise<string|null>>} */
    _pagePending: {},
  }),
  getters: {
    /**
     * Compteur HUD : pages images (CBZ/PDF) ou écrans EPUB (+ chapitre spine).
     */
    pageLabel(s) {
      const cur = s.pageCount ? s.pageIndex + 1 : 0;
      const total = s.pageCount;
      if (s.readingMode === READING_MODE.EPUB || isEpubFormat(s.format)) {
        const screenCur = (s.epubScreenIndex || 0) + 1;
        const screenTotal = Math.max(1, s.epubScreenCount || 1);
        return i18nT('reader.epubScreenOf', {
          cur: screenCur,
          total: screenTotal,
          ch: cur,
          chTotal: total,
        });
      }
      return `${cur} / ${total}`;
    },
    progress: (s) => (s.pageCount ? ((s.pageIndex + 1) / s.pageCount) * 100 : 0),
    currentChapter: (s) => s.chapters[s.chapterIndex] || null,
    isStripMode: (s) => s.readingMode === READING_MODE.STRIP,
    isEpubMode: (s) =>
      s.readingMode === READING_MODE.EPUB || isEpubFormat(s.format),
    fontSizeLabel: (s) => `${s.fontSize || EPUB_FONT_DEFAULT} %`,
    filterCss(s) {
      return `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`;
    },
    /** Fit courant (contain + fit-width/height) — source unique des bornes. */
    fit: (s) =>
      computeFit({
        stageW: s.stageW,
        stageH: s.stageH,
        pageW: s.pageW,
        pageH: s.pageH,
      }),
    /** Page mesurée : tant que false, la vue masque le stage (pas de flash). */
    isPageMeasured() {
      return this.fit.valid;
    },
    /** Échelle CSS absolue = fitScale × zoom. */
    scale() {
      return scaleForZoom(this.zoom, this.fit);
    },
    /** Débordement px stage par axe (0 = l’axe tient entièrement). */
    pageOverflow() {
      return overflowFor(this.zoom, this.fit);
    },
    canPan() {
      return hasOverflow(this.zoom, this.fit);
    },
    isZoomed: (s) => s.zoom > 1.001,
    zoomLabel: (s) => `${Math.round(s.zoom * 100)} %`,
    /** Transform du calque de pan — unique source du rendu page. */
    pageTransformCss() {
      return pageTransform(
        { zoom: this.zoom, x: this.offsetX, y: this.offsetY },
        this.fit,
      );
    },
    pageLayerStyle() {
      return {
        transform: this.pageTransformCss,
        transformOrigin: 'center center',
        willChange: 'transform',
      };
    },
    /** Filtres de lecture (luminosité / contraste / sépia) — pas de transform. */
    pageFilterStyle(s) {
      return {
        filter: `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`,
        willChange: 'filter',
      };
    },
    isFinished(s) {
      return s.pageCount > 0 && s.pageIndex + 1 >= s.pageCount;
    },
    /** Écran fin de tome : série avec au moins un voisin volume ±1. */
    showEndSeriesNav(s) {
      return (
        s.pageCount > 0 &&
        s.pageIndex + 1 >= s.pageCount &&
        Boolean(s.seriesId) &&
        Boolean(s.prevVolumeOffer || s.nextVolumeOffer)
      );
    },
  },
  actions: {
    clearHudTimer() {
      if (this._hudTimer) {
        clearTimeout(this._hudTimer);
        this._hudTimer = null;
      }
    },
    /** Toast bas de plan (progression) — n’ouvre pas la modal pause. */
    flashHud(ms = 1400) {
      this.clearHudTimer();
      if (this.hudVisible) return;
      this.toastVisible = true;
      this._hudTimer = setTimeout(() => {
        this.toastVisible = false;
        this._hudTimer = null;
      }, ms);
    },
    setHudFocus(index) {
      const i = Number(index);
      this.hudFocusIndex = Number.isFinite(i) && i >= 0 ? Math.floor(i) : 0;
    },
    moveHudFocus(delta) {
      const items =
        typeof document !== 'undefined'
          ? document.querySelectorAll('.hud [data-hud-focus]')
          : [];
      const max = Math.max(0, items.length - 1);
      const next = Math.min(max, Math.max(0, this.hudFocusIndex + delta));
      this.hudFocusIndex = next;
      return next;
    },
    closeHud() {
      this.clearHudTimer();
      this.hudVisible = false;
      this.hudPanel = 'main';
      this.hudFocusIndex = 0;
      this.toastVisible = false;
    },
    async loadPrefs() {
      try {
        const prefs = await window.vdr.profiles.getPrefs();
        this.direction = prefs.readingDirection || 'ltr';
        this.defaultFitMode = prefs.defaultFitMode || 'fit-page';
        this.brightness = prefs.brightness ?? 1;
        this.contrast = prefs.contrast ?? 1;
        this.sepia = prefs.sepia ?? 0;
      } catch {
        // ignore
      }
    },
    async persistPrefs(patch) {
      try {
        const prefs = await window.vdr.profiles.setPrefs(patch || {});
        this.brightness = prefs.brightness ?? this.brightness;
        this.contrast = prefs.contrast ?? this.contrast;
        this.sepia = prefs.sepia ?? this.sepia;
        if (prefs.readingDirection) this.direction = prefs.readingDirection;
        if (prefs.defaultFitMode) this.defaultFitMode = prefs.defaultFitMode;
      } catch {
        // ignore
      }
    },
    async open(filePath, { resume = true, readingMode } = {}) {
      this.loading = true;
      this.error = null;
      this.prevVolumeOffer = null;
      this.nextVolumeOffer = null;
      this.endFocusIndex = 0;
      this.revokePageCache();
      try {
        await this.loadPrefs();
        const meta = await window.vdr.reader.open(filePath);
        this.filePath = filePath;
        this.bookId = meta.bookId ?? null;
        this.title = meta.title;
        this.format = meta.format || null;
        this.pageCount = meta.pageCount;
        this.chapters = meta.chapters || [];
        this.chapterIndex = 0;
        this.renderEngine = meta.renderEngine || meta.format || null;
        this.readingMode = resolveReadingMode(
          meta.format,
          readingMode !== undefined && readingMode !== null
            ? readingMode
            : READING_MODE.PAGE,
        );
        this.resetTransform();
        if (this.isEpubMode) {
          this.fontSize = EPUB_FONT_DEFAULT;
          this.fitMode = 'reflow';
          this.epubScreenIndex = 0;
          this.epubScreenCount = 1;
          this.epubLandOn = 'start';
        } else if (this.isStripMode) {
          this.fitMode = 'fit-width';
        }

        // Métadonnées série déjà fournies par reader.open (plus de listBooks)
        this.series = meta.series ?? null;
        this.seriesId = meta.seriesId ?? null;
        this.volume = meta.volume ?? null;
        if (meta.title) this.title = meta.title;

        let start = 0;
        if (resume && meta.resumePage > 0 && meta.resumePage < meta.pageCount) {
          start = meta.resumePage;
        }
        this.pageIndex = start;
        await this.loadCurrentPage({ scrollToCurrent: this.isStripMode });
        await this.refreshBookmarks();
        this.flashHud(1800);
        return meta;
      } catch (err) {
        this.error = err.message || String(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async loadCurrentPage({ scrollToCurrent = false } = {}) {
      if (!this.filePath || this.pageCount === 0) return;
      if (this.isEpubMode) {
        const url = await this.ensurePageUrl(this.pageIndex);
        this.pageUrl = url;
        this.stripPages = [];
        this.trimPageCache();
        void this.prefetchNeighbors(this.pageIndex);
      } else if (this.isStripMode) {
        await this.loadStripWindow();
        if (scrollToCurrent) this.requestStripScroll();
      } else {
        const url = await this.ensurePageUrl(this.pageIndex);
        this.pageUrl = url;
        this.stripPages = [];
        this.trimPageCache();
        void this.prefetchNeighbors(this.pageIndex);
      }
      this.syncChapterIndex();
      this.persistProgress();
      if (this.isFinished) await this.checkNextVolume();
    },
    /** Signale à ReaderView de scroller la page courante (nav A/B, signet…). */
    requestStripScroll() {
      this.stripScrollToken += 1;
    },
    blobUrlFromPage(page) {
      const bin = atob(page.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: page.mime || 'image/jpeg' });
      return URL.createObjectURL(blob);
    },
    /**
     * Charge / mémoise une page (ObjectURL) avec dédup in-flight.
     * @param {number} index
     */
    async ensurePageUrl(index) {
      if (index < 0 || index >= this.pageCount) return null;
      if (this._pageUrlCache[index]) return this._pageUrlCache[index];
      if (this._pagePending[index]) return this._pagePending[index];
      this._pagePending[index] = (async () => {
        try {
          const page = await window.vdr.reader.getPage(index);
          if (!page?.data) return null;
          if (page.engine) this.renderEngine = page.engine;
          const url = this.blobUrlFromPage(page);
          this._pageUrlCache[index] = url;
          return url;
        } catch {
          return null;
        } finally {
          delete this._pagePending[index];
        }
      })();
      return this._pagePending[index];
    },
    /**
     * Prefetch voisines (page ±RADIUS ou strip hors fenêtre).
     * Ne bloque pas le rendu de la fenêtre visible en strip.
     */
    async prefetchNeighbors(center = this.pageIndex) {
      if (this.isEpubMode) {
        const jobs = [];
        for (let i = center - 1; i <= center + 1; i += 1) {
          if (i === center) continue;
          if (i >= 0 && i < this.pageCount) jobs.push(this.ensurePageUrl(i));
        }
        if (jobs.length) await Promise.all(jobs);
        this.trimPageCache(center);
        return;
      }
      if (this.isStripMode) {
        const { start, end } = stripPrefetchRange(center, this.pageCount);
        const win = stripWindowRange(center, this.pageCount);
        const jobs = [];
        for (let i = start; i <= end; i += 1) {
          if (i < win.start || i > win.end) jobs.push(this.ensurePageUrl(i));
        }
        if (jobs.length) await Promise.all(jobs);
        this.trimPageCache(center);
        return;
      }
      const jobs = [];
      for (let i = center - PAGE_CACHE_RADIUS; i <= center + PAGE_CACHE_RADIUS; i += 1) {
        if (i === center) continue;
        if (i >= 0 && i < this.pageCount) jobs.push(this.ensurePageUrl(i));
      }
      if (jobs.length) await Promise.all(jobs);
      this.trimPageCache(center);
    },
    /** Garde page courante + prefetch (ou fenêtre strip) ; révoque le reste. */
    trimPageCache(center = this.pageIndex) {
      const keep = new Set();
      if (this.isEpubMode) {
        for (let i = center - 1; i <= center + 1; i += 1) {
          if (i >= 0 && i < this.pageCount) keep.add(i);
        }
      } else if (this.isStripMode) {
        const { start, end } = stripPrefetchRange(center, this.pageCount);
        for (let i = start; i <= end; i += 1) keep.add(i);
      } else {
        for (let i = center - PAGE_CACHE_RADIUS; i <= center + PAGE_CACHE_RADIUS; i += 1) {
          if (i >= 0 && i < this.pageCount) keep.add(i);
        }
      }
      const stripUrls = new Set(
        (this.stripPages || []).map((p) => p.url).filter(Boolean),
      );
      for (const key of Object.keys(this._pageUrlCache)) {
        const idx = Number(key);
        if (!keep.has(idx)) {
          const url = this._pageUrlCache[idx];
          if (url && url !== this.pageUrl && !stripUrls.has(url)) {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
          }
          delete this._pageUrlCache[idx];
        }
      }
    },
    revokePageCache() {
      for (const url of Object.values(this._pageUrlCache)) {
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        }
      }
      this._pageUrlCache = {};
      this._pagePending = {};
      this.stripPages = [];
    },
    /**
     * Charge ~4–5 pages dans le strip DOM + prefetch voisines (cache partagé).
     */
    async loadStripWindow() {
      if (!this.filePath || this.pageCount === 0) {
        this.stripPages = [];
        this.pageUrl = null;
        return;
      }
      const { start, end } = stripWindowRange(this.pageIndex, this.pageCount);
      const jobs = [];
      for (let i = start; i <= end; i += 1) {
        jobs.push(this.ensurePageUrl(i));
      }
      await Promise.all(jobs);
      const next = [];
      for (let i = start; i <= end; i += 1) {
        const url = this._pageUrlCache[i];
        if (url) next.push({ index: i, url });
      }
      this.stripPages = next;
      this.pageUrl = this._pageUrlCache[this.pageIndex] || null;
      void this.prefetchNeighbors(this.pageIndex);
    },
    /**
     * Scroll utilisateur : maj index + glisse la fenêtre si besoin.
     * @param {number} index
     */
    async setPageFromStripScroll(index) {
      const i = Number(index);
      if (!Number.isFinite(i) || i < 0 || i >= this.pageCount) return;
      if (i === this.pageIndex) return;
      this.pageIndex = i;
      this.syncChapterIndex();
      this.persistProgress();
      await this.loadStripWindow();
      if (this.isFinished) await this.checkNextVolume();
    },
    syncChapterIndex() {
      if (!this.chapters.length) {
        this.chapterIndex = 0;
        return;
      }
      const idx = this.chapters.findIndex(
        (c) => this.pageIndex >= c.startIndex && this.pageIndex <= c.endIndex,
      );
      this.chapterIndex = idx >= 0 ? idx : 0;
    },
    async persistProgress() {
      if (!this.filePath) return;
      try {
        await window.vdr.progress.save({
          filePath: this.filePath,
          bookId: this.bookId,
          pageCurrent: this.pageIndex,
          pageTotal: this.pageCount,
        });
      } catch {
        // ignore
      }
    },
    async checkAdjacentVolumes() {
      if (!this.seriesId) {
        this.prevVolumeOffer = null;
        this.nextVolumeOffer = null;
        return;
      }
      try {
        const books = await window.vdr.library.list();
        const opts = {
          seriesId: this.seriesId,
          volume: this.volume,
          bookId: this.bookId,
        };
        const prev = findAdjacentVolume(books, { ...opts, delta: -1 });
        const next = findAdjacentVolume(books, { ...opts, delta: 1 });
        this.prevVolumeOffer =
          prev && prev.id !== this.bookId ? prev : null;
        this.nextVolumeOffer =
          next && next.id !== this.bookId ? next : null;
        if (this.showEndSeriesNav) {
          // Focus par défaut : suivant s’il existe, sinon précédent.
          this.endFocusIndex = this.nextVolumeOffer
            ? this.prevVolumeOffer
              ? 1
              : 0
            : 0;
        }
      } catch {
        this.prevVolumeOffer = null;
        this.nextVolumeOffer = null;
      }
    },
    /** Alias rétrocompat — voisins volume ±1. */
    async checkNextVolume() {
      return this.checkAdjacentVolumes();
    },
    setEndFocus(index) {
      const i = Number(index);
      this.endFocusIndex = Number.isFinite(i) && i >= 0 ? Math.floor(i) : 0;
    },
    moveEndFocus(delta) {
      const items =
        typeof document !== 'undefined'
          ? document.querySelectorAll('.reader__next [data-end-focus]')
          : [];
      const max = Math.max(0, items.length - 1);
      const next = Math.min(max, Math.max(0, this.endFocusIndex + delta));
      this.endFocusIndex = next;
      return next;
    },
    async openAdjacentVolume(delta) {
      const step = Number(delta) || 0;
      if (!step) return false;
      let offer = step > 0 ? this.nextVolumeOffer : this.prevVolumeOffer;
      if (!offer?.filePath) {
        await this.checkAdjacentVolumes();
        offer = step > 0 ? this.nextVolumeOffer : this.prevVolumeOffer;
      }
      if (!offer?.filePath) return false;
      const mode = this.readingMode;
      await this.close();
      await this.open(offer.filePath, { resume: false, readingMode: mode });
      return true;
    },
    async openNextVolume() {
      return this.openAdjacentVolume(1);
    },
    async openPrevVolume() {
      return this.openAdjacentVolume(-1);
    },
    async close() {
      await this.persistProgress();
      this.closeHud();
      this.clearZoomAnim();
      this.resetTransform();
      this.stageW = 0;
      this.stageH = 0;
      this.pageW = 0;
      this.pageH = 0;
      this.revokePageCache();
      this.pageUrl = null;
      this.stripPages = [];
      this.stripScrollToken = 0;
      this.readingMode = READING_MODE.PAGE;
      this.format = null;
      this.fontSize = EPUB_FONT_DEFAULT;
      this.epubScreenIndex = 0;
      this.epubScreenCount = 1;
      this.epubLandOn = 'start';
      await window.vdr.reader.close();
      this.filePath = null;
      this.bookId = null;
      this.title = '';
      this.series = null;
      this.seriesId = null;
      this.volume = null;
      this.pageCount = 0;
      this.pageIndex = 0;
      this.chapters = [];
      this.bookmarks = [];
      this.prevVolumeOffer = null;
      this.nextVolumeOffer = null;
      this.endFocusIndex = 0;
      this.error = null;
      this.renderEngine = null;
      // Progression changée → forcer refresh biblio au prochain écran
      try {
        useLibraryStore().invalidate();
      } catch {
        // ignore
      }
    },
    clearZoomAnim() {
      if (this._zoomTransitionTimer) {
        clearTimeout(this._zoomTransitionTimer);
        this._zoomTransitionTimer = null;
      }
      this.zoomTransition = false;
    },
    /** Transition CSS transform pour zoom / reset / fit (D-Pad, L3, LB). */
    pulseZoomTransition(ms = ZOOM_ANIM_MS + 40) {
      this.zoomTransition = true;
      if (this._zoomTransitionTimer) clearTimeout(this._zoomTransitionTimer);
      this._zoomTransitionTimer = setTimeout(() => {
        this.zoomTransition = false;
        this._zoomTransitionTimer = null;
      }, ms);
    },
    /**
     * Dimensions locales du stage page (`clientWidth/Height`, pré-rotation CSS).
     * Conserve le facteur de zoom et reclampe l’offset aux nouvelles bornes.
     */
    setStageMetrics(width, height) {
      const w = Number(width);
      const h = Number(height);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return;
      if (w === this.stageW && h === this.stageH) return;
      this.stageW = Math.max(0, w);
      this.stageH = Math.max(0, h);
      this.applyView({ zoom: this.zoom, x: this.offsetX, y: this.offsetY });
    },
    /**
     * Dimensions naturelles de la page affichée (`naturalWidth/Height`).
     * `_refitPending` (ouverture / signet / chapitre / reset) → page entière
     * (ou fit-width si préférence). Sinon (nav D-Pad page ±1) : conserve
     * `zoom` + offset clampé aux bornes du nouveau fit.
     */
    setPageMetrics(width, height) {
      const w = Number(width);
      const h = Number(height);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
      this.pageW = w;
      this.pageH = h;
      if (this._refitPending) {
        this._refitPending = false;
        // Préférence explicite « bord à bord largeur » ; sinon page entière.
        if (this.defaultFitMode === 'fit-width') {
          this.applyView({ zoom: zoomForFitWidth(this.fit), x: 0, y: 0 });
          this.fitMode = 'fit-width';
          return;
        }
        this.applyView(resetView());
        this.fitMode = 'fit-page';
        return;
      }
      this.applyView({ zoom: this.zoom, x: this.offsetX, y: this.offsetY });
    },
    /**
     * Point d’entrée unique du modèle : borne le zoom puis clampe l’offset.
     * Toute écriture de `zoom` / `offset*` passe par ici (pas de clamp dupliqué).
     */
    applyView(view) {
      const fit = this.fit;
      const zoom = clampZoom(view?.zoom ?? this.zoom, fit);
      const offset = clampOffset(
        { x: view?.x ?? this.offsetX, y: view?.y ?? this.offsetY },
        zoom,
        fit,
      );
      this.zoom = zoom;
      this.offsetX = offset.x;
      this.offsetY = offset.y;
    },
    /** Vue neutre — page entière centrée ; la prochaine mesure refit. */
    resetTransform() {
      this.clearZoomAnim();
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      if (this.isEpubMode) this.fitMode = 'reflow';
      else if (!this.isStripMode) this.fitMode = 'fit-page';
      this._refitPending = true;
    },
    /**
     * Pan stick en px stage locaux (axes déjà passés par `visualPanToLocal`).
     * Clampé à ±débordement/2 ; no-op si la page tient entièrement.
     * Strip / EPUB = no-op (scroll dédié).
     * @returns {boolean} true si l’offset a bougé
     */
    pan(dx, dy, speed = PAGE_PAN_SPEED) {
      if (this.isStripMode || this.isEpubMode) return false;
      // Le pan est continu (une frame par tick) : jamais de transition CSS.
      if (this.zoomTransition) this.clearZoomAnim();
      const next = panBy(
        { x: this.offsetX, y: this.offsetY },
        { x: dx, y: dy },
        this.zoom,
        this.fit,
        speed,
      );
      this.offsetX = next.x;
      this.offsetY = next.y;
      return next.moved;
    },
    /**
     * Intention du stick : pan s’il y a du débordement, sinon none (no-op).
     * Le stick ne tourne **jamais** les pages — D-Pad ←/→ seulement.
     * @param {{ x: number, y: number } | null} stickLocal
     */
    stickIntent(stickLocal) {
      if (this.isStripMode || this.isEpubMode) return STICK_INTENT.NONE;
      return resolveStickIntent(stickLocal, this.zoom, this.fit);
    },
    /**
     * Zoom D-Pad : ±15 % multiplicatif, borné [page entière, ×4].
     * Strip = no-op. EPUB = taille police ±.
     */
    zoomBy(steps) {
      if (this.isStripMode) return;
      if (this.isEpubMode) {
        this.adjustFontSize(steps);
        return;
      }
      const next = zoomStep(this.zoom, steps, this.fit);
      if (Math.abs(next - this.zoom) < 1e-6) return;
      this.pulseZoomTransition();
      // Ancré au centre du stage : on zoome sur ce qu’on regarde.
      this.applyView(
        zoomAboutCenter(
          { x: this.offsetX, y: this.offsetY },
          this.zoom,
          next,
          this.fit,
        ),
      );
      this.fitMode = this.zoom > 1.001 ? 'zoom' : 'fit-page';
    },
    /**
     * L3 / R3 — reset : page entière bord à bord, recentrée.
     * Garanti par construction (`zoom = 1`, `offset = 0`), sans mesure DOM.
     * No-op en strip.
     */
    resetZoom() {
      if (this.isStripMode) return;
      if (this.isEpubMode) {
        this.resetFontSize();
        return;
      }
      this.pulseZoomTransition();
      this.applyView(resetView());
      this.fitMode = 'fit-page';
    },
    /** @deprecated alias — préférer resetZoom() */
    toggleZoom() {
      this.resetZoom();
    },
    /** LB — page bord à bord en largeur (déborde éventuellement en hauteur). */
    setFitWidth() {
      if (this.isStripMode || this.isEpubMode) return;
      this.pulseZoomTransition();
      this.applyView({ zoom: zoomForFitWidth(this.fit), x: 0, y: 0 });
      this.fitMode = 'fit-width';
    },
    /** Page bord à bord en hauteur (déborde éventuellement en largeur). */
    setFitHeight() {
      if (this.isStripMode || this.isEpubMode) return;
      this.pulseZoomTransition();
      this.applyView({ zoom: zoomForFitHeight(this.fit), x: 0, y: 0 });
      this.fitMode = 'fit-height';
    },
    adjustFontSize(steps) {
      if (!this.isEpubMode) return;
      const delta = (Number(steps) || 0) * EPUB_FONT_STEP;
      const next = Math.min(
        EPUB_FONT_MAX,
        Math.max(EPUB_FONT_MIN, (this.fontSize || EPUB_FONT_DEFAULT) + delta),
      );
      if (next === this.fontSize) return;
      this.fontSize = next;
      this.flashHud(900);
    },
    resetFontSize() {
      if (!this.isEpubMode) return;
      this.fontSize = EPUB_FONT_DEFAULT;
      this.flashHud(900);
    },
    /**
     * Mesure EpubReaderStage → pages-écran du chapitre courant.
     * @param {number} count
     * @param {number} index
     */
    setEpubScreens(count, index) {
      if (!this.isEpubMode) return;
      const n = Math.max(1, Math.floor(Number(count) || 1));
      this.epubScreenCount = n;
      this.epubScreenIndex = clampScreenIndex(index, n);
      this.epubLandOn = '';
    },
    toggleDirection() {
      this.direction = this.direction === 'ltr' ? 'rtl' : 'ltr';
      this.persistPrefs({ readingDirection: this.direction });
      window.vdr.setConfig({ readingDirection: this.direction });
    },
    toggleHud() {
      this.clearHudTimer();
      this.toastVisible = false;
      this.hudVisible = !this.hudVisible;
      if (!this.hudVisible) {
        this.hudPanel = 'main';
        this.hudFocusIndex = 0;
      } else {
        this.hudFocusIndex = 0;
      }
    },
    setHudPanel(panel) {
      this.clearHudTimer();
      this.toastVisible = false;
      this.hudPanel = panel;
      this.hudVisible = true;
      this.hudFocusIndex = 0;
    },
    async setFilters(patch) {
      if (patch.brightness != null) this.brightness = patch.brightness;
      if (patch.contrast != null) this.contrast = patch.contrast;
      if (patch.sepia != null) this.sepia = patch.sepia;
      await this.persistPrefs({
        brightness: this.brightness,
        contrast: this.contrast,
        sepia: this.sepia,
      });
    },
    async applyNightPreset() {
      await this.setFilters(NIGHT_PRESET);
    },
    async resetFilters() {
      await this.setFilters(RESET_FILTERS);
    },
    async refreshBookmarks() {
      if (!this.bookId) {
        this.bookmarks = [];
        return;
      }
      try {
        this.bookmarks = (await window.vdr.bookmarks.list(this.bookId)) || [];
      } catch {
        this.bookmarks = [];
      }
    },
    async addBookmark(label = null) {
      if (!this.bookId) return null;
      const result = await window.vdr.bookmarks.add({
        bookId: this.bookId,
        page: this.pageIndex,
        label: label || `Page ${this.pageIndex + 1}`,
      });
      await this.refreshBookmarks();
      this.bookmarkFlash = result.created ? 'Signet ajouté' : 'Signet déjà présent';
      this.setHudPanel('bookmarks');
      setTimeout(() => {
        this.bookmarkFlash = null;
      }, 1600);
      return result;
    },
    async removeBookmark(id) {
      await window.vdr.bookmarks.remove(id);
      await this.refreshBookmarks();
    },
    async goToBookmark(bm) {
      if (bm == null) return;
      this.pageIndex = bm.page;
      this.resetTransform();
      await this.loadCurrentPage({ scrollToCurrent: this.isStripMode });
      this.flashHud(900);
    },
    async stepPage(which) {
      // EPUB : d’abord page-écran dans le chapitre, puis spine ±1.
      if (this.isEpubMode) {
        const step = resolveEpubPageStep({
          screenIndex: this.epubScreenIndex,
          screenCount: this.epubScreenCount,
          which: which === 'prev' ? 'prev' : 'next',
          rtl: this.direction === 'rtl',
        });
        if (step.type === 'screen') {
          this.epubScreenIndex = step.index;
          this.flashHud(900);
          return true;
        }
        if (step.type === 'chapter') {
          const dir = step.which === 'next' ? 1 : -1;
          const next = this.pageIndex + dir;
          if (next < 0 || next >= this.pageCount) {
            if (step.which === 'next' && this.isFinished) {
              await this.checkAdjacentVolumes();
            }
            return false;
          }
          this.epubLandOn = step.landOn;
          this.pageIndex = next;
          this.epubScreenIndex = step.landOn === 'end' ? Math.max(0, this.epubScreenCount - 1) : 0;
          await this.loadCurrentPage({ scrollToCurrent: false });
          this.flashHud(900);
          return true;
        }
        return false;
      }

      const dir = this.direction === 'rtl' ? -1 : 1;
      const delta = which === 'next' ? dir : -dir;
      const next = this.pageIndex + delta;
      if (next < 0 || next >= this.pageCount) {
        if (which === 'next' && this.isFinished) await this.checkAdjacentVolumes();
        return false;
      }
      this.pageIndex = next;
      // Zoom + offset survivent : setPageMetrics reclampe au nouveau fit.
      await this.loadCurrentPage({ scrollToCurrent: this.isStripMode });
      this.flashHud(900);
      return true;
    },
    async stepChapter(dir) {
      if (this.isEpubMode) {
        this.epubLandOn = dir < 0 ? 'end' : 'start';
      }
      if (!this.chapters.length) {
        const next = Math.min(
          this.pageCount - 1,
          Math.max(0, this.pageIndex + dir * 10),
        );
        if (next === this.pageIndex) return false;
        this.pageIndex = next;
        this.resetTransform();
        if (this.isEpubMode) {
          this.epubScreenIndex = dir < 0 ? Math.max(0, this.epubScreenCount - 1) : 0;
        }
        await this.loadCurrentPage({ scrollToCurrent: this.isStripMode });
        this.flashHud(900);
        return true;
      }
      const nextIdx = this.chapterIndex + dir;
      if (nextIdx < 0 || nextIdx >= this.chapters.length) return false;
      this.chapterIndex = nextIdx;
      this.pageIndex = this.chapters[nextIdx].startIndex;
      this.resetTransform();
      if (this.isEpubMode) {
        this.epubScreenIndex = dir < 0 ? Math.max(0, this.epubScreenCount - 1) : 0;
      }
      await this.loadCurrentPage({ scrollToCurrent: this.isStripMode });
      this.flashHud(900);
      return true;
    },
  },
});
