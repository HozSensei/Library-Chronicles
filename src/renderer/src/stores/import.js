import { defineStore } from 'pinia';

export const useImportStore = defineStore('import', {
  state: () => ({
    items: [],
    cursor: 0,
    loading: false,
    root: null,
    error: null,
    /** Édition en cours du tome sélectionné */
    draft: {
      title: '',
      series: '',
      volume: null,
      author: '',
      year: null,
    },
    enrichResults: [],
    enrichLoading: false,
    enrichProvider: null,
    providers: [],
    activeProvider: 'stub',
    coverPreview: null,
    lastImported: null,
  }),
  getters: {
    selected: (s) => s.items[s.cursor] || null,
    selectedProviderMeta(s) {
      return s.providers.find((p) => p.id === s.activeProvider) || null;
    },
  },
  actions: {
    async loadProviders() {
      try {
        const data = await window.vdr.metadata.listProviders();
        this.providers = data.providers || [];
        this.activeProvider = data.activeProvider || 'stub';
      } catch {
        this.providers = [];
        this.activeProvider = 'stub';
      }
    },
    async setProvider(id) {
      await window.vdr.metadata.setProvider(id);
      this.activeProvider = id;
      await this.loadProviders();
    },
    async openProviderHelp(provider) {
      if (!provider?.helpUrl) return;
      await window.vdr.metadata.openHelp({
        provider: provider.id,
        url: provider.helpUrl,
      });
    },
    async scan() {
      this.loading = true;
      this.error = null;
      try {
        await this.loadProviders();
        const result = await window.vdr.import.scan();
        this.root = result.root;
        this.items = result.found || [];
        this.error = result.error || null;
        this.cursor = 0;
        if (this.selected) await this.loadDraftFromSelected();
      } finally {
        this.loading = false;
      }
    },
    moveCursor(delta) {
      if (!this.items.length) return;
      this.cursor = (this.cursor + delta + this.items.length) % this.items.length;
      this.loadDraftFromSelected();
    },
    async loadDraftFromSelected() {
      const item = this.selected;
      if (!item) return;
      const d = item.detected || {};
      this.draft = {
        title: d.title || item.name,
        series: d.series || '',
        volume: d.volume,
        author: d.author || '',
        year: d.year,
      };
      this.enrichResults = [];
      this.enrichProvider = null;
      this.coverPreview = null;
      try {
        const cover = await window.vdr.import.previewCover(item.filePath);
        if (cover?.data) {
          this.coverPreview = `data:${cover.mime};base64,${cover.data}`;
        }
      } catch {
        this.coverPreview = null;
      }
    },
    patchDraft(patch) {
      this.draft = { ...this.draft, ...patch };
    },
    async enrich() {
      const item = this.selected;
      if (!item) return;
      this.enrichLoading = true;
      try {
        const query = this.draft.series || this.draft.title || item.name;
        const { results, activeProvider } = await window.vdr.metadata.search(
          query,
          this.activeProvider,
        );
        this.enrichResults = results || [];
        this.enrichProvider = activeProvider || this.activeProvider;
      } finally {
        this.enrichLoading = false;
      }
    },
    applyEnrichResult(result) {
      this.patchDraft({
        title: result.title || this.draft.title,
        series: result.series || this.draft.series,
        volume: result.volume ?? this.draft.volume,
        author: result.author || this.draft.author,
        year: result.year ?? this.draft.year,
      });
    },
    async commitSelected({ copyToLibrary = true } = {}) {
      const item = this.selected;
      if (!item) return null;
      const result = await window.vdr.import.commit({
        sourcePath: item.filePath,
        metadata: { ...this.draft },
        copyToLibrary,
      });
      this.lastImported = result.book;
      item.alreadyInLibrary = true;
      item.existingBookId = result.book?.id;
      return result;
    },
  },
});
