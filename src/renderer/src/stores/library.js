import { defineStore } from 'pinia';

export const useLibraryStore = defineStore('library', {
  state: () => ({
    books: [],
    cursor: 0,
    loading: false,
    root: null,
  }),
  getters: {
    selected: (s) => s.books[s.cursor] || null,
  },
  actions: {
    async refresh() {
      this.loading = true;
      try {
        const config = await window.vdr.getConfig();
        this.root = config.libraryRoot;
        this.books = (await window.vdr.library.list()) || [];
        this.cursor = 0;
      } finally {
        this.loading = false;
      }
    },
    moveCursor(delta) {
      if (!this.books.length) return;
      this.cursor = (this.cursor + delta + this.books.length) % this.books.length;
    },
  },
});
