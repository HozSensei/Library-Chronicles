<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useImportStore } from '../stores/import';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../composables/useI18n';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';
import {
  IMPORT_DETAIL_TABS,
  IMPORT_INFOS_FIELDS,
  IMPORT_SEARCH_FIELDS,
  importFieldDomId,
} from '../../../shared/import-focus.js';
import { IMPORT_FLOW } from '../../../shared/import-flow.js';
import { metaSourceLabel, enrichResultCardFields } from '../../../shared/import-meta.js';
import { focusTextInputForEdit } from '../../../shared/virtual-keyboard.js';
import {
  META_APPLY_FIELDS,
  META_APPLY_FOCUS,
} from '../../../shared/meta-apply-fields.js';
import {
  ROUTE,
  bookDetailLocation,
  importItemLocation,
  isMetaSearchRoute,
  isSameAppLocation,
  resolveParentLocation,
} from '../../../shared/app-routes.js';

const route = useRoute();
const router = useRouter();
const imp = useImportStore();
const ui = useUiStore();
const { t } = useI18n();

const metaApplyFields = META_APPLY_FIELDS;

const listHints = computed(() => {
  const imported = Boolean(imp.selected?.alreadyInLibrary);
  return [
    { key: '↑↓', label: t('import.hintFileHeader') },
    { key: 'A', label: t('import.hintOpenSheet') },
    {
      key: 'X',
      label: imported
        ? t('import.removeFromLibrary')
        : t('import.importThis'),
    },
    { key: 'B', label: t('import.hintBackLibrary') },
  ];
});

const infosHints = computed(() => [
  { key: '↑↓', label: t('import.hintField') },
  { key: 'A', label: t('import.hintEdit') },
  { key: 'X', label: t('import.hintImportBook') },
  { key: 'Y', label: t('import.hintImportMeta') },
  { key: 'LB/RB', label: t('import.hintTab') },
  { key: 'B', label: t('import.hintBackList') },
]);

const searchHints = computed(() => [
  { key: '↑↓', label: t('import.hintFieldResult') },
  { key: 'LB/RB', label: t('import.hintTab') },
  { key: 'A', label: t('import.hintApplyEdit') },
  { key: 'Y', label: t('import.hintSearch') },
  { key: 'B', label: t('import.hintBackSheet') },
]);

const applyModalHints = computed(() => [
  { key: '↑↓', label: 'champ' },
  { key: 'A', label: 'cocher / appliquer' },
  { key: 'B', label: 'annuler' },
]);

const hints = computed(() => {
  if (imp.isApplyModalOpen) return applyModalHints.value;
  if (!imp.isDetail) return listHints.value;
  return imp.isSearchTab ? searchHints.value : infosHints.value;
});

const statusLabel = computed(() => {
  if (imp.loading) return t('import.scanning');
  if (imp.committing) return t('import.committing');
  if (imp.isDetail) {
    const name =
      imp.draft?.title ||
      imp.selected?.detected?.title ||
      imp.selected?.name ||
      'Tome';
    if (imp.isSearchTab) return `Recherche méta · ${name}`;
    return `Fiche · ${name} · brouillon`;
  }
  if (!imp.items.length) return t('import.empty');
  return `${imp.items.length} fichier(s)`;
});

const draftFormatLabel = computed(() =>
  imp.selected?.format ? String(imp.selected.format).toUpperCase() : '—',
);

const showSheetTabs = computed(
  () =>
    route.name === ROUTE.IMPORT_ITEM_META || route.name === ROUTE.IMPORT_ITEM,
);

/** Navigation sans push redondant (même name+params). */
function navigateTo(location, { replace = false } = {}) {
  if (!location || isSameAppLocation(route, location)) return Promise.resolve();
  return replace ? router.replace(location) : router.push(location);
}

/**
 * Pose le flow UI immédiatement depuis la route (avant tout await)
 * pour ne pas re-afficher la liste pendant loadDraft/scan.
 */
function applyFlowFromRoute() {
  const name = route.name;
  if (name === ROUTE.IMPORT) {
    imp.goToList();
    return;
  }
  if (name === ROUTE.IMPORT_ITEM) {
    imp.setFlow(IMPORT_FLOW.SHEET, { metaReturn: 'list', bookId: null });
    return;
  }
  if (name === ROUTE.IMPORT_ITEM_META) {
    imp.setFlow(IMPORT_FLOW.META_SEARCH, {
      metaReturn: 'sheet',
      bookId: null,
    });
    return;
  }
  if (isMetaSearchRoute(name)) {
    imp.setFlow(IMPORT_FLOW.META_SEARCH, {
      metaReturn: 'book',
      bookId: route.params.id ?? null,
    });
  }
}

/**
 * Aligne le store sur la route (source de vérité — pas d’entryIntent).
 * Ne closeDetail() pas aveuglément : sync depuis l’URL.
 * setFlow avant loadDraft : une seule transition, pas de flash liste.
 */
async function syncFromRoute() {
  const name = route.name;
  if (name === ROUTE.IMPORT) {
    applyFlowFromRoute();
    ui.setImportFocusZone('list');
    ui.setImportFocus(0);
    return;
  }

  if (name === ROUTE.IMPORT_ITEM || name === ROUTE.IMPORT_ITEM_META) {
    const ok = imp.selectByItemKey(String(route.params.itemKey || ''));
    if (!ok) {
      await navigateTo({ name: ROUTE.IMPORT }, { replace: true });
      return;
    }
    const meta = name === ROUTE.IMPORT_ITEM_META;
    applyFlowFromRoute();
    ui.setImportFocusZone('fields');
    ui.setImportFocus(
      meta ? IMPORT_SEARCH_FIELDS.QUERY : IMPORT_INFOS_FIELDS.TITLE,
    );
    await imp.loadDraftFromSelected({ keepResults: meta });
    return;
  }

  if (
    name === ROUTE.IMPORT_BOOK_META ||
    name === ROUTE.LIBRARY_BOOK_META
  ) {
    const bookId = route.params.id;
    const ok = imp.selectByBookId(bookId);
    if (!ok) {
      const parent = resolveParentLocation(route);
      if (parent) await navigateTo(parent, { replace: true });
      else await navigateTo({ name: ROUTE.IMPORT }, { replace: true });
      return;
    }
    applyFlowFromRoute();
    ui.setImportFocusZone('fields');
    ui.setImportFocus(IMPORT_SEARCH_FIELDS.QUERY);
    await imp.loadDraftFromSelected({ keepResults: true });
  }
}

onMounted(async () => {
  // Flow optimiste avant scan : évite un frame liste sur deep-link fiche/méta.
  applyFlowFromRoute();
  await imp.loadProviders();
  await imp.scan();
  await syncFromRoute();
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
});

watch(
  () => [route.name, route.params.itemKey, route.params.id],
  () => {
    void syncFromRoute().then(() =>
      nextTick(() => scheduleScrollFocusedIntoView('.import')),
    );
  },
);

watch(
  () => [
    imp.cursor,
    imp.viewMode,
    imp.detailTab,
    imp.enrichResultCursor,
    ui.importFocusIndex,
    ui.importFocusZone,
    imp.applyModalFocus,
  ],
  () => nextTick(() => scheduleScrollFocusedIntoView('.import')),
);

async function openDetailAt(index) {
  if (typeof index === 'number' && imp.items[index]) {
    imp.cursor = index;
  }
  const item = imp.selected;
  if (!item) return;
  if (item.existingBookId != null) {
    await navigateTo(bookDetailLocation(item.existingBookId, 'import'));
    return;
  }
  await navigateTo(importItemLocation(item.filePath));
}

function backToList() {
  return navigateTo({ name: ROUTE.IMPORT });
}

function goParent() {
  if (imp.isApplyModalOpen) {
    imp.cancelApplyEnrich();
    return;
  }
  const parent = resolveParentLocation(route);
  if (parent) {
    return navigateTo(parent);
  }
  return navigateTo({ name: ROUTE.LIBRARY });
}

function switchTab(tab) {
  const item = imp.selected;
  if (tab === IMPORT_DETAIL_TABS.SEARCH) {
    if (
      route.name === ROUTE.IMPORT_BOOK_META ||
      route.name === ROUTE.LIBRARY_BOOK_META ||
      route.name === ROUTE.IMPORT_ITEM_META
    ) {
      return;
    }
    if (item?.filePath) {
      return navigateTo(importItemLocation(item.filePath, { meta: true }));
    }
    return;
  }
  // Infos : rester sur sheet item — jamais remonter à la liste
  if (route.name === ROUTE.IMPORT_ITEM) return;
  if (route.name === ROUTE.IMPORT_ITEM_META && item?.filePath) {
    return navigateTo(importItemLocation(item.filePath));
  }
  const parent = resolveParentLocation(route);
  if (parent && parent.name !== ROUTE.IMPORT) {
    return navigateTo(parent);
  }
}

async function doImportOne() {
  if (!imp.selected || imp.committing) return;
  if (!imp.isDetail && imp.selected.alreadyInLibrary) {
    await imp.removeSelectedFromLibrary();
    return;
  }
  const result = await imp.commitSelected({ copyToLibrary: true });
  const bookId = result?.book?.id ?? imp.selected?.existingBookId;
  if (bookId != null) {
    await navigateTo(bookDetailLocation(bookId, 'import'));
    return;
  }
  await backToList();
}

async function doImportAll() {
  if (!imp.items.length || imp.committing) return;
  ui.setImportFocusZone('header');
  ui.setImportFocus(0);
  await imp.commitAll({ copyToLibrary: true });
}

async function openMetaSearch() {
  const item = imp.selected;
  if (!item?.filePath) {
    switchTab(IMPORT_DETAIL_TABS.SEARCH);
    return;
  }
  await navigateTo(importItemLocation(item.filePath, { meta: true }));
}

async function doSearch() {
  const input = document.querySelector(
    '.import [data-import-field="query"] input',
  );
  if (input && typeof input.value === 'string') {
    imp.setSearchQuery(input.value);
  }
  await imp.enrich();
  if (imp.enrichResults.length) {
    // Blur query : sinon A sur résultat est mangé par shouldBlockGamepadConfirmForText
    try {
      input?.blur?.();
      /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
    } catch {
      /* ignore */
    }
    ui.setImportFocusZone('results');
    ui.setImportFocus(0);
    imp.enrichResultCursor = 0;
  } else {
    ui.setImportFocusZone('fields');
    ui.setImportFocus(IMPORT_SEARCH_FIELDS.QUERY);
  }
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
}

function onSearchQueryKeydown(ev) {
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  void doSearch();
}

function onRowClick(index) {
  ui.setImportFocusZone('list');
  imp.cursor = index;
}

function onImportAllFocus() {
  ui.setImportFocusZone('header');
  ui.setImportFocus(0);
}

function onRowActivate(index) {
  return openDetailAt(index);
}

function headerFocused() {
  return !imp.isDetail && ui.importFocusZone === 'header';
}

function fieldFocused(index) {
  return (
    imp.isDetail &&
    ui.importFocusZone === 'fields' &&
    ui.importFocusIndex === index
  );
}

function resultFocused(index) {
  return (
    imp.isDetail &&
    imp.isSearchTab &&
    ui.importFocusZone === 'results' &&
    (ui.importFocusIndex === index || imp.enrichResultCursor === index)
  );
}

async function focusFieldInput(fieldIndex, tab) {
  const id = importFieldDomId(fieldIndex, tab);
  const el = document.querySelector(
    `.import [data-import-field="${id}"] input, .import [data-import-field="${id}"] textarea, .import [data-import-field="${id}"]`,
  );
  if (!el) return;
  if (el.tagName === 'SELECT') {
    el.focus?.();
    return;
  }
  if (el.tagName === 'BUTTON') {
    el.click?.();
    return;
  }
  await focusTextInputForEdit(el);
}

function onInfosFieldActivate(fieldIndex) {
  ui.setImportFocusZone('fields');
  ui.setImportFocus(fieldIndex);
  return focusFieldInput(fieldIndex, IMPORT_DETAIL_TABS.INFOS);
}

function onSearchFieldActivate(fieldIndex) {
  ui.setImportFocusZone('fields');
  ui.setImportFocus(fieldIndex);
  if (fieldIndex === IMPORT_SEARCH_FIELDS.PROVIDER) {
    return;
  }
  return focusFieldInput(fieldIndex, IMPORT_DETAIL_TABS.SEARCH);
}

function onResultChoose(index) {
  if (!imp.enrichResults[index]) return;
  try {
    /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
  } catch {
    /* ignore */
  }
  imp.enrichResultCursor = index;
  ui.setImportFocusZone('results');
  ui.setImportFocus(index);
  imp.applyEnrichCursor(index);
}

function confirmApplyModal() {
  const bookId =
    route.name === ROUTE.IMPORT_BOOK_META ||
    route.name === ROUTE.LIBRARY_BOOK_META
      ? route.params.id
      : (imp.metaReturnBookId ?? imp.selected?.existingBookId ?? null);
  const ok = imp.confirmApplyEnrich({ bookId });
  if (ok) {
    nextTick(() => scheduleScrollFocusedIntoView('.import'));
  }
}

function cancelApplyModal() {
  imp.cancelApplyEnrich();
}

function toggleApplyField(fieldId) {
  imp.toggleApplyField(fieldId);
}

function applyFieldFocused(index) {
  return imp.isApplyModalOpen && imp.applyModalFocus === index;
}

function applyButtonFocused() {
  return (
    imp.isApplyModalOpen && imp.applyModalFocus === META_APPLY_FOCUS.APPLY
  );
}

function rowTitle(item) {
  return item.selectedMeta?.title || item.detected?.title || item.name;
}

function rowSeries(item) {
  return item.selectedMeta?.series || item.detected?.series || '';
}

function rowVolume(item) {
  const v = item.selectedMeta?.volume ?? item.detected?.volume;
  return v != null ? v : null;
}

function enrichCoverSrc(result) {
  if (!result?.id) return null;
  return imp.enrichCoverPreviews[result.id] || null;
}

function enrichCard(result) {
  return enrichResultCardFields(result, {
    volumeLabel: (v) => t('import.enrichVolume', { n: v }),
  });
}

function enrichSeriesLabel(result) {
  return enrichCard(result).series;
}

function enrichVolumeLabel(result) {
  return enrichCard(result).volumeLabel;
}

function enrichSynopsisExcerpt(result) {
  return enrichCard(result).synopsis;
}

function dotLabel(item) {
  return metaSourceLabel(item.metaSource);
}

defineExpose({
  doSearch,
  doImportOne,
  doImportAll,
  switchTab,
  backToList,
  goParent,
  openMetaSearch,
  openDetailAt,
  confirmApplyModal,
  cancelApplyModal,
  syncFromRoute,
});
</script>

<template>
  <section class="import" aria-label="Import">
    <div class="import__atmosphere" aria-hidden="true" />

    <header class="import__head">
      <div class="import__head-main">
        <p class="import__brand">Library Chronicles</p>
        <div class="import__title-row">
          <h1 class="import__title">
            {{ imp.isDetail ? (imp.isSearchTab ? t('import.searchMeta') : t('import.detail')) : t('import.title') }}
          </h1>
          <button
            v-if="!imp.isDetail"
            type="button"
            class="import__import-all"
            :class="{ 'is-focused': headerFocused() }"
            :disabled="!imp.items.length || imp.committing"
            :aria-label="t('import.importAll')"
            @focus="onImportAllFocus"
            @click="doImportAll"
          >
            {{ t('import.importAll') }}
          </button>
        </div>
        <p class="import__status">{{ statusLabel }}</p>
        <p v-if="imp.root && !imp.isDetail" class="import__root">{{ imp.root }}</p>
      </div>
    </header>

    <!-- LISTE -->
    <div v-if="!imp.isDetail" class="import__scroll shell-scroll">
      <div class="import__scroll-inner">
        <div class="import__list" aria-label="Fichiers à importer">
          <button
            v-for="(item, index) in imp.items"
            :key="item.filePath"
            type="button"
            class="import__row"
            :class="{
              'is-focused': ui.importFocusZone === 'list' && index === imp.cursor,
            }"
            @click="onRowClick(index)"
            @dblclick="onRowActivate(index)"
          >
            <span
              class="import__dot"
              :class="`import__dot--${item.metaSource || 'empty'}`"
              :title="dotLabel(item)"
              :aria-label="dotLabel(item)"
            />
            <span class="import__row-body">
              <span class="import__row-title">
                {{ rowTitle(item) }}
              </span>
              <span class="import__row-meta">
                {{ item.format?.toUpperCase() }}
                <template v-if="rowSeries(item)">
                  · {{ rowSeries(item) }}
                  <template v-if="rowVolume(item) != null">
                    T{{ rowVolume(item) }}
                  </template>
                </template>
                <template v-if="item.alreadyInLibrary"> · déjà importé</template>
              </span>
            </span>

            <span
              v-if="item.alreadyInLibrary"
              class="import__done"
              title="Déjà dans la bibliothèque"
              aria-label="Déjà importé"
            >
              ✓
            </span>
          </button>

          <div
            v-if="!imp.items.length && !imp.loading"
            class="import__empty"
          >
            <p class="import__empty-title">Dossier import vide</p>
            <p class="import__empty-lead">
              Dépose des CBZ, CBR ou PDF — le dossier est rescanné automatiquement.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- FICHE DÉTAIL (brouillon non importé — même look que BookDetailView) -->
    <template v-else>
      <nav
        v-if="showSheetTabs"
        class="import__tabs"
        aria-label="Onglets fiche import"
      >
        <button
          type="button"
          class="import__tab"
          :class="{ 'is-active': imp.isInfosTab }"
          @click="switchTab(IMPORT_DETAIL_TABS.INFOS)"
        >
          {{ t('import.detail') }}
        </button>
        <button
          type="button"
          class="import__tab"
          :class="{ 'is-active': imp.isSearchTab }"
          @click="switchTab(IMPORT_DETAIL_TABS.SEARCH)"
        >
          {{ t('import.searchTab') }}
        </button>
      </nav>

      <div class="import__scroll shell-scroll">
        <div class="import__scroll-inner">
          <!-- ONGLET INFOS = fiche bibliothèque (draft) -->
          <div
            v-if="imp.isInfosTab"
            class="import__sheet"
            aria-label="Fiche livre (brouillon)"
          >
            <div class="import__sheet-hero">
              <aside class="import__sheet-cover">
                <div class="import__sheet-cover-frame">
                  <img
                    v-if="imp.coverPreview"
                    :src="imp.coverPreview"
                    alt=""
                  />
                  <div v-else class="import__cover-ph">Aperçu</div>
                </div>
              </aside>

              <div class="import__sheet-info">
                <div
                  class="field import__sheet-field import__sheet-field--title"
                  data-import-field="title"
                  :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.TITLE) }"
                  @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.TITLE)"
                >
                  <label class="visually-hidden" for="import-field-title">Titre</label>
                  <input
                    id="import-field-title"
                    class="import__sheet-headline"
                    v-model="imp.draft.title"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                  />
                </div>

                <div class="import__sheet-fields" aria-label="Métadonnées">
                  <div
                    class="field import__sheet-field import__sheet-meta"
                    data-import-field="series"
                    :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.SERIES) }"
                    @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.SERIES)"
                  >
                    <label for="import-field-series">Série</label>
                    <input
                      id="import-field-series"
                      v-model="imp.draft.series"
                      type="text"
                      inputmode="text"
                      autocomplete="off"
                    />
                  </div>

                  <div class="import__sheet-fields-row">
                    <div
                      class="field import__sheet-field import__sheet-meta"
                      data-import-field="volume"
                      :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.VOLUME) }"
                      @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.VOLUME)"
                    >
                      <label for="import-field-volume">Tome</label>
                      <input
                        id="import-field-volume"
                        v-model.number="imp.draft.volume"
                        type="number"
                        min="0"
                        inputmode="numeric"
                      />
                    </div>
                    <div
                      class="field import__sheet-field import__sheet-meta"
                      data-import-field="year"
                      :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.YEAR) }"
                      @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.YEAR)"
                    >
                      <label for="import-field-year">Année</label>
                      <input
                        id="import-field-year"
                        v-model.number="imp.draft.year"
                        type="number"
                        min="1900"
                        inputmode="numeric"
                      />
                    </div>
                  </div>

                  <div
                    class="field import__sheet-field import__sheet-meta"
                    data-import-field="author"
                    :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.AUTHOR) }"
                    @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.AUTHOR)"
                  >
                    <label for="import-field-author">Auteur</label>
                    <input
                      id="import-field-author"
                      v-model="imp.draft.author"
                      type="text"
                      inputmode="text"
                      autocomplete="off"
                    />
                  </div>

                  <div class="import__sheet-chips" aria-hidden="true">
                    <span class="import__sheet-chip">{{ draftFormatLabel }}</span>
                    <span class="import__sheet-chip">Brouillon</span>
                  </div>

                  <div
                    class="field import__sheet-field import__sheet-field--synopsis"
                    data-import-field="synopsis"
                    :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.SYNOPSIS) }"
                    @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.SYNOPSIS)"
                  >
                    <label for="import-field-synopsis">Synopsis</label>
                    <textarea
                      id="import-field-synopsis"
                      v-model="imp.draft.description"
                      rows="5"
                      class="import__textarea"
                      inputmode="text"
                      placeholder="Enrichis les métadonnées via Importer des méta."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ONGLET RECHERCHE -->
          <div
            v-else
            class="import__detail"
            aria-label="Recherche métadonnées"
          >
            <form
              class="import__search-block"
              @submit.prevent="doSearch"
            >
              <div
                class="field"
                data-import-field="query"
                :class="{ 'is-focused': fieldFocused(IMPORT_SEARCH_FIELDS.QUERY) }"
                @click="onSearchFieldActivate(IMPORT_SEARCH_FIELDS.QUERY)"
              >
                <label>Mots-clés</label>
                <input
                  :value="imp.searchQuery"
                  type="search"
                  name="import-search-query"
                  inputmode="search"
                  enterkeyhint="search"
                  autocomplete="off"
                  placeholder="Titre, série… · Entrée pour rechercher"
                  @input="imp.setSearchQuery($event.target.value)"
                  @keydown="onSearchQueryKeydown"
                />
              </div>

              <div
                class="field"
                data-import-field="provider"
                :class="{ 'is-focused': fieldFocused(IMPORT_SEARCH_FIELDS.PROVIDER) }"
                @click="
                  ui.setImportFocusZone('fields');
                  ui.setImportFocus(IMPORT_SEARCH_FIELDS.PROVIDER);
                "
              >
                <label>Source API</label>
                <select
                  class="import__select"
                  :value="imp.activeProvider"
                  @change="imp.setProvider($event.target.value)"
                >
                  <option v-for="p in imp.providers" :key="p.id" :value="p.id">
                    {{ p.label }} — {{ p.freeLabel }}
                  </option>
                </select>
                <p
                  v-if="imp.selectedProviderMeta?.helpText"
                  class="import__help"
                >
                  {{ imp.selectedProviderMeta.helpText }}
                  <button
                    v-if="imp.selectedProviderMeta.helpUrl"
                    type="button"
                    class="link-btn"
                    @click="imp.openProviderHelp(imp.selectedProviderMeta)"
                  >
                    {{ imp.selectedProviderMeta.helpLinkLabel || 'Documentation' }}
                  </button>
                </p>
              </div>

              <p class="import__search-hint">
                {{
                  imp.enrichLoading
                    ? 'Recherche…'
                    : 'Y ou Entrée pour lancer · A pour appliquer un résultat'
                }}
              </p>
            </form>

            <p
              v-if="imp.enrichWarning || imp.enrichError"
              class="import__alert"
            >
              {{ imp.enrichError || imp.enrichWarning }}
            </p>

            <div v-if="imp.enrichResults.length" class="import__enrich">
              <p class="import__enrich-label">
                {{ t('import.resultsLabel') }}
                <template v-if="imp.enrichProvider"> · {{ imp.enrichProvider }}</template>
                <span class="import__enrich-hint"> · A {{ t('import.hintApplyEdit') }}</span>
              </p>
              <button
                v-for="(r, rIndex) in imp.enrichResults"
                :key="r.id || `${r.source}-${rIndex}`"
                type="button"
                class="import__enrich-item"
                :class="{ 'is-focused': resultFocused(rIndex) }"
                @click="onResultChoose(rIndex)"
              >
                <div class="import__enrich-cover" aria-hidden="true">
                  <img
                    v-if="enrichCoverSrc(r)"
                    :src="enrichCoverSrc(r)"
                    alt=""
                  />
                  <div v-else class="import__enrich-cover-ph">—</div>
                </div>
                <div class="import__enrich-body">
                  <strong class="import__enrich-title">{{ r.title }}</strong>
                  <span
                    v-if="enrichSeriesLabel(r)"
                    class="import__enrich-series"
                  >
                    {{ t('import.enrichSeries', { name: enrichSeriesLabel(r) }) }}
                  </span>
                  <span
                    v-if="enrichVolumeLabel(r)"
                    class="import__enrich-volume"
                  >
                    {{ enrichVolumeLabel(r) }}
                  </span>
                  <p
                    v-if="enrichSynopsisExcerpt(r)"
                    class="import__enrich-synopsis"
                  >
                    {{ enrichSynopsisExcerpt(r) }}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <footer class="import__foot">
      <div
        v-if="imp.isDetail && imp.isInfosTab"
        class="import__sheet-actions"
        role="toolbar"
        aria-label="Actions fiche"
      >
        <button
          type="button"
          class="import__sheet-action is-primary"
          :disabled="imp.committing || !imp.selected"
          @click="doImportOne"
        >
          <span class="import__sheet-action-label">Importer le livre</span>
          <span class="import__sheet-action-sub">Ajouter à la bibliothèque</span>
        </button>
        <button
          type="button"
          class="import__sheet-action import__sheet-action--ghost"
          @click="openMetaSearch"
        >
          <span class="import__sheet-action-label">Importer des méta</span>
          <span class="import__sheet-action-sub">Recherche API</span>
        </button>
      </div>
      <ControlHint class="import__hints" :items="hints" />
    </footer>

    <!-- Modal apply méta sélectif -->
    <div
      v-if="imp.isApplyModalOpen"
      class="import__apply-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Champs métadonnées à appliquer"
    >
      <div class="import__apply-dialog">
        <h2 class="import__apply-title">Appliquer les métadonnées</h2>
        <p class="import__apply-lead">
          Choisis les champs à reprendre de
          « {{ imp.pendingApplyResult?.title || 'ce résultat' }} ».
        </p>
        <ul class="import__apply-list" role="list">
          <li
            v-for="(field, index) in metaApplyFields"
            :key="field.id"
          >
            <button
              type="button"
              class="import__apply-row"
              :class="{ 'is-focused': applyFieldFocused(index) }"
              :aria-pressed="Boolean(imp.applyFieldSelection[field.id])"
              @click="imp.setApplyModalFocus(index); toggleApplyField(field.id)"
            >
              <span
                class="import__apply-check"
                :class="{
                  'is-on': Boolean(imp.applyFieldSelection[field.id]),
                }"
                aria-hidden="true"
              />
              <span class="import__apply-label">{{ field.label }}</span>
            </button>
          </li>
        </ul>
        <div class="import__apply-actions">
          <button
            type="button"
            class="import__apply-confirm"
            :class="{ 'is-focused': applyButtonFocused() }"
            @click="imp.setApplyModalFocus(META_APPLY_FOCUS.APPLY); confirmApplyModal()"
          >
            Appliquer
          </button>
          <button
            type="button"
            class="import__apply-cancel"
            @click="cancelApplyModal"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.import {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  overflow-x: hidden;
  box-sizing: border-box;
}

.import__atmosphere {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 40% at 0% 0%, var(--wash-a), transparent 50%),
    var(--ink-950);
  z-index: 0;
}

.import__head,
.import__tabs,
.import__scroll,
.import__foot {
  position: relative;
  z-index: 1;
}

.import__head {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 1.25rem clamp(1rem, 2.5vw, 2.5rem) 0.85rem;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.import__brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--brass);
}

.import__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
  margin-top: 0.2rem;
  min-width: 0;
}

.import__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.import__import-all {
  appearance: none;
  flex-shrink: 0;
  padding: 0.4rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--brass) 55%, var(--border));
  border-radius: var(--radius-md);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brass) 28%, transparent),
    color-mix(in srgb, var(--brass-deep) 14%, transparent)
  );
  color: var(--paper);
  font: inherit;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    background 160ms var(--ease-soft),
    opacity 160ms var(--ease-soft);
}

.import__import-all:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.import__import-all.is-focused,
.import__import-all:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.import__status {
  margin: 0.4rem 0 0;
  color: var(--paper-dim);
}

.import__root {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--paper-dim);
  word-break: break-all;
  max-width: 56ch;
}

.import__tabs {
  flex-shrink: 0;
  display: flex;
  gap: 0.4rem;
  padding: 0 clamp(1rem, 2.5vw, 2.5rem) 0.55rem;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.import__tab {
  appearance: none;
  padding: 0.4rem 0.95rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--paper-dim);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    background 160ms var(--ease-soft),
    color 160ms var(--ease-soft);
}

.import__tab.is-active {
  border-color: color-mix(in srgb, var(--brass) 55%, var(--border));
  background: color-mix(in srgb, var(--brass) 14%, transparent);
  color: var(--paper);
}

.import__tab:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.import__scroll {
  flex: 1;
  width: 100%;
}

.import__scroll-inner {
  padding: 0.35rem clamp(1rem, 2.5vw, 2.5rem) 1rem;
  box-sizing: border-box;
  max-width: 100%;
  padding-right: max(clamp(1rem, 2.5vw, 2.5rem), 0.75rem);
}

.import__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  max-width: 48rem;
}

.import__row {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.import__row.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(3px, 0, 0);
}

/* Pastilles méta : bleu = détectées · rouge = vide · vert = sélection API */
.import__dot {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: #6b8caf;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 25%, transparent);
}

.import__dot--detected {
  background: #4a8fd4;
  color: #4a8fd4;
}

.import__dot--empty {
  background: var(--danger);
  color: var(--danger);
}

.import__dot--selected {
  background: var(--success);
  color: var(--success);
}

.import__row-body {
  flex: 1;
  min-width: 0;
}

.import__row-title {
  display: block;
  font-family: var(--font-display);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import__row-meta {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.75rem;
  color: var(--paper-dim);
}

.import__done {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  border: 1px solid var(--success);
  background: color-mix(in srgb, var(--success) 22%, transparent);
  color: var(--success);
  font-size: 0.7rem;
  font-weight: 800;
}

.import__empty {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 2rem 1.25rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--paper-dim);
  min-height: 10rem;
}

.import__empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--paper);
}

.import__empty-lead {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

.import__detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  max-width: 52rem;
}

/* Fiche brouillon — même composition que BookDetailView */
.import__sheet {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
  max-width: 64rem;
}

.import__sheet-hero {
  display: grid;
  grid-template-columns: clamp(9rem, 22vw, 15rem) minmax(0, 1fr);
  gap: 1.35rem clamp(1.25rem, 3vw, 2.5rem);
  align-items: start;
  min-width: 0;
}

.import__sheet-cover {
  width: 100%;
  min-width: 0;
}

.import__sheet-cover-frame {
  position: relative;
  isolation: isolate;
  aspect-ratio: 2 / 3;
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--ink-800);
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

.import__sheet-cover-frame img,
.import__cover-ph {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.import__cover-ph {
  display: grid;
  place-items: center;
  background: var(--ink-800);
  color: var(--paper-dim);
  font-size: 0.8rem;
  position: absolute;
  inset: 0;
}

.import__sheet-info {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.import__sheet-fields {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.import__sheet-fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 1rem;
  min-width: 0;
}

.import__sheet-field {
  border-radius: var(--radius-sm);
  min-width: 0;
}

.import__sheet-headline {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--paper);
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 3vw, 2.25rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.import__sheet-meta {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.15rem;
}

.import__sheet-meta label,
.import__sheet-field--synopsis label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brass);
}

.import__sheet-meta input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--paper);
  padding: 0.55rem 0.65rem;
  font: inherit;
  font-size: 0.98rem;
  font-weight: 600;
}

.import__sheet-field--synopsis {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.15rem;
  margin-top: 0.15rem;
}

.import__sheet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.15rem 0.15rem 0.25rem;
}

.import__sheet-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--paper);
  font-size: 0.75rem;
  font-weight: 600;
}

.import__sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
  min-width: 0;
  max-width: 100%;
}

.import__sheet-action {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--paper);
  font: inherit;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.import__sheet-action.is-primary {
  border-color: color-mix(in srgb, var(--brass) 55%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brass) 28%, transparent),
    color-mix(in srgb, var(--brass-deep) 14%, transparent)
  );
}

.import__sheet-action--ghost {
  color: var(--paper-dim);
  background: transparent;
}

.import__sheet-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.import__sheet-action:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  color: var(--paper);
}

.import__sheet-action-label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
}

.import__sheet-action-sub {
  font-size: 0.7rem;
  color: var(--paper-dim);
  white-space: nowrap;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.import__search-block {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin: 0;
}

.import__search-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
}

.field {
  border-radius: var(--radius-sm);
  padding: 0.15rem;
}

/* Anneau sur le contrôle uniquement — pas de halo sur le wrapper .field */
.field.is-focused {
  outline: none;
  box-shadow: none;
  background: transparent;
}

.field.is-focused .import__sheet-headline,
.field.is-focused.import__sheet-meta input,
.field.is-focused .import__textarea,
.field.is-focused input:not(.import__sheet-headline),
.field.is-focused select {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--paper-dim);
}

.import__sheet-meta label {
  margin-bottom: 0;
  color: var(--brass);
}

.field input:not(.import__sheet-headline),
.import__select,
.import__textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--paper);
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  font: inherit;
}

.import__textarea {
  resize: vertical;
  min-height: 6.5rem;
  line-height: 1.55;
  font-weight: 400;
}

.import__help {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--paper-dim);
}

.link-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--brass-bright);
  text-decoration: underline;
  padding: 0;
  margin-left: 0.35rem;
  font: inherit;
  cursor: pointer;
}

.import__alert {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  font-size: 0.875rem;
}

.import__enrich-label {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--brass);
}

.import__enrich-hint {
  color: var(--paper-dim);
  letter-spacing: 0;
  text-transform: none;
  font-size: 0.75rem;
}

.import__enrich-item {
  appearance: none;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.9rem;
  width: 100%;
  margin-top: 0.55rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.import__enrich-cover {
  width: 4.25rem;
  flex-shrink: 0;
}

.import__enrich-cover img,
.import__enrich-cover-ph {
  aspect-ratio: 2 / 3;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  object-fit: cover;
  background: var(--ink-800);
}

.import__enrich-cover-ph {
  display: grid;
  place-items: center;
  color: var(--paper-dim);
  font-size: 0.75rem;
}

.import__enrich-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.22rem;
  padding: 0.1rem 0;
}

.import__enrich-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.import__enrich-series,
.import__enrich-volume {
  font-size: 0.8rem;
  color: var(--paper-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import__enrich-volume {
  color: var(--brass-bright);
  font-weight: 600;
}

.import__enrich-synopsis {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--paper-dim);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.import__enrich-item.is-focused,
.import__enrich-item:hover {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  background: color-mix(in srgb, var(--brass) 10%, var(--surface));
}

.import__foot {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0.65rem clamp(1rem, 2.5vw, 2.5rem) 1.1rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-950) 88%, transparent);
  backdrop-filter: blur(10px);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.import__hints {
  flex-shrink: 0;
  align-self: center;
}

@media (max-width: 720px) {
  .import__sheet-hero {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .import__sheet-cover {
    width: min(11rem, 48vw);
    justify-self: center;
  }

  .import__sheet-fields-row {
    grid-template-columns: 1fr;
  }

  .import__sheet-actions {
    flex-direction: column;
  }

  .import__sheet-action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .import__row,
  .import__enrich-item,
  .import__tab,
  .import__sheet-action,
  .import__import-all,
  .field {
    transition: none;
  }
}

.import__apply-modal {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: color-mix(in srgb, var(--ink-950) 72%, transparent);
  backdrop-filter: blur(8px);
}

.import__apply-dialog {
  width: min(26rem, 100%);
  max-height: min(85vh, 36rem);
  overflow: auto;
  padding: 1.15rem 1.25rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--ink-900, var(--ink-950));
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
}

.import__apply-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--paper);
}

.import__apply-lead {
  margin: 0.45rem 0 0.9rem;
  font-size: 0.88rem;
  color: var(--paper-dim);
}

.import__apply-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.import__apply-row {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--paper);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.import__apply-row.is-focused,
.import__apply-row:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.import__apply-check {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: transparent;
}

.import__apply-check.is-on {
  border-color: var(--brass);
  background:
    linear-gradient(135deg, var(--brass), var(--brass-deep, var(--brass)));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ink-950) 35%, transparent);
}

.import__apply-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.import__apply-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.import__apply-confirm,
.import__apply-cancel {
  appearance: none;
  padding: 0.55rem 0.95rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font: inherit;
  font-family: var(--font-display);
  font-weight: 700;
  cursor: pointer;
}

.import__apply-confirm {
  color: var(--paper);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brass) 28%, transparent),
    color-mix(in srgb, var(--brass-deep, var(--brass)) 14%, transparent)
  );
  border-color: color-mix(in srgb, var(--brass) 55%, var(--border));
}

.import__apply-confirm.is-focused,
.import__apply-confirm:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.import__apply-cancel {
  color: var(--paper-dim);
  background: transparent;
}

</style>
