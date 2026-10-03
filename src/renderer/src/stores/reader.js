import { defineStore } from 'pinia';
import { ZOOM_STEP } from '../../../shared/gamepad-codes.js';
import { panForZoomToCenter } from '../../../shared/zoom-anchor.js';

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
    /** Pages empilées mode webtoon { index, url } */
    stripPages: [],
    chapters: [],
    chapterIndex: 0,
    bookmarks: [],
    bookmarkFlash: null,
    nextVolumeOffer: null,
    webtoonMode: false,
    brightness: 1,
    contrast: 1,
    sepia: 0,
    loading: false,
    error: null,
    renderEngine: null,
    _hudTimer: null,
    _zoomRaf: null,
    _zoomTransitionTimer: null,
  }),
  getters: {
    pageLabel: (s) => `${s.pageCount ? s.pageIndex + 1 : 0} / ${s.pageCount}`,
    progress: (s) => (s.pageCount ? ((s.pageIndex + 1) / s.pageCount) * 100 : 0),
    transform: (s) => `translate3d(${s.panX}px, ${s.panY}px, 0) scale(${s.scale})`,
    currentChapter: (s) => s.chapters[s.chapterIndex] || null,
    filterCss(s) {
      return `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`;
    },
    imageStyle(s) {
      // Fit height/width : CSS [data-fit] sur .reader__stage (repère plan local).
      // Ici uniquement pan / scale / filtres — évite de combattre object-fit.
      const base = {
        transform: s.transform,
        transformOrigin: 'center center',
        willChange: 'transform',
        filter: `brightness(${s.brightness}) contrast(${s.contrast}) sepia(${s.sepia})`,
      };
      if (s.webtoonMode) {
        return { ...base, transform: 'none' };
      }
      return base;
    },
    isFinished(s) {
      return s.pageCount > 0 && s.pageIndex + 1 >= s.pageCount;
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
        this.webtoonMode = Boolean(prefs.webtoonMode);
        this.brightness = prefs.brightness ?? 1;
        this.contrast = prefs.contrast ?? 1;
        this.sepia = prefs.sepia ?? 0;
      } catch {
        // ignore
      }
    },
    async persistPrefs(patch) {
      try {
        const prefs = await window.vdr.profiles.setPrefs(patch);
        this.webtoonMode = Boolean(prefs.webtoonMode);
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
      this.nextVolumeOffer = null;
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

        // Métadonnées série depuis la bibliothèque
        try {
          const books = await window.vdr.library.list();
          const book = books.find((b) => b.filePath === filePath || b.id === meta.bookId);
          if (book) {
            this.bookId = book.id;
            this.series = book.series;
            this.seriesId = book.seriesId;
            this.volume = book.volume;
            this.title = book.title || this.title;
          }
        } catch {
          // ignore
        }

        let start = 0;
        if (resume && meta.resumePage > 0 && meta.resumePage < meta.pageCount) {
          start = meta.resumePage;
        }
        this.pageIndex = start;
        await this.loadCurrentPage();
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
    async loadCurrentPage() {
      if (!this.filePath || this.pageCount === 0) return;
      if (this.webtoonMode) {
        await this.loadStripWindow();
      } else {
        await this.revokeStrip();
        const page = await window.vdr.reader.getPage(this.pageIndex);
        if (this.pageUrl) URL.revokeObjectURL(this.pageUrl);
        if (!page?.data) {
          this.pageUrl = null;
          return;
        }
        this.pageUrl = this.blobUrlFromPage(page);
        if (page.engine) this.renderEngine = page.engine;
      }
      this.syncChapterIndex();
      this.persistProgress();
      if (this.isFinished) await this.checkNextVolume();
    },
    blobUrlFromPage(page) {
      const bin = atob(page.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: page.mime || 'image/jpeg' });
      return URL.createObjectURL(blob);
    },
    async revokeStrip() {
      for (const p of this.stripPages) {
        if (p.url) URL.revokeObjectURL(p.url);
      }
      this.stripPages = [];
    },
    async loadStripWindow() {
      const start = Math.max(0, this.pageIndex - 1);
      const end = Math.min(this.pageCount - 1, this.pageIndex + 4);
      const keep = new Map(this.stripPages.map((p) => [p.index, p]));
      const next = [];
      for (let i = start; i <= end; i += 1) {
        if (keep.has(i)) {
          next.push(keep.get(i));
          keep.delete(i);
        } else {
          const page = await window.vdr.reader.getPage(i);
          if (page?.data) {
            next.push({ index: i, url: this.blobUrlFromPage(page) });
          }
        }
      }
      for (const orphan of keep.values()) {
        if (orphan.url) URL.revokeObjectURL(orphan.url);
      }
      this.stripPages = next;
      // Page « courante » aussi en pageUrl pour compat
      const cur = next.find((p) => p.index === this.pageIndex);
      if (this.pageUrl && !this.stripPages.some((p) => p.url === this.pageUrl)) {
        // pageUrl peut être partagé avec strip — ne pas revoke si encore utilisé
      }
      this.pageUrl = cur?.url || null;
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
    async checkNextVolume() {
      if (!this.seriesId) {
        this.nextVolumeOffer = null;
        return;
      }
      try {
        const next = await window.vdr.library.nextUnread({
          seriesId: this.seriesId,
          afterBookId: this.bookId,
          afterVolume: this.volume,
        });
        this.nextVolumeOffer =
          next && next.id !== this.bookId ? next : null;
      } catch {
        this.nextVolumeOffer = null;
      }
    },
    async openNextVolume() {
      if (!this.nextVolumeOffer?.filePath) {
        await this.checkNextVolume();
      }
      const next = this.nextVolumeOffer;
      if (!next?.filePath) return false;
      await this.close();
      await this.open(next.filePath);
      return true;
    },
    async close() {
      await this.persistProgress();
      this.closeHud();
      this.clearZoomAnim();
      this.scale = 1;
      this.targetScale = 1;
      await this.revokeStrip();
      if (this.pageUrl) {
        // peut déjà être révoqué via strip
        try {
          URL.revokeObjectURL(this.pageUrl);
        } catch {
          // ignore
        }
        this.pageUrl = null;
      }
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
      this.nextVolumeOffer = null;
      this.error = null;
      this.renderEngine = null;
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
     * Applique une échelle en ancrant le point sous le centre du viewport
     * (ajuste panX/panY — voir `panForZoomToCenter`).
     */
    applyScaleAtCenter(nextScale) {
      const to = clampScale(nextScale);
      const from = this.scale;
      if (from !== 0 && Math.abs(to - from) >= 1e-9) {
        const anchored = panForZoomToCenter(this.panX, this.panY, from, to);
        this.panX = anchored.panX;
        this.panY = anchored.panY;
      }
      this.scale = to;
    },
    /**
     * Interpole `scale` → `targetScale` en ~200 ms ease-out (rAF).
     * Le pas logique reste ±ZOOM_STEP ; seul le rendu est lissé.
     * Chaque frame ancre le zoom au centre (pas de dérive / faux scroll).
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
        const anchored = panForZoomToCenter(fromPanX, fromPanY, fromScale, s);
        this.panX = anchored.panX;
        this.panY = anchored.panY;
        this.scale = s;
        if (t < 1) {
          this._zoomRaf = requestAnimationFrame(step);
        } else {
          const finalPan = panForZoomToCenter(fromPanX, fromPanY, fromScale, to);
          this.panX = finalPan.panX;
          this.panY = finalPan.panY;
          this.scale = to;
          this._zoomRaf = null;
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
      if (this.webtoonMode) {
        // Scroll vertical principal
        this.panY += dy * speed * 1.8;
        this.panX += dx * speed * 0.25;
        // Avancer/reculer page si défilement important
        if (Math.abs(dy) > 0.55) {
          // laissé au composant scroll natif ; panY sert de fallback
        }
        return;
      }
      if (this.fitMode === 'fit-width') {
        this.panY += dy * speed * 1.4;
        this.panX += dx * speed * 0.4;
        return;
      }
      this.panX += dx * speed;
      this.panY += dy * speed;
    },
    scrollWebtoon(deltaY) {
      this.panY += deltaY;
    },
    zoomBy(steps) {
      if (this.webtoonMode) return;
      // Garder le gabarit CSS fit courant (height/width %) : le zoom D-Pad
      // multiplie uniquement via transform scale ancré au centre.
      // Passer en `custom` (taille naturelle) provoquait un saut vertical.
      this.animateScaleTo(this.targetScale + Number(steps) * ZOOM_STEP);
    },
    /**
     * L3 / R3 — toggle Fit Height ↔ Fit Width (bord à bord gauche-droite).
     *
     * Fit Width = la planche prend 100 % de la **largeur utilisateur** du
     * viewport lecture. Sous plan CSS `rotate(90deg)` + Ally CCW :
     *   largeur utilisateur = largeur locale du stage (`.reader__stage` /
     *   `.reader__plane` `clientWidth` = 100vh fenêtre).
     * CSS : `width: 100%; height: auto` + `scale` transform = 1
     * (équivalent scale = stageLocalWidth / pageNaturalWidth si on partait
     * du natural size).
     *
     * Déjà en fit-width → retour Fit Height ; sinon → Fit Width
     * (depuis fit-height, zoom-100 ou échelle custom). Animation : pulse CSS
     * width/height + animateScaleTo(1) ancré centre.
     */
    toggleZoom() {
      if (this.webtoonMode) return;
      this.pulseZoomTransition();
      this.fitMode = this.fitMode === 'fit-width' ? 'fit-height' : 'fit-width';
      this.panX = 0;
      this.panY = 0;
      this.animateScaleTo(1);
    },
    /** LB — Fit Width direct (même animation L3). */
    setFitWidth() {
      if (this.webtoonMode) return;
      this.pulseZoomTransition();
      this.fitMode = 'fit-width';
      this.panX = 0;
      this.panY = 0;
      this.animateScaleTo(1);
    },
    toggleDirection() {
      this.direction = this.direction === 'ltr' ? 'rtl' : 'ltr';
      this.persistPrefs({ readingDirection: this.direction });
      window.vdr.setConfig({ readingDirection: this.direction });
    },
    async toggleWebtoon() {
      this.webtoonMode = !this.webtoonMode;
      this.resetTransform();
      await this.persistPrefs({ webtoonMode: this.webtoonMode });
      await this.loadCurrentPage();
      this.flashHud(1200);
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
      await this.loadCurrentPage();
      this.flashHud(900);
    },
    async stepPage(which) {
      const dir = this.direction === 'rtl' ? -1 : 1;
      const delta = which === 'next' ? dir : -dir;
      const next = this.pageIndex + delta;
      if (next < 0 || next >= this.pageCount) {
        if (which === 'next' && this.isFinished) await this.checkNextVolume();
        return false;
      }
      this.pageIndex = next;
      if (!this.webtoonMode) this.resetTransform();
      await this.loadCurrentPage();
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
        if (!this.webtoonMode) this.resetTransform();
        await this.loadCurrentPage();
        this.flashHud(900);
        return true;
      }
      const nextIdx = this.chapterIndex + dir;
      if (nextIdx < 0 || nextIdx >= this.chapters.length) return false;
      this.chapterIndex = nextIdx;
      this.pageIndex = this.chapters[nextIdx].startIndex;
      if (!this.webtoonMode) this.resetTransform();
      await this.loadCurrentPage();
      this.flashHud(900);
      return true;
    },
  },
});
