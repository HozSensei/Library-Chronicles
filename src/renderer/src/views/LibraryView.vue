<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();

const hints = [
  { key: 'A', label: 'ouvrir' },
  { key: 'X', label: 'import' },
  { key: 'Start', label: 'réglages' },
  { key: 'B', label: 'retour' },
  { key: 'LT/RT', label: 'filtre' },
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

onMounted(() => {
  library.refresh();
});

watch(
  () => library.filtered.length,
  () => {
    if (library.cursor >= library.filtered.length) library.cursor = 0;
  },
);

function openSelected() {
  const book = library.selected;
  if (!book) return;
  router.push({ name: 'reader', query: { path: book.filePath } });
}

function statusBadge(status) {
  if (status === 'reading') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Non lu';
}
</script>

<template>
  <section class="library">
    <header class="library__header">
      <p class="library__brand">Vertical Deck Reader</p>
      <h1>Bibliothèque</h1>
      <p class="library__lead">
        {{ filterLabel }} · {{ library.filtered.length }} tome(s)
        <template v-if="library.continueBook">
          · Reprendre « {{ library.continueBook.title }} »
        </template>
      </p>
    </header>

    <div class="library__toolbar">
      <button type="button" class="ghost" @click="library.scan()">Scanner</button>
      <button type="button" class="ghost" @click="router.push({ name: 'import' })">Import</button>
      <button type="button" class="ghost" @click="library.cycleFilter(1)">{{ filterLabel }}</button>
    </div>

    <div class="library__body">
      <div v-if="library.loading" class="library__empty">Chargement…</div>
      <div v-else-if="!library.filtered.length" class="library__empty">
        <p>Aucun tome indexé.</p>
        <p class="dim">Importe des fichiers ou scanne le dossier bibliothèque.</p>
      </div>
      <div v-else class="library__grid">
        <button
          v-for="(book, index) in library.filtered"
          :key="book.id"
          type="button"
          class="tile"
          :class="{ 'is-focused': index === library.cursor }"
          @click="library.cursor = index; openSelected()"
        >
          <div class="tile__cover">
            <img
              v-if="library.covers[book.id]"
              :src="library.covers[book.id]"
              :alt="book.title"
            />
            <div v-else class="tile__placeholder">{{ book.format || '?' }}</div>
            <span class="tile__badge">{{ statusBadge(book.status) }}</span>
          </div>
          <span class="tile__title">{{ book.title }}</span>
          <span v-if="book.status === 'reading'" class="tile__prog">
            p. {{ book.pageCurrent + 1 }}/{{ book.pageTotal || '?' }}
          </span>
        </button>
      </div>
    </div>

    <footer class="library__footer">
      <button type="button" class="ghost" @click="router.push({ name: 'boot' })">Retour</button>
      <ControlHint :items="hints" />
    </footer>
  </section>
</template>

<style scoped>
.library {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  background:
    radial-gradient(ellipse 80% 40% at 20% 0%, var(--wash-a), transparent 50%),
    var(--ink-950);
}

.library__brand {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--brass);
  letter-spacing: 0.04em;
}

.library__header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: -0.02em;
}

.library__lead {
  margin: 0.55rem 0 0;
  color: var(--paper-dim);
  max-width: 26rem;
  line-height: 1.4;
}

.library__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.library__body {
  flex: 1;
  margin-top: 1rem;
  min-height: 0;
  overflow: auto;
}

.library__empty {
  height: 100%;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.35rem;
  color: var(--paper);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}

.library__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.tile {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
  color: inherit;
  border-radius: var(--radius-sm);
}

.tile.is-focused {
  outline: none;
}

.tile.is-focused .tile__cover {
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
  transform: translate3d(0, -2px, 0) scale(1.02);
}

.tile__cover {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--ink-800);
  transition: transform 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft);
}

.tile__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile__placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--paper-dim);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.tile__badge {
  position: absolute;
  left: 0.35rem;
  bottom: 0.35rem;
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #f2ebe0;
}

.tile__title {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__prog {
  display: block;
  font-size: 0.72rem;
  color: var(--brass);
}

.library__footer {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}
</style>
