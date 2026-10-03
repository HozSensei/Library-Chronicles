import { defineStore } from 'pinia';

export const useImportStore = defineStore('import', {
  state: () => ({
    items: [],
    cursor: 0,
    /** Chemins sélectionnés (interne : commitAll). */
    selectedPaths: [],
    /** list = fichiers · detail = fiche méta / search API. */
    viewMode: 'list',
    loading: false,
    committing: false,
    root: null,
    error: null,
    draft: {
      title: '',
      series: '',
      volume: null,
      author: '',
      year: null,
      description: '',
    },
    /** Requête API éditable (clavier virtuel). */
    searchQuery: '',
    enrichResults: [],
    enrichResultCursor: 0,
    enrichLoading: false,
    enrichProvider: null,
    enrichWarning: null,
    enrichError: null,
    providers: [],
    activeProvider: 'anilist',
    coverPreview: null,
    lastImported: null,
  }),
  getters: {
    selected: (s) => s.items[s.cursor] || null,
    selectedProviderMeta(s) {
      return s.providers.find((p) => p.id === s.activeProvider) || null;
    },
    selectedCount: (s) => s.selectedPaths.length,
    selectedItems(s) {
      const set = new Set(s.selectedPaths);
      return s.items.filter((i) => set.has(i.filePath));
    },
    allSelectableSelected(s) {
      if (!s.items.length) return false;
      return s.items.every((i) => s.selectedPaths.includes(i.filePath));
    },
    isDetail: (s) => s.viewMode === 'detail',
  },
  actions: {
    isPathSelected(filePath) {
      return this.selectedPaths.includes(filePath);
    },
    toggleSelect(filePath) {
      const path = filePath || this.selected?.filePath;
      if (!path) return;
      const idx = this.selectedPaths.indexOf(path);
      if (idx >= 0) {
        this.selectedPaths = this.selectedPaths.filter((p) => p !== path);
      } else {
        this.selectedPaths = [...this.selectedPaths, path];
      }
    },
    selectAll() {
      this.selectedPaths = this.items.map((i) => i.filePath);
    },
    clearSelection() {
      this.selectedPaths = [];
    },
    toggleSelectAll() {
      if (this.allSelectableSelected) this.clearSelection();
      else this.selectAll();
    },
    async loadProviders() {
      try {
        const data = await window.vdr.metadata.listProviders();
        this.providers = data.providers || [];
        const active = data.activeProvider || 'anilist';
        this.activeProvider =
          active === 'stub' && this.providers.some((p) => p.id === 'anilist')
            ? 'anilist'
            : active;
        if (this.activeProvider !== active) {
          await window.vdr.metadata.setProvider(this.activeProvider);
        }
      } catch {
        this.providers = [];
        this.activeProvider = 'anilist';
      }
    },
    async setProvider(id) {
      await window.vdr.metadata.setProvider(id);
      this.activeProvider = id;
      this.enrichWarning = null;
      this.enrichError = null;
      await this.loadProviders();
    },
    cycleProvider(delta = 1) {
      if (!this.providers.length) return;
      const idx = this.providers.findIndex((p) => p.id === this.activeProvider);
      const next =
        (Math.max(0, idx) + delta + this.providers.length) % this.providers.length;
      return this.setProvider(this.providers[next].id);
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
        this.cursor = Math.min(this.cursor, Math.max(0, this.items.length - 1));
        const valid = new Set(this.items.map((i) => i.filePath));
        this.selectedPaths = this.selectedPaths.filter((p) => valid.has(p));
        if (this.viewMode === 'detail' && this.selected) {
          await this.loadDraftFromSelected({ keepResults: false });
        } else if (this.viewMode === 'detail' && !this.selected) {
          this.viewMode = 'list';
        }
      } finally {
        this.loading = false;
      }
    },
    moveCursor(delta) {
      if (!this.items.length) return;
      this.cursor = (this.cursor + delta + this.items.length) % this.items.length;
    },
    /**
     * Ouvre la fiche détail import (édition méta + search API) — pas d’import immédiat.
     * @param {number} [index]
     */
    async openDetail(index) {
      if (typeof index === 'number' && this.items[index]) {
        this.cursor = index;
      }
      if (!this.selected) return false;
      await this.loadDraftFromSelected({ keepResults: false });
      this.viewMode = 'detail';
      return true;
    },
    closeDetail() {
      this.viewMode = 'list';
      this.enrichResultCursor = 0;
    },
    async loadDraftFromSelected({ keepResults = false } = {}) {
      const item = this.selected;
      if (!item) return;
      const d = item.detected || {};
      this.draft = {
        title: d.title || item.name,
        series: d.series || '',
        volume: d.volume,
        author: d.author || '',
        year: d.year,
        description: d.description || '',
      };
      this.searchQuery = String(d.series || d.title || item.name || '').trim();
      if (!keepResults) {
        this.enrichResults = [];
        this.enrichResultCursor = 0;
        this.enrichProvider = null;
        this.enrichWarning = null;
        this.enrichError = null;
      }
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
    setSearchQuery(query) {
      this.searchQuery = String(query ?? '');
    },
    moveEnrichCursor(delta) {
      if (!this.enrichResults.length) {
        this.enrichResultCursor = 0;
        return;
      }
      const n = this.enrichResults.length;
      this.enrichResultCursor = (this.enrichResultCursor + delta + n) % n;
    },
    /** Recherche API via le provider actif — query éditable (searchQuery). */
    async enrich() {
      const item = this.selected;
      if (!item) return;
      this.enrichLoading = true;
      this.enrichWarning = null;
      this.enrichError = null;
      this.enrichResults = [];
      this.enrichResultCursor = 0;
      try {
        if (this.activeProvider === 'stub') {
          const hasAni = this.providers.some((p) => p.id === 'anilist');
          if (hasAni) {
            await this.setProvider('anilist');
          }
        }
        const query =
          String(this.searchQuery || '').trim() ||
          this.draft.series ||
          this.draft.title ||
          item.name;
        if (!String(this.searchQuery || '').trim()) {
          this.searchQuery = String(query || '');
        }
        const payload = await window.vdr.metadata.search(query, this.activeProvider);
        this.enrichResults = payload.results || [];
        this.enrichProvider = payload.activeProvider || this.activeProvider;
        this.enrichWarning = payload.warning || null;
        if (!this.enrichResults.length && !this.enrichWarning) {
          this.enrichWarning =
            'Aucun résultat. Essaie un autre provider ou des mots-clés plus courts.';
        }
      } catch (err) {
        this.enrichError = err?.message || 'Échec recherche métadonnées';
        this.enrichResults = [];
      } finally {
        this.enrichLoading = false;
      }
    },
    applyEnrichResult(result) {
      if (!result) return;
      this.patchDraft({
        title: result.title || this.draft.title,
        series: result.series || this.draft.series,
        volume: result.volume ?? this.draft.volume,
        author: result.author || this.draft.author,
        year: result.year ?? this.draft.year,
        description: result.description || this.draft.description,
      });
    },
    applyEnrichCursor() {
      const result = this.enrichResults[this.enrichResultCursor];
      if (result) this.applyEnrichResult(result);
    },
    async commitSelected({ copyToLibrary = true } = {}) {
      const item = this.selected;
      if (!item) return null;
      this.committing = true;
      try {
        const result = await window.vdr.import.commit({
          sourcePath: item.filePath,
          metadata: {
            ...this.draft,
            description: this.draft.description || null,
          },
          copyToLibrary,
        });
        this.lastImported = result.book;
        item.alreadyInLibrary = true;
        item.existingBookId = result.book?.id;
        return result;
      } finally {
        this.committing = false;
      }
    },
    async commitSelection({ copyToLibrary = true } = {}) {
      const paths =
        this.selectedPaths.length > 0
          ? [...this.selectedPaths]
          : this.selected
            ? [this.selected.filePath]
            : [];
      if (!paths.length) return [];

      this.committing = true;
      const results = [];
      try {
        for (const filePath of paths) {
          const item = this.items.find((i) => i.filePath === filePath);
          if (!item) continue;
          const useDraft = this.selected?.filePath === filePath;
          const meta = useDraft
            ? {
                ...this.draft,
                description: this.draft.description || null,
              }
            : {
                title: item.detected?.title || item.name,
                series: item.detected?.series || '',
                volume: item.detected?.volume ?? null,
                author: item.detected?.author || '',
                year: item.detected?.year ?? null,
                description: item.detected?.description || null,
              };
          const result = await window.vdr.import.commit({
            sourcePath: filePath,
            metadata: meta,
            copyToLibrary,
          });
          item.alreadyInLibrary = true;
          item.existingBookId = result.book?.id;
          this.lastImported = result.book;
          results.push(result);
        }
        this.selectedPaths = this.selectedPaths.filter(
          (p) => !paths.includes(p),
        );
      } finally {
        this.committing = false;
      }
      return results;
    },
    /** Importe tous les fichiers avec méta détectées / draft curseur. */
    async commitAll({ copyToLibrary = true } = {}) {
      this.selectAll();
      return this.commitSelection({ copyToLibrary });
    },
  },
});
