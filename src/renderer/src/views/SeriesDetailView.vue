<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import LazyCover from '../components/LazyCover.vue';
import { useLibraryStore } from '../stores/library';
import { useUiStore } from '../stores/ui';
import {
  clampSeriesFocus,
  seriesFocusKind,
} from '../../../shared/series-focus.js';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const ui = useUiStore();

const loading = ref(true);

const group = computed(() => {
  const id = route.params.seriesId;
  return library.getSeriesById(id);
});

const volumes = computed(() => group.value?.volumes || []);

const coverBookId = computed(() => {
  const g = group.value;
  if (!g) return null;
  return g.seriesCoverBookId ?? g.volumes?.[0]?.id ?? g.coverBookId ?? null;
});

const authorLabel = computed(() => {
  const authors = volumes.value
    .map((v) => v.author)
    .filter((a) => a != null && String(a).trim());
  if (!authors.length) return '—';
  // Auteur le plus fréquent, sinon premier
  const counts = new Map();
  for (const a of authors) {
    const key = String(a).trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = authors[0];
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
});

const yearLabel = computed(() => {
  const years = volumes.value
    .map((v) => Number(v.year))
    .filter((y) => Number.isFinite(y));
  if (!years.length) return '—';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
});

const statusLabel = computed(() => {
  const s = group.value?.status;
  if (s === 'reading') return 'En cours';
  if (s === 'finished') return 'Terminé';
  return 'Non lu';
});

const progressLabel = computed(() => {
  const g = group.value;
  if (!g) return '—';
  return `${g.finishedCount || 0}/${g.volumeCount || 0} tomes`;
});

const openTarget = computed(() => {
  const kind = seriesFocusKind(ui.seriesFocusIndex, volumes.value.length);
  if (kind === 'volume') {
    return volumes.value[ui.seriesFocusIndex] || null;
  }
  return group.value?.nextUnread || volumes.value[0] || null;
});

const hints = [
  { key: '↑↓', label: 'tome' },
  { key: 'A', label: 'ouvrir' },
  { key: 'B', label: 'retour' },
];

function syncFocus() {
  const n = volumes.value.length;
  ui.setSeriesFocus(clampSeriesFocus(ui.seriesFocusIndex, n), n);
}

async function load() {
  loading.value = true;
  await library.refresh();
  syncFocus();
  if (coverBookId.value != null) await library.ensureCover(coverBookId.value);
  for (const v of volumes.value.slice(0, 12)) {
    void library.ensureCover(v.id);
  }
  loading.value = false;
  nextTick(() => scheduleScrollFocusedIntoView('.series-detail'));
}

onMounted(load);

watch(
  () => route.params.seriesId,
  () => {
    ui.setSeriesFocus(0, 0);
    load();
  },
);

watch(
  () => ui.seriesFocusIndex,
  () => nextTick(() => scheduleScrollFocusedIntoView('.series-detail')),
);

function statusBadge(status) {
  if (status === 'reading') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Non lu';
}

function openVolume(book) {
  if (!book?.id) return;
  router.push({ name: 'book', params: { id: String(book.id) } });
}

function openFocused() {
  const book = openTarget.value;
  if (book?.id) openVolume(book);
}

function back() {
  router.push({ name: 'library' });
}

function focusVolume(index) {
  ui.setSeriesFocus(index, volumes.value.length);
}

function focusOpen() {
  ui.setSeriesFocus(volumes.value.length, volumes.value.length);
}

function focusBack() {
  ui.setSeriesFocus(volumes.value.length + 1, volumes.value.length);
}

function volumeFocused(index) {
  return (
    seriesFocusKind(ui.seriesFocusIndex, volumes.value.length) === 'volume' &&
    ui.seriesFocusIndex === index
  );
}

function openFocusedBtn() {
  return seriesFocusKind(ui.seriesFocusIndex, volumes.value.length) === 'open';
}

function backFocused() {
  return seriesFocusKind(ui.seriesFocusIndex, volumes.value.length) === 'back';
}
</script>

<template>
  <section class="series-detail" aria-label="Fiche série">
    <div class="series-detail__atmosphere" aria-hidden="true" />

    <header class="series-detail__head">
      <div class="series-detail__head-main">
        <p class="series-detail__brand">Vertical Deck Reader</p>
        <p class="series-detail__status">
          {{ loading ? 'Chargement…' : group ? `Série · ${progressLabel}` : 'Introuvable' }}
        </p>
      </div>
      <ControlHint class="series-detail__hints" :items="hints" />
    </header>

    <div v-if="loading" class="series-detail__state">Chargement…</div>

    <div v-else-if="!group" class="series-detail__state series-detail__state--stack">
      <p class="series-detail__empty-title">Série introuvable</p>
      <button
        type="button"
        class="series-detail__action is-primary"
        :class="{ 'is-focused': true }"
        @click="back"
      >
        <span class="series-detail__action-label">Retour bibliothèque</span>
      </button>
    </div>

    <template v-else>
      <div class="series-detail__scroll shell-scroll">
        <div class="series-detail__scroll-inner">
          <div class="series-detail__hero" aria-label="Détails de la série">
            <aside class="series-detail__cover">
              <div class="series-detail__cover-frame">
                <LazyCover
                  v-if="coverBookId != null"
                  :book-id="coverBookId"
                  :alt="group.series"
                  eager
                />
              </div>
            </aside>

            <div class="series-detail__info">
              <h1 class="series-detail__title">{{ group.series }}</h1>
              <dl class="series-detail__meta">
                <div>
                  <dt>Tomes</dt>
                  <dd>{{ progressLabel }}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>{{ statusLabel }}</dd>
                </div>
                <div>
                  <dt>Auteur</dt>
                  <dd>{{ authorLabel }}</dd>
                </div>
                <div>
                  <dt>Années</dt>
                  <dd>{{ yearLabel }}</dd>
                </div>
              </dl>
              <p class="series-detail__lead">
                Choisis un tome pour ouvrir sa fiche, puis Lire.
              </p>
            </div>
          </div>

          <section class="series-detail__volumes" aria-label="Tomes de la série">
            <div class="series-detail__volumes-head">
              <h2>Tomes</h2>
              <p>{{ volumes.length }} volume{{ volumes.length > 1 ? 's' : '' }}</p>
            </div>
            <div
              class="series-detail__grid"
              :style="{ '--grid-cols': String(Math.min(6, library.columns || 6)) }"
              role="list"
            >
              <button
                v-for="(book, index) in volumes"
                :key="book.id"
                type="button"
                class="series-detail__vol"
                :class="{ 'is-focused': volumeFocused(index) }"
                role="listitem"
                @click="focusVolume(index); openVolume(book)"
              >
                <div class="series-detail__vol-art">
                  <LazyCover
                    :book-id="book.id"
                    :alt="book.title"
                    :format="book.format"
                  />
                </div>
                <span class="series-detail__vol-title">
                  {{
                    book.volume != null && book.volume !== ''
                      ? `Tome ${book.volume}`
                      : book.title
                  }}
                </span>
                <span class="series-detail__vol-meta">{{ statusBadge(book.status) }}</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer class="series-detail__foot">
        <div class="series-detail__actions" role="toolbar" aria-label="Actions fiche série">
          <button
            type="button"
            class="series-detail__action is-primary"
            data-series-action="open"
            :class="{ 'is-focused': openFocusedBtn() }"
            :disabled="!openTarget"
            @click="focusOpen(); openFocused()"
          >
            <span class="series-detail__action-label">Ouvrir un tome</span>
            <span class="series-detail__action-sub">
              {{
                openTarget?.volume != null
                  ? `Tome ${openTarget.volume}`
                  : openTarget?.title || 'Fiche tome'
              }}
            </span>
          </button>
          <button
            type="button"
            class="series-detail__action series-detail__action--ghost"
            data-series-action="back"
            :class="{ 'is-focused': backFocused() }"
            @click="focusBack(); back()"
          >
            <span class="series-detail__action-label">Retour</span>
            <span class="series-detail__action-sub">Bibliothèque</span>
          </button>
        </div>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.series-detail {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--paper);
}

.series-detail__atmosphere {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 10% 0%, var(--wash-a), transparent 55%),
    radial-gradient(ellipse 45% 35% at 90% 80%, var(--wash-b), transparent 50%),
    var(--ink-950);
}

.series-detail__head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem clamp(1rem, 2.5vw, 2rem) 0.5rem;
}

.series-detail__brand {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
}

.series-detail__status {
  margin: 0.2rem 0 0;
  color: var(--paper-dim);
  font-size: 0.85rem;
}

.series-detail__state {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: 1;
  color: var(--paper-dim);
}

.series-detail__state--stack {
  gap: 1rem;
}

.series-detail__empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--paper);
}

.series-detail__scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.series-detail__scroll-inner {
  padding: 0.5rem clamp(1rem, 2.5vw, 2rem) 1.25rem;
  display: grid;
  gap: 1.5rem;
}

.series-detail__hero {
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
  gap: 1.5rem 2rem;
  align-items: start;
}

.series-detail__cover-frame {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 16px;
  overflow: hidden;
  background: var(--ink-800);
  border: 1px solid var(--border);
}

.series-detail__cover-frame :deep(.lazy-cover),
.series-detail__cover-frame :deep(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.series-detail__title {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.series-detail__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1.25rem;
  margin: 0;
}

.series-detail__meta dt {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--paper-dim);
}

.series-detail__meta dd {
  margin: 0.2rem 0 0;
  font-weight: 600;
}

.series-detail__lead {
  margin: 1.1rem 0 0;
  color: var(--paper-dim);
  max-width: 36rem;
  line-height: 1.45;
}

.series-detail__volumes-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.series-detail__volumes-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.series-detail__volumes-head p {
  margin: 0;
  color: var(--paper-dim);
  font-size: 0.85rem;
}

.series-detail__grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 6), minmax(0, 1fr));
  gap: 1rem 0.85rem;
}

.series-detail__vol {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  font: inherit;
  min-width: 0;
}

.series-detail__vol-art {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 14px;
  overflow: hidden;
  background: var(--ink-800);
  border: 1px solid var(--border);
  transition: transform 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft);
}

.series-detail__vol-art :deep(.lazy-cover),
.series-detail__vol-art :deep(img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.series-detail__vol.is-focused .series-detail__vol-art {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.series-detail__vol-title {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-detail__vol-meta {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: var(--paper-dim);
}

.series-detail__foot {
  position: relative;
  z-index: 2;
  padding: 0.75rem clamp(1rem, 2.5vw, 2rem) 1rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--ink-950) 88%, transparent);
}

.series-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.series-detail__action {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--paper);
  border-radius: 14px;
  padding: 0.75rem 1.2rem;
  min-width: 10rem;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.series-detail__action.is-primary {
  border-color: var(--brass);
  background: color-mix(in srgb, var(--brass) 22%, transparent);
}

.series-detail__action--ghost {
  background: transparent;
}

.series-detail__action.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.series-detail__action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.series-detail__action-label {
  display: block;
  font-weight: 700;
}

.series-detail__action-sub {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--paper-dim);
}

@media (max-width: 720px) {
  .series-detail__hero {
    grid-template-columns: 1fr;
  }

  .series-detail__cover {
    max-width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .series-detail__vol-art {
    transition: none;
  }
}
</style>
