<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();

const hints = [
  { key: 'A', label: 'fiche' },
  { key: 'X', label: 'import' },
  { key: 'Select', label: 'séries' },
  { key: 'Start', label: 'réglages' },
  { key: 'B', label: 'retour' },
];

const filterLabel = computed(() => {
  const map = {
    all: 'Tous',
    reading: 'En cours',
    unread: 'Non lus',
    finished: 'Terminés',
  };
  return map[library.filter] || 'Tous';
});

const viewLabel = computed(() =>
  library.viewMode === 'series' ? 'Séries' : 'Livres',
);
const gridCols = computed(() => library.columns);
const showGrid = computed(
  () => library.viewMode === 'books' && library.filtered.length > 0,
);
const showSeries = computed(
  () => library.viewMode === 'series' && library.seriesList.length > 0,
);

onMounted(() => {
  ui.exitReaderMode();
  library.refresh().then(() => {
    library.focusGrid(0);
    scrollFocusIntoView();
  });
});

watch(
  () => [library.focusZone, library.cursor, library.seriesCursor],
  () => nextTick(scrollFocusIntoView),
);

function scrollFocusIntoView() {
  const el = document.querySelector('.library .is-focused');
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function openBook(book, index) {
  if (!book?.id) return;
  library.focusGrid(index);
  router.push({ name: 'book', params: { id: String(book.id) } });
}

async function openSeriesGroup(index) {
  library.focusSeries(index);
  const book = await library.nextUnreadForSelected();
  if (book?.id) {
    router.push({ name: 'book', params: { id: String(book.id) } });
  }
}

function statusBadge(status) {
  if (status === 'reading') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Non lu';
}
</script>

<template>
  <section class="library relative h-full" aria-label="Bibliothèque Vertical Deck Reader">
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="
        background:
          radial-gradient(ellipse 70% 40% at 10% 0%, var(--wash-a), transparent 55%),
          radial-gradient(ellipse 50% 35% at 100% 80%, var(--wash-b), transparent 50%),
          var(--ink-950);
      "
    />

    <div class="relative z-10 flex h-full flex-col">
      <header class="flex items-end justify-between gap-4 px-8 pt-8 pb-4 sm:px-10">
        <div>
          <p class="m-0 text-sm font-semibold tracking-wide text-[var(--brass)]">
            Vertical Deck Reader
          </p>
          <h1 class="m-0 mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Bibliothèque
          </h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="ghost" @click="library.scan()">Scanner</button>
          <button type="button" class="ghost" @click="library.cycleFilter(1)">{{ filterLabel }}</button>
          <button type="button" class="ghost" @click="library.toggleViewMode()">{{ viewLabel }}</button>
          <button type="button" class="ghost" @click="router.push({ name: 'import' })">Import</button>
        </div>
      </header>

      <div class="library__scroll min-h-0 flex-1 overflow-auto px-8 pb-4 sm:px-10">
        <!-- Vide -->
        <div
          v-if="!library.loading && library.isEmpty"
          class="flex h-full min-h-[20rem] flex-col items-center justify-center gap-4 text-center"
        >
          <p class="m-0 font-[family-name:var(--font-display)] text-2xl font-bold">Aucun livre</p>
          <p class="m-0 max-w-md text-[var(--paper-dim)]">
            Importe un CBZ, CBR ou PDF pour commencer ta collection.
          </p>
          <div class="w-full max-w-xs">
            <FocusButton
              :focused="true"
              subtitle="A · Ouvrir l’import"
              @select="router.push({ name: 'import' })"
            >
              Importer
            </FocusButton>
          </div>
        </div>

        <div v-else-if="library.loading" class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }">
          <div
            v-for="n in 12"
            :key="n"
            class="aspect-[2/3] animate-pulse rounded-[var(--radius-sm)] bg-[var(--ink-800)]"
          />
        </div>

        <template v-else>
          <section v-if="library.viewMode === 'series'" aria-label="Séries">
            <div v-if="!showSeries" class="py-16 text-center text-[var(--paper-dim)]">
              Aucune série détectée.
            </div>
            <div v-else class="grid gap-3">
              <button
                v-for="(group, index) in library.seriesList"
                :key="group.seriesId"
                type="button"
                class="series-row flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left"
                :class="{ 'is-focused': library.focusZone === 'series' && index === library.seriesCursor }"
                @click="openSeriesGroup(index)"
              >
                <div class="h-24 w-16 overflow-hidden rounded bg-[var(--ink-800)]">
                  <LazyCover
                    v-if="group.coverBookId"
                    :book-id="group.coverBookId"
                    :alt="group.series"
                    eager
                  />
                </div>
                <div class="min-w-0">
                  <p class="m-0 truncate font-[family-name:var(--font-display)] text-lg font-bold">
                    {{ group.series }}
                  </p>
                  <p class="m-0 mt-1 text-sm text-[var(--paper-dim)]">
                    {{ group.finishedCount }}/{{ group.volumeCount }} · {{ statusBadge(group.status) }}
                  </p>
                </div>
              </button>
            </div>
          </section>

          <section v-else aria-label="Grille livres">
            <div v-if="!showGrid" class="py-16 text-center text-[var(--paper-dim)]">
              Aucun tome pour ce filtre.
            </div>
            <div
              v-else
              class="library__grid grid gap-4"
              :style="{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }"
            >
              <button
                v-for="(book, index) in library.filtered"
                :key="book.id"
                type="button"
                class="tile group appearance-none border-0 bg-transparent p-0 text-left text-inherit"
                :class="{ 'is-focused': library.focusZone === 'grid' && index === library.cursor }"
                @click="openBook(book, index)"
              >
                <div
                  class="tile__cover relative aspect-[2/3] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--ink-800)] transition-transform duration-150"
                >
                  <LazyCover
                    :book-id="book.id"
                    :alt="book.title"
                    :format="book.format"
                  />
                  <span
                    class="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[0.65rem] text-white"
                  >
                    {{ statusBadge(book.status) }}
                  </span>
                </div>
                <span class="mt-2 block truncate text-sm font-semibold">{{ book.title }}</span>
                <span v-if="book.series" class="block truncate text-xs text-[var(--brass)]">
                  {{ book.series }}
                  <template v-if="book.volume != null"> · T{{ book.volume }}</template>
                </span>
              </button>
            </div>
          </section>
        </template>
      </div>

      <footer class="flex flex-col items-center gap-2 px-8 pb-6 pt-2">
        <button type="button" class="ghost" @click="router.push({ name: 'boot' })">Retour</button>
        <ControlHint :items="hints" />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.tile.is-focused .tile__cover,
.series-row.is-focused {
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
  transform: translate3d(0, -2px, 0) scale(1.02);
}

.tile.is-focused span:first-of-type {
  color: var(--brass-bright);
}

.series-row {
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: box-shadow 160ms var(--ease-soft), border-color 160ms var(--ease-soft);
}
</style>
