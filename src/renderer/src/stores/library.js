import { defineStore } from 'pinia';

const RECENT_LIMIT = 14;

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

function sortByAccess(a, b) {
  return String(b.lastAccess || '').localeCompare(String(a.lastAccess || ''));
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
    readingCursor: 0,
    heroIndex: 0,
    /** @type {'nav' | 'hero' | 'watching' | 'filters' | 'trending' | 'recent' | 'series'} */
    focusZone: 'hero',
    /** @type {'board' | 'recent' | 'series'} */
    catalogTab: 'board',
    expandedSeriesId: null,
    loading: false,
    root: null,
    importRoot: null,
    continueBook: null,
    lastAccessedBook: null,
    filter: 'all',
    filterIndex: 0,
    columns: 6,
    profileName: '',
  }),
  getters: {
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
    readingBooks(s) {
      return s.books
        .filter((b) => b.status === 'reading')
        .sort(sortByAccess)
        .slice(0, 8);
    },
    trendingBooks(s) {
      // « Tendances » = récents + en cours mélangés, sinon toute la biblio
      const reading = s.books.filter((b) => b.status === 'reading');
      const rest = s.books
        .filter((b) => b.status !== 'reading')
        .slice()
        .sort(sortByCreatedDesc);
      const merged = [...reading, ...rest];
      return (merged.length ? merged : s.books.slice().sort(sortByTitle)).slice(
        0,
        18,
      );
    },
    heroBook(s) {
      if (s.continueBook) return s.continueBook;
      if (s.lastAccessedBook) return s.lastAccessedBook;
      if (s.recentBooks[0]) return s.recentBooks[0];
      return s.books[0] || null;
    },
    heroSlides(s) {
      const slides = [];
      if (s.continueBook) slides.push(s.continueBook);
      if (s.lastAccessedBook && s.lastAccessedBook.id !== s.continueBook?.id) {
        slides.push(s.lastAccessedBook);
      }
      for (const b of s.recentBooks) {
        if (slides.length >= 4) break;
        if (!slides.some((x) => x.id === b.id)) slides.push(b);
      }
      return slides;
    },
    isEmpty: (s) => !s.books.length,
    seriesList(s) {
      const groups = s.seriesGroups || [];
      if (s.filter === 'all') return groups;
      return groups.filter((g) => g.status === s.filter);
    },
    selected() {
      if (this.focusZone === 'hero') return this.heroSlides[this.heroIndex] || this.heroBook;
      if (this.focusZone === 'watching') return this.readingBooks[this.readingCursor] || null;
      if (this.focusZone === 'recent') return this.recentBooks[this.recentCursor] || null;
      if (this.focusZone === 'trending') return this.trendingBooks[this.cursor] || null;
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
    filters() {
      return [
        { id: 'all', label: 'Tous' },
        { id: 'reading', label: 'En cours' },
        { id: 'unread', label: 'Non lus' },
        { id: 'finished', label: 'Terminés' },
      ];
    },
  },
  actions: {
    syncColumns() {
      this.columns = 6;
    },
    async refresh() {
      this.loading = true;
      try {
        const config = await window.vdr.getConfig();
        this.root = config.libraryRoot;
        this.importRoot = config.importRoot;
        this.syncColumns();
        try {
          const active = await window.vdr.profiles.getActive();
          this.profileName = active?.profile?.name || '';
        } catch {
          this.profileName = '';
        }
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
        this.cursor = Math.min(this.cursor, Math.max(0, this.trendingBooks.length - 1));
        this.recentCursor = Math.min(
          this.recentCursor,
          Math.max(0, this.recentBooks.length - 1),
        );
        this.seriesCursor = Math.min(
          this.seriesCursor,
          Math.max(0, this.seriesList.length - 1),
        );
        this.heroIndex = Math.min(
          this.heroIndex,
          Math.max(0, this.heroSlides.length - 1),
        );
        if (this.focusZone === 'nav' || this.focusZone === 'filters') {
          /* keep */
        } else if (!this.books.length) {
          this.focusZone = 'hero';
        }
        const warm = [
          ...this.heroSlides.map((b) => b.id),
          ...this.trendingBooks.slice(0, 10).map((b) => b.id),
          ...this.readingBooks.slice(0, 6).map((b) => b.id),
        ];
        await Promise.all([...new Set(warm)].map((id) => this.ensureCover(id)));
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
    setCatalogTab(tab) {
      this.catalogTab = tab;
      if (tab === 'series') {
        this.focusZone = 'series';
        this.seriesCursor = 0;
      } else if (tab === 'recent') {
        this.focusZone = 'recent';
        this.recentCursor = 0;
      } else {
        this.focusZone = 'hero';
      }
    },
    cycleCatalogTab(dir = 1) {
      const tabs = ['board', 'recent', 'series'];
      const i = tabs.indexOf(this.catalogTab);
      this.setCatalogTab(tabs[(i + dir + tabs.length) % tabs.length]);
    },
    focusHero(index = 0) {
      this.focusZone = 'hero';
      this.heroIndex = Math.max(0, Math.min(index, Math.max(0, this.heroSlides.length - 1)));
    },
    focusWatching(index = 0) {
      if (!this.readingBooks.length) return false;
      this.focusZone = 'watching';
      this.readingCursor = Math.max(
        0,
        Math.min(index, this.readingBooks.length - 1),
      );
      return true;
    },
    focusTrending(index = 0) {
      if (!this.trendingBooks.length) return false;
      this.focusZone = 'trending';
      this.cursor = Math.max(0, Math.min(index, this.trendingBooks.length - 1));
      return true;
    },
    focusRecent(index = 0) {
      if (!this.recentBooks.length) return false;
      this.focusZone = 'recent';
      this.recentCursor = Math.max(0, Math.min(index, this.recentBooks.length - 1));
      return true;
    },
    focusGrid(index = 0) {
      return this.focusTrending(index);
    },
    focusSeries(index = 0) {
      if (!this.seriesList.length) return false;
      this.catalogTab = 'series';
      this.focusZone = 'series';
      this.seriesCursor = Math.max(0, Math.min(index, this.seriesList.length - 1));
      return true;
    },
    setFilter(filter) {
      this.filter = filter;
      const idx = this.filters.findIndex((f) => f.id === filter);
      this.filterIndex = idx >= 0 ? idx : 0;
      this.cursor = 0;
    },
    cycleFilter(dir = 1) {
      const order = this.filters;
      const i = order.findIndex((f) => f.id === this.filter);
      const next = order[(i + dir + order.length) % order.length];
      this.setFilter(next.id);
    },
    toggleViewMode() {
      this.cycleCatalogTab(1);
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
    /**
     * Navigation manette catalogue Movie Gather.
     * Zones verticales : hero/watching → filters → trending → recent
     */
    moveCatalog(dx, dy) {
      if (this.catalogTab === 'series') {
        const list = this.seriesList;
        if (!list.length) return;
        this.focusZone = 'series';
        if (dy !== 0) {
          this.seriesCursor = Math.max(
            0,
            Math.min(list.length - 1, this.seriesCursor + dy),
          );
        }
        if (dx !== 0) {
          this.seriesCursor = Math.max(
            0,
            Math.min(list.length - 1, this.seriesCursor + dx),
          );
        }
        return;
      }

      if (this.catalogTab === 'recent') {
        const list = this.recentBooks;
        if (!list.length) return;
        this.focusZone = 'recent';
        this.recentCursor = Math.max(
          0,
          Math.min(list.length - 1, this.recentCursor + dx + dy * 6),
        );
        this.ensureCover(list[this.recentCursor]?.id);
        return;
      }

      // Board
      if (dy < 0) {
        if (this.focusZone === 'trending' || this.focusZone === 'recent') {
          this.focusZone = 'filters';
          return;
        }
        if (this.focusZone === 'filters') {
          this.focusZone = 'hero';
          return;
        }
        if (this.focusZone === 'watching') {
          this.focusZone = 'hero';
          return;
        }
      }
      if (dy > 0) {
        if (this.focusZone === 'hero' || this.focusZone === 'watching') {
          this.focusZone = 'filters';
          return;
        }
        if (this.focusZone === 'filters') {
          if (this.trendingBooks.length) this.focusTrending(0);
          else if (this.recentBooks.length) this.focusRecent(0);
          return;
        }
        if (this.focusZone === 'trending' && this.recentBooks.length) {
          this.focusRecent(0);
          return;
        }
      }

      if (this.focusZone === 'hero') {
        if (dx > 0 && this.readingBooks.length) {
          this.focusWatching(0);
          return;
        }
        if (dx !== 0 && this.heroSlides.length > 1) {
          this.heroIndex = Math.max(
            0,
            Math.min(this.heroSlides.length - 1, this.heroIndex + dx),
          );
          const b = this.heroSlides[this.heroIndex];
          if (b) this.ensureCover(b.id);
        }
        return;
      }

      if (this.focusZone === 'watching') {
        if (dx < 0) {
          this.focusHero(this.heroIndex);
          return;
        }
        const delta = dy !== 0 ? dy : dx;
        this.readingCursor = Math.max(
          0,
          Math.min(this.readingBooks.length - 1, this.readingCursor + delta),
        );
        this.ensureCover(this.readingBooks[this.readingCursor]?.id);
        return;
      }

      if (this.focusZone === 'filters') {
        if (dx !== 0) this.cycleFilter(dx);
        return;
      }

      if (this.focusZone === 'trending') {
        const list = this.trendingBooks;
        if (!list.length) return;
        this.cursor = Math.max(0, Math.min(list.length - 1, this.cursor + dx));
        this.ensureCover(list[this.cursor]?.id);
        return;
      }

      if (this.focusZone === 'recent') {
        const list = this.recentBooks;
        if (!list.length) return;
        this.recentCursor = Math.max(
          0,
          Math.min(list.length - 1, this.recentCursor + dx),
        );
        this.ensureCover(list[this.recentCursor]?.id);
      }
    },
  },
});
