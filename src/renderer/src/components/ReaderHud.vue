<script setup>
import { computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useReaderStore } from '../stores/reader';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const reader = useReaderStore();
const ui = useUiStore();

const focusIds = computed(() => {
  const ids = ['tab-main', 'tab-filters', 'tab-bookmarks'];
  if (reader.hudPanel === 'main') {
    ids.push('quit', 'direction', 'reading-mode', 'bookmark');
    if (reader.prevVolumeOffer) ids.push('prev-volume');
    if (reader.nextVolumeOffer) ids.push('next-volume');
  } else if (reader.hudPanel === 'filters') {
    ids.push(
      'brightness-down',
      'brightness-up',
      'contrast-down',
      'contrast-up',
      'sepia-down',
      'sepia-up',
      'night',
      'reset-filters',
    );
  } else {
    for (const bm of reader.bookmarks) {
      ids.push(`bm-go-${bm.id}`, `bm-del-${bm.id}`);
    }
    ids.push('bm-add');
  }
  return ids;
});

watch(
  () => [
    reader.hudVisible,
    reader.hudPanel,
    reader.bookmarks.length,
    reader.prevVolumeOffer,
    reader.nextVolumeOffer,
  ],
  async ([visible]) => {
    if (!visible) return;
    await nextTick();
    const max = Math.max(0, focusIds.value.length - 1);
    if (reader.hudFocusIndex > max) reader.setHudFocus(0);
  },
);

async function openAdjacent(delta) {
  const ok =
    delta < 0 ? await reader.openPrevVolume() : await reader.openNextVolume();
  if (!ok) return;
  router.replace({ name: 'reader', query: { path: reader.filePath } });
}

function isFocused(id) {
  return focusIds.value[reader.hudFocusIndex] === id;
}

function nudge(key, delta) {
  const cur = reader[key];
  const next = Math.round((cur + delta) * 100) / 100;
  reader.setFilters({ [key]: next });
}

function closePause() {
  reader.closeHud();
}

async function quitReading() {
  await reader.close();
  // Resize landscape = App.vue watch (sortie route reader) — une seule transition.
  router.push({ name: 'library' });
}
</script>

<template>
  <!-- Toast progression (page ±, ouverture) — pas la modal pause -->
  <div
    v-show="reader.toastVisible && !reader.hudVisible"
    class="hud-toast"
    :class="{ 'hud-toast--static': ui.reducedMotion }"
    aria-live="polite"
  >
    <div class="hud-toast__bar">
      <span class="hud-toast__title">{{ reader.title || '—' }}</span>
      <span class="hud-toast__page">{{ reader.pageLabel }}</span>
    </div>
    <div
      class="hud-toast__track"
      role="progressbar"
      :aria-valuenow="Math.round(reader.progress)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="hud-toast__fill" :style="{ width: `${reader.progress}%` }" />
    </div>
  </div>

  <!-- Modal pause Select — même plan tourné que le stage (+90°) -->
  <aside
    v-show="reader.hudVisible"
    class="hud"
    :class="{ 'hud--static': ui.reducedMotion }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="hud-pause-title"
    aria-label="Menu pause lecture"
  >
    <button
      type="button"
      class="hud__backdrop"
      tabindex="-1"
      aria-label="Fermer le menu pause"
      @click="closePause"
    />

    <div class="hud__dialog">
      <header class="hud__header">
        <div class="hud__bar">
          <span class="hud__title">{{ reader.title || '—' }}</span>
          <span class="hud__page">{{ reader.pageLabel }}</span>
        </div>
        <div
          class="hud__track"
          role="progressbar"
          :aria-valuenow="Math.round(reader.progress)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="hud__fill" :style="{ width: `${reader.progress}%` }" />
        </div>
      </header>

      <div class="hud__tabs" role="tablist">
        <button
          type="button"
          class="hud__tab"
          data-hud-focus
          role="tab"
          :class="{ 'is-active': reader.hudPanel === 'main', 'is-focused': isFocused('tab-main') }"
          :aria-selected="reader.hudPanel === 'main'"
          @click="reader.setHudPanel('main')"
        >
          Lecture
        </button>
        <button
          type="button"
          class="hud__tab"
          data-hud-focus
          role="tab"
          :class="{ 'is-active': reader.hudPanel === 'filters', 'is-focused': isFocused('tab-filters') }"
          :aria-selected="reader.hudPanel === 'filters'"
          @click="reader.setHudPanel('filters')"
        >
          Filtres
        </button>
        <button
          type="button"
          class="hud__tab"
          data-hud-focus
          role="tab"
          :class="{
            'is-active': reader.hudPanel === 'bookmarks',
            'is-focused': isFocused('tab-bookmarks'),
          }"
          :aria-selected="reader.hudPanel === 'bookmarks'"
          @click="reader.setHudPanel('bookmarks')"
        >
          Signets
        </button>
      </div>

      <div class="hud__body">
        <div v-if="reader.hudPanel === 'main'" class="hud__panel" role="tabpanel">
          <p id="hud-pause-title" class="hud__pause-title">Pause lecture</p>
          <div class="hud__meta">
            <span>
              {{ reader.direction.toUpperCase() }}
              · {{ reader.isStripMode ? 'strip vertical' : 'page par page' }}
              <template v-if="reader.isPageMode"> · {{ reader.fitMode }}</template>
              <template v-if="reader.currentChapter">
                · {{ reader.currentChapter.name }}
              </template>
              <template v-if="reader.series">
                · {{ reader.series }}
                <template v-if="reader.volume != null"> T{{ reader.volume }}</template>
              </template>
            </span>
          </div>
          <div class="hud__actions">
            <button
              type="button"
              class="btn-primary"
              data-hud-focus
              :class="{ 'is-focused': isFocused('quit') }"
              @click="quitReading"
            >
              Quitter la lecture
            </button>
            <button
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('direction') }"
              @click="reader.toggleDirection()"
            >
              Sens {{ reader.direction.toUpperCase() }}
            </button>
            <button
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('reading-mode') }"
              @click="reader.toggleReadingMode()"
            >
              {{ reader.isStripMode ? 'Page par page' : 'Strip vertical' }}
            </button>
            <button
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('bookmark') }"
              @click="reader.addBookmark()"
            >
              Signet (X)
            </button>
            <button
              v-if="reader.prevVolumeOffer"
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('prev-volume') }"
              @click="openAdjacent(-1)"
            >
              Tome précédent
              <template v-if="reader.prevVolumeOffer.volume != null">
                · T{{ reader.prevVolumeOffer.volume }}
              </template>
            </button>
            <button
              v-if="reader.nextVolumeOffer"
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('next-volume') }"
              @click="openAdjacent(1)"
            >
              Tome suivant
              <template v-if="reader.nextVolumeOffer.volume != null">
                · T{{ reader.nextVolumeOffer.volume }}
              </template>
            </button>
          </div>
        </div>

        <div v-else-if="reader.hudPanel === 'filters'" class="hud__panel" role="tabpanel">
          <label class="hud__slider">
            <span>Luminosité {{ reader.brightness.toFixed(2) }}</span>
            <input
              type="range"
              min="0.4"
              max="1.6"
              step="0.02"
              :value="reader.brightness"
              tabindex="-1"
              @input="reader.setFilters({ brightness: Number($event.target.value) })"
            />
            <span class="hud__nudge">
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('brightness-down') }"
                @click="nudge('brightness', -0.05)"
              >
                −
              </button>
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('brightness-up') }"
                @click="nudge('brightness', 0.05)"
              >
                +
              </button>
            </span>
          </label>
          <label class="hud__slider">
            <span>Contraste {{ reader.contrast.toFixed(2) }}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.02"
              :value="reader.contrast"
              tabindex="-1"
              @input="reader.setFilters({ contrast: Number($event.target.value) })"
            />
            <span class="hud__nudge">
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('contrast-down') }"
                @click="nudge('contrast', -0.05)"
              >
                −
              </button>
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('contrast-up') }"
                @click="nudge('contrast', 0.05)"
              >
                +
              </button>
            </span>
          </label>
          <label class="hud__slider">
            <span>Sépia {{ reader.sepia.toFixed(2) }}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              :value="reader.sepia"
              tabindex="-1"
              @input="reader.setFilters({ sepia: Number($event.target.value) })"
            />
            <span class="hud__nudge">
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('sepia-down') }"
                @click="nudge('sepia', -0.05)"
              >
                −
              </button>
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused('sepia-up') }"
                @click="nudge('sepia', 0.05)"
              >
                +
              </button>
            </span>
          </label>
          <div class="hud__actions">
            <button
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('night') }"
              @click="reader.applyNightPreset()"
            >
              Preset nuit
            </button>
            <button
              type="button"
              class="ghost"
              data-hud-focus
              :class="{ 'is-focused': isFocused('reset-filters') }"
              @click="reader.resetFilters()"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-else class="hud__panel" role="tabpanel">
          <p v-if="reader.bookmarkFlash" class="hud__flash">{{ reader.bookmarkFlash }}</p>
          <ul v-if="reader.bookmarks.length" class="hud__bookmarks">
            <li v-for="bm in reader.bookmarks" :key="bm.id">
              <button
                type="button"
                class="hud__bm"
                data-hud-focus
                :class="{ 'is-focused': isFocused(`bm-go-${bm.id}`) }"
                @click="reader.goToBookmark(bm)"
              >
                p.{{ bm.page + 1 }}
                <span v-if="bm.label">· {{ bm.label }}</span>
              </button>
              <button
                type="button"
                class="ghost"
                data-hud-focus
                :class="{ 'is-focused': isFocused(`bm-del-${bm.id}`) }"
                @click="reader.removeBookmark(bm.id)"
              >
                ×
              </button>
            </li>
          </ul>
          <p v-else class="hud__empty">Aucun signet — X pour en ajouter.</p>
          <button
            type="button"
            class="ghost"
            data-hud-focus
            :class="{ 'is-focused': isFocused('bm-add') }"
            @click="reader.addBookmark()"
          >
            Ajouter ici
          </button>
        </div>
      </div>

      <p class="hud__hint">
        A valider · B fermer · Select pause · ↑↓ focus
        <template v-if="reader.isStripMode">
          · Stick ↕ scroll · ←→ zoom · L3 zoom
        </template>
        <template v-else>
          · Stick pan · ←→ zoom · L3 fit · ↑↓ page
        </template>
      </p>
    </div>
  </aside>
</template>

<style scoped>
/* —— Toast progression (bas du plan portrait) —— */
.hud-toast {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 1.25rem;
  z-index: var(--z-hud);
  padding: 0.75rem 0.9rem;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--brass) 35%, transparent);
  color: var(--paper);
  animation: hud-fade 200ms var(--ease-out);
  max-width: min(28rem, calc(100% - 2rem));
  margin-inline: auto;
  box-sizing: border-box;
  pointer-events: none;
}

.hud-toast--static {
  animation: none;
}

.hud-toast__bar {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
}

.hud-toast__title {
  font-family: var(--font-display);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.hud-toast__page {
  flex-shrink: 0;
  color: var(--paper-dim);
  font-size: 0.78rem;
}

.hud-toast__track {
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 12%, transparent);
  overflow: hidden;
}

.hud-toast__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brass-deep), var(--brass-bright));
  transition: width 160ms var(--ease-soft);
}

.hud-toast--static .hud-toast__fill {
  transition: none;
}

/* —— Modal pause (plein plan lecteur, déjà +90° via .reader__plane) —— */
.hud {
  position: absolute;
  inset: 0;
  z-index: calc(var(--z-hud) + 2);
  display: grid;
  place-items: center;
  padding: 1.25rem;
  box-sizing: border-box;
  color: var(--paper);
  animation: hud-fade 180ms var(--ease-out);
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.hud--static {
  animation: none;
}

.hud__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  margin: 0;
  /* Voile semi-transparent clair/foncé selon data-theme (--hud-fade) */
  background: var(--hud-fade);
  cursor: pointer;
}

.hud__dialog {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: min(22.5rem, 100%);
  max-width: 100%;
  max-height: min(36rem, calc(100% - 0.5rem));
  min-width: 0;
  min-height: 0;
  padding: 1.15rem 1.2rem 1.05rem;
  box-sizing: border-box;
  /* Fond = background du thème (data-theme), pas un noir générique */
  background: var(--bg);
  color: var(--paper);
  border: 1px solid color-mix(in srgb, var(--brass) 42%, transparent);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--ink) 45%, transparent);
  overflow: hidden;
}

.hud__header {
  flex-shrink: 0;
  min-width: 0;
}

.hud__bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.55rem;
  font-size: 0.95rem;
}

.hud__title {
  font-family: var(--font-display);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.hud__page {
  flex-shrink: 0;
  color: var(--paper-dim);
  font-size: 0.82rem;
}

.hud__track {
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 12%, transparent);
  overflow: hidden;
}

.hud__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brass-deep), var(--brass-bright));
  transition: width 160ms var(--ease-soft);
}

.hud--static .hud__fill {
  transition: none;
}

.hud__tabs {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.hud__tab {
  flex: 1;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--paper-dim);
  padding: 0.45rem 0.4rem;
  font: inherit;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.78rem;
  cursor: pointer;
  min-width: 0;
}

.hud__tab.is-active {
  /* Texte sombre sur pastille accent (lisible clair + sombre) */
  color: #1a1510;
  background: var(--brass-bright);
  border-color: var(--brass-bright);
}

.hud__tab.is-focused,
.hud__actions .is-focused,
.hud__nudge .is-focused,
.hud__bm.is-focused,
.hud__panel > .ghost.is-focused {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.hud__body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}

.hud__panel {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}

.hud__meta {
  display: flex;
  justify-content: space-between;
  color: var(--paper-dim);
  font-size: 0.78rem;
  gap: 0.75rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.hud__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.hud__actions > * {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.hud__hint,
.hud__empty,
.hud__flash {
  margin: 0;
  font-size: 0.75rem;
  color: var(--paper-dim);
}

.hud__hint {
  flex-shrink: 0;
  text-align: center;
  letter-spacing: 0.02em;
}

.hud__flash {
  color: var(--brass-bright);
}

.hud__slider {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
  min-width: 0;
}

.hud__slider input[type='range'] {
  width: 100%;
  max-width: 100%;
}

.hud__nudge {
  display: flex;
  gap: 0.35rem;
}

.hud__nudge .ghost {
  min-width: 2.5rem;
}

.hud__bookmarks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
  max-height: none;
  overflow: visible;
}

.hud__bookmarks li {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.hud__bm {
  flex: 1;
  text-align: left;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--paper) 8%, transparent);
  color: inherit;
  padding: 0.45rem 0.55rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  min-width: 0;
  overflow-wrap: anywhere;
}

@keyframes hud-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hud,
  .hud-toast {
    animation: none;
  }
  .hud__fill,
  .hud-toast__fill {
    transition: none;
  }
}
</style>
