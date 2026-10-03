<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';

const router = useRouter();
const library = useLibraryStore();

const hints = [
  { key: 'A', label: 'ouvrir' },
  { key: 'X', label: 'import' },
  { key: 'Select', label: 'séries' },
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

const heroTitle = computed(() => {
  if (library.heroMode === 'reading') return 'Lecture en cours';
  if (library.heroMode === 'last') return 'Dernier lu';
  if (library.heroMode === 'empty') return 'Bibliothèque vide';
  return 'Continuer';
});

const heroCta = computed(() => {
  if (library.heroMode === 'reading') return 'A · Reprendre';
  if (library.heroMode === 'last') return 'A · Rouvrir';
  if (library.heroMode === 'empty') return 'A · Importer';
  return 'A · Parcourir';
});

const heroLead = computed(() => {
  if (library.heroMode === 'reading' && library.heroBook) {
    const b = library.heroBook;
    return `p. ${b.pageCurrent + 1}/${b.pageTotal || '?'}`;
  }
  if (library.heroMode === 'last' && library.heroBook) {
    return library.heroBook.title;
  }
  if (library.heroMode === 'empty') {
    return 'Importe un CBZ, CBR ou PDF pour commencer.';
  }
  return 'Choisis un tome dans les ajouts récents.';
});

const showRecent = computed(
  () => library.viewMode === 'books' && library.recentBooks.length > 0,
);
const showGrid = computed(
  () => library.viewMode === 'books' && library.filtered.length > 0,
);
const showSeries = computed(
  () => library.viewMode === 'series' && library.seriesList.length > 0,
);
const viewLabel = computed(() =>
  library.viewMode === 'series' ? 'Séries' : 'Livres',
);

onMounted(() => {
  library.refresh().then(() => {
    library.focusHero();
    scrollFocusIntoView();
  });
});

watch(
  () => library.filtered.length,
  () => {
    if (library.cursor >= library.filtered.length) library.cursor = 0;
  },
);

watch(
  () => [library.focusZone, library.cursor, library.recentCursor],
  () => {
    nextTick(scrollFocusIntoView);
  },
);

function scrollFocusIntoView() {
  const el = document.querySelector('.library .is-focused');
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

async function openSelected() {
  if (library.focusZone === 'hero' && library.heroMode === 'empty') {
    router.push({ name: 'import' });
    return;
  }
  if (library.focusZone === 'hero' && library.heroMode === 'invite' && !library.heroBook) {
    if (showRecent.value) library.focusRecent(0);
    else if (showSeries.value) library.focusSeries(0);
    else if (showGrid.value) library.focusGrid(0);
    return;
  }
  if (library.focusZone === 'series') {
    const book = await library.nextUnreadForSelected();
    if (book?.filePath) {
      router.push({ name: 'reader', query: { path: book.filePath } });
    }
    return;
  }
  const book = library.selected;
  if (!book) return;
  router.push({ name: 'reader', query: { path: book.filePath } });
}

async function openSeriesGroup(index) {
  library.focusSeries(index);
  const book = await library.nextUnreadForSelected();
  if (book?.filePath) {
    router.push({ name: 'reader', query: { path: book.filePath } });
  }
}

function openVolume(book) {
  if (!book?.filePath) return;
  router.push({ name: 'reader', query: { path: book.filePath } });
}

function openBook(book, zone, index) {
  if (zone === 'recent') {
    library.focusRecent(index);
  } else if (zone === 'grid') {
    library.focusGrid(index);
  } else {
    library.focusHero();
  }
  if (!book?.filePath) {
    if (library.heroMode === 'empty') router.push({ name: 'import' });
    return;
  }
  router.push({ name: 'reader', query: { path: book.filePath } });
}

function statusBadge(status) {
  if (status === 'reading') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Non lu';
}
</script>

<template>
  <section class="library" aria-label="Catalogue Vertical Deck Reader">
    <div class="library__scroll">
      <!-- Héro catalogue -->
      <header
        class="hero"
        :class="{
          'is-focused': library.focusZone === 'hero',
          'hero--empty': library.heroMode === 'empty',
          'hero--idle': library.heroMode === 'invite',
        }"
        @click="library.focusHero(); openSelected()"
      >
        <div class="hero__media" aria-hidden="true">
          <LazyCover
            v-if="library.heroBook"
            :book-id="library.heroBook.id"
            :alt="library.heroBook.title"
            :format="library.heroBook.format"
            eager
          />
          <div v-else class="hero__void" />
          <div class="hero__veil" />
        </div>

        <div class="hero__content">
          <p class="hero__brand">Vertical Deck Reader</p>
          <p class="hero__eyebrow">{{ heroTitle }}</p>
          <h1 class="hero__title">
            <template v-if="library.heroBook && library.heroMode !== 'invite'">
              {{ library.heroBook.title }}
            </template>
            <template v-else-if="library.heroMode === 'empty'">
              Aucun tome encore
            </template>
            <template v-else>
              Prêt à lire
            </template>
          </h1>
          <p class="hero__lead">{{ heroLead }}</p>
          <p class="hero__cta" :class="{ 'is-pulse': library.focusZone === 'hero' }">
            {{ heroCta }}
          </p>
        </div>
      </header>

      <div class="library__toolbar">
        <button type="button" class="ghost" @click="library.scan()">Scanner</button>
        <button type="button" class="ghost" @click="router.push({ name: 'import' })">Import</button>
        <button type="button" class="ghost" @click="library.cycleFilter(1)">{{ filterLabel }}</button>
        <button type="button" class="ghost" @click="library.toggleViewMode()">{{ viewLabel }}</button>
      </div>

      <!-- Skeleton chargement liste -->
      <div v-if="library.loading" class="catalog-skel" aria-busy="true" aria-label="Chargement">
        <div class="catalog-skel__rail">
          <div v-for="n in 4" :key="'r' + n" class="catalog-skel__tile" />
        </div>
        <div class="catalog-skel__grid">
          <div v-for="n in 6" :key="'g' + n" class="catalog-skel__tile" />
        </div>
      </div>

      <template v-else>
        <!-- Vue séries -->
        <section v-if="library.viewMode === 'series'" class="grid-section" aria-label="Séries">
          <div class="section-head">
            <h2>Séries</h2>
            <p>{{ filterLabel }} · {{ library.seriesList.length }} série(s)</p>
          </div>

          <div v-if="!showSeries" class="library__empty">
            <p class="library__empty-title">Aucune série détectée</p>
            <p class="dim">
              Les tomes avec métadonnée série (ou titre « Série - Tome N ») apparaissent ici.
            </p>
            <button type="button" class="ghost" @click="library.toggleViewMode()">
              Voir les livres
            </button>
          </div>

          <div v-else class="series-list">
            <div
              v-for="(group, index) in library.seriesList"
              :key="group.seriesId"
              class="series-card"
              :class="{
                'is-focused':
                  library.focusZone === 'series' && index === library.seriesCursor,
                'is-open': library.expandedSeriesId === group.seriesId,
              }"
            >
              <button type="button" class="series-card__main" @click="openSeriesGroup(index)">
                <div class="series-card__cover">
                  <LazyCover
                    v-if="group.coverBookId"
                    :book-id="group.coverBookId"
                    :alt="group.series"
                    eager
                  />
                </div>
                <div class="series-card__meta">
                  <span class="series-card__title">{{ group.series }}</span>
                  <span class="series-card__sub">
                    {{ group.finishedCount }}/{{ group.volumeCount }} ·
                    {{ statusBadge(group.status) }}
                  </span>
                  <span v-if="group.nextUnread" class="series-card__next">
                    A · {{ group.nextUnread.title }}
                  </span>
                </div>
              </button>
              <div v-if="library.expandedSeriesId === group.seriesId" class="series-card__vols">
                <button
                  v-for="vol in group.volumes"
                  :key="vol.id"
                  type="button"
                  class="series-vol"
                  @click="openVolume(vol)"
                >
                  <span>T{{ vol.volume ?? '?' }} · {{ vol.title }}</span>
                  <span>{{ statusBadge(vol.status) }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <template v-else>
          <!-- Ajouts récents -->
          <section v-if="showRecent" class="rail-section" aria-label="Ajouts récents">
            <div class="section-head">
              <h2>Ajouts récents</h2>
              <p>Derniers tomes indexés</p>
            </div>
            <div class="rail" role="list">
              <button
                v-for="(book, index) in library.recentBooks"
                :key="'recent-' + book.id"
                type="button"
                class="rail__item"
                :class="{
                  'is-focused':
                    library.focusZone === 'recent' && index === library.recentCursor,
                }"
                role="listitem"
                @click="openBook(book, 'recent', index)"
              >
                <div class="rail__cover">
                  <LazyCover
                    :book-id="book.id"
                    :alt="book.title"
                    :format="book.format"
                    :eager="index < 4"
                  />
                </div>
                <span class="rail__title">{{ book.title }}</span>
              </button>
            </div>
          </section>

          <!-- Tous les livres -->
          <section class="grid-section" aria-label="Tous les livres">
            <div class="section-head">
              <h2>Tous les livres</h2>
              <p>{{ filterLabel }} · {{ library.filtered.length }} tome(s)</p>
            </div>

            <div v-if="!showGrid" class="library__empty">
              <p class="library__empty-title">Aucun tome ici</p>
              <p class="dim">
                <template v-if="library.filter !== 'all'">
                  Change de filtre (LT/RT) ou importe un album.
                </template>
                <template v-else>
                  Importe des CBZ/CBR/PDF ou scanne le dossier bibliothèque.
                </template>
              </p>
              <button
                type="button"
                class="ghost library__empty-cta"
                @click="router.push({ name: 'import' })"
              >
                Ouvrir l’import
              </button>
            </div>

            <div v-else class="library__grid">
              <button
                v-for="(book, index) in library.filtered"
                :key="book.id"
                type="button"
                class="tile"
                :class="{
                  'is-focused': library.focusZone === 'grid' && index === library.cursor,
                }"
                @click="openBook(book, 'grid', index)"
              >
                <div class="tile__cover">
                  <LazyCover
                    :book-id="book.id"
                    :alt="book.title"
                    :format="book.format"
                  />
                  <span class="tile__badge">{{ statusBadge(book.status) }}</span>
                </div>
                <span class="tile__title">{{ book.title }}</span>
                <span v-if="book.series" class="tile__prog">
                  {{ book.series }}
                  <template v-if="book.volume != null"> · T{{ book.volume }}</template>
                </span>
                <span v-else-if="book.status === 'reading'" class="tile__prog">
                  p. {{ book.pageCurrent + 1 }}/{{ book.pageTotal || '?' }}
                </span>
              </button>
            </div>
          </section>
        </template>
      </template>
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
  background: var(--ink-950);
}

.library__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 0.5rem;
}

/* —— Héro full-bleed —— */
.hero {
  position: relative;
  min-height: min(52vh, 28rem);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  cursor: pointer;
  border: none;
  text-align: left;
  color: inherit;
  isolation: isolate;
}

.hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero__void {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 30% 20%, var(--wash-a), transparent 55%),
    radial-gradient(ellipse 60% 50% at 90% 80%, var(--wash-b), transparent 50%),
    linear-gradient(165deg, var(--ink-900), var(--ink-950));
}

.hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, transparent 28%, rgba(0, 0, 0, 0.72) 78%, var(--ink-950) 100%),
    linear-gradient(90deg, rgba(0, 0, 0, 0.45) 0%, transparent 55%);
  pointer-events: none;
}

[data-theme='light'] .hero__veil {
  background:
    linear-gradient(180deg, rgba(243, 238, 228, 0.2) 0%, transparent 30%, rgba(28, 24, 18, 0.55) 78%, var(--ink-950) 100%),
    linear-gradient(90deg, rgba(28, 24, 18, 0.35) 0%, transparent 55%);
}

.hero__content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: calc(var(--pad) + 0.5rem) var(--pad) 1.35rem;
  animation: hero-in 420ms var(--ease-out);
}

.hero__brand {
  margin: 0 0 0.65rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.35rem, 4.2vw, 1.85rem);
  color: var(--brass-bright);
  letter-spacing: 0.03em;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.45);
}

.hero__eyebrow {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brass);
}

.hero__title {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 5vw, 2.15rem);
  letter-spacing: -0.02em;
  line-height: 1.15;
  max-width: 16ch;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
}

.hero__lead {
  margin: 0.55rem 0 0;
  color: var(--paper-dim);
  max-width: 22rem;
  line-height: 1.4;
  font-size: 0.95rem;
}

.hero__cta {
  display: inline-block;
  margin: 1rem 0 0;
  padding: 0.55rem 1.1rem;
  border: 1px solid var(--brass);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(212, 163, 92, 0.28), rgba(154, 107, 47, 0.14));
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  transition:
    box-shadow 180ms var(--ease-soft),
    border-color 180ms var(--ease-soft),
    transform 180ms var(--ease-soft);
}

.hero.is-focused .hero__cta,
.hero__cta.is-pulse {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(0, -1px, 0);
}

.hero.is-focused {
  outline: none;
}

.hero.is-focused::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 2px var(--brass-bright);
  pointer-events: none;
  z-index: 2;
  animation: focus-ring 480ms var(--ease-out);
}

.hero--empty .hero__title,
.hero--idle .hero__title {
  max-width: 14ch;
}

.library__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.85rem var(--pad) 0;
}

.section-head {
  padding: 0 var(--pad);
  margin-bottom: 0.75rem;
}

.section-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  letter-spacing: -0.01em;
}

.section-head p {
  margin: 0.25rem 0 0;
  color: var(--paper-dim);
  font-size: 0.85rem;
}

/* —— Rail horizontal —— */
.rail-section {
  margin-top: 1.35rem;
  animation: section-in 360ms var(--ease-out);
}

.rail {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.15rem var(--pad) 0.5rem;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.rail::-webkit-scrollbar {
  display: none;
}

.rail__item {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  width: 7.25rem;
  flex: 0 0 auto;
  text-align: left;
  color: inherit;
  cursor: pointer;
  scroll-snap-align: start;
}

.rail__cover {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  transition: transform 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft);
}

.rail__item.is-focused .rail__cover {
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
  transform: translate3d(0, -2px, 0) scale(1.03);
}

.rail__title {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail__item.is-focused .rail__title {
  color: var(--brass-bright);
}

/* —— Grille —— */
.grid-section {
  margin-top: 1.5rem;
  padding: 0 var(--pad) 1rem;
  animation: section-in 420ms var(--ease-out);
}

.library__empty {
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.45rem;
  color: var(--paper);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 1.5rem;
  min-height: 10rem;
  animation: section-in 280ms var(--ease-out);
}

.library__empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
}

.library__empty-cta {
  margin: 0.65rem auto 0;
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}

.library__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
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

.tile.is-focused .tile__title {
  color: var(--brass-bright);
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

.tile__badge {
  position: absolute;
  left: 0.35rem;
  bottom: 0.35rem;
  z-index: 1;
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

/* —— Vue séries —— */
.series-list {
  display: grid;
  gap: 0.75rem;
  padding: 0 var(--pad) 1rem;
}

.series-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: color-mix(in srgb, var(--ink-800) 70%, transparent);
}

.series-card.is-focused {
  border-color: var(--brass-bright);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass-bright) 50%, transparent);
}

.series-card__main {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.series-card__cover {
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background: var(--ink-800);
}

.series-card__meta {
  display: grid;
  align-content: center;
  gap: 0.2rem;
  min-width: 0;
}

.series-card__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-card__sub,
.series-card__next {
  font-size: 0.78rem;
  color: var(--paper-dim);
}

.series-card__next {
  color: var(--brass);
}

.series-card__vols {
  display: grid;
  border-top: 1px solid var(--border);
}

.series-vol {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  text-align: left;
}

.series-vol:hover {
  background: color-mix(in srgb, var(--brass) 10%, transparent);
}

/* —— Skeletons catalogue —— */
.catalog-skel {
  padding: 1.25rem var(--pad);
}

.catalog-skel__rail {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.catalog-skel__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.catalog-skel__tile {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    110deg,
    var(--ink-800) 0%,
    var(--ink-700) 42%,
    var(--ink-800) 78%
  );
  background-size: 200% 100%;
  animation: shimmer 1.1s var(--ease-soft) infinite;
  flex: 0 0 7.25rem;
}

.catalog-skel__grid .catalog-skel__tile {
  flex: none;
  width: auto;
}

.library__footer {
  flex-shrink: 0;
  padding: 0.75rem var(--pad) var(--pad);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  background: linear-gradient(180deg, transparent, var(--ink-950) 30%);
}

@keyframes hero-in {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes section-in {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes focus-ring {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero__content,
  .rail-section,
  .grid-section,
  .library__empty,
  .hero.is-focused::after,
  .catalog-skel__tile,
  .rail__cover,
  .tile__cover {
    animation: none;
    transition: none;
  }
}

@keyframes empty-in {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .library__empty,
  .tile__cover {
    animation: none;
    transition: none;
  }
}
</style>
