<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';
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

const hints = [
  { key: 'A', label: 'action' },
  { key: '←→', label: 'focus' },
  { key: 'B', label: 'retour' },
];

onMounted(async () => {
  await library.refresh();
  const id = route.params.id;
  book.value = library.books.find((b) => String(b.id) === String(id)) || null;
  if (book.value?.id) await library.ensureCover(book.value.id);
  loading.value = false;
  ui.setBookFocus(0);
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
</script>

<template>
  <section class="book-detail" aria-label="Fiche livre">
    <div class="book-detail__bg" aria-hidden="true" />

    <div class="book-detail__shell">
      <header class="book-detail__head">
        <div class="min-w-0">
          <p class="book-detail__brand">Vertical Deck Reader</p>
          <h1 class="book-detail__heading">Fiche livre</h1>
        </div>
        <button type="button" class="ghost shrink-0" @click="back">Retour</button>
      </header>

      <div v-if="loading" class="book-detail__state">Chargement…</div>

      <div v-else-if="!book" class="book-detail__state book-detail__state--stack">
        <p class="m-0 text-xl font-bold">Livre introuvable</p>
        <FocusButton :focused="true" @select="back">Retour bibliothèque</FocusButton>
      </div>

      <div v-else class="book-detail__scroll">
        <!-- Rangée principale : cover | détails techniques -->
        <div class="book-detail__row">
          <aside class="book-detail__cover" aria-label="Couverture">
            <div class="book-detail__cover-frame">
              <LazyCover
                :book-id="book.id"
                :alt="book.title"
                :format="book.format"
                eager
              />
            </div>
          </aside>

          <div class="book-detail__info min-w-0">
            <h2 class="book-detail__title">{{ book.title }}</h2>
            <p v-if="book.series" class="book-detail__series">
              {{ book.series }}
              <template v-if="book.volume != null"> · Tome {{ book.volume }}</template>
            </p>

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

            <div class="book-detail__actions">
              <FocusButton
                :focused="ui.bookFocusIndex === 0"
                subtitle="Ouvrir le lecteur"
                @select="read"
              >
                Lire
              </FocusButton>
              <FocusButton
                :focused="ui.bookFocusIndex === 1"
                subtitle="Bibliothèque"
                @select="back"
              >
                Retour
              </FocusButton>
              <FocusButton
                :focused="ui.bookFocusIndex === 2"
                subtitle="Import / meta"
                @select="goImport"
              >
                Options
              </FocusButton>
            </div>
          </div>
        </div>

        <!-- Synopsis pleine largeur sous la rangée -->
        <section class="book-detail__synopsis" aria-label="Synopsis">
          <h3>Synopsis</h3>
          <p>
            {{ synopsis || 'Aucune synopsis pour ce tome. Enrichis les métadonnées à l’import.' }}
          </p>
        </section>
      </div>

      <footer class="book-detail__foot">
        <ControlHint :items="hints" />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.book-detail {
  position: relative;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
}

.book-detail__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 55% 45% at 0% 20%, var(--wash-a), transparent 55%),
    var(--ink-950);
}

.book-detail__shell {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  max-width: var(--shell-max);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2rem) clamp(1.25rem, 3vw, 2.5rem);
  box-sizing: border-box;
  overflow-x: hidden;
}

.book-detail__head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  margin-bottom: 1.25rem;
}

.book-detail__brand {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--brass);
}

.book-detail__heading {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  font-weight: 700;
}

.book-detail__state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--paper-dim);
  min-height: 0;
}

.book-detail__state--stack {
  flex-direction: column;
  gap: 0.75rem;
}

.book-detail__scroll {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 0.15rem;
}

.book-detail__row {
  display: grid;
  grid-template-columns: minmax(9rem, 12.5rem) minmax(0, 1fr);
  gap: clamp(1.25rem, 3vw, 2.25rem);
  align-items: start;
  min-width: 0;
}

.book-detail__cover {
  width: 100%;
  max-width: 12.5rem;
  min-width: 0;
}

.book-detail__cover-frame {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--ink-800);
  overflow: hidden;
}

.book-detail__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.book-detail__series {
  margin: 0.5rem 0 0;
  font-size: 1.05rem;
  color: var(--brass-bright);
  overflow-wrap: anywhere;
}

.book-detail__meta {
  margin: 1.25rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.75rem 1.25rem;
  min-width: 0;
}

.book-detail__meta dt {
  margin: 0;
  font-size: 0.78rem;
  color: var(--paper-dim);
}

.book-detail__meta dd {
  margin: 0.2rem 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.book-detail__actions {
  margin-top: 1.35rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  max-width: 36rem;
  min-width: 0;
}

.book-detail__synopsis {
  min-width: 0;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border);
}

.book-detail__synopsis h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
}

.book-detail__synopsis p {
  margin: 0.75rem 0 0;
  max-width: 52rem;
  line-height: 1.55;
  color: var(--paper-dim);
  overflow-wrap: anywhere;
}

.book-detail__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  padding-top: 0.35rem;
}

@media (max-width: 720px) {
  .book-detail__row {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .book-detail__info {
    width: 100%;
  }

  .book-detail__actions {
    grid-template-columns: minmax(0, 1fr);
    max-width: none;
  }
}
</style>
