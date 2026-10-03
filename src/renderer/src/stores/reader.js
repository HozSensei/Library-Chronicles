import { defineStore } from 'pinia';

export const useReaderStore = defineStore('reader', {
  state: () => ({
    filePath: null,
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
  }),
  getters: {
    pageLabel: (s) => `${s.pageCount ? s.pageIndex + 1 : 0} / ${s.pageCount}`,
    progress: (s) => (s.pageCount ? ((s.pageIndex + 1) / s.pageCount) * 100 : 0),
    transform: (s) => `translate3d(${s.panX}px, ${s.panY}px, 0) scale(${s.scale})`,
  },
  actions: {
    async open(filePath) {
      const meta = await window.vdr.reader.open(filePath);
      this.filePath = filePath;
      this.title = meta.title;
      this.pageCount = meta.pageCount;
      this.pageIndex = 0;
      this.resetTransform();
      // TODO[Phase 1]: charger page 0
      return meta;
    },
    async close() {
      if (this.pageUrl) {
        URL.revokeObjectURL(this.pageUrl);
        this.pageUrl = null;
      }
      await window.vdr.reader.close();
      this.filePath = null;
      this.title = '';
      this.pageCount = 0;
      this.pageIndex = 0;
      this.hudVisible = false;
    },
    resetTransform() {
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
      this.fitMode = 'fit-height';
    },
    pan(dx, dy, speed = 14) {
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
    toggleDirection() {
      this.direction = this.direction === 'ltr' ? 'rtl' : 'ltr';
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
      // TODO[Phase 1]: getPage
      return true;
    },
  },
});
