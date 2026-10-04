<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import ControlHint from '../components/ControlHint.vue';
import { useImportStore } from '../stores/import';
import { useUiStore } from '../stores/ui';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';
import {
  IMPORT_DETAIL_TABS,
  IMPORT_INFOS_FIELDS,
  IMPORT_SEARCH_FIELDS,
  importFieldDomId,
} from '../../../shared/import-focus.js';
import { metaSourceLabel } from '../../../shared/import-meta.js';
import { focusTextInputForEdit } from '../../../shared/virtual-keyboard.js';

const imp = useImportStore();
const ui = useUiStore();

const listHints = [
  { key: '↑↓', label: 'fichier' },
  { key: 'A', label: 'ouvrir fiche' },
  { key: 'X', label: 'Importer ce tome' },
  { key: 'Y', label: 'Tout importer' },
  { key: 'B', label: 'retour biblio' },
];

const infosHints = [
  { key: '↑↓', label: 'champ' },
  { key: 'LB/RB', label: 'onglet' },
  { key: 'A', label: 'éditer' },
  { key: 'X', label: 'Importer ce tome' },
  { key: 'B', label: 'retour liste' },
];

const searchHints = [
  { key: '↑↓', label: 'champ / résultat' },
  { key: 'LB/RB', label: 'onglet' },
  { key: 'A', label: 'appliquer / éditer' },
  { key: 'Y', label: 'lancer recherche' },
  { key: 'B', label: 'retour Infos' },
];

const hints = computed(() => {
  if (!imp.isDetail) return listHints;
  return imp.isSearchTab ? searchHints : infosHints;
});

const statusLabel = computed(() => {
  if (imp.loading) return 'Scan…';
  if (imp.committing) return 'Import en cours…';
  if (imp.isDetail) {
    const name = imp.selected?.detected?.title || imp.selected?.name || 'Tome';
    const tab = imp.isSearchTab ? 'Recherche' : 'Infos';
    return `Fiche import · ${name} · ${tab}`;
  }
  if (!imp.items.length) return 'Aucun fichier dans le dossier import';
  return `${imp.items.length} fichier(s)`;
});

onMounted(async () => {
  await imp.loadProviders();
  await imp.scan();
  imp.closeDetail();
  ui.setImportFocusZone('list');
  ui.setImportFocus(0);
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
});

watch(
  () => [
    imp.cursor,
    imp.viewMode,
    imp.detailTab,
    imp.enrichResultCursor,
    ui.importFocusIndex,
    ui.importFocusZone,
  ],
  () => nextTick(() => scheduleScrollFocusedIntoView('.import')),
);

async function openDetailAt(index) {
  const ok = await imp.openDetail(index);
  if (!ok) return;
  ui.setImportFocusZone('fields');
  ui.setImportFocus(IMPORT_INFOS_FIELDS.TITLE);
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
}

function backToList() {
  imp.closeDetail();
  ui.setImportFocusZone('list');
  ui.setImportFocus(0);
}

function switchTab(tab) {
  const next =
    tab === IMPORT_DETAIL_TABS.SEARCH
      ? IMPORT_DETAIL_TABS.SEARCH
      : IMPORT_DETAIL_TABS.INFOS;
  imp.setDetailTab(next);
  ui.setImportFocusZone('fields');
  ui.setImportFocus(
    next === IMPORT_DETAIL_TABS.SEARCH
      ? IMPORT_SEARCH_FIELDS.QUERY
      : IMPORT_INFOS_FIELDS.TITLE,
  );
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
}

async function doImportOne() {
  if (!imp.selected || imp.committing) return;
  await imp.commitSelected({ copyToLibrary: true });
  backToList();
}

async function doSearch() {
  // Sync depuis le champ DOM (clavier virtuel / Enter) avant l’IPC.
  const input = document.querySelector(
    '.import [data-import-field="query"] input',
  );
  if (input && typeof input.value === 'string') {
    imp.setSearchQuery(input.value);
  }
  await imp.enrich();
  if (imp.enrichResults.length) {
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

function onRowActivate(index) {
  return openDetailAt(index);
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
  imp.enrichResultCursor = index;
  ui.setImportFocusZone('results');
  ui.setImportFocus(index);
  imp.applyEnrichResult(imp.enrichResults[index]);
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

function dotLabel(item) {
  return metaSourceLabel(item.metaSource);
}

// Exposé pour tests / manette (commit depuis fiche)
defineExpose({ doSearch, doImportOne, switchTab, backToList });
</script>

<template>
  <section class="import" aria-label="Import">
    <div class="import__atmosphere" aria-hidden="true" />

    <header class="import__head">
      <div class="import__head-main">
        <p class="import__brand">Library Chronicles</p>
        <h1 class="import__title">
          {{ imp.isDetail ? 'Fiche import' : 'Import' }}
        </h1>
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

    <!-- FICHE DÉTAIL -->
    <template v-else>
      <nav class="import__tabs" aria-label="Onglets fiche import">
        <button
          type="button"
          class="import__tab"
          :class="{ 'is-active': imp.isInfosTab }"
          @click="switchTab(IMPORT_DETAIL_TABS.INFOS)"
        >
          Infos
        </button>
        <button
          type="button"
          class="import__tab"
          :class="{ 'is-active': imp.isSearchTab }"
          @click="switchTab(IMPORT_DETAIL_TABS.SEARCH)"
        >
          Recherche
        </button>
      </nav>

      <div class="import__scroll shell-scroll">
        <div class="import__scroll-inner">
          <!-- ONGLET INFOS -->
          <div
            v-if="imp.isInfosTab"
            class="import__detail"
            aria-label="Métadonnées d’import"
          >
            <div class="import__detail-top">
              <div class="import__cover">
                <img
                  v-if="imp.coverPreview"
                  :src="imp.coverPreview"
                  alt=""
                />
                <div v-else class="import__cover-ph">Aperçu</div>
              </div>

              <div class="import__fields">
                <div
                  class="field"
                  data-import-field="title"
                  :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.TITLE) }"
                  @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.TITLE)"
                >
                  <label>Titre</label>
                  <input
                    v-model="imp.draft.title"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                  />
                </div>
                <div
                  class="field"
                  data-import-field="series"
                  :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.SERIES) }"
                  @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.SERIES)"
                >
                  <label>Série</label>
                  <input
                    v-model="imp.draft.series"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                  />
                </div>
                <div class="import__fields-row">
                  <div
                    class="field"
                    data-import-field="volume"
                    :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.VOLUME) }"
                    @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.VOLUME)"
                  >
                    <label>Tome</label>
                    <input
                      v-model.number="imp.draft.volume"
                      type="number"
                      min="0"
                      inputmode="numeric"
                    />
                  </div>
                  <div
                    class="field"
                    data-import-field="year"
                    :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.YEAR) }"
                    @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.YEAR)"
                  >
                    <label>Année</label>
                    <input
                      v-model.number="imp.draft.year"
                      type="number"
                      min="1900"
                      inputmode="numeric"
                    />
                  </div>
                </div>
                <div
                  class="field"
                  data-import-field="author"
                  :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.AUTHOR) }"
                  @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.AUTHOR)"
                >
                  <label>Auteur</label>
                  <input
                    v-model="imp.draft.author"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                  />
                </div>
                <div
                  class="field"
                  data-import-field="synopsis"
                  :class="{ 'is-focused': fieldFocused(IMPORT_INFOS_FIELDS.SYNOPSIS) }"
                  @click="onInfosFieldActivate(IMPORT_INFOS_FIELDS.SYNOPSIS)"
                >
                  <label>Synopsis</label>
                  <textarea
                    v-model="imp.draft.description"
                    rows="3"
                    class="import__textarea"
                    inputmode="text"
                  />
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
                Résultats
                <template v-if="imp.enrichProvider"> · {{ imp.enrichProvider }}</template>
                <span class="import__enrich-hint"> · A pour appliquer</span>
              </p>
              <button
                v-for="(r, rIndex) in imp.enrichResults"
                :key="r.id || `${r.source}-${rIndex}`"
                type="button"
                class="import__enrich-item"
                :class="{ 'is-focused': resultFocused(rIndex) }"
                @click="onResultChoose(rIndex)"
              >
                <strong>{{ r.title }}</strong>
                <span>
                  {{ r.source }} · conf. {{ Math.round((r.confidence || 0) * 100) }}%
                  <template v-if="r.author"> · {{ r.author }}</template>
                  <template v-if="r.year"> · {{ r.year }}</template>
                </span>
                <span v-if="r.description" class="import__enrich-desc">
                  {{ r.description }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <footer class="import__foot">
      <ControlHint class="import__hints" :items="hints" />
    </footer>
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

.import__title {
  margin: 0.2rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.02em;
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

.import__hints {
  flex-shrink: 0;
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

.import__detail-top {
  display: flex;
  gap: 1.1rem;
  min-width: 0;
}

.import__cover {
  width: 6.5rem;
  flex-shrink: 0;
}

.import__cover img,
.import__cover-ph {
  aspect-ratio: 2 / 3;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  object-fit: cover;
}

.import__cover-ph {
  display: grid;
  place-items: center;
  background: var(--ink-800);
  color: var(--paper-dim);
  font-size: 0.8rem;
}

.import__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.import__fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
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
  transition:
    box-shadow 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.field.is-focused {
  box-shadow: 0 0 0 3px var(--focus-glow);
  background: color-mix(in srgb, var(--brass) 8%, transparent);
}

.field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--paper-dim);
}

.field input,
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
  flex-direction: column;
  gap: 0.15rem;
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.65rem 0.85rem;
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

.import__enrich-item span {
  font-size: 0.75rem;
  color: var(--paper-dim);
}

.import__enrich-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
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
  justify-content: center;
  padding: 0.5rem clamp(1rem, 2.5vw, 2.5rem) 1.1rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-950) 88%, transparent);
  backdrop-filter: blur(10px);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .import__detail-top {
    flex-direction: column;
  }

  .import__cover {
    width: 5.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .import__row,
  .import__enrich-item,
  .import__tab,
  .field {
    transition: none;
  }
}
</style>
