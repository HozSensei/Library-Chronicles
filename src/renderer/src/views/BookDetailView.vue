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

const statusHint = computed(() => {
  if (!book.value) return 'Fiche';
  const fmt = (book.value.format || '?').toUpperCase();
  const pages =
    book.value.pageTotal != null
      ? `${book.value.pageCurrent + 1}/${book.value.pageTotal}`
      : '—';
  return `${fmt} · ${statusLabel.value} · p. ${pages}`;
});

const hints = [
  { key: '↑↓', label: 'focus' },
  { key: 'A', label: 'action' },
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

function focusContent(index) {
  ui.setBookFocus(index);
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
          <div class="book-detail__list" aria-label="Détails du tome">
            <button
              type="button"
              class="book-detail__row book-detail__row--identity"
              :class="{ 'is-focused': ui.bookFocusIndex === BOOK_FOCUS.IDENTITY }"
              @click="focusContent(BOOK_FOCUS.IDENTITY)"
            >
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
              <span class="book-detail__row-body">
                <span class="book-detail__row-kicker">Tome</span>
                <span class="book-detail__row-title">{{ book.title }}</span>
                <span v-if="book.series" class="book-detail__row-meta">
                  {{ book.series }}
                  <template v-if="book.volume != null"> · Tome {{ book.volume }}</template>
                </span>
                <span v-else class="book-detail__row-meta">{{ book.author || 'Auteur inconnu' }}</span>
              </span>
            </button>

            <button
              type="button"
              class="book-detail__row book-detail__row--meta"
              :class="{ 'is-focused': ui.bookFocusIndex === BOOK_FOCUS.META }"
              @click="focusContent(BOOK_FOCUS.META)"
            >
              <span class="book-detail__row-body">
                <span class="book-detail__row-kicker">Métadonnées</span>
                <dl class="book-detail__meta">
                  <div>
                    <dt>Auteur</dt>
                    <dd>{{ book.author || '—' }}</dd>
                  </div>
                  <div>
                    <dt>Année</dt>
                    <dd>{{ book.year || '—' }}</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>{{ (book.format || '—').toUpperCase() }}</dd>
                  </div>
                  <div>
                    <dt>Pages</dt>
                    <dd>{{ book.pageCurrent + 1 }} / {{ book.pageTotal || '?' }}</dd>
                  </div>
                  <div>
                    <dt>Statut</dt>
                    <dd>{{ statusLabel }}</dd>
                  </div>
                </dl>
              </span>
            </button>

            <button
              type="button"
              class="book-detail__row book-detail__row--synopsis"
              :class="{ 'is-focused': ui.bookFocusIndex === BOOK_FOCUS.SYNOPSIS }"
              @click="focusContent(BOOK_FOCUS.SYNOPSIS)"
            >
              <span class="book-detail__row-body">
                <span class="book-detail__row-kicker">Synopsis</span>
                <span class="book-detail__synopsis-text">
                  {{
                    synopsis ||
                      'Aucune synopsis pour ce tome. Enrichis les métadonnées à l’import.'
                  }}
                </span>
              </span>
            </button>
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

.book-detail__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  max-width: 52rem;
}

.book-detail__row {
  appearance: none;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
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

.book-detail__row.is-focused,
.book-detail__row:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(3px, 0, 0);
}

.book-detail__row--identity {
  align-items: center;
}

.book-detail__cover {
  width: 4.75rem;
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

.book-detail__row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.book-detail__row-kicker {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--brass);
  font-weight: 700;
}

.book-detail__row-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  letter-spacing: -0.02em;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.book-detail__row-meta {
  font-size: 0.9rem;
  color: var(--brass-bright);
  overflow-wrap: anywhere;
}

.book-detail__meta {
  margin: 0.35rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.65rem 1.1rem;
  min-width: 0;
}

.book-detail__meta dt {
  margin: 0;
  font-size: 0.75rem;
  color: var(--paper-dim);
}

.book-detail__meta dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.book-detail__synopsis-text {
  margin-top: 0.25rem;
  line-height: 1.55;
  color: var(--paper-dim);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
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

@media (max-width: 560px) {
  .book-detail__cover {
    width: 3.75rem;
  }

  .book-detail__actions {
    flex-direction: column;
  }

  .book-detail__action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-detail__row,
  .book-detail__action {
    transition: none;
  }
}
</style>
