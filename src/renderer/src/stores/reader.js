import { defineStore } from 'pinia';
import {
  stripPrefetchRange,
  stripWindowRange,
} from '../../../shared/reader-strip.js';
import { findAdjacentVolume } from '../../../shared/series.js';
import {
  measureReaderZoomGeometry,
  panForZoomToCenter,
  panForZoomToScreenCenter,
  pinReaderOverflow,
} from '../../../shared/zoom-anchor.js';
import { useLibraryStore } from './library.js';

const NIGHT_PRESET = { brightness: 0.78, contrast: 1.12, sepia: 0.35 };
const RESET_FILTERS = { brightness: 1, contrast: 1, sepia: 0 };
/** Durée d’interpolation zoom D-Pad / L3 (ms), ease-out. */
const ZOOM_ANIM_MS = 200;

function clampScale(value) {
  return Math.min(4, Math.max(0.25, value));
}

export const useReaderStore = defineStore('reader', {
  state: () => ({
    filePath: null,
    bookId: null,
    title: '',
    series: null,
    seriesId: null,
    volume: null,
    pageIndex: 0,
    pageCount: 0,
    direction: 'ltr',
    fitMode: 'fit-height',
    /** Échelle affichée (interpolée). */
    scale: 1,
    /** Cible logique du zoom (±15 % par pas). */
    targetScale: 1,
    /** Pulse CSS pour transition fit L3 (width/height). */
    zoomTransition: false,
    panX: 0,
    panY: 0,
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
    _zoomRaf: null,
    _zoomTransitionTimer: null,
    /** Demande scrollIntoView après nav programmatique (pas scroll utilisateur). */
    stripScrollToken: 0,
    /** Cache ObjectURL pages { index → url } (fenêtre + prefetch). */
    _pageUrlCache: {},
    /** @type {Record<number, Promise<string|null>>} */
    _pagePending: {},
  }),
  getters: {
    pageLabel: (s) => `${s.pageCount ? s.pageIndex + 1 : 0} / ${s.pageCount}`,
    progress: (s) => (s.pageCount ? ((s.pageIndex + 1) / s.pageCount) * 100 : 0),
    transform: (s) => `scale(${s.scale})`,
    currentChapter: (s) => s.chapters[s.chapterIndex] || null,
    filterCss(s) {
      return `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`;
    },
    imageStyle(s) {
      // Conservé pour zoom / fit résiduels ; le strip ignore transform scale.
      return {
        transform: s.transform,
        transformOrigin: 'center center',
        willChange: 'transform',
        filter: `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`,
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
        this.fitMode = prefs.defaultFitMode || 'fit-height';
        this.brightness = prefs.brightness ?? 1;
        this.contrast = prefs.contrast ?? 1;
        this.sepia = prefs.sepia ?? 0;
      } catch {
        // ignore
      }
    },
    async persistPrefs(patch) {
      try {
        // Pref legacy webtoon ignorée : strip vertical = défaut.
        const safe = { ...(patch || {}) };
        delete safe.webtoonMode;
        const prefs = await window.vdr.profiles.setPrefs(safe);
        this.brightness = prefs.brightness ?? this.brightness;
        this.contrast = prefs.contrast ?? this.contrast;
        this.sepia = prefs.sepia ?? this.sepia;
        if (prefs.readingDirection) this.direction = prefs.readingDirection;
        if (prefs.defaultFitMode) this.fitMode = prefs.defaultFitMode;
      } catch {
        // ignore
      }
    },
    async open(filePath, { resume = true } = {}) {
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
        this.pageCount = meta.pageCount;
        this.chapters = meta.chapters || [];
        this.chapterIndex = 0;
        this.renderEngine = meta.renderEngine || meta.format || null;
        this.resetTransform();

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
        await this.loadCurrentPage({ scrollToCurrent: true });
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
      await this.loadStripWindow();
      if (scrollToCurrent) this.requestStripScroll();
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
     * Prefetch hors fenêtre DOM (voisines ±STRIP_PREFETCH).
     * Ne bloque pas le rendu de la fenêtre visible.
     */
    async prefetchNeighbors(center = this.pageIndex) {
      const { start, end } = stripPrefetchRange(center, this.pageCount);
      const win = stripWindowRange(center, this.pageCount);
      const jobs = [];
      for (let i = start; i <= end; i += 1) {
        if (i < win.start || i > win.end) jobs.push(this.ensurePageUrl(i));
      }
      if (jobs.length) await Promise.all(jobs);
      this.trimPageCache(center);
    },
    /** Garde fenêtre strip + prefetch ; révoque le reste. */
    trimPageCache(center = this.pageIndex) {
      const { start, end } = stripPrefetchRange(center, this.pageCount);
      const keep = new Set();
      for (let i = start; i <= end; i += 1) keep.add(i);
      const stripUrls = new Set(this.stripPages.map((p) => p.url).filter(Boolean));
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
    async revokeStrip() {
      // URLs détenues par _pageUrlCache — ne pas double-revoke.
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
      await this.close();
      await this.open(offer.filePath, { resume: false });
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
      this.scale = 1;
      this.targetScale = 1;
      await this.revokeStrip();
      this.revokePageCache();
      this.pageUrl = null;
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
      if (this._zoomRaf != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._zoomRaf);
      }
      this._zoomRaf = null;
      if (this._zoomTransitionTimer) {
        clearTimeout(this._zoomTransitionTimer);
        this._zoomTransitionTimer = null;
      }
      this.zoomTransition = false;
    },
    /**
     * Ancre pan au centre écran pour un changement d’échelle.
     * Mesure stage/page (fit + rotate) ; fallback centre image si pas de DOM.
     */
    panAnchoredForScale(fromPanX, fromPanY, fromScale, toScale) {
      pinReaderOverflow();
      const geom = measureReaderZoomGeometry();
      if (geom && geom.stageW > 0 && geom.stageH > 0) {
        return panForZoomToScreenCenter(
          fromPanX,
          fromPanY,
          fromScale,
          toScale,
          geom,
        );
      }
      return panForZoomToCenter(fromPanX, fromPanY, fromScale, toScale);
    },
    /**
     * Applique une échelle en ancrant le point sous le centre du viewport
     * (écran → local image → nouveau pan ; voir `panForZoomToScreenCenter`).
     */
    applyScaleAtCenter(nextScale) {
      const to = clampScale(nextScale);
      const from = this.scale;
      if (from !== 0 && Math.abs(to - from) >= 1e-9) {
        const anchored = this.panAnchoredForScale(this.panX, this.panY, from, to);
        this.panX = anchored.panX;
        this.panY = anchored.panY;
      }
      this.scale = to;
      pinReaderOverflow();
    },
    /**
     * Interpole `scale` → `targetScale` en ~200 ms ease-out (rAF).
     * Conservé pour chemins fit/zoom résiduels ; strip vertical n’y passe pas.
     * Chaque frame ancre le zoom au centre écran (pas de dérive / faux scroll).
     */
    animateScaleTo(target, { duration = ZOOM_ANIM_MS } = {}) {
      const to = clampScale(target);
      this.targetScale = to;
      if (typeof requestAnimationFrame !== 'function') {
        this.applyScaleAtCenter(to);
        return;
      }
      if (this._zoomRaf != null) cancelAnimationFrame(this._zoomRaf);
      const fromScale = this.scale;
      const fromPanX = this.panX;
      const fromPanY = this.panY;
      // Géométrie figée au départ (fit CSS stable pendant le lerp scale).
      const geom = measureReaderZoomGeometry();
      const anchor = (panX, panY, from, s) => {
        pinReaderOverflow();
        if (geom && geom.stageW > 0 && geom.stageH > 0) {
          return panForZoomToScreenCenter(panX, panY, from, s, geom);
        }
        return panForZoomToCenter(panX, panY, from, s);
      };
      if (Math.abs(to - fromScale) < 0.0005) {
        this.applyScaleAtCenter(to);
        this._zoomRaf = null;
        return;
      }
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const ease = 1 - (1 - t) ** 3;
        const s = fromScale + (to - fromScale) * ease;
        // Ancre depuis l’état de départ (évite la dérive flottante frame à frame).
        const anchored = anchor(fromPanX, fromPanY, fromScale, s);
        this.panX = anchored.panX;
        this.panY = anchored.panY;
        this.scale = s;
        if (t < 1) {
          this._zoomRaf = requestAnimationFrame(step);
        } else {
          const finalPan = anchor(fromPanX, fromPanY, fromScale, to);
          this.panX = finalPan.panX;
          this.panY = finalPan.panY;
          this.scale = to;
          this._zoomRaf = null;
          pinReaderOverflow();
        }
      };
      this._zoomRaf = requestAnimationFrame(step);
    },
    /** Transition CSS width/height pour toggle fit L3. */
    pulseZoomTransition(ms = ZOOM_ANIM_MS + 40) {
      this.zoomTransition = true;
      if (this._zoomTransitionTimer) clearTimeout(this._zoomTransitionTimer);
      this._zoomTransitionTimer = setTimeout(() => {
        this.zoomTransition = false;
        this._zoomTransitionTimer = null;
      }, ms);
    },
    resetTransform() {
      this.clearZoomAnim();
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
      this.targetScale = 1;
    },
    /**
     * Pan en repère local du plan lecteur (après visualPanToLocal = +90° CW
     * si CSS rotate). Sous rotate(90deg) : local(+X)→bas écran, local(+Y)→gauche.
     */
    pan(dx, dy, speed = 14) {
      // Strip vertical : fallback si pas de .reader__strip (scroll natif prioritaire).
      this.panY += dy * speed * 1.8;
      this.panX += dx * speed * 0.25;
    },
    zoomBy(_steps) {
      // Strip vertical fit-width : zoom D-Pad désactivé (bindings → stepPage côté gamepad).
    },
    /**
     * L3 / R3 — no-op en strip vertical (pages déjà largeur 100 %).
     * Binding conservé pour ne pas casser le remap utilisateur.
     * Ancien toggle fit-width/fit-height retiré du chemin lecture.
     */
    toggleZoom() {
      // strip default : fit width implicite (fit-width / fit-height N/A)
    },
    /** LB — no-op (strip déjà largeur pleine). */
    setFitWidth() {
      // strip default
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
      await this.loadCurrentPage({ scrollToCurrent: true });
      this.flashHud(900);
    },
    async stepPage(which) {
      const dir = this.direction === 'rtl' ? -1 : 1;
      const delta = which === 'next' ? dir : -dir;
      const next = this.pageIndex + delta;
      if (next < 0 || next >= this.pageCount) {
        if (which === 'next' && this.isFinished) await this.checkAdjacentVolumes();
        return false;
      }
      this.pageIndex = next;
      await this.loadCurrentPage({ scrollToCurrent: true });
      this.flashHud(900);
      return true;
    },
    async stepChapter(dir) {
      if (!this.chapters.length) {
        const next = Math.min(
          this.pageCount - 1,
          Math.max(0, this.pageIndex + dir * 10),
        );
        if (next === this.pageIndex) return false;
        this.pageIndex = next;
        await this.loadCurrentPage({ scrollToCurrent: true });
        this.flashHud(900);
        return true;
      }
      const nextIdx = this.chapterIndex + dir;
      if (nextIdx < 0 || nextIdx >= this.chapters.length) return false;
      this.chapterIndex = nextIdx;
      this.pageIndex = this.chapters[nextIdx].startIndex;
      await this.loadCurrentPage({ scrollToCurrent: true });
      this.flashHud(900);
      return true;
    },
  },
});
