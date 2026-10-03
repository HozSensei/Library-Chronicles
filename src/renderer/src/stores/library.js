import { defineStore } from 'pinia';

const RECENT_LIMIT = 12;

function sortByCreatedDesc(a, b) {
  const ca = a.createdAt || '';
  const cb = b.createdAt || '';
  if (ca && cb) return String(cb).localeCompare(String(ca));
  if (ca) return -1;
  if (cb) return 1;
  return Number(b.id) - Number(a.id);
}

function sortByTitle(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''), 'fr', {
    sensitivity: 'base',
  });
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    books: [],
    seriesGroups: [],
    seriesSingles: [],
    covers: {},
    coverPending: {},
    cursor: 0,
    recentCursor: 0,
    seriesCursor: 0,
    /** @type {'grid' | 'series'} */
    focusZone: 'grid',
    /** @type {'books' | 'series'} */
    viewMode: 'books',
    expandedSeriesId: null,
    loading: false,
    root: null,
    importRoot: null,
    continueBook: null,
    lastAccessedBook: null,
    filter: 'all',
    /** Grille Steam OS landscape : 6 colonnes. */
    columns: 6,
  }),
  getters: {
    isLandscapeGrid: (s) => s.columns >= 5,
    filtered(s) {
      let list = s.books;
      if (s.filter !== 'all') {
        list = list.filter((b) => b.status === s.filter);
      }
      return list.slice().sort(sortByTitle);
    },
    recentBooks(s) {
      return s.books.slice().sort(sortByCreatedDesc).slice(0, RECENT_LIMIT);
    },
    isEmpty: (s) => !s.books.length,
    seriesList(s) {
      const groups = s.seriesGroups || [];
      if (s.filter === 'all') return groups;
      return groups.filter((g) => g.status === s.filter);
    },
    selected() {
      if (this.focusZone === 'series') {
        const g = this.seriesList[this.seriesCursor];
        if (!g) return null;
        return g.nextUnread || g.volumes[0] || null;
      }
      return this.filtered[this.cursor] || null;
    },
    selectedSeries() {
      if (this.focusZone !== 'series') return null;
      return this.seriesList[this.seriesCursor] || null;
    },
    getBookById() {
      return (id) => this.books.find((b) => String(b.id) === String(id)) || null;
    },
  },
  actions: {
    syncColumns(orientation) {
      // Menus toujours landscape → 6 cols ; portrait lecture n’affecte pas la grille
      this.columns = orientation === 'portrait-ccw' ? 3 : 6;
    },
    async refresh() {
      this.loading = true;
      try {
        const config = await window.vdr.getConfig();
        this.root = config.libraryRoot;
        this.importRoot = config.importRoot;
        this.syncColumns('landscape');
        this.books = (await window.vdr.library.list()) || [];
        try {
          const series = await window.vdr.library.series();
          this.seriesGroups = series?.groups || [];
          this.seriesSingles = series?.singles || [];
        } catch {
          this.seriesGroups = [];
          this.seriesSingles = [];
        }
        this.continueBook = (await window.vdr.library.continue()) || null;
        const excludeId = this.continueBook?.id ?? null;
        this.lastAccessedBook =
          (await window.vdr.library.lastAccessed?.(excludeId)) ||
          this.books
            .filter((b) => b.lastAccess && b.id !== excludeId)
            .sort((a, b) => String(b.lastAccess).localeCompare(String(a.lastAccess)))[0] ||
          null;
        this.cursor = Math.min(this.cursor, Math.max(0, this.filtered.length - 1));
        this.seriesCursor = Math.min(
          this.seriesCursor,
          Math.max(0, this.seriesList.length - 1),
        );
        this.focusZone = this.viewMode === 'series' ? 'series' : 'grid';
        const warm = this.filtered.slice(0, 18).map((b) => b.id);
        for (const g of this.seriesList.slice(0, 8)) {
          if (g.coverBookId) warm.push(g.coverBookId);
        }
        await Promise.all(warm.map((id) => this.ensureCover(id)));
      } finally {
        this.loading = false;
      }
    },
    async scan() {
      this.loading = true;
      try {
        await window.vdr.library.scan();
        await this.refresh();
      } finally {
        this.loading = false;
      }
    },
    async ensureCover(id) {
      if (id == null) return null;
      if (this.covers[id]) return this.covers[id];
      if (this.coverPending[id]) return this.coverPending[id];
      this.coverPending[id] = (async () => {
        try {
          const url = await window.vdr.library.getCover(id);
          if (url) this.covers[id] = url;
          return url;
        } catch {
          return null;
        } finally {
          delete this.coverPending[id];
        }
      })();
      return this.coverPending[id];
    },
    focusGrid(index = 0) {
      if (!this.filtered.length) return false;
      this.focusZone = 'grid';
      this.cursor = Math.max(0, Math.min(index, this.filtered.length - 1));
      return true;
    },
    selectBookInGrid(bookId) {
      const idx = this.filtered.findIndex((b) => b.id === bookId);
      if (idx < 0) return;
      this.focusZone = 'grid';
      this.cursor = idx;
    },
    setFilter(filter) {
      this.filter = filter;
      this.cursor = 0;
    },
    cycleFilter(dir = 1) {
      const order = ['all', 'reading', 'unread', 'finished'];
      const i = order.indexOf(this.filter);
      this.setFilter(order[(i + dir + order.length) % order.length]);
    },
    toggleViewMode() {
      this.viewMode = this.viewMode === 'books' ? 'series' : 'books';
      this.expandedSeriesId = null;
      if (this.viewMode === 'series') {
        this.focusZone = 'series';
        this.seriesCursor = 0;
      } else {
        this.focusZone = 'grid';
      }
    },
    focusSeries(index = 0) {
      if (!this.seriesList.length) return false;
      this.viewMode = 'series';
      this.focusZone = 'series';
      this.seriesCursor = Math.max(0, Math.min(index, this.seriesList.length - 1));
      return true;
    },
    toggleExpandSeries() {
      const g = this.seriesList[this.seriesCursor];
      if (!g) return;
      this.expandedSeriesId =
        this.expandedSeriesId === g.seriesId ? null : g.seriesId;
    },
    async nextUnreadForSelected() {
      const g = this.selectedSeries;
      if (!g?.seriesId) return this.selected;
      try {
        const next = await window.vdr.library.nextUnread({
          seriesId: g.seriesId,
        });
        return next || g.nextUnread || g.volumes[0] || null;
      } catch {
        return g.nextUnread || g.volumes[0] || null;
      }
    },
    moveCatalog(dx, dy) {
      if (this.viewMode === 'series' && this.focusZone === 'series') {
        const list = this.seriesList;
        if (!list.length) return;
        if (dy !== 0) {
          this.seriesCursor = Math.max(
            0,
            Math.min(list.length - 1, this.seriesCursor + dy),
          );
        }
        if (dx !== 0) this.toggleExpandSeries();
        const g = list[this.seriesCursor];
        if (g?.coverBookId) this.ensureCover(g.coverBookId);
        return;
      }

      const list = this.filtered;
      if (!list.length) return;
      const cols = this.columns;
      const row = Math.floor(this.cursor / cols);
      const col = this.cursor % cols;
      let nextRow = row + dy;
      let nextCol = col + dx;
      if (nextCol < 0) nextCol = cols - 1;
      if (nextCol >= cols) nextCol = 0;
      const rows = Math.ceil(list.length / cols);
      if (nextRow < 0) nextRow = 0;
      if (nextRow >= rows) nextRow = rows - 1;
      let next = nextRow * cols + nextCol;
      if (next >= list.length) next = list.length - 1;
      this.cursor = next;
      this.ensureCover(list[next]?.id);
    },
  },
});
