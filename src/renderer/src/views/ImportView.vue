<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useImportStore } from '../stores/import';
import { useUiStore } from '../stores/ui';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const router = useRouter();
const imp = useImportStore();
const ui = useUiStore();

const hints = [
  { key: '↑↓', label: 'tome' },
  { key: 'A', label: 'sélection' },
  { key: '←→', label: 'actions' },
  { key: 'Y', label: 'enrichir' },
  { key: 'B', label: 'retour' },
];

const statusLabel = computed(() => {
  if (imp.loading) return 'Scan…';
  if (imp.committing) return 'Import en cours…';
  if (!imp.items.length) return 'Aucun fichier dans le dossier import';
  const sel = imp.selectedCount;
  const base = `${imp.items.length} fichier(s)`;
  return sel ? `${base} · ${sel} sélectionné(s)` : base;
});

const enrichSubtitle = computed(() => {
  if (imp.enrichLoading) return 'Recherche…';
  const p = imp.selectedProviderMeta;
  if (!p) return 'Métadonnées';
  return p.label;
});

const importSelectionLabel = computed(() => {
  if (imp.committing) return 'Import…';
  const n = imp.selectedCount;
  if (n > 0) return `Importer (${n})`;
  return 'Importer sélection';
});

onMounted(async () => {
  await imp.loadProviders();
  await imp.scan();
  ui.setImportFocusZone('list');
  ui.setImportFocus(0);
  nextTick(() => scheduleScrollFocusedIntoView('.import'));
});

watch(
  () => [imp.cursor, ui.importFocusIndex, ui.importFocusZone],
  () => nextTick(() => scheduleScrollFocusedIntoView('.import')),
);

async function doImportSelection() {
  await imp.commitSelection({ copyToLibrary: true });
}

async function doImportAll() {
  if (!imp.items.length) return;
  await imp.commitAll({ copyToLibrary: true });
}

async function doEnrich() {
  await imp.enrich();
}

function activateFooterAction(id) {
  if (id === 'import-selection') return doImportSelection();
  if (id === 'import-all') return doImportAll();
  if (id === 'enrich') return doEnrich();
  if (id === 'rescan') return imp.scan();
  if (id === 'back') return router.push({ name: 'library' });
}

function onRowClick(index) {
  ui.setImportFocusZone('list');
  imp.cursor = index;
  imp.loadDraftFromSelected();
}

function onRowToggle(index, event) {
  event?.stopPropagation?.();
  imp.cursor = index;
  imp.toggleSelect(imp.items[index]?.filePath);
}

function footerFocused(index) {
  return ui.importFocusZone === 'actions' && ui.importFocusIndex === index;
}
</script>

<template>
  <section class="import" aria-label="Import">
    <div class="import__atmosphere" aria-hidden="true" />

    <header class="import__head">
      <div class="import__head-main">
        <p class="import__brand">Vertical Deck Reader</p>
        <h1 class="import__title">Import</h1>
        <p class="import__status">{{ statusLabel }}</p>
        <p v-if="imp.root" class="import__root">{{ imp.root }}</p>
      </div>
      <ControlHint class="import__hints" :items="hints" />
    </header>

    <div class="import__scroll shell-scroll">
      <div class="import__scroll-inner">
        <div class="import__layout">
          <aside class="import__list" aria-label="Fichiers à importer">
            <button
              v-for="(item, index) in imp.items"
              :key="item.filePath"
              type="button"
              class="import__row"
              :class="{
                'is-focused': ui.importFocusZone === 'list' && index === imp.cursor,
                'is-picked': imp.isPathSelected(item.filePath),
              }"
              :aria-pressed="imp.isPathSelected(item.filePath)"
              @click="onRowClick(index)"
            >
              <span
                class="import__pick"
                :class="{ 'is-on': imp.isPathSelected(item.filePath) }"
                role="presentation"
                @click="onRowToggle(index, $event)"
              >
                <span class="import__pick-mark" aria-hidden="true">✓</span>
              </span>

              <span class="import__row-body">
                <span class="import__row-title">
                  {{ item.detected?.title || item.name }}
                </span>
                <span class="import__row-meta">
                  {{ item.format?.toUpperCase() }}
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
                Dépose des CBZ, CBR ou PDF, puis Rescanner.
              </p>
            </div>
          </aside>

          <div
            v-if="!imp.selected && !imp.loading"
            class="import__detail import__detail--idle"
          >
            <p class="import__empty-title">Sélectionne un tome</p>
            <p class="import__empty-lead">
              ↑↓ naviguer · A cocher · footer pour importer
            </p>
          </div>

          <div v-else-if="imp.selected" class="import__detail">
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
                <div class="field">
                  <label>Provider métadonnées</label>
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
                <div class="field">
                  <label>Titre</label>
                  <input v-model="imp.draft.title" type="text" inputmode="text" autocomplete="off" />
                </div>
                <div class="field">
                  <label>Série</label>
                  <input v-model="imp.draft.series" type="text" inputmode="text" autocomplete="off" />
                </div>
                <div class="import__fields-row">
                  <div class="field">
                    <label>Tome</label>
                    <input v-model.number="imp.draft.volume" type="number" min="0" inputmode="numeric" />
                  </div>
                  <div class="field">
                    <label>Année</label>
                    <input v-model.number="imp.draft.year" type="number" min="1900" inputmode="numeric" />
                  </div>
                </div>
                <div class="field">
                  <label>Auteur</label>
                  <input v-model="imp.draft.author" type="text" inputmode="text" autocomplete="off" />
                </div>
                <div class="field">
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
              </p>
              <button
                v-for="r in imp.enrichResults"
                :key="r.id"
                type="button"
                class="import__enrich-item"
                @click="imp.applyEnrichResult(r)"
              >
                <strong>{{ r.title }}</strong>
                <span>
                  {{ r.source }} · conf. {{ Math.round((r.confidence || 0) * 100) }}%
                  <template v-if="r.author"> · {{ r.author }}</template>
                </span>
                <span v-if="r.description" class="import__enrich-desc">
                  {{ r.description }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="import__foot">
      <div class="import__actions" role="toolbar" aria-label="Actions import">
        <button
          type="button"
          class="import__action"
          :class="{
            'is-focused': footerFocused(0),
            'is-primary': true,
          }"
          :disabled="imp.committing || (!imp.items.length)"
          @click="activateFooterAction('import-selection')"
        >
          <span class="import__action-label">{{ importSelectionLabel }}</span>
          <span class="import__action-sub">Sélection ou tome focus</span>
        </button>
        <button
          type="button"
          class="import__action"
          :class="{ 'is-focused': footerFocused(1) }"
          :disabled="imp.committing || !imp.items.length"
          @click="activateFooterAction('import-all')"
        >
          <span class="import__action-label">Tout importer</span>
          <span class="import__action-sub">{{ imp.items.length || 0 }} fichier(s)</span>
        </button>
        <button
          type="button"
          class="import__action"
          :class="{ 'is-focused': footerFocused(2) }"
          :disabled="!imp.selected || imp.enrichLoading"
          @click="activateFooterAction('enrich')"
        >
          <span class="import__action-label">
            {{ imp.enrichLoading ? 'Enrichissement…' : 'Enrichir' }}
          </span>
          <span class="import__action-sub">{{ enrichSubtitle }}</span>
        </button>
        <button
          type="button"
          class="import__action import__action--ghost"
          :class="{ 'is-focused': footerFocused(3) }"
          @click="activateFooterAction('rescan')"
        >
          <span class="import__action-label">Rescanner</span>
        </button>
        <button
          type="button"
          class="import__action import__action--ghost"
          :class="{ 'is-focused': footerFocused(4) }"
          @click="activateFooterAction('back')"
        >
          <span class="import__action-label">Retour</span>
        </button>
      </div>
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

.import__scroll {
  flex: 1;
  width: 100%;
}

.import__scroll-inner {
  padding: 0.35rem clamp(1rem, 2.5vw, 2.5rem) 1rem;
  box-sizing: border-box;
  max-width: 100%;
  /* Réserve l’espace scrollbar-gutter sans manger le contenu utile */
  padding-right: max(clamp(1rem, 2.5vw, 2.5rem), 0.75rem);
}

.import__layout {
  display: grid;
  grid-template-columns: minmax(14rem, 40%) minmax(0, 1fr);
  gap: 1.25rem;
  min-width: 0;
  max-width: 100%;
}

.import__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
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
  padding: 0.7rem 0.85rem;
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

.import__row.is-picked {
  background: color-mix(in srgb, var(--brass) 10%, var(--surface));
}

.import__row.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(3px, 0, 0);
}

.import__pick {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 0.35rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-800) 80%, transparent);
  color: transparent;
  transition:
    border-color 140ms var(--ease-soft),
    background 140ms var(--ease-soft),
    color 140ms var(--ease-soft);
}

.import__pick.is-on {
  border-color: var(--brass-bright);
  background: color-mix(in srgb, var(--brass) 28%, transparent);
  color: var(--brass-bright);
}

.import__pick-mark {
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
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

.import__empty,
.import__detail--idle {
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
  gap: 0.85rem;
  min-width: 0;
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

.import__enrich-item {
  appearance: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
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

.import__enrich-item:hover {
  border-color: var(--brass);
}

.import__foot {
  flex-shrink: 0;
  padding: 0.75rem clamp(1rem, 2.5vw, 2.5rem) 1.1rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-950) 88%, transparent);
  backdrop-filter: blur(10px);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
}

.import__action {
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

.import__action.is-primary {
  border-color: color-mix(in srgb, var(--brass) 55%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brass) 20%, transparent),
    color-mix(in srgb, var(--brass-deep) 10%, transparent)
  );
}

.import__action--ghost {
  color: var(--paper-dim);
  background: transparent;
}

.import__action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.import__action.is-focused,
.import__action:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  color: var(--paper);
}

.import__action-label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
}

.import__action-sub {
  font-size: 0.7rem;
  color: var(--paper-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 12rem;
}

@media (max-width: 900px) {
  .import__layout {
    grid-template-columns: 1fr;
  }

  .import__detail-top {
    flex-direction: column;
  }

  .import__cover {
    width: 5.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .import__row,
  .import__action {
    transition: none;
  }
}
</style>
