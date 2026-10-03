<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';
import { useProfilesStore } from '../stores/profiles';
import { clearProfileSelected } from '../router';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();
const profiles = useProfilesStore();

const hints = [
  { key: 'A', label: 'ouvrir' },
  { key: 'X', label: 'import' },
  { key: 'LB/RB', label: 'onglets' },
  { key: 'LT/RT', label: 'filtre' },
  { key: 'Start', label: 'réglages' },
];

const navItems = [
  { id: 'board', label: 'Bibliothèque' },
  { id: 'recent', label: 'Récents' },
  { id: 'series', label: 'Séries' },
];

const activeHero = computed(
  () => library.heroSlides[library.heroIndex] || library.heroBook,
);

const heroMeta = computed(() => {
  const b = activeHero.value;
  if (!b) return null;
  const progress =
    b.pageTotal > 0
      ? Math.round(((b.pageCurrent + 1) / b.pageTotal) * 100)
      : null;
  return {
    year: b.year || null,
    series: b.series,
    volume: b.volume,
    progress,
    status:
      b.status === 'reading'
        ? 'En cours'
        : b.status === 'finished'
          ? 'Terminé'
          : 'Non lu',
    format: (b.format || '').toUpperCase(),
  };
});

onMounted(async () => {
  await profiles.refresh();
  await library.refresh();
  library.focusHero(0);
  nextTick(scrollFocusIntoView);
});

watch(
  () => [library.focusZone, library.cursor, library.recentCursor, library.readingCursor, library.heroIndex],
  () => nextTick(scrollFocusIntoView),
);

function scrollFocusIntoView() {
  scheduleScrollFocusedIntoView('.catalog');
}

/** Fiche détail uniquement — pas de setSessionMode / resize fenêtre. */
function openBook(book) {
  if (!book?.id) {
    router.push({ name: 'import' });
    return;
  }
  router.push({ name: 'book', params: { id: String(book.id) } });
}

function openSelected() {
  if (library.focusZone === 'series') {
    library.nextUnreadForSelected().then((book) => {
      if (book?.id) openBook(book);
    });
    return;
  }
  const book = library.selected;
  if (!book) {
    if (library.isEmpty) router.push({ name: 'import' });
    return;
  }
  openBook(book);
}

function statusBadge(status) {
  if (status === 'reading') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Non lu';
}

function switchProfile() {
  clearProfileSelected();
  router.push({ name: 'profiles', query: { manage: '1' } });
}

function scrollRail(refEl, dir) {
  const el = typeof refEl === 'string' ? document.querySelector(refEl) : refEl;
  if (!el) return;
  el.scrollBy({ left: dir * 320, behavior: 'smooth' });
}
</script>

<template>
  <section class="catalog relative h-full min-h-0 min-w-0 overflow-hidden overflow-x-hidden" aria-label="Catalogue Vertical Deck Reader">
    <div class="catalog__bg pointer-events-none absolute inset-0" aria-hidden="true" />

    <div class="relative z-10 flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      <!-- Header Movie Gather style -->
      <header class="catalog__header">
        <p class="catalog__logo">Vertical Deck Reader</p>

        <nav class="catalog__nav" aria-label="Sections">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="catalog__nav-link"
            :class="{ 'is-active': library.catalogTab === item.id }"
            @click="library.setCatalogTab(item.id)"
          >
            {{ item.label }}
          </button>
        </nav>

        <div class="catalog__tools">
          <button type="button" class="ghost catalog__tool" @click="library.scan()">
            Scanner
          </button>
          <button type="button" class="ghost catalog__tool" @click="router.push({ name: 'import' })">
            Import
          </button>
          <button
            type="button"
            class="catalog__settings"
            title="Paramètres (Start)"
            aria-label="Paramètres"
            @click="router.push({ name: 'settings' })"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="catalog__profile"
            :title="library.profileName || 'Profil'"
            @click="switchProfile"
          >
            <span
              class="catalog__avatar"
              :style="{ background: profiles.activeProfile?.color || 'var(--brass)' }"
            >
              {{ (library.profileName || '?').slice(0, 1).toUpperCase() }}
            </span>
            <span class="catalog__profile-name">{{ library.profileName || 'Profil' }}</span>
          </button>
        </div>
      </header>

      <div class="catalog__scroll shell-scroll min-h-0 min-w-0 flex-1">
        <div class="catalog__scroll-inner">
        <!-- BOARD -->
        <template v-if="library.catalogTab === 'board'">
          <!-- Hero + En cours -->
          <div class="catalog__hero-row">
            <button
              type="button"
              class="hero"
              :class="{
                'is-focused': library.focusZone === 'hero',
                'hero--empty': library.isEmpty,
              }"
              @click="library.focusHero(); openSelected()"
            >
              <div class="hero__media" aria-hidden="true">
                <LazyCover
                  v-if="activeHero"
                  :book-id="activeHero.id"
                  :alt="activeHero.title"
                  :format="activeHero.format"
                  eager
                />
                <div v-else class="hero__void" />
                <div class="hero__veil" />
              </div>

              <div v-if="library.heroSlides.length > 1" class="hero__dots">
                <span
                  v-for="(s, i) in library.heroSlides"
                  :key="s.id"
                  class="hero__dot"
                  :class="{ 'is-on': i === library.heroIndex }"
                />
              </div>

              <div class="hero__body">
                <p v-if="heroMeta?.year" class="hero__year">{{ heroMeta.year }}</p>
                <h1 class="hero__title">
                  <template v-if="activeHero">{{ activeHero.title }}</template>
                  <template v-else>Aucun tome encore</template>
                </h1>
                <p class="hero__lead">
                  <template v-if="activeHero && heroMeta">
                    {{ heroMeta.status }}
                    <template v-if="heroMeta.series"> · {{ heroMeta.series }}</template>
                    <template v-if="heroMeta.volume != null"> · T{{ heroMeta.volume }}</template>
                    <template v-if="heroMeta.progress != null"> · {{ heroMeta.progress }}%</template>
                  </template>
                  <template v-else>
                    Importe un CBZ, CBR ou PDF pour démarrer ta collection.
                  </template>
                </p>
                <span class="hero__play" aria-hidden="true">▶</span>
              </div>
            </button>

            <aside class="watching" aria-label="En cours">
              <h2 class="watching__title">En cours</h2>
              <div v-if="!library.readingBooks.length" class="watching__empty">
                Aucune lecture en cours.
              </div>
              <button
                v-for="(book, index) in library.readingBooks"
                :key="'w-' + book.id"
                type="button"
                class="watching__item"
                :class="{
                  'is-focused':
                    library.focusZone === 'watching' && index === library.readingCursor,
                }"
                @click="library.focusWatching(index); openBook(book)"
              >
                <div class="watching__thumb">
                  <LazyCover :book-id="book.id" :alt="book.title" :format="book.format" />
                  <span class="watching__play">▶</span>
                </div>
                <div class="watching__meta">
                  <p class="watching__name">{{ book.title }}</p>
                  <p class="watching__sub">
                    <template v-if="book.pageTotal">
                      p. {{ book.pageCurrent + 1 }}/{{ book.pageTotal }}
                    </template>
                    <template v-else>{{ statusBadge(book.status) }}</template>
                    <template v-if="book.series"> · {{ book.series }}</template>
                  </p>
                </div>
              </button>
            </aside>
          </div>

          <!-- Filtres pills -->
          <section class="filters" aria-label="Filtres">
            <h2 class="section-label">Filtrer</h2>
            <div class="filters__row">
              <button
                v-for="(f, index) in library.filters"
                :key="f.id"
                type="button"
                class="pill"
                :class="{
                  'is-active': library.filter === f.id,
                  'is-focused':
                    library.focusZone === 'filters' && library.filterIndex === index,
                }"
                @click="library.setFilter(f.id); library.focusZone = 'filters'"
              >
                {{ f.label }}
              </button>
            </div>
          </section>

          <!-- Empty -->
          <div v-if="library.isEmpty && !library.loading" class="catalog__empty">
            <p class="catalog__empty-title">Bibliothèque vide</p>
            <button type="button" class="catalog__cta" @click="router.push({ name: 'import' })">
              Importer
            </button>
          </div>

          <template v-else>
            <!-- Trending rail -->
            <section class="rail-section" aria-label="Tendances">
              <div class="rail-head">
                <h2>Tendances</h2>
                <div class="rail-arrows">
                  <button type="button" class="rail-arrow" aria-label="Précédent" @click="scrollRail('.rail--trending', -1)">‹</button>
                  <button type="button" class="rail-arrow" aria-label="Suivant" @click="scrollRail('.rail--trending', 1)">›</button>
                </div>
              </div>
              <div class="rail rail--trending" role="list">
                <button
                  v-for="(book, index) in library.trendingBooks"
                  :key="'t-' + book.id"
                  type="button"
                  class="poster"
                  :class="{
                    'is-focused':
                      library.focusZone === 'trending' && index === library.cursor,
                  }"
                  role="listitem"
                  @click="library.focusTrending(index); openBook(book)"
                >
                  <div class="poster__art">
                    <LazyCover :book-id="book.id" :alt="book.title" :format="book.format" />
                  </div>
                  <span class="poster__title">{{ book.title }}</span>
                  <span class="poster__meta">
                    {{ statusBadge(book.status) }}
                    <template v-if="book.series"> · {{ book.series }}</template>
                  </span>
                </button>
              </div>
            </section>

            <!-- New / Récents rail -->
            <section v-if="library.recentBooks.length" class="rail-section" aria-label="Nouveautés">
              <div class="rail-head">
                <h2>Nouveautés</h2>
                <div class="rail-arrows">
                  <button type="button" class="rail-arrow" aria-label="Précédent" @click="scrollRail('.rail--recent', -1)">‹</button>
                  <button type="button" class="rail-arrow" aria-label="Suivant" @click="scrollRail('.rail--recent', 1)">›</button>
                </div>
              </div>
              <div class="rail rail--recent" role="list">
                <button
                  v-for="(book, index) in library.recentBooks"
                  :key="'r-' + book.id"
                  type="button"
                  class="poster"
                  :class="{
                    'is-focused':
                      library.focusZone === 'recent' && index === library.recentCursor,
                  }"
                  role="listitem"
                  @click="library.focusRecent(index); openBook(book)"
                >
                  <div class="poster__art">
                    <LazyCover :book-id="book.id" :alt="book.title" :format="book.format" />
                  </div>
                  <span class="poster__title">{{ book.title }}</span>
                  <span class="poster__meta">{{ statusBadge(book.status) }}</span>
                </button>
              </div>
            </section>
          </template>
        </template>

        <!-- RECENTS tab -->
        <template v-else-if="library.catalogTab === 'recent'">
          <section class="rail-section pad-top" aria-label="Récents">
            <div class="rail-head">
              <h2>Ajouts récents</h2>
            </div>
            <div v-if="!library.recentBooks.length" class="catalog__empty">
              <p class="catalog__empty-title">Pas encore d’ajouts</p>
            </div>
            <div v-else class="rail rail--wrap" role="list">
              <button
                v-for="(book, index) in library.recentBooks"
                :key="'rr-' + book.id"
                type="button"
                class="poster"
                :class="{
                  'is-focused':
                    library.focusZone === 'recent' && index === library.recentCursor,
                }"
                @click="library.focusRecent(index); openBook(book)"
              >
                <div class="poster__art">
                  <LazyCover :book-id="book.id" :alt="book.title" :format="book.format" />
                </div>
                <span class="poster__title">{{ book.title }}</span>
              </button>
            </div>
          </section>
        </template>

        <!-- SERIES tab -->
        <template v-else>
          <section class="series-panel pad-top" aria-label="Séries">
            <div class="rail-head">
              <h2>Séries</h2>
            </div>
            <div v-if="!library.seriesList.length" class="catalog__empty">
              <p class="catalog__empty-title">Aucune série détectée</p>
            </div>
            <div v-else class="series-list">
              <button
                v-for="(group, index) in library.seriesList"
                :key="group.seriesId"
                type="button"
                class="series-row"
                :class="{
                  'is-focused':
                    library.focusZone === 'series' && index === library.seriesCursor,
                }"
                @click="library.focusSeries(index); library.nextUnreadForSelected().then((b) => b && openBook(b))"
              >
                <div class="series-row__cover">
                  <LazyCover
                    v-if="group.coverBookId"
                    :book-id="group.coverBookId"
                    :alt="group.series"
                    eager
                  />
                </div>
                <div>
                  <p class="series-row__name">{{ group.series }}</p>
                  <p class="series-row__meta">
                    {{ group.finishedCount }}/{{ group.volumeCount }} ·
                    {{ statusBadge(group.status) }}
                  </p>
                </div>
              </button>
            </div>
          </section>
        </template>
        </div>
      </div>

      <footer class="catalog__footer">
        <ControlHint :items="hints" />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.catalog__bg {
  background:
    radial-gradient(ellipse 70% 45% at 15% 0%, var(--wash-a), transparent 55%),
    radial-gradient(ellipse 50% 40% at 95% 70%, var(--wash-b), transparent 50%),
    var(--ink-950);
}

.catalog__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem 1.5rem;
  padding: 1.1rem clamp(1rem, 2.5vw, 2rem) 0.75rem;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.catalog__logo {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
  color: var(--paper);
  white-space: nowrap;
}

.catalog__nav {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.75rem;
  min-width: 0;
}

.catalog__nav-link {
  appearance: none;
  background: none;
  border: none;
  color: var(--paper-dim);
  font: inherit;
  font-weight: 600;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.35rem 0;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.catalog__nav-link.is-active {
  color: var(--paper);
  border-bottom-color: var(--paper);
}

.catalog__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
}

.catalog__tool {
  font-size: 0.8rem;
}

.catalog__settings {
  appearance: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: color-mix(in srgb, var(--ink-800) 70%, transparent);
  color: var(--paper);
  cursor: pointer;
  padding: 0;
  transition:
    border-color 160ms var(--ease-soft),
    color 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.catalog__settings:hover,
.catalog__settings:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  color: var(--brass-bright);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.catalog__profile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  appearance: none;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-800) 70%, transparent);
  color: var(--paper);
  border-radius: 999px;
  padding: 0.25rem 0.75rem 0.25rem 0.3rem;
  cursor: pointer;
  font: inherit;
}

.catalog__avatar {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.85rem;
  color: #0e1419;
}

.catalog__profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog__scroll {
  max-width: 100%;
  box-sizing: border-box;
}

.catalog__scroll-inner {
  padding: 0.5rem clamp(1rem, 2.5vw, 2rem) 1.5rem;
  max-width: 100%;
  box-sizing: border-box;
}

.catalog__hero-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(200px, 280px);
  gap: 1.1rem;
  min-height: 280px;
  min-width: 0;
  max-width: 100%;
}

.hero {
  position: relative;
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 22px;
  overflow: hidden;
  min-height: 280px;
  padding: 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
  background: var(--ink-800);
}

.hero.is-focused {
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.hero__media {
  position: absolute;
  inset: 0;
}

.hero__media :deep(img),
.hero__void {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero__void {
  background:
    linear-gradient(135deg, var(--ink-700), var(--ink-900));
}

.hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(8, 12, 16, 0.92) 0%, rgba(8, 12, 16, 0.35) 55%, rgba(8, 12, 16, 0.2) 100%),
    linear-gradient(0deg, rgba(8, 12, 16, 0.85) 0%, transparent 45%);
}

.hero__dots {
  position: absolute;
  top: 1rem;
  left: 1.1rem;
  display: flex;
  gap: 0.35rem;
  z-index: 2;
}

.hero__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--paper) 35%, transparent);
}

.hero__dot.is-on {
  background: var(--paper);
}

.hero__body {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 1.4rem 1.5rem 1.35rem;
  max-width: 70%;
}

.hero__year {
  margin: 0;
  font-size: 0.85rem;
  color: var(--paper-dim);
}

.hero__title {
  margin: 0.2rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.35rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.hero__lead {
  margin: 0.55rem 0 0;
  color: var(--paper-dim);
  font-size: 0.92rem;
}

.hero__play {
  position: absolute;
  right: 1.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--paper) 18%, transparent);
  backdrop-filter: blur(8px);
  font-size: 1rem;
  color: var(--paper);
}

.watching {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--ink-900) 88%, transparent);
  padding: 1rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  overflow: auto;
  max-height: 320px;
}

.watching__title {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
}

.watching__empty {
  color: var(--paper-dim);
  font-size: 0.85rem;
  padding: 0.5rem 0.25rem;
}

.watching__item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0.65rem;
  align-items: center;
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0.35rem;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
}

.watching__item.is-focused {
  border-color: var(--brass-bright);
  background: color-mix(in srgb, var(--brass) 12%, transparent);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.watching__thumb {
  position: relative;
  width: 64px;
  height: 40px;
  max-width: 64px;
  max-height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ink-800);
}

.watching__thumb :deep(.lazy-cover),
.watching__thumb :deep(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.watching__play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  font-size: 0.7rem;
}

.watching__name {
  margin: 0;
  font-weight: 700;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.watching__sub {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: var(--paper-dim);
}

.filters {
  margin-top: 1.35rem;
}

.section-label,
.rail-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
}

.filters__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.pill {
  appearance: none;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--paper);
  border-radius: 999px;
  padding: 0.55rem 1rem;
  font: inherit;
  font-size: 0.88rem;
  cursor: pointer;
}

.pill.is-active,
.pill.is-focused {
  border-color: var(--brass-bright);
  background: color-mix(in srgb, var(--brass) 14%, transparent);
}

.pill.is-focused {
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.rail-section {
  margin-top: 1.5rem;
}

.pad-top {
  padding-top: 0.5rem;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.rail-arrows {
  display: flex;
  gap: 0.4rem;
}

.rail-arrow {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-800) 80%, transparent);
  color: var(--paper);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

.rail {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  padding-bottom: 0.5rem;
  scroll-snap-type: x mandatory;
  min-width: 0;
}

.rail--wrap {
  flex-wrap: wrap;
  overflow: visible;
}

.poster {
  /* Largeur fixe : min-width:auto + titre nowrap gonflait une carte (titre long). */
  flex: 0 0 140px;
  width: 140px;
  max-width: 140px;
  min-width: 0;
  box-sizing: border-box;
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  font: inherit;
  scroll-snap-align: start;
}

.poster__art {
  position: relative;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 2 / 3;
  height: auto;
  border-radius: 14px;
  overflow: hidden;
  background: var(--ink-800);
  border: 1px solid var(--border);
  transition: transform 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft);
}

.poster__art :deep(.lazy-cover),
.poster__art :deep(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.poster.is-focused .poster__art {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.poster__title {
  display: block;
  margin-top: 0.55rem;
  width: 100%;
  max-width: 100%;
  font-size: 0.88rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster__meta {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: var(--paper-dim);
}

.catalog__empty {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-height: 12rem;
  text-align: center;
  padding: 2rem;
}

.catalog__empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.catalog__cta {
  appearance: none;
  border: 1px solid var(--brass);
  background: color-mix(in srgb, var(--brass) 18%, transparent);
  color: var(--paper);
  border-radius: 14px;
  padding: 0.85rem 1.6rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.series-list {
  display: grid;
  gap: 0.65rem;
}

.series-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: inherit;
  text-align: left;
  border-radius: 14px;
  padding: 0.75rem;
  cursor: pointer;
  font: inherit;
}

.series-row.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.series-row__cover {
  position: relative;
  width: 48px;
  height: 72px;
  max-width: 48px;
  max-height: 72px;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ink-800);
  flex-shrink: 0;
}

.series-row__cover :deep(.lazy-cover),
.series-row__cover :deep(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.series-row__name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
}

.series-row__meta {
  margin: 0.25rem 0 0;
  color: var(--paper-dim);
  font-size: 0.85rem;
}

.catalog__footer {
  display: flex;
  justify-content: center;
  padding: 0.5rem 1rem 1rem;
}

@media (max-width: 960px) {
  .catalog__header {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .catalog__nav {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .catalog__hero-row {
    grid-template-columns: 1fr;
  }

  .watching {
    max-height: none;
  }

  .hero__body {
    max-width: 90%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .poster__art {
    transition: none;
  }
}
</style>
