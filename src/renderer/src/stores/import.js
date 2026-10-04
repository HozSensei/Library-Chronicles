import { defineStore } from 'pinia';
import {
  IMPORT_FLOW,
  META_RETURN,
  flowFromViewState,
  normalizeEntryIntent,
  normalizeImportFlow,
  normalizeMetaReturn,
  viewStateFromFlow,
} from '../../../shared/import-flow.js';
import {
  META_SOURCE,
  computeMetaSource,
  metadataFromDetected,
  normalizeImportMetadata,
  resolveItemMetadata,
} from '../../../shared/import-meta.js';
import { normalizeMetadataQuery } from '../../../shared/metadata-query.js';
import { useLibraryStore } from './library.js';
import { useToastStore } from './toast.js';

function draftFromItem(item) {
  if (item?.selectedMeta) {
    return normalizeImportMetadata(item.selectedMeta, item);
  }
  return metadataFromDetected(item);
}

function annotateItem(item, prev = null) {
  const selectedMeta = prev?.selectedMeta ?? item.selectedMeta ?? null;
  return {
    ...item,
    selectedMeta,
    metaSource: computeMetaSource({
      selectedMeta,
      detected: item.detected,
    }),
  };
}

export const useImportStore = defineStore('import', {
  state: () => ({
    items: [],
    cursor: 0,
    /** Chemins sélectionnés (interne : commitSelection). */
    selectedPaths: [],
    /**
     * État UI bas niveau (rétrocompat).
     * Préférer `flow` / `setFlow` : list | sheet | meta-search.
     * list = fichiers · detail = fiche méta / search API.
     */
    viewMode: 'list',
    /** Onglet fiche : infos (méta) | search (API). */
    detailTab: 'infos',
    /**
     * Contexte de retour B depuis sheet / meta-search.
     * `book` → BookDetail ; `sheet` → fiche brouillon ; `list` → liste.
     */
    metaReturn: META_RETURN.LIST,
    /** Id livre BookDetail quand metaReturn === 'book'. */
    metaReturnBookId: null,
    /**
     * Intent d’entrée consommé au mount ImportView (évite reset list).
     * null | list | sheet | meta-search
     */
    entryIntent: null,
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
      coverUrl: null,
      source: null,
    },
    /** Requête API éditable (clavier virtuel). */
    searchQuery: '',
    enrichResults: [],
    enrichResultCursor: 0,
    enrichLoading: false,
    enrichProvider: null,
    enrichWarning: null,
    enrichError: null,
    /** data-URL jaquettes résultats (CSP : pas d’img https). */
    enrichCoverPreviews: {},
    providers: [],
    activeProvider: 'anilist',
    coverPreview: null,
    lastImported: null,
    _providersLoaded: false,
    _enrichCoverToken: 0,
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
    isInfosTab: (s) => s.detailTab !== 'search',
    isSearchTab: (s) => s.detailTab === 'search',
    /** Machine d’état : list | sheet | meta-search */
    flow: (s) =>
      flowFromViewState({ viewMode: s.viewMode, detailTab: s.detailTab }),
    isListFlow: (s) =>
      flowFromViewState({ viewMode: s.viewMode, detailTab: s.detailTab }) ===
      IMPORT_FLOW.LIST,
    isSheetFlow: (s) =>
      flowFromViewState({ viewMode: s.viewMode, detailTab: s.detailTab }) ===
      IMPORT_FLOW.SHEET,
    isMetaSearchFlow: (s) =>
      flowFromViewState({ viewMode: s.viewMode, detailTab: s.detailTab }) ===
      IMPORT_FLOW.META_SEARCH,
  },
  actions: {
    /**
     * Pose le flow nommé et synchronise viewMode/detailTab.
     * @param {'list'|'sheet'|'meta-search'} flow
     * @param {{ metaReturn?: string, bookId?: number|string|null, entryIntent?: boolean }} [opts]
     */
    setFlow(flow, opts = {}) {
      const next = normalizeImportFlow(flow);
      const { viewMode, detailTab } = viewStateFromFlow(next);
      this.viewMode = viewMode;
      this.detailTab = detailTab;
      if (opts.metaReturn != null) {
        this.metaReturn = normalizeMetaReturn(opts.metaReturn);
      }
      if (opts.bookId !== undefined) {
        this.metaReturnBookId =
          opts.bookId != null && opts.bookId !== ''
            ? opts.bookId
            : null;
      }
      if (opts.entryIntent) {
        this.entryIntent = next;
      }
      if (next === IMPORT_FLOW.LIST) {
        this.metaReturn = META_RETURN.LIST;
        this.metaReturnBookId = null;
        this.enrichResultCursor = 0;
      }
    },
    /** Intent consommé une fois au mount ImportView. */
    consumeEntryIntent() {
      const intent = normalizeEntryIntent(this.entryIntent);
      this.entryIntent = null;
      return intent;
    },
    setDetailTab(tab) {
      this.detailTab = tab === 'search' ? 'search' : 'infos';
    },
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
    async loadProviders({ force = false } = {}) {
      if (this._providersLoaded && !force && this.providers.length) return;
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
        this._providersLoaded = true;
      } catch {
        this.providers = [];
        this.activeProvider = 'anilist';
        this._providersLoaded = false;
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
        const prevByPath = new Map(this.items.map((i) => [i.filePath, i]));
        this.items = (result.found || []).map((raw) =>
          annotateItem(raw, prevByPath.get(raw.filePath)),
        );
        this.error = result.error || null;
        this.cursor = Math.min(this.cursor, Math.max(0, this.items.length - 1));
        const valid = new Set(this.items.map((i) => i.filePath));
        this.selectedPaths = this.selectedPaths.filter((p) => valid.has(p));
        if (this.viewMode === 'detail' && this.selected) {
          await this.loadDraftFromSelected({ keepResults: false });
        } else if (this.viewMode === 'detail' && !this.selected) {
          this.goToList();
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
     * Ouvre la fiche brouillon (flow `sheet`) — pas d’import immédiat.
     * @param {number} [index]
     * @param {{ entryIntent?: boolean }} [opts]
     */
    async openDetail(index, opts = {}) {
      if (typeof index === 'number' && this.items[index]) {
        this.cursor = index;
      }
      if (!this.selected) return false;
      await this.loadDraftFromSelected({ keepResults: false });
      this.setFlow(IMPORT_FLOW.SHEET, {
        metaReturn: META_RETURN.LIST,
        bookId: null,
        entryIntent: Boolean(opts.entryIntent),
      });
      return true;
    },
    /** Alias explicite — flow sheet. */
    async openSheet(index, opts = {}) {
      return this.openDetail(index, opts);
    },
    /**
     * Ouvre la Recherche API (flow `meta-search`) sans dump vers la liste.
     * @param {{
     *   index?: number,
     *   returnTo?: 'sheet'|'book'|'list',
     *   bookId?: number|string|null,
     *   entryIntent?: boolean,
     *   keepResults?: boolean,
     * }} [opts]
     */
    async openMetaSearch(opts = {}) {
      const {
        index,
        returnTo = META_RETURN.SHEET,
        bookId = null,
        entryIntent = true,
        keepResults = false,
      } = opts;
      if (typeof index === 'number' && this.items[index]) {
        this.cursor = index;
      }
      if (!this.selected) return false;
      await this.loadDraftFromSelected({ keepResults });
      this.setFlow(IMPORT_FLOW.META_SEARCH, {
        metaReturn: returnTo,
        bookId:
          bookId ??
          (returnTo === META_RETURN.BOOK
            ? this.selected?.existingBookId
            : null),
        entryIntent,
      });
      return true;
    },
    closeDetail() {
      this.setFlow(IMPORT_FLOW.LIST);
    },
    goToList() {
      this.setFlow(IMPORT_FLOW.LIST);
    },
    goToSheet() {
      this.setFlow(IMPORT_FLOW.SHEET, {
        metaReturn: this.metaReturn === META_RETURN.BOOK
          ? META_RETURN.BOOK
          : META_RETURN.LIST,
        bookId: this.metaReturnBookId,
      });
    },
    /**
     * X liste — toggle : importer OU retirer de la bibliothèque si déjà ✓.
     */
    async toggleImportOrRemoveSelected({ copyToLibrary = true } = {}) {
      const item = this.selected;
      if (!item || this.committing) return null;
      if (item.alreadyInLibrary && item.existingBookId != null) {
        return this.removeSelectedFromLibrary();
      }
      return this.commitSelected({ copyToLibrary });
    },
    /**
     * Retire le livre déjà importé (focus) de la bibliothèque.
     * Ne supprime pas le fichier source dans le dossier import.
     */
    async removeSelectedFromLibrary() {
      const item = this.selected;
      const bookId = item?.existingBookId;
      if (!item || bookId == null) return null;
      this.committing = true;
      const toast = useToastStore();
      try {
        const lib = useLibraryStore();
        const result = await lib.removeBook(bookId);
        const label =
          item.selectedMeta?.title ||
          item.detected?.title ||
          item.name ||
          'Livre';
        item.alreadyInLibrary = false;
        item.existingBookId = null;
        toast.success(`Retiré de la bibliothèque · ${label}`);
        return result;
      } catch (err) {
        toast.error(err?.message || 'Échec du retrait');
        throw err;
      } finally {
        this.committing = false;
      }
    },
    async loadDraftFromSelected({ keepResults = false } = {}) {
      const item = this.selected;
      if (!item) return;
      const d = draftFromItem(item);
      this.draft = {
        title: d.title,
        series: d.series,
        volume: d.volume,
        author: d.author,
        year: d.year,
        description: d.description || '',
        coverUrl: d.coverUrl || null,
        source: d.source || null,
      };
      // Préremplissage auto depuis draft/fichier : strip « Tome N » / « Vol. N »
      // pour matcher la série. La saisie manuelle (setSearchQuery / enrich) ne
      // strippe pas — voir prepareMetadataSearchQuery côté main.
      const prefillRaw = String(d.series || d.title || item.name || '').trim();
      this.searchQuery = normalizeMetadataQuery(prefillRaw) || prefillRaw;
      if (!keepResults) {
        this.enrichResults = [];
        this.enrichResultCursor = 0;
        this.enrichProvider = null;
        this.enrichWarning = null;
        this.enrichError = null;
        this.clearEnrichCoverPreviews();
      }
      this.coverPreview = null;
      if (d.coverUrl) {
        await this.resolveCoverPreview(d.coverUrl);
      } else {
        try {
          const cover = await window.vdr.import.previewCover(item.filePath);
          if (cover?.data) {
            this.coverPreview = `data:${cover.mime};base64,${cover.data}`;
          }
        } catch {
          this.coverPreview = null;
        }
      }
    },
    /**
     * Affiche une jacket : data-URL directe, sinon téléchargement main
     * (CSP renderer bloque img https://).
     * @param {string|null|undefined} coverUrl
     */
    async resolveCoverPreview(coverUrl) {
      const url = String(coverUrl || '').trim();
      if (!url) {
        this.coverPreview = null;
        return;
      }
      if (/^data:/i.test(url)) {
        this.coverPreview = url;
        return;
      }
      try {
        const remote = await window.vdr.import.previewCoverFromUrl(url);
        if (remote?.dataUrl) {
          this.coverPreview = remote.dataUrl;
          return;
        }
      } catch {
        /* fallback ci-dessous */
      }
      // Dernier recours : URL brute (bloquée par CSP en pratique)
      this.coverPreview = url;
    },
    /** Met à jour selectedMeta si l’item a un choix API (pastille verte). */
    syncSelectedMetaFromDraft() {
      const item = this.selected;
      if (!item || item.metaSource !== META_SOURCE.SELECTED) return;
      item.selectedMeta = normalizeImportMetadata(this.draft, item);
      item.metaSource = META_SOURCE.SELECTED;
    },
    patchDraft(patch) {
      this.draft = { ...this.draft, ...patch };
      this.syncSelectedMetaFromDraft();
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
    clearEnrichCoverPreviews() {
      this._enrichCoverToken += 1;
      this.enrichCoverPreviews = {};
    },
    /**
     * Proxy CSP des jaquettes résultats (concurrence limitée).
     * @param {Array<{ id?: string, coverUrl?: string|null }>} results
     */
    async loadEnrichCoverPreviews(results) {
      const token = ++this._enrichCoverToken;
      this.enrichCoverPreviews = {};
      const queue = (results || []).filter(
        (r) => r?.id && String(r.coverUrl || '').trim(),
      );
      if (!queue.length) return;
      let next = 0;
      const concurrency = Math.min(6, queue.length);
      const worker = async () => {
        while (next < queue.length) {
          if (token !== this._enrichCoverToken) return;
          const r = queue[next];
          next += 1;
          try {
            const remote = await window.vdr.import.previewCoverFromUrl(
              r.coverUrl,
            );
            if (token !== this._enrichCoverToken) return;
            if (remote?.dataUrl) {
              this.enrichCoverPreviews = {
                ...this.enrichCoverPreviews,
                [r.id]: remote.dataUrl,
              };
            }
          } catch {
            /* jaquette optionnelle */
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
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
      this.clearEnrichCoverPreviews();
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
        if (this.enrichResults.length) {
          void this.loadEnrichCoverPreviews(this.enrichResults);
        }
      } catch (err) {
        this.enrichError = err?.message || 'Échec recherche métadonnées';
        this.enrichResults = [];
      } finally {
        this.enrichLoading = false;
      }
    },
    /**
     * Applique un résultat API → draft + selectedMeta (pastille verte).
     * @param {object} result
     */
    applyEnrichResult(result) {
      if (!result) return;
      // Conserver le tome détecté (fichier) : AniList renvoie souvent le
      // nombre total de volumes de la série (ex. Solo Leveling → 15).
      const volume =
        this.draft.volume != null ? this.draft.volume : (result.volume ?? null);
      this.patchDraft({
        title: result.title || this.draft.title,
        series: result.series || this.draft.series,
        volume,
        author: result.author || this.draft.author,
        year: result.year ?? this.draft.year,
        description: result.description || this.draft.description,
        coverUrl: result.coverUrl || this.draft.coverUrl || null,
        source: result.source || this.draft.source || null,
      });
      if (result.coverUrl) {
        void this.resolveCoverPreview(result.coverUrl);
      }
      const item = this.selected;
      if (item) {
        item.selectedMeta = normalizeImportMetadata(this.draft, item);
        item.metaSource = META_SOURCE.SELECTED;
      }
      // Depuis BookDetail : persister aussi la fiche bibliothèque
      const bookId =
        this.metaReturn === META_RETURN.BOOK
          ? (this.metaReturnBookId ?? item?.existingBookId)
          : null;
      if (bookId != null) {
        void (async () => {
          try {
            const lib = useLibraryStore();
            await lib.updateBook(
              bookId,
              {
                title: this.draft.title,
                series: this.draft.series || null,
                volume: this.draft.volume,
                year: this.draft.year,
                author: this.draft.author || null,
                metadata: {
                  description: this.draft.description || null,
                  synopsis: this.draft.description || null,
                  coverUrl: this.draft.coverUrl || null,
                  source: this.draft.source || null,
                },
              },
              { silent: true },
            );
            useToastStore().success('Métadonnées appliquées');
          } catch (err) {
            try {
              useToastStore().error(err?.message || 'Échec méta');
            } catch {
              /* ignore */
            }
          }
        })();
      } else {
        try {
          useToastStore().success('Métadonnées appliquées');
        } catch {
          /* toast optionnel */
        }
      }
    },
    applyEnrichCursor() {
      const result = this.enrichResults[this.enrichResultCursor];
      if (result) this.applyEnrichResult(result);
    },
    /**
     * X — importer le tome focus.
     * Méta : sélectionnées (API) si présentes, sinon défaut / draft fiche.
     */
    async commitSelected({ copyToLibrary = true } = {}) {
      const item = this.selected;
      if (!item) return null;
      this.committing = true;
      const toast = useToastStore();
      try {
        const meta = resolveItemMetadata(item, {
          draft: this.draft,
          preferDraft: this.isDetail,
        });
        const result = await window.vdr.import.commit({
          sourcePath: item.filePath,
          metadata: meta,
          copyToLibrary,
        });
        this.lastImported = result.book;
        item.alreadyInLibrary = true;
        item.existingBookId = result.book?.id;
        try {
          const lib = useLibraryStore();
          if (result.book?.id != null) delete lib.covers[result.book.id];
          lib.invalidate();
        } catch {
          /* ignore */
        }
        const label =
          result.book?.title || meta?.title || item.name || 'Livre';
        toast.success(`Importé · ${label}`);
        return result;
      } catch (err) {
        toast.error(err?.message || 'Échec de l’import');
        throw err;
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
      const toast = useToastStore();
      try {
        for (const filePath of paths) {
          const item = this.items.find((i) => i.filePath === filePath);
          if (!item) continue;
          const preferDraft =
            this.isDetail && this.selected?.filePath === filePath;
          const meta = resolveItemMetadata(item, {
            draft: this.draft,
            preferDraft,
          });
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
        if (results.length) {
          try {
            const lib = useLibraryStore();
            for (const r of results) {
              if (r.book?.id != null) delete lib.covers[r.book.id];
            }
            lib.invalidate();
          } catch {
            /* ignore */
          }
          toast.success(
            results.length === 1
              ? `Importé · ${results[0].book?.title || 'Livre'}`
              : `${results.length} livres importés`,
          );
        }
      } catch (err) {
        toast.error(err?.message || 'Échec de l’import');
        throw err;
      } finally {
        this.committing = false;
      }
      return results;
    },
    /**
     * Y — tout importer.
     * Chaque item : méta sélectionnées (API) si présentes, sinon défaut détecté.
     */
    async commitAll({ copyToLibrary = true } = {}) {
      if (!this.items.length) return [];
      this.committing = true;
      const results = [];
      const toast = useToastStore();
      try {
        for (const item of this.items) {
          const preferDraft =
            this.isDetail && this.selected?.filePath === item.filePath;
          const meta = resolveItemMetadata(item, {
            draft: this.draft,
            preferDraft,
          });
          const result = await window.vdr.import.commit({
            sourcePath: item.filePath,
            metadata: meta,
            copyToLibrary,
          });
          item.alreadyInLibrary = true;
          item.existingBookId = result.book?.id;
          this.lastImported = result.book;
          results.push(result);
        }
        this.selectedPaths = [];
        if (results.length) {
          try {
            const lib = useLibraryStore();
            for (const r of results) {
              if (r.book?.id != null) delete lib.covers[r.book.id];
            }
            lib.invalidate();
          } catch {
            /* ignore */
          }
          toast.success(
            results.length === 1
              ? `Importé · ${results[0].book?.title || 'Livre'}`
              : `${results.length} livres importés`,
          );
        }
      } catch (err) {
        toast.error(err?.message || 'Échec de l’import');
        throw err;
      } finally {
        this.committing = false;
      }
      return results;
    },
  },
});
