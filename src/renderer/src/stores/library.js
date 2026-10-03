import { defineStore } from 'pinia';

export const useLibraryStore = defineStore('library', {
  state: () => ({
    books: [],
    covers: {},
    cursor: 0,
    loading: false,
    root: null,
    importRoot: null,
    continueBook: null,
    filter: 'all', // all | reading | unread | finished
    columns: 3,
  }),
  getters: {
    filtered(s) {
      if (s.filter === 'all') return s.books;
      return s.books.filter((b) => b.status === s.filter);
    },
    selected() {
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
        this.cursor = 0;
        await this.prefetchCovers();
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
    async prefetchCovers() {
      const ids = this.books.slice(0, 40).map((b) => b.id);
      await Promise.all(
        ids.map(async (id) => {
          if (this.covers[id]) return;
          try {
            const url = await window.vdr.library.getCover(id);
            if (url) this.covers[id] = url;
          } catch {
            // ignore
          }
        }),
      );
    },
    moveCursor(delta) {
      const list = this.filtered;
      if (!list.length) return;
      this.cursor = (this.cursor + delta + list.length) % list.length;
    },
    moveCursorGrid(dx, dy) {
      const list = this.filtered;
      if (!list.length) return;
      const cols = this.columns;
      const row = Math.floor(this.cursor / cols);
      const col = this.cursor % cols;
      const rows = Math.ceil(list.length / cols);
      let nextRow = row + dy;
      let nextCol = col + dx;
      if (nextCol < 0) nextCol = cols - 1;
      if (nextCol >= cols) nextCol = 0;
      if (nextRow < 0) nextRow = rows - 1;
      if (nextRow >= rows) nextRow = 0;
      let next = nextRow * cols + nextCol;
      if (next >= list.length) next = list.length - 1;
      this.cursor = next;
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
  },
});
