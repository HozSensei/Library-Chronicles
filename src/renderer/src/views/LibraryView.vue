<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import LazyCover from '../components/LazyCover.vue';
import AppBrandLogo from '../components/AppBrandLogo.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';
import { useProfilesStore } from '../stores/profiles';
import { clearProfileSelected } from '../router';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();
const profiles = useProfilesStore();

const hints = computed(() => {
  if (library.isEmpty) {
    return [
      { key: 'A', label: 'importer' },
      { key: 'X', label: 'import' },
      { key: 'Start', label: 'réglages' },
    ];
  }
  return [
    { key: 'A', label: 'ouvrir' },
    { key: 'X', label: 'import' },
    { key: 'LB/RB', label: 'onglets' },
    { key: 'LT/RT', label: 'filtre' },
    { key: 'Start', label: 'réglages' },
  ];
});

function goImport() {
  const idx = library.headerNav.findIndex((n) => n.id === 'import');
  if (idx >= 0) library.focusNav(idx);
  router.push({ name: 'import' });
}

const navItems = [
  { id: 'board', label: 'Bibliothèque' },
  { id: 'all', label: 'Tous les livres' },
  { id: 'recent', label: 'Récents' },
  { id: 'series', label: 'Séries' },
];

function navFocused(id) {
  if (library.focusZone !== 'nav') return false;
  const item = library.selectedHeaderNav;
  if (!item) return false;
  if (item.kind === 'tab') return item.tab === id;
  return item.id === id || item.action === id;
}

onMounted(async () => {
  await profiles.refresh();
  await library.refresh();
  library.enterBoardContent();
  nextTick(scrollFocusIntoView);
});

watch(
  () => [
    library.focusZone,
    library.cursor,
    library.recentCursor,
    library.readingCursor,
    library.navIndex,
    library.catalogTab,
    library.filter,
  ],
  () => nextTick(scrollFocusIntoView),
);

function scrollFocusIntoView() {
  scheduleScrollFocusedIntoView('.catalog');
}

/** Fiche détail tome — pas de setSessionMode / resize fenêtre. */
function openBook(book) {
  if (!book?.id) {
    router.push({ name: 'import' });
    return;
  }
  router.push({ name: 'book', params: { id: String(book.id) } });
}

function openSeries(seriesId) {
  if (!seriesId) return;
  router.push({ name: 'series', params: { seriesId: String(seriesId) } });
}

/** Ouvre la cible résolue ({ type, seriesId|bookId }). */
function openResolved(target) {
  if (!target) {
    if (library.isEmpty) router.push({ name: 'import' });
    return;
  }
  if (target.type === 'series') {
    openSeries(target.seriesId);
    return;
  }
  if (target.type === 'book') {
    openBook({ id: target.bookId });
  }
}

function openRecentEntry(entry) {
  openResolved(library.resolveRecentOpen(entry));
}

function openSelected() {
  if (library.focusZone === 'series') {
    openResolved(library.resolveSeriesOpen());
    return;
  }
  if (library.focusZone === 'recent') {
    openRecentEntry(library.selectedRecent);
    return;
  }
  const book = library.selected;
  if (!book) {
    if (library.isEmpty) router.push({ name: 'import' });
    return;
  }
  openBook(book);
}

function recentLabel(entry) {
  if (!entry) return '';
  if (entry.kind === 'series' && entry.series) return entry.series;
  return entry.lastBook?.title || entry.series || 'Sans titre';
}

function recentMeta(entry) {
  if (!entry) return '';
  if (entry.kind === 'series') {
    return `${entry.volumeCount} tomes · ${statusBadge(entry.status)}`;
  }
  return statusBadge(entry.status);
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

function selectTab(tab) {
  const idx = library.headerNav.findIndex((n) => n.kind === 'tab' && n.tab === tab);
  if (idx >= 0) library.focusNav(idx);
  library.setCatalogTab(tab, { keepNav: false });
}
</script>

<template>
  <section class="catalog relative h-full min-h-0 min-w-0 overflow-hidden overflow-x-hidden" aria-label="Catalogue Library Chronicles">
    <div class="catalog__bg pointer-events-none absolute inset-0" aria-hidden="true" />

    <div class="relative z-10 flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      <!-- Bandeau foncé + logo à cheval (straddle) -->
      <header
        class="catalog__chrome"
        :class="{ 'catalog__chrome--empty': library.isEmpty }"
        aria-label="Navigation catalogue"
      >
        <div class="catalog__bar">
          <div class="catalog__brand">
            <AppBrandLogo size="straddle" class="catalog__logo" />
          </div>

          <nav v-if="!library.isEmpty" class="catalog__nav" aria-label="Sections">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              class="catalog__nav-link"
              :class="{
                'is-active': library.catalogTab === item.id,
                'is-focused': navFocused(item.id),
              }"
              @click="selectTab(item.id)"
            >
              {{ item.label }}
            </button>
          </nav>
          <div v-else class="catalog__nav-spacer" aria-hidden="true" />

          <div class="catalog__tools">
            <button
              type="button"
              class="ghost catalog__tool"
              :class="{ 'is-focused': navFocused('scan') }"
              @click="library.focusNav(library.headerNav.findIndex((n) => n.id === 'scan')); library.scan()"
            >
              Scanner
            </button>
            <button
              type="button"
              class="ghost catalog__tool"
              :class="{ 'is-focused': navFocused('import') }"
              @click="goImport()"
            >
              Import
            </button>
            <button
              type="button"
              class="catalog__settings"
              :class="{ 'is-focused': navFocused('settings') }"
              title="Paramètres (Start)"
              aria-label="Paramètres"
              @click="library.focusNav(library.headerNav.findIndex((n) => n.id === 'settings')); router.push({ name: 'settings' })"
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
              :class="{ 'is-focused': navFocused('profile') }"
              :title="library.profileName || 'Profil'"
              @click="library.focusNav(library.headerNav.findIndex((n) => n.id === 'profile')); switchProfile()"
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
        </div>
      </header>

      <div class="catalog__scroll shell-scroll min-h-0 min-w-0 flex-1">
        <div class="catalog__scroll-inner">
        <!-- Empty library: Import CTA only (no tabs / Continuer / Recents) -->
        <div
          v-if="library.isEmpty && !library.loading"
          class="catalog__empty catalog__empty--solo"
        >
          <p class="catalog__empty-title">Bibliothèque vide</p>
          <p class="catalog__empty-lead">
            Importez vos premiers livres pour remplir le catalogue.
          </p>
          <button
            type="button"
            class="catalog__cta"
            :class="{ 'is-focused': navFocused('import') }"
            @click="goImport()"
          >
            Importer
          </button>
        </div>

        <template v-else-if="!library.isEmpty">
        <!-- BOARD -->
        <template v-if="library.catalogTab === 'board'">
          <!-- Continuer : liste / grille des tomes en cours -->
          <section class="continue-section" aria-label="Continuer">
            <div class="rail-head">
              <h2>Continuer</h2>
            </div>
            <div v-if="!library.readingBooks.length" class="continue-empty">
              Aucune lecture en cours.
            </div>
            <div
              v-else
              class="book-grid"
              :style="{ '--grid-cols': String(library.columns || 6) }"
              role="list"
            >
              <button
                v-for="(book, index) in library.readingBooks"
                :key="'c-' + book.id"
                type="button"
                class="poster poster--grid"
                :class="{
                  'is-focused':
                    library.focusZone === 'continue' && index === library.readingCursor,
                }"
                role="listitem"
                @click="library.focusContinue(index); openBook(book)"
              >
                <div class="poster__art">
                  <LazyCover :book-id="book.id" :alt="book.title" :format="book.format" />
                </div>
                <span class="poster__title">{{ book.title }}</span>
                <span class="poster__meta">
                  <template v-if="book.pageTotal">
                    p. {{ book.pageCurrent + 1 }}/{{ book.pageTotal }}
                  </template>
                  <template v-else>{{ statusBadge(book.status) }}</template>
                  <template v-if="book.series"> · {{ book.series }}</template>
                </span>
              </button>
            </div>
          </section>

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

            <!-- New / Récents rail — une entrée par série -->
            <section v-if="library.recentSeries.length" class="rail-section" aria-label="Nouveautés">
              <div class="rail-head">
                <h2>Nouveautés</h2>
                <div class="rail-arrows">
                  <button type="button" class="rail-arrow" aria-label="Précédent" @click="scrollRail('.rail--recent', -1)">‹</button>
                  <button type="button" class="rail-arrow" aria-label="Suivant" @click="scrollRail('.rail--recent', 1)">›</button>
                </div>
              </div>
              <div class="rail rail--recent" role="list">
                <button
                  v-for="(entry, index) in library.recentSeries"
                  :key="'r-' + (entry.seriesId || entry.lastBook?.id)"
                  type="button"
                  class="poster"
                  :class="{
                    'is-focused':
                      library.focusZone === 'recent' && index === library.recentCursor,
                  }"
                  role="listitem"
                  @click="library.focusRecent(index); openRecentEntry(entry)"
                >
                  <div class="poster__art">
                    <LazyCover
                      v-if="entry.coverBookId != null"
                      :book-id="entry.coverBookId"
                      :alt="recentLabel(entry)"
                      :format="entry.lastBook?.format"
                    />
                  </div>
                  <span class="poster__title">{{ recentLabel(entry) }}</span>
                  <span class="poster__meta">{{ recentMeta(entry) }}</span>
                </button>
              </div>
            </section>
        </template>

        <!-- ALL BOOKS tab — grille dense (pas de rail horizontal) -->
        <template v-else-if="library.catalogTab === 'all'">
          <section class="filters pad-top" aria-label="Filtres">
            <h2 class="section-label">Tous les livres</h2>
            <div class="filters__row">
              <button
                v-for="(f, index) in library.filters"
                :key="'af-' + f.id"
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

          <div v-if="!library.filtered.length" class="catalog__empty">
            <p class="catalog__empty-title">Aucun livre pour ce filtre</p>
          </div>
          <section v-else class="grid-section" aria-label="Tous les livres">
            <div
              class="book-grid"
              :style="{ '--grid-cols': String(library.columns || 6) }"
              role="list"
            >
              <button
                v-for="(book, index) in library.filtered"
                :key="'g-' + book.id"
                type="button"
                class="poster poster--grid"
                :class="{
                  'is-focused':
                    library.focusZone === 'grid' && index === library.cursor,
                }"
                role="listitem"
                @click="library.focusGrid(index); openBook(book)"
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
        </template>

        <!-- RECENTS tab — une entrée par série (dernier tome touché) -->
        <template v-else-if="library.catalogTab === 'recent'">
          <section class="rail-section pad-top" aria-label="Récents">
            <div class="rail-head">
              <h2>Récents</h2>
            </div>
            <div v-if="!library.recentSeries.length" class="catalog__empty">
              <p class="catalog__empty-title">Pas encore d’activité</p>
            </div>
            <div v-else class="rail rail--wrap" role="list">
              <button
                v-for="(entry, index) in library.recentSeries"
                :key="'rr-' + (entry.seriesId || entry.lastBook?.id)"
                type="button"
                class="poster"
                :class="{
                  'is-focused':
                    library.focusZone === 'recent' && index === library.recentCursor,
                }"
                @click="library.focusRecent(index); openRecentEntry(entry)"
              >
                <div class="poster__art">
                  <LazyCover
                    v-if="entry.coverBookId != null"
                    :book-id="entry.coverBookId"
                    :alt="recentLabel(entry)"
                    :format="entry.lastBook?.format"
                  />
                </div>
                <span class="poster__title">{{ recentLabel(entry) }}</span>
                <span class="poster__meta">{{ recentMeta(entry) }}</span>
              </button>
            </div>
          </section>
        </template>

        <!-- SERIES tab → fiche série -->
        <template v-else-if="library.catalogTab === 'series'">
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
                @click="library.focusSeries(index); openSeries(group.seriesId)"
              >
                <div class="series-row__cover">
                  <LazyCover
                    v-if="group.seriesCoverBookId || group.coverBookId"
                    :book-id="group.seriesCoverBookId || group.coverBookId"
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

.catalog__chrome {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  /* réserve pour le débordement du logo sous le bandeau */
  padding-bottom: clamp(1.15rem, 2.4vw, 1.65rem);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.catalog__bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem 1.35rem;
  min-height: 3.15rem;
  padding: 0.45rem clamp(1rem, 2.5vw, 2rem);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  /* bandeau plus foncé que le fond catalogue */
  background: color-mix(in srgb, var(--ink-950) 38%, #050607 62%);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  box-shadow: 0 10px 28px color-mix(in srgb, #000 28%, transparent);
}

.catalog__chrome--empty .catalog__bar {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.catalog__brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  align-self: stretch;
  min-width: 0;
  padding-top: 0.2rem;
}

.catalog__logo {
  margin: 0;
  flex-shrink: 0;
  /* à cheval : moitié basse déborde sur le contenu */
  margin-bottom: calc(-1 * clamp(1.15rem, 2.4vw, 1.65rem));
}

.catalog__nav-spacer {
  min-width: 0;
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

.catalog__nav-link.is-focused {
  color: var(--brass-bright);
  border-bottom-color: var(--brass-bright);
  box-shadow: 0 2px 0 0 var(--focus-glow);
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

.catalog__tool.is-focused {
  border-color: var(--brass-bright);
  color: var(--brass-bright);
  box-shadow: 0 0 0 2px var(--focus-glow);
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
.catalog__settings:focus-visible,
.catalog__settings.is-focused {
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

.catalog__profile.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 2px var(--focus-glow);
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
  /* un peu d’air sous le logo à cheval */
  padding: 0.85rem clamp(1rem, 2.5vw, 2rem) 1.5rem;
  max-width: 100%;
  box-sizing: border-box;
}

.continue-section {
  margin-top: 0.35rem;
}

.continue-empty {
  color: var(--paper-dim);
  font-size: 0.9rem;
  padding: 0.75rem 0.15rem 0.25rem;
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

.grid-section {
  margin-top: 1.25rem;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 6), minmax(0, 1fr));
  gap: 1rem 0.85rem;
  max-width: 100%;
  min-width: 0;
}

.poster--grid {
  flex: none;
  width: 100%;
  max-width: none;
  min-width: 0;
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

.catalog__empty--solo {
  min-height: min(28rem, 70vh);
  align-content: center;
  padding: 3rem 1.5rem;
}

.catalog__empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.catalog__empty-lead {
  margin: 0;
  max-width: 28rem;
  color: var(--paper-dim);
  font-size: 0.95rem;
  line-height: 1.45;
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

.catalog__cta.is-focused {
  outline: 2px solid var(--brass);
  outline-offset: 3px;
  background: color-mix(in srgb, var(--brass) 32%, transparent);
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
  .catalog__bar {
    grid-template-columns: 1fr;
    justify-items: start;
    row-gap: 0.65rem;
    padding-top: 0.55rem;
    padding-bottom: 0.65rem;
  }

  .catalog__nav {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
    order: 3;
    width: 100%;
  }

  .catalog__tools {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalog__logo {
    filter: none;
  }

  .poster__art {
    transition: none;
  }
}
</style>
