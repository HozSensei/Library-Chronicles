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

const synopsisDisplay = computed(
  () =>
    synopsis.value ||
    'Aucune synopsis pour ce tome. Enrichis les métadonnées à l’import.',
);

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

const formatLabel = computed(() =>
  book.value?.format ? String(book.value.format).toUpperCase() : '—',
);

const statusHint = computed(() => {
  if (!book.value) return 'Fiche';
  return `${formatLabel.value} · ${statusLabel.value} · p. ${pagesLabel.value}`;
});

/** Autres tomes de la même série — rail sous le contenu (jamais stacked sur la méta). */
const seriesRail = computed(() => {
  const current = book.value;
  if (!current?.series) return [];
  const key = String(current.series).trim().toLowerCase();
  if (!key) return [];
  return (library.books || [])
    .filter((b) => String(b.series || '').trim().toLowerCase() === key)
    .slice()
    .sort((a, b) => {
      const va = Number(a.volume);
      const vb = Number(b.volume);
      const aOk = Number.isFinite(va);
      const bOk = Number.isFinite(vb);
      if (aOk && bOk && va !== vb) return va - vb;
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return String(a.title || '').localeCompare(String(b.title || ''), 'fr');
    });
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
  () => route.params.id,
  async (id) => {
    if (!id) return;
    loading.value = true;
    await library.refresh();
    book.value = library.books.find((b) => String(b.id) === String(id)) || null;
    if (book.value?.id) await library.ensureCover(book.value.id);
    loading.value = false;
    ui.setBookFocus(BOOK_FOCUS.READ);
    nextTick(() => scheduleScrollFocusedIntoView('.book-detail'));
  },
);

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

function openSibling(id) {
  if (!id || String(id) === String(book.value?.id)) return;
  router.push({ name: 'book', params: { id: String(id) } });
}

function openSeriesPage() {
  const b = book.value;
  if (!b) return;
  const sid =
    b.seriesId ||
    library.seriesGroups.find(
      (g) =>
        String(g.series || '')
          .trim()
          .toLowerCase() === String(b.series || '').trim().toLowerCase(),
    )?.seriesId;
  if (!sid) return;
  router.push({ name: 'series', params: { seriesId: String(sid) } });
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
          <!-- Hero : cover portrait + méta — grid, jamais absolute overlapping -->
          <div class="book-detail__hero" aria-label="Détails du tome">
            <aside class="book-detail__cover">
              <div class="book-detail__cover-frame">
                <LazyCover
                  :book-id="book.id"
                  :alt="book.title"
                  :format="book.format"
                  eager
                />
              </div>
            </aside>

            <div class="book-detail__info">
              <div
                class="field book-detail__field book-detail__field--title"
                :class="{ 'is-focused': fieldFocused(BOOK_FOCUS.TITLE) }"
                data-book-field="title"
                @click="focusField(BOOK_FOCUS.TITLE)"
              >
                <label class="visually-hidden" for="book-field-title">Titre</label>
                <input
                  id="book-field-title"
                  class="book-detail__headline"
                  type="text"
                  :value="display(book.title)"
                  readonly
                  tabindex="0"
                  aria-readonly="true"
                  @focus="focusField(BOOK_FOCUS.TITLE)"
                />
              </div>

              <div class="book-detail__fields" aria-label="Métadonnées">
                <div
                  class="field book-detail__field book-detail__meta"
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
                    class="field book-detail__field book-detail__meta"
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
                    class="field book-detail__field book-detail__meta"
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
                  class="field book-detail__field book-detail__meta"
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

                <div class="book-detail__chips" aria-hidden="true">
                  <span class="book-detail__chip">{{ formatLabel }}</span>
                  <span class="book-detail__chip">{{ statusLabel }}</span>
                  <span v-if="book.year" class="book-detail__chip">{{ book.year }}</span>
                </div>

                <div class="book-detail__fields-row">
                  <div
                    class="field book-detail__field book-detail__meta"
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
                    class="field book-detail__field book-detail__meta"
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
                  class="field book-detail__field book-detail__meta"
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
                  rows="5"
                  :value="synopsisDisplay"
                  readonly
                  tabindex="0"
                  aria-readonly="true"
                  @focus="focusField(BOOK_FOCUS.SYNOPSIS)"
                />
              </div>
            </div>
          </div>

          <!-- Rail série : flux document normal, sous le hero — z-index / overflow contenus -->
          <section
            v-if="seriesRail.length > 1"
            class="book-detail__rail"
            aria-label="Autres tomes de la série"
          >
            <div class="book-detail__rail-head">
              <button
                type="button"
                class="book-detail__rail-title book-detail__rail-link"
                @click="openSeriesPage"
              >
                {{ display(book.series) }}
              </button>
              <p class="book-detail__rail-sub">{{ seriesRail.length }} tomes · fiche série</p>
            </div>
            <div class="book-detail__rail-track">
              <button
                v-for="item in seriesRail"
                :key="item.id"
                type="button"
                class="book-detail__thumb"
                :class="{ 'is-active': String(item.id) === String(book.id) }"
                :aria-current="String(item.id) === String(book.id) ? 'page' : undefined"
                :aria-label="item.title || `Tome ${item.volume || ''}`"
                @click="openSibling(item.id)"
              >
                <div class="book-detail__thumb-art">
                  <LazyCover
                    :book-id="item.id"
                    :alt="item.title || ''"
                    :format="item.format"
                  />
                </div>
                <span class="book-detail__thumb-label">
                  {{ item.volume != null && item.volume !== '' ? `Tome ${item.volume}` : item.title }}
                </span>
              </button>
            </div>
          </section>
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
  isolation: isolate;
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
  z-index: 0;
  background:
    radial-gradient(ellipse 55% 45% at 8% 20%, var(--wash-a), transparent 55%),
    radial-gradient(ellipse 40% 35% at 100% 0%, var(--wash-b), transparent 50%),
    var(--ink-950);
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
  padding: 1.1rem clamp(1rem, 2.5vw, 2.5rem) 0.55rem;
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

.book-detail__status {
  margin: 0.35rem 0 0;
  color: var(--paper-dim);
  font-size: 0.88rem;
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
  /* Contient tout débordement de covers / rails */
  overflow-x: hidden;
  isolation: isolate;
}

.book-detail__scroll-inner {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 0.5rem clamp(1rem, 2.5vw, 2.5rem) 1.25rem;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
  padding-right: max(clamp(1rem, 2.5vw, 2.5rem), 0.75rem);
}

/* Grid landscape : cover + info côte à côte, sans absolute croisé */
.book-detail__hero {
  display: grid;
  grid-template-columns: clamp(9rem, 22vw, 15rem) minmax(0, 1fr);
  gap: 1.35rem clamp(1.25rem, 3vw, 2.5rem);
  align-items: start;
  min-width: 0;
  max-width: 64rem;
  position: relative;
  z-index: 1;
  isolation: isolate;
}

.book-detail__cover {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  position: relative;
  z-index: 0;
}

.book-detail__cover-frame {
  /* Ancre LazyCover (position:absolute) — sans ceci la cover remonte sur la méta */
  position: relative;
  isolation: isolate;
  aspect-ratio: 2 / 3;
  width: 100%;
  max-width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--ink-800);
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

.book-detail__cover-frame :deep(.lazy-cover),
.book-detail__cover-frame :deep(.lazy-cover__img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  object-position: center;
}

.book-detail__info {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.book-detail__fields {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.book-detail__fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 1rem;
  min-width: 0;
}

.book-detail__field {
  border-radius: var(--radius-sm);
  min-width: 0;
  transition:
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft);
}

.book-detail__field--title {
  margin-bottom: 0.15rem;
}

.book-detail__headline {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0.15rem 0.35rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--paper);
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 3.4vw, 2.65rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  cursor: default;
}

/* Labels + valeurs type streaming (pas de boîtes formulaire empilées) */
.book-detail__meta {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid transparent;
}

.book-detail__meta label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brass);
}

.book-detail__meta input,
.book-detail__textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  cursor: default;
  opacity: 1;
  color: var(--paper);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  font: inherit;
  font-size: 0.98rem;
  font-weight: 600;
}

.book-detail__field--synopsis {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.35rem;
  border: 1px solid transparent;
  margin-top: 0.25rem;
}

.book-detail__field--synopsis label {
  color: var(--brass);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.book-detail__textarea {
  resize: none;
  line-height: 1.55;
  min-height: 6.5rem;
  white-space: pre-wrap;
  font-weight: 400;
  color: var(--paper);
  opacity: 0.92;
}

.book-detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.15rem 0.35rem 0.35rem;
}

.book-detail__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--paper);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.book-detail__field.is-focused,
.book-detail__field:focus-within {
  outline: none;
  transform: translate3d(2px, 0, 0);
}

.book-detail__field.is-focused .book-detail__headline,
.book-detail__field:focus-within .book-detail__headline,
.book-detail__meta.is-focused,
.book-detail__meta:focus-within,
.book-detail__field--synopsis.is-focused,
.book-detail__field--synopsis:focus-within {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-radius: var(--radius-sm);
}

.book-detail__field.is-focused .book-detail__headline,
.book-detail__field:focus-within .book-detail__headline {
  border-style: solid;
}

/* Rail horizontal sous le hero — stacking bas, overflow clip sur les thumbs */
.book-detail__rail {
  position: relative;
  z-index: 0;
  isolation: isolate;
  min-width: 0;
  max-width: 64rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border);
}

.book-detail__rail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 1rem;
  margin-bottom: 0.75rem;
}

.book-detail__rail-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--paper);
}

.book-detail__rail-link {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--paper);
  text-align: left;
}

.book-detail__rail-link:hover,
.book-detail__rail-link:focus-visible {
  color: var(--brass-bright);
  outline: none;
}

.book-detail__rail-sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
}

.book-detail__rail-track {
  display: flex;
  gap: 0.85rem;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  min-width: 0;
  padding: 0.15rem 0.15rem 0.65rem;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.book-detail__thumb {
  flex: 0 0 5.75rem;
  width: 5.75rem;
  max-width: 5.75rem;
  min-width: 0;
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  font: inherit;
  scroll-snap-align: start;
  position: relative;
  z-index: 0;
}

.book-detail__thumb-art {
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--ink-800);
  border: 1px solid var(--border);
}

.book-detail__thumb-art :deep(.lazy-cover),
.book-detail__thumb-art :deep(.lazy-cover__img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.book-detail__thumb-label {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--paper-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-detail__thumb.is-active .book-detail__thumb-art {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.book-detail__thumb.is-active .book-detail__thumb-label {
  color: var(--brass-bright);
}

.book-detail__thumb.is-active::after {
  content: '';
  display: block;
  height: 2px;
  margin-top: 0.3rem;
  border-radius: 999px;
  background: var(--brass);
}

.book-detail__foot {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
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
    color-mix(in srgb, var(--brass) 28%, transparent),
    color-mix(in srgb, var(--brass-deep) 14%, transparent)
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

@media (max-width: 720px) {
  .book-detail__hero {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .book-detail__cover {
    width: min(11rem, 48vw);
    justify-self: center;
  }

  .book-detail__meta {
    grid-template-columns: 4.75rem minmax(0, 1fr);
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
