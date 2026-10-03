import { defineStore } from 'pinia';

export const useImportStore = defineStore('import', {
  state: () => ({
    items: [],
    cursor: 0,
    /** Chemins sélectionnés pour import multi. */
    selectedPaths: [],
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
    enrichResults: [],
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
        // Évite de rester coincé sur stub si un provider réel est disponible
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
        // Conserve la sélection encore présente après rescan
        const valid = new Set(this.items.map((i) => i.filePath));
        this.selectedPaths = this.selectedPaths.filter((p) => valid.has(p));
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
        description: d.description || '',
      };
      this.enrichResults = [];
      this.enrichProvider = null;
      this.enrichWarning = null;
      this.enrichError = null;
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
      this.enrichWarning = null;
      this.enrichError = null;
      this.enrichResults = [];
      try {
        if (this.activeProvider === 'stub') {
          // Auto-bascule vers AniList si l’utilisateur est encore sur stub
          const hasAni = this.providers.some((p) => p.id === 'anilist');
          if (hasAni) {
            await this.setProvider('anilist');
          }
        }
        const query = this.draft.series || this.draft.title || item.name;
        const payload = await window.vdr.metadata.search(query, this.activeProvider);
        this.enrichResults = payload.results || [];
        this.enrichProvider = payload.activeProvider || this.activeProvider;
        this.enrichWarning = payload.warning || null;
        if (!this.enrichResults.length && !this.enrichWarning) {
          this.enrichWarning = 'Aucun résultat. Essaie un autre provider ou un titre plus court.';
        }
      } catch (err) {
        this.enrichError = err?.message || 'Échec enrichissement';
        this.enrichResults = [];
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
        description: result.description || this.draft.description,
      });
    },
    async commitSelected({ copyToLibrary = true } = {}) {
      const item = this.selected;
      if (!item) return null;
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
    },
    /**
     * Importe les tomes cochés (ou le curseur si aucune sélection).
     * Le tome curseur applique le brouillon métadonnées courant.
     */
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
    /** Sélectionne tout puis importe. */
    async commitAll({ copyToLibrary = true } = {}) {
      this.selectAll();
      return this.commitSelection({ copyToLibrary });
    },
  },
});
