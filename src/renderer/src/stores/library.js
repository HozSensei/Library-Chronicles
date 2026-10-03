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
    /** @type {'hero' | 'recent' | 'grid' | 'series'} */
    focusZone: 'hero',
    /** @type {'books' | 'series'} */
    viewMode: 'books',
    /** Série dépliée (seriesId) ou null */
    expandedSeriesId: null,
    loading: false,
    root: null,
    importRoot: null,
    continueBook: null,
    lastAccessedBook: null,
    filter: 'all', // all | reading | unread | finished
    /** Colonnes grille — 3 portrait Ally, 6 landscape desktop. */
    columns: 3,
  }),
  getters: {
    isLandscapeGrid: (s) => s.columns >= 6,
    filtered(s) {
      let list = s.books;
      if (s.filter !== 'all') {
        list = list.filter((b) => b.status === s.filter);
      }
      // Catalogue : grille alphabétique pour « Tous les livres »
      return list.slice().sort(sortByTitle);
    },
    recentBooks(s) {
      return s.books.slice().sort(sortByCreatedDesc).slice(0, RECENT_LIMIT);
    },
    /** Mode héro : reading | last | invite | empty */
    heroMode(s) {
      if (s.continueBook) return 'reading';
      if (s.lastAccessedBook) return 'last';
      if (!s.books.length) return 'empty';
      return 'invite';
    },
    heroBook(s) {
      if (s.continueBook) return s.continueBook;
      if (s.lastAccessedBook) return s.lastAccessedBook;
      return s.books.slice().sort(sortByCreatedDesc)[0] || null;
    },
    seriesList(s) {
      const groups = s.seriesGroups || [];
      if (s.filter === 'all') return groups;
      return groups.filter((g) => g.status === s.filter);
    },
    selected() {
      if (this.focusZone === 'hero') return this.heroBook;
      if (this.focusZone === 'recent') {
        return this.recentBooks[this.recentCursor] || null;
      }
      if (this.focusZone === 'series') {
        const g = this.seriesList[this.seriesCursor];
        if (!g) return null;
        if (this.expandedSeriesId === g.seriesId) {
          return g.nextUnread || g.volumes[0] || null;
        }
        return g.nextUnread || g.volumes[0] || null;
      }
      const list = this.filtered;
      return list[this.cursor] || null;
    },
    selectedSeries() {
      if (this.focusZone !== 'series') return null;
      return this.seriesList[this.seriesCursor] || null;
    },
  },
  actions: {
    /** Aligne le curseur grille sur le nombre de colonnes CSS (portrait 3 / landscape 6). */
    syncColumns(orientation) {
      this.columns = orientation === 'landscape' ? 6 : 3;
    },
    async refresh() {
      this.loading = true;
      try {
        const config = await window.vdr.getConfig();
        this.root = config.libraryRoot;
        this.importRoot = config.importRoot;
        this.syncColumns(config.orientation);
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
        this.recentCursor = Math.min(
          this.recentCursor,
          Math.max(0, this.recentBooks.length - 1),
        );
        this.seriesCursor = Math.min(
          this.seriesCursor,
          Math.max(0, this.seriesList.length - 1),
        );
        if (!this.heroBook && this.filtered.length) {
          this.focusZone = this.viewMode === 'series' ? 'series' : 'grid';
        } else if (this.focusZone === 'recent' && !this.recentBooks.length) {
          this.focusZone = this.heroBook ? 'hero' : 'grid';
        }
        // Prefetch discret : héro + premiers récents (le reste via LazyCover)
        const warm = [];
        if (this.heroBook) warm.push(this.heroBook.id);
        for (const b of this.recentBooks.slice(0, 6)) warm.push(b.id);
        for (const g of this.seriesList.slice(0, 6)) {
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
    /** @deprecated préférer ensureCover + LazyCover */
    async prefetchCovers() {
      const ids = this.books.slice(0, 12).map((b) => b.id);
      await Promise.all(ids.map((id) => this.ensureCover(id)));
    },
    focusHero() {
      this.focusZone = 'hero';
    },
    focusRecent(index = 0) {
      if (!this.recentBooks.length) return false;
      this.focusZone = 'recent';
      this.recentCursor = Math.max(0, Math.min(index, this.recentBooks.length - 1));
      return true;
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
    selectBookInRecent(bookId) {
      const idx = this.recentBooks.findIndex((b) => b.id === bookId);
      if (idx < 0) return;
      this.focusZone = 'recent';
      this.recentCursor = idx;
    },
    moveCursor(delta) {
      const list = this.filtered;
      if (!list.length) return;
      this.cursor = (this.cursor + delta + list.length) % list.length;
    },
    moveCursorGrid(dx, dy) {
      // Compat : délègue à la navigation catalogue
      this.moveCatalog(dx, dy);
    },
    setFilter(filter) {
      this.filter = filter;
      this.cursor = 0;
      if (this.focusZone === 'grid' && !this.filtered.length) {
        this.focusZone = this.heroBook ? 'hero' : 'recent';
      }
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
        this.focusZone = this.seriesList.length ? 'series' : 'hero';
        this.seriesCursor = 0;
      } else if (this.focusZone === 'series') {
        this.focusZone = this.filtered.length ? 'grid' : 'hero';
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
        if (!list.length) {
          this.focusZone = 'hero';
          return;
        }
        if (dy < 0 && this.seriesCursor < 1) {
          this.focusZone = 'hero';
          return;
        }
        if (dy !== 0) {
          this.seriesCursor = Math.max(
            0,
            Math.min(list.length - 1, this.seriesCursor + dy),
          );
        }
        if (dx !== 0) {
          this.toggleExpandSeries();
        }
        const g = list[this.seriesCursor];
        if (g?.coverBookId) this.ensureCover(g.coverBookId);
        return;
      }

      if (this.focusZone === 'hero') {
        if (dy > 0) {
          if (this.viewMode === 'series') {
            if (!this.focusSeries(0)) this.focusGrid(0);
          } else if (!this.focusRecent(0)) this.focusGrid(0);
        }
        return;
      }

      if (this.focusZone === 'recent') {
        const list = this.recentBooks;
        if (!list.length) {
          this.focusZone = this.heroBook ? 'hero' : 'grid';
          return;
        }
        if (dy < 0) {
          this.focusZone = 'hero';
          return;
        }
        if (dy > 0) {
          this.focusGrid(0);
          return;
        }
        if (dx !== 0) {
          this.recentCursor = (this.recentCursor + dx + list.length) % list.length;
          this.ensureCover(list[this.recentCursor]?.id);
        }
        return;
      }

      // grid
      const list = this.filtered;
      if (!list.length) {
        if (this.recentBooks.length) this.focusRecent(0);
        else this.focusZone = 'hero';
        return;
      }
      const cols = this.columns;
      const row = Math.floor(this.cursor / cols);
      const col = this.cursor % cols;

      if (dy < 0 && row === 0) {
        if (!this.focusRecent(Math.min(col, this.recentBooks.length - 1))) {
          this.focusZone = 'hero';
        }
        return;
      }

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
