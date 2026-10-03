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
    covers: {},
    coverPending: {},
    cursor: 0,
    recentCursor: 0,
    /** @type {'hero' | 'recent' | 'grid'} */
    focusZone: 'hero',
    loading: false,
    root: null,
    importRoot: null,
    continueBook: null,
    lastAccessedBook: null,
    filter: 'all', // all | reading | unread | finished
    columns: 3,
  }),
  getters: {
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
    selected() {
      if (this.focusZone === 'hero') return this.heroBook;
      if (this.focusZone === 'recent') {
        return this.recentBooks[this.recentCursor] || null;
      }
      const list = this.filtered;
      return list[this.cursor] || null;
    },
  },
  actions: {
    async refresh() {
      this.loading = true;
      try {
        const config = await window.vdr.getConfig();
        this.root = config.libraryRoot;
        this.importRoot = config.importRoot;
        this.books = (await window.vdr.library.list()) || [];
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
        if (!this.heroBook && this.filtered.length) this.focusZone = 'grid';
        else if (this.focusZone === 'recent' && !this.recentBooks.length) {
          this.focusZone = this.heroBook ? 'hero' : 'grid';
        }
        // Prefetch discret : héro + premiers récents (le reste via LazyCover)
        const warm = [];
        if (this.heroBook) warm.push(this.heroBook.id);
        for (const b of this.recentBooks.slice(0, 6)) warm.push(b.id);
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
    /**
     * Navigation console-first entre héro / rail / grille.
     * @param {number} dx
     * @param {number} dy
     */
    moveCatalog(dx, dy) {
      if (this.focusZone === 'hero') {
        if (dy > 0) {
          if (!this.focusRecent(0)) this.focusGrid(0);
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
  },
});
