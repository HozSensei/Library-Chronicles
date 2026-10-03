<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';
import { BOOK_FOCUS } from '../../../shared/book-focus.js';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();

const book = ref(null);
const loading = ref(true);

const synopsis = computed(() => {
  const b = book.value;
  if (!b) return '';
  return b.metadata?.description || b.metadata?.synopsis || '';
});

const statusLabel = computed(() => {
  const s = book.value?.status;
  if (s === 'reading') return 'En cours';
  if (s === 'finished') return 'Terminé';
  return 'Non lu';
});

const pagesLabel = computed(() => {
  const b = book.value;
  if (!b) return '—';
  return `${b.pageCurrent + 1} / ${b.pageTotal || '?'}`;
});

const providerLabel = computed(() => {
  const b = book.value;
  if (!b) return '—';
  const meta = b.metadata || {};
  return (
    meta.source ||
    meta.provider ||
    meta.providerId ||
    (b.format ? String(b.format).toUpperCase() : '—')
  );
});

const statusHint = computed(() => {
  if (!book.value) return 'Fiche';
  const fmt = (book.value.format || '?').toUpperCase();
  return `${fmt} · ${statusLabel.value} · p. ${pagesLabel.value}`;
});

const hints = [
  { key: '↑↓', label: 'champ' },
  { key: 'A', label: 'lire' },
  { key: 'B', label: 'retour' },
];

onMounted(async () => {
  await library.refresh();
  const id = route.params.id;
  book.value = library.books.find((b) => String(b.id) === String(id)) || null;
  if (book.value?.id) await library.ensureCover(book.value.id);
  loading.value = false;
  ui.setBookFocus(BOOK_FOCUS.READ);
  nextTick(() => scheduleScrollFocusedIntoView('.book-detail'));
});

watch(
  () => ui.bookFocusIndex,
  () => nextTick(() => scheduleScrollFocusedIntoView('.book-detail')),
);

/** Entrée lecteur uniquement — jamais de resize ici (route book ≠ reader). */
function read() {
  if (!book.value?.filePath) return;
  router.push({ name: 'reader', query: { path: book.value.filePath } });
}

function back() {
  router.push({ name: 'library' });
}

function goImport() {
  router.push({ name: 'import' });
}

function focusField(index) {
  ui.setBookFocus(index);
}

function fieldFocused(index) {
  return ui.bookFocusIndex === index;
}

function footerFocused(index) {
  return ui.bookFocusIndex === index;
}

function activateFooter(index) {
  ui.setBookFocus(index);
  if (index === BOOK_FOCUS.READ) return read();
  if (index === BOOK_FOCUS.BACK) return back();
  if (index === BOOK_FOCUS.OPTIONS) return goImport();
}

function display(value) {
  if (value == null || value === '') return '—';
  return String(value);
}
</script>

<template>
  <section class="book-detail" aria-label="Fiche livre">
    <div class="book-detail__atmosphere" aria-hidden="true" />

    <header class="book-detail__head">
      <div class="book-detail__head-main">
        <p class="book-detail__brand">Vertical Deck Reader</p>
        <h1 class="book-detail__title">Fiche livre</h1>
        <p class="book-detail__status">{{ loading ? 'Chargement…' : statusHint }}</p>
      </div>
      <ControlHint class="book-detail__hints" :items="hints" />
    </header>

    <div v-if="loading" class="book-detail__state">Chargement…</div>

    <div v-else-if="!book" class="book-detail__state book-detail__state--stack">
      <p class="book-detail__empty-title">Livre introuvable</p>
      <button
        type="button"
        class="book-detail__action is-primary"
        :class="{ 'is-focused': true }"
        @click="back"
      >
        <span class="book-detail__action-label">Retour bibliothèque</span>
      </button>
    </div>

    <template v-else>
      <div class="book-detail__scroll shell-scroll">
        <div class="book-detail__scroll-inner">
          <div class="book-detail__panel" aria-label="Détails du tome">
            <div class="book-detail__top">
              <aside class="book-detail__cover" aria-hidden="true">
                <div class="book-detail__cover-frame">
                  <LazyCover
                    :book-id="book.id"
                    :alt="book.title"
                    :format="book.format"
                    eager
                  />
                </div>
              </aside>

              <div class="book-detail__fields">
                <div
                  class="field book-detail__field"
                  :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.TITLE) }"
                  data-book-field="title"
                  @click="focusField(BOOK_FOCUS.TITLE)"
                >
                  <label for="book-field-title">Titre</label>
                  <input
                    id="book-field-title"
                    type="text"
                    :value="display(book.title)"
                    readonly
                    tabindex="0"
                    aria-readonly="true"
                    @focus="focusField(BOOK_FOCUS.TITLE)"
                  />
                </div>

                <div
                  class="field book-detail__field"
                  :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.SERIES) }"
                  data-book-field="series"
                  @click="focusField(BOOK_FOCUS.SERIES)"
                >
                  <label for="book-field-series">Série</label>
                  <input
                    id="book-field-series"
                    type="text"
                    :value="display(book.series)"
                    readonly
                    tabindex="0"
                    aria-readonly="true"
                    @focus="focusField(BOOK_FOCUS.SERIES)"
                  />
                </div>

                <div class="book-detail__fields-row">
                  <div
                    class="field book-detail__field"
                    :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.VOLUME) }"
                    data-book-field="volume"
                    @click="focusField(BOOK_FOCUS.VOLUME)"
                  >
                    <label for="book-field-volume">Tome</label>
                    <input
                      id="book-field-volume"
                      type="text"
                      :value="display(book.volume)"
                      readonly
                      tabindex="0"
                      aria-readonly="true"
                      @focus="focusField(BOOK_FOCUS.VOLUME)"
                    />
                  </div>
                  <div
                    class="field book-detail__field"
                    :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.YEAR) }"
                    data-book-field="year"
                    @click="focusField(BOOK_FOCUS.YEAR)"
                  >
                    <label for="book-field-year">Année</label>
                    <input
                      id="book-field-year"
                      type="text"
                      :value="display(book.year)"
                      readonly
                      tabindex="0"
                      aria-readonly="true"
                      @focus="focusField(BOOK_FOCUS.YEAR)"
                    />
                  </div>
                </div>

                <div
                  class="field book-detail__field"
                  :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.AUTHOR) }"
                  data-book-field="author"
                  @click="focusField(BOOK_FOCUS.AUTHOR)"
                >
                  <label for="book-field-author">Auteur</label>
                  <input
                    id="book-field-author"
                    type="text"
                    :value="display(book.author)"
                    readonly
                    tabindex="0"
                    aria-readonly="true"
                    @focus="focusField(BOOK_FOCUS.AUTHOR)"
                  />
                </div>

                <div class="book-detail__fields-row">
                  <div
                    class="field book-detail__field"
                    :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.STATUS) }"
                    data-book-field="status"
                    @click="focusField(BOOK_FOCUS.STATUS)"
                  >
                    <label for="book-field-status">Statut</label>
                    <input
                      id="book-field-status"
                      type="text"
                      :value="statusLabel"
                      readonly
                      tabindex="0"
                      aria-readonly="true"
                      @focus="focusField(BOOK_FOCUS.STATUS)"
                    />
                  </div>
                  <div
                    class="field book-detail__field"
                    :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.PAGES) }"
                    data-book-field="pages"
                    @click="focusField(BOOK_FOCUS.PAGES)"
                  >
                    <label for="book-field-pages">Pages</label>
                    <input
                      id="book-field-pages"
                      type="text"
                      :value="pagesLabel"
                      readonly
                      tabindex="0"
                      aria-readonly="true"
                      @focus="focusField(BOOK_FOCUS.PAGES)"
                    />
                  </div>
                </div>

                <div
                  class="field book-detail__field"
                  :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.PROVIDER) }"
                  data-book-field="provider"
                  @click="focusField(BOOK_FOCUS.PROVIDER)"
                >
                  <label for="book-field-provider">Provider</label>
                  <input
                    id="book-field-provider"
                    type="text"
                    :value="providerLabel"
                    readonly
                    tabindex="0"
                    aria-readonly="true"
                    @focus="focusField(BOOK_FOCUS.PROVIDER)"
                  />
                </div>
              </div>
            </div>

            <div
              class="field book-detail__field book-detail__field--synopsis"
              :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.SYNOPSIS) }"
              data-book-field="synopsis"
              @click="focusField(BOOK_FOCUS.SYNOPSIS)"
            >
              <label for="book-field-synopsis">Synopsis</label>
              <textarea
                id="book-field-synopsis"
                class="book-detail__textarea"
                rows="4"
                :value="
                  synopsis ||
                  'Aucune synopsis pour ce tome. Enrichis les métadonnées à l’import.'
                "
                readonly
                tabindex="0"
                aria-readonly="true"
                @focus="focusField(BOOK_FOCUS.SYNOPSIS)"
              />
            </div>
          </div>
        </div>
      </div>

      <footer class="book-detail__foot">
        <div class="book-detail__actions" role="toolbar" aria-label="Actions fiche">
          <button
            type="button"
            class="book-detail__action is-primary"
            :data-book-action="BOOK_FOCUS.READ"
            :class="{ 'is-focused': footerFocused(BOOK_FOCUS.READ) }"
            :disabled="!book.filePath"
            @click="activateFooter(BOOK_FOCUS.READ)"
          >
            <span class="book-detail__action-label">Lire</span>
            <span class="book-detail__action-sub">Ouvrir le lecteur</span>
          </button>
          <button
            type="button"
            class="book-detail__action book-detail__action--ghost"
            :data-book-action="BOOK_FOCUS.BACK"
            :class="{ 'is-focused': footerFocused(BOOK_FOCUS.BACK) }"
            @click="activateFooter(BOOK_FOCUS.BACK)"
          >
            <span class="book-detail__action-label">Retour</span>
            <span class="book-detail__action-sub">Bibliothèque</span>
          </button>
          <button
            type="button"
            class="book-detail__action book-detail__action--ghost"
            :data-book-action="BOOK_FOCUS.OPTIONS"
            :class="{ 'is-focused': footerFocused(BOOK_FOCUS.OPTIONS) }"
            @click="activateFooter(BOOK_FOCUS.OPTIONS)"
          >
            <span class="book-detail__action-label">Options</span>
            <span class="book-detail__action-sub">Import / meta</span>
          </button>
        </div>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.book-detail {
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

.book-detail__atmosphere {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 40% at 0% 0%, var(--wash-a), transparent 50%),
    var(--ink-950);
  z-index: 0;
}

.book-detail__head,
.book-detail__scroll,
.book-detail__foot,
.book-detail__state {
  position: relative;
  z-index: 1;
}

.book-detail__head {
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

.book-detail__brand {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--brass);
}

.book-detail__title {
  margin: 0.2rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.book-detail__status {
  margin: 0.4rem 0 0;
  color: var(--paper-dim);
}

.book-detail__hints {
  flex-shrink: 0;
}

.book-detail__state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--paper-dim);
  min-height: 0;
  padding: 1.5rem;
}

.book-detail__state--stack {
  flex-direction: column;
  gap: 0.85rem;
}

.book-detail__empty-title {
  margin: 0;
  font-weight: 700;
  color: var(--paper);
  font-size: 1.15rem;
}

.book-detail__scroll {
  flex: 1;
  width: 100%;
}

.book-detail__scroll-inner {
  padding: 0.35rem clamp(1rem, 2.5vw, 2.5rem) 1rem;
  box-sizing: border-box;
  max-width: 100%;
  padding-right: max(clamp(1rem, 2.5vw, 2.5rem), 0.75rem);
}

.book-detail__panel {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
  max-width: 56rem;
}

.book-detail__top {
  display: flex;
  gap: 1.25rem;
  min-width: 0;
  align-items: flex-start;
}

.book-detail__cover {
  width: clamp(7.5rem, 18vw, 10.5rem);
  flex-shrink: 0;
}

.book-detail__cover-frame {
  aspect-ratio: 2 / 3;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--ink-800);
  overflow: hidden;
}

.book-detail__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.book-detail__fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.book-detail__field {
  border-radius: var(--radius-sm);
  transition:
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft);
}

.book-detail__field input,
.book-detail__textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  cursor: default;
  /* Lecture seule : garde le look formulaire Import, focus manette sur le wrapper */
  opacity: 1;
  color: var(--paper);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.book-detail__textarea {
  resize: none;
  line-height: 1.5;
  min-height: 6.5rem;
  white-space: pre-wrap;
}

.book-detail__field.is-focused,
.book-detail__field:focus-within {
  outline: none;
  transform: translate3d(2px, 0, 0);
}

.book-detail__field.is-focused input,
.book-detail__field.is-focused .book-detail__textarea,
.book-detail__field:focus-within input,
.book-detail__field:focus-within .book-detail__textarea {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.book-detail__foot {
  flex-shrink: 0;
  padding: 0.75rem clamp(1rem, 2.5vw, 2.5rem) 1.1rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-950) 88%, transparent);
  backdrop-filter: blur(10px);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.book-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
}

.book-detail__action {
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

.book-detail__action.is-primary {
  border-color: color-mix(in srgb, var(--brass) 55%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brass) 20%, transparent),
    color-mix(in srgb, var(--brass-deep) 10%, transparent)
  );
}

.book-detail__action--ghost {
  color: var(--paper-dim);
  background: transparent;
}

.book-detail__action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.book-detail__action.is-focused,
.book-detail__action:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  color: var(--paper);
}

.book-detail__action-label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
}

.book-detail__action-sub {
  font-size: 0.7rem;
  color: var(--paper-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 12rem;
}

@media (max-width: 720px) {
  .book-detail__top {
    flex-direction: column;
    align-items: stretch;
  }

  .book-detail__cover {
    width: min(9rem, 42vw);
    align-self: center;
  }
}

@media (max-width: 560px) {
  .book-detail__fields-row {
    grid-template-columns: 1fr;
  }

  .book-detail__actions {
    flex-direction: column;
  }

  .book-detail__action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-detail__field,
  .book-detail__action {
    transition: none;
  }

  .book-detail__field.is-focused,
  .book-detail__field:focus-within {
    transform: none;
  }
}
</style>
