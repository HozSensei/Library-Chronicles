import { defineStore } from 'pinia';

const RECENT_LIMIT = 14;
const CONTINUE_LIMIT = 18;

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

/** En cours : status reading, ou progression > 0 non terminé. */
function isContinueBook(b) {
  if (!b) return false;
  if (b.status === 'reading') return true;
  if (b.status === 'finished') return false;
  const total = Number(b.pageTotal) || 0;
  const current = Number(b.pageCurrent) || 0;
  return total > 0 && current > 0;
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
    navIndex: 0,
    /** @type {'nav' | 'continue' | 'filters' | 'trending' | 'recent' | 'grid' | 'series'} */
    focusZone: 'continue',
    /** @type {'board' | 'all' | 'recent' | 'series'} */
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
        .filter(isContinueBook)
        .sort(sortByAccess)
        .slice(0, CONTINUE_LIMIT);
    },
    trendingBooks(s) {
      // « Tendances » = récents + en cours mélangés, sinon toute la biblio
      const reading = s.books.filter(isContinueBook);
      const rest = s.books
        .filter((b) => !isContinueBook(b))
        .slice()
        .sort(sortByCreatedDesc);
      const merged = [...reading, ...rest];
      return (merged.length ? merged : s.books.slice().sort(sortByTitle)).slice(
        0,
        18,
      );
    },
    /** Onglets + actions header (focus manette). */
    headerNav() {
      return [
        { id: 'tab-board', kind: 'tab', tab: 'board', label: 'Bibliothèque' },
        { id: 'tab-all', kind: 'tab', tab: 'all', label: 'Tous les livres' },
        { id: 'tab-recent', kind: 'tab', tab: 'recent', label: 'Récents' },
        { id: 'tab-series', kind: 'tab', tab: 'series', label: 'Séries' },
        { id: 'scan', kind: 'action', action: 'scan', label: 'Scanner' },
        { id: 'import', kind: 'action', action: 'import', label: 'Import' },
        { id: 'settings', kind: 'action', action: 'settings', label: 'Paramètres' },
        { id: 'profile', kind: 'action', action: 'profile', label: 'Profil' },
      ];
    },
    selectedHeaderNav() {
      return this.headerNav[this.navIndex] || null;
    },
    isEmpty: (s) => !s.books.length,
    seriesList(s) {
      const groups = s.seriesGroups || [];
      if (s.filter === 'all') return groups;
      return groups.filter((g) => g.status === s.filter);
    },
    selected() {
      if (this.focusZone === 'continue') {
        return this.readingBooks[this.readingCursor] || null;
      }
      if (this.focusZone === 'recent') return this.recentBooks[this.recentCursor] || null;
      if (this.focusZone === 'trending') return this.trendingBooks[this.cursor] || null;
      if (this.focusZone === 'grid') return this.filtered[this.cursor] || null;
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
      if (typeof window === 'undefined') {
        this.columns = 6;
        return;
      }
      const w = window.innerWidth || 1280;
      if (w <= 640) this.columns = 3;
      else if (w <= 960) this.columns = 4;
      else this.columns = 6;
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
        if (this.catalogTab === 'all' || this.focusZone === 'grid') {
          this.cursor = Math.min(this.cursor, Math.max(0, this.filtered.length - 1));
        } else {
          this.cursor = Math.min(this.cursor, Math.max(0, this.trendingBooks.length - 1));
        }
        this.recentCursor = Math.min(
          this.recentCursor,
          Math.max(0, this.recentBooks.length - 1),
        );
        this.seriesCursor = Math.min(
          this.seriesCursor,
          Math.max(0, this.seriesList.length - 1),
        );
        this.readingCursor = Math.min(
          this.readingCursor,
          Math.max(0, this.readingBooks.length - 1),
        );
        this.navIndex = Math.min(
          this.navIndex,
          Math.max(0, this.headerNav.length - 1),
        );
        if (this.focusZone === 'nav' || this.focusZone === 'filters') {
          /* keep */
        } else if (!this.books.length) {
          this.focusZone = this.catalogTab === 'board' ? 'continue' : 'filters';
        } else if (
          this.focusZone === 'continue' &&
          !this.readingBooks.length &&
          this.catalogTab === 'board'
        ) {
          this.focusZone = 'filters';
        }
        const warm = [
          ...this.readingBooks.slice(0, 12).map((b) => b.id),
          ...this.trendingBooks.slice(0, 10).map((b) => b.id),
          ...(this.catalogTab === 'all'
            ? this.filtered.slice(0, 24).map((b) => b.id)
            : []),
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
    /**
     * @param {'board'|'all'|'recent'|'series'} tab
     * @param {{ keepNav?: boolean }} [opts]
     */
    setCatalogTab(tab, opts = {}) {
      this.catalogTab = tab;
      // keepNav explicite (false) prime sur focusZone==='nav' — utile au clic souris.
      const keepNav =
        opts.keepNav === true ||
        (opts.keepNav !== false && this.focusZone === 'nav');
      // Aligner l’index nav sur l’onglet actif
      const tabIdx = this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === tab);
      if (tabIdx >= 0 && (keepNav || this.focusZone === 'nav')) {
        this.navIndex = tabIdx;
      }
      if (keepNav) {
        this.focusZone = 'nav';
        return;
      }
      if (tab === 'series') {
        this.focusZone = 'series';
        this.seriesCursor = 0;
      } else if (tab === 'recent') {
        this.focusZone = 'recent';
        this.recentCursor = 0;
      } else if (tab === 'all') {
        this.cursor = 0;
        if (this.filtered.length) this.focusGrid(0);
        else this.focusZone = 'filters';
      } else {
        this.enterBoardContent();
      }
    },
    cycleCatalogTab(dir = 1) {
      const tabs = ['board', 'all', 'recent', 'series'];
      const i = tabs.indexOf(this.catalogTab);
      const safe = i >= 0 ? i : 0;
      const keepNav = this.focusZone === 'nav';
      this.setCatalogTab(tabs[(safe + dir + tabs.length) % tabs.length], { keepNav });
    },
    focusNav(index = 0) {
      this.focusZone = 'nav';
      this.navIndex = Math.max(0, Math.min(index, this.headerNav.length - 1));
      return true;
    },
    focusContinue(index = 0) {
      if (!this.readingBooks.length) return false;
      this.focusZone = 'continue';
      this.readingCursor = Math.max(
        0,
        Math.min(index, this.readingBooks.length - 1),
      );
      this.ensureCover(this.readingBooks[this.readingCursor]?.id);
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
      if (!this.filtered.length) return false;
      this.focusZone = 'grid';
      this.cursor = Math.max(0, Math.min(index, this.filtered.length - 1));
      this.ensureCover(this.filtered[this.cursor]?.id);
      return true;
    },
    focusSeries(index = 0) {
      if (!this.seriesList.length) return false;
      this.catalogTab = 'series';
      this.focusZone = 'series';
      this.seriesCursor = Math.max(0, Math.min(index, this.seriesList.length - 1));
      return true;
    },
    /** Première zone contenu selon l’onglet courant. */
    enterCatalogContent() {
      if (this.catalogTab === 'series') {
        if (this.seriesList.length) this.focusSeries(this.seriesCursor);
        else this.focusZone = 'series';
        return;
      }
      if (this.catalogTab === 'recent') {
        if (this.recentBooks.length) this.focusRecent(0);
        else this.focusZone = 'recent';
        return;
      }
      if (this.catalogTab === 'all') {
        this.focusZone = 'filters';
        return;
      }
      this.enterBoardContent();
    },
    enterBoardContent() {
      if (this.focusContinue(this.readingCursor)) return;
      this.focusZone = 'filters';
    },
    setFilter(filter) {
      this.filter = filter;
      const idx = this.filters.findIndex((f) => f.id === filter);
      this.filterIndex = idx >= 0 ? idx : 0;
      this.cursor = 0;
      if (this.catalogTab === 'all' && this.focusZone === 'grid') {
        if (this.filtered.length) this.focusGrid(0);
        else this.focusZone = 'filters';
      }
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
     * Navigation manette catalogue.
     * Zones verticales board : nav → continue → filters → trending → recent
     * Onglet « Tous » : nav → filters → grille dense (columns)
     */
    moveCatalog(dx, dy) {
      // Zone header (tabs + actions)
      if (this.focusZone === 'nav') {
        if (dx !== 0) {
          const next = Math.max(
            0,
            Math.min(this.headerNav.length - 1, this.navIndex + dx),
          );
          this.navIndex = next;
          const item = this.headerNav[next];
          if (item?.kind === 'tab' && item.tab !== this.catalogTab) {
            this.setCatalogTab(item.tab, { keepNav: true });
          }
        }
        if (dy > 0) this.enterCatalogContent();
        return;
      }

      if (this.catalogTab === 'series') {
        const list = this.seriesList;
        if (dy < 0 && (!list.length || this.seriesCursor <= 0)) {
          this.focusNav(
            this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === 'series'),
          );
          return;
        }
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

      if (this.catalogTab === 'all') {
        const cols = Math.max(1, this.columns || 6);
        const list = this.filtered;

        if (this.focusZone === 'filters') {
          if (dx !== 0) this.cycleFilter(dx);
          if (dy < 0) {
            this.focusNav(
              this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === 'all'),
            );
            return;
          }
          if (dy > 0 && list.length) this.focusGrid(0);
          return;
        }

        if (!list.length) {
          this.focusZone = 'filters';
          if (dx !== 0) this.cycleFilter(dx);
          if (dy < 0) {
            this.focusNav(
              this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === 'all'),
            );
          }
          return;
        }

        this.focusZone = 'grid';
        if (dy < 0 && this.cursor < cols) {
          this.focusZone = 'filters';
          return;
        }
        const next = this.cursor + dx + dy * cols;
        this.cursor = Math.max(0, Math.min(list.length - 1, next));
        this.ensureCover(list[this.cursor]?.id);
        return;
      }

      if (this.catalogTab === 'recent') {
        const list = this.recentBooks;
        const cols = Math.max(1, this.columns || 6);
        if (!list.length) {
          if (dy < 0) {
            this.focusNav(
              this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === 'recent'),
            );
          }
          return;
        }
        this.focusZone = 'recent';
        if (dy < 0 && this.recentCursor < cols) {
          this.focusNav(
            this.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === 'recent'),
          );
          return;
        }
        this.recentCursor = Math.max(
          0,
          Math.min(list.length - 1, this.recentCursor + dx + dy * cols),
        );
        this.ensureCover(list[this.recentCursor]?.id);
        return;
      }

      // Board — continue (grille) → filters → trending → recent
      const cols = Math.max(1, this.columns || 6);

      if (this.focusZone === 'continue') {
        const list = this.readingBooks;
        if (!list.length) {
          if (dy < 0) this.focusNav(0);
          else if (dy > 0) this.focusZone = 'filters';
          return;
        }
        if (dy < 0 && this.readingCursor < cols) {
          this.focusNav(0);
          return;
        }
        if (dy > 0) {
          const next = this.readingCursor + dy * cols;
          if (next > list.length - 1) {
            this.focusZone = 'filters';
            return;
          }
        }
        const next = this.readingCursor + dx + dy * cols;
        this.readingCursor = Math.max(0, Math.min(list.length - 1, next));
        this.ensureCover(list[this.readingCursor]?.id);
        return;
      }

      if (dy < 0) {
        if (this.focusZone === 'trending' || this.focusZone === 'recent') {
          this.focusZone = 'filters';
          return;
        }
        if (this.focusZone === 'filters') {
          if (!this.focusContinue(0)) this.focusNav(0);
          return;
        }
      }
      if (dy > 0) {
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
