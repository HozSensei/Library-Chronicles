import { defineStore } from 'pinia';

export const useReaderStore = defineStore('reader', {
  state: () => ({
    filePath: null,
    bookId: null,
    title: '',
    pageIndex: 0,
    pageCount: 0,
    direction: 'ltr',
    fitMode: 'fit-height',
    scale: 1,
    panX: 0,
    panY: 0,
    hudVisible: false,
    pageUrl: null,
    chapters: [],
    chapterIndex: 0,
    loading: false,
    error: null,
  }),
  getters: {
    pageLabel: (s) => `${s.pageCount ? s.pageIndex + 1 : 0} / ${s.pageCount}`,
    progress: (s) => (s.pageCount ? ((s.pageIndex + 1) / s.pageCount) * 100 : 0),
    transform: (s) => `translate3d(${s.panX}px, ${s.panY}px, 0) scale(${s.scale})`,
    currentChapter: (s) => s.chapters[s.chapterIndex] || null,
    imageStyle(s) {
      const base = {
        transform: s.transform,
        transformOrigin: 'center center',
        willChange: 'transform',
      };
      if (s.fitMode === 'fit-width') {
        return { ...base, width: '100%', height: 'auto', maxHeight: 'none' };
      }
      if (s.fitMode === 'zoom-100') {
        return { ...base, width: 'auto', height: 'auto', maxHeight: 'none' };
      }
      // fit-height (défaut)
      return { ...base, height: '100%', width: 'auto', maxWidth: 'none' };
    },
  },
  actions: {
    async open(filePath, { resume = true } = {}) {
      this.loading = true;
      this.error = null;
      try {
        const config = await window.vdr.getConfig();
        const meta = await window.vdr.reader.open(filePath);
        this.filePath = filePath;
        this.bookId = meta.bookId ?? null;
        this.title = meta.title;
        this.pageCount = meta.pageCount;
        this.chapters = meta.chapters || [];
        this.chapterIndex = 0;
        this.direction = config.readingDirection || 'ltr';
        this.fitMode = config.defaultFitMode || 'fit-height';
        this.resetTransform();

        let start = 0;
        if (resume && meta.resumePage > 0 && meta.resumePage < meta.pageCount) {
          start = meta.resumePage;
        }
        this.pageIndex = start;
        await this.loadCurrentPage();
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
      const page = await window.vdr.reader.getPage(this.pageIndex);
      if (this.pageUrl) URL.revokeObjectURL(this.pageUrl);
      if (!page?.data) {
        this.pageUrl = null;
        return;
      }
      const bin = atob(page.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: page.mime || 'image/jpeg' });
      this.pageUrl = URL.createObjectURL(blob);
      this.syncChapterIndex();
      this.persistProgress();
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
    async close() {
      await this.persistProgress();
      if (this.pageUrl) {
        URL.revokeObjectURL(this.pageUrl);
        this.pageUrl = null;
      }
      await window.vdr.reader.close();
      this.filePath = null;
      this.bookId = null;
      this.title = '';
      this.pageCount = 0;
      this.pageIndex = 0;
      this.hudVisible = false;
      this.chapters = [];
      this.error = null;
    },
    resetTransform() {
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
    },
    pan(dx, dy, speed = 14) {
      if (this.fitMode === 'fit-width') {
        // En fit-width, stick Y scroll verticalement la planche
        this.panY += dy * speed * 1.4;
        this.panX += dx * speed * 0.4;
        return;
      }
      this.panX += dx * speed;
      this.panY += dy * speed;
    },
    zoomBy(steps) {
      this.scale = Math.min(4, Math.max(0.25, this.scale + steps * 0.15));
      this.fitMode = 'custom';
    },
    toggleZoom() {
      if (this.fitMode === 'fit-height') {
        this.fitMode = 'zoom-100';
        this.scale = 1;
      } else {
        this.fitMode = 'fit-height';
        this.scale = 1;
      }
      this.panX = 0;
      this.panY = 0;
    },
    setFitWidth() {
      this.fitMode = 'fit-width';
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
    },
    toggleDirection() {
      this.direction = this.direction === 'ltr' ? 'rtl' : 'ltr';
      window.vdr.setConfig({ readingDirection: this.direction });
    },
    toggleHud() {
      this.hudVisible = !this.hudVisible;
    },
    async stepPage(which) {
      const dir = this.direction === 'rtl' ? -1 : 1;
      const delta = which === 'next' ? dir : -dir;
      const next = this.pageIndex + delta;
      if (next < 0 || next >= this.pageCount) return false;
      this.pageIndex = next;
      this.resetTransform();
      await this.loadCurrentPage();
      return true;
    },
    async stepChapter(dir) {
      if (!this.chapters.length) {
        // Pas de structure : saut ±10 pages
        const next = Math.min(
          this.pageCount - 1,
          Math.max(0, this.pageIndex + dir * 10),
        );
        if (next === this.pageIndex) return false;
        this.pageIndex = next;
        this.resetTransform();
        await this.loadCurrentPage();
        return true;
      }
      const nextIdx = this.chapterIndex + dir;
      if (nextIdx < 0 || nextIdx >= this.chapters.length) return false;
      this.chapterIndex = nextIdx;
      this.pageIndex = this.chapters[nextIdx].startIndex;
      this.resetTransform();
      await this.loadCurrentPage();
      return true;
    },
  },
});
