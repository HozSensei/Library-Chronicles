<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';

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
  await ui.exitReaderMode();
  await library.refresh();
  const id = route.params.id;
  book.value = library.books.find((b) => String(b.id) === String(id)) || null;
  if (book.value?.id) await library.ensureCover(book.value.id);
  loading.value = false;
  ui.setBookFocus(0);
});

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
  <section class="book-detail relative h-full" aria-label="Fiche livre">
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="
        background:
          radial-gradient(ellipse 55% 45% at 0% 20%, var(--wash-a), transparent 55%),
          var(--ink-950);
      "
    />

    <div class="relative z-10 mx-auto flex h-full max-w-[var(--shell-max)] flex-col px-8 py-8 sm:px-12">
      <header class="mb-6 flex items-center justify-between gap-4">
        <div>
          <p class="m-0 text-sm font-semibold text-[var(--brass)]">Vertical Deck Reader</p>
          <h1 class="m-0 mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">
            Fiche livre
          </h1>
        </div>
        <button type="button" class="ghost" @click="back">Retour</button>
      </header>

      <div v-if="loading" class="flex flex-1 items-center justify-center text-[var(--paper-dim)]">
        Chargement…
      </div>

      <div v-else-if="!book" class="flex flex-1 flex-col items-center justify-center gap-3">
        <p class="m-0 text-xl font-bold">Livre introuvable</p>
        <FocusButton :focused="true" @select="back">Retour bibliothèque</FocusButton>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
        <div class="grid gap-8 lg:grid-cols-[14rem_1fr]">
          <div class="mx-auto w-full max-w-[14rem]">
            <div class="aspect-[2/3] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-800)] shadow-lg">
              <LazyCover
                :book-id="book.id"
                :alt="book.title"
                :format="book.format"
                eager
              />
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div>
              <h2 class="m-0 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
                {{ book.title }}
              </h2>
              <p v-if="book.series" class="m-0 mt-2 text-lg text-[var(--brass-bright)]">
                {{ book.series }}
                <template v-if="book.volume != null"> · Tome {{ book.volume }}</template>
              </p>
            </div>

            <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-[var(--paper-dim)]">Auteur</dt>
                <dd class="m-0 mt-0.5 font-semibold">{{ book.author || '—' }}</dd>
              </div>
              <div>
                <dt class="text-[var(--paper-dim)]">Année</dt>
                <dd class="m-0 mt-0.5 font-semibold">{{ book.year || '—' }}</dd>
              </div>
              <div>
                <dt class="text-[var(--paper-dim)]">Format</dt>
                <dd class="m-0 mt-0.5 font-semibold">{{ (book.format || '—').toUpperCase() }}</dd>
              </div>
              <div>
                <dt class="text-[var(--paper-dim)]">Pages</dt>
                <dd class="m-0 mt-0.5 font-semibold">
                  {{ book.pageCurrent + 1 }} / {{ book.pageTotal || '?' }}
                </dd>
              </div>
              <div>
                <dt class="text-[var(--paper-dim)]">Statut</dt>
                <dd class="m-0 mt-0.5 font-semibold">{{ statusLabel }}</dd>
              </div>
            </dl>

            <div class="mt-2 grid max-w-xl gap-3 sm:grid-cols-3">
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

        <section class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 class="m-0 font-[family-name:var(--font-display)] text-lg font-bold">Synopsis</h3>
          <p class="m-0 mt-3 max-w-4xl leading-relaxed text-[var(--paper-dim)]">
            {{ synopsis || 'Aucune synopsis pour ce tome. Enrichis les métadonnées à l’import.' }}
          </p>
        </section>
      </div>

      <footer class="mt-4 flex justify-center">
        <ControlHint :items="hints" />
      </footer>
    </div>
  </section>
</template>
