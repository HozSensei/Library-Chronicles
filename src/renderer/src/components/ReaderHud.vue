<script setup>
import { useReaderStore } from '../stores/reader';
import { useUiStore } from '../stores/ui';

const reader = useReaderStore();
const ui = useUiStore();

function nudge(key, delta) {
  const cur = reader[key];
  const next = Math.round((cur + delta) * 100) / 100;
  reader.setFilters({ [key]: next });
}
</script>

<template>
  <aside
    v-show="reader.hudVisible"
    class="hud"
    :class="{ 'hud--static': ui.reducedMotion }"
    aria-label="Options de lecture"
  >
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

    <div class="hud__tabs">
      <button
        type="button"
        class="hud__tab"
        :class="{ 'is-active': reader.hudPanel === 'main' }"
        @click="reader.setHudPanel('main')"
      >
        Lecture
      </button>
      <button
        type="button"
        class="hud__tab"
        :class="{ 'is-active': reader.hudPanel === 'filters' }"
        @click="reader.setHudPanel('filters')"
      >
        Filtres
      </button>
      <button
        type="button"
        class="hud__tab"
        :class="{ 'is-active': reader.hudPanel === 'bookmarks' }"
        @click="reader.setHudPanel('bookmarks')"
      >
        Signets
      </button>
    </div>

    <div v-if="reader.hudPanel === 'main'" class="hud__panel">
      <div class="hud__meta">
        <span>
          {{ reader.direction.toUpperCase() }}
          · {{ reader.webtoonMode ? 'webtoon' : reader.fitMode }}
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
        <button type="button" class="ghost" @click="reader.toggleWebtoon()">
          {{ reader.webtoonMode ? 'Quitter webtoon' : 'Mode webtoon' }}
        </button>
        <button type="button" class="ghost" @click="reader.addBookmark()">
          Signet (X)
        </button>
        <button
          v-if="reader.nextVolumeOffer"
          type="button"
          class="ghost"
          @click="reader.openNextVolume()"
        >
          Tome suivant
        </button>
      </div>
      <p class="hud__hint">Y masquer · X signet · Select webtoon · LB fit width</p>
    </div>

    <div v-else-if="reader.hudPanel === 'filters'" class="hud__panel">
      <label class="hud__slider">
        <span>Luminosité {{ reader.brightness.toFixed(2) }}</span>
        <input
          type="range"
          min="0.4"
          max="1.6"
          step="0.02"
          :value="reader.brightness"
          @input="reader.setFilters({ brightness: Number($event.target.value) })"
        />
        <span class="hud__nudge">
          <button type="button" class="ghost" @click="nudge('brightness', -0.05)">−</button>
          <button type="button" class="ghost" @click="nudge('brightness', 0.05)">+</button>
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
          @input="reader.setFilters({ contrast: Number($event.target.value) })"
        />
        <span class="hud__nudge">
          <button type="button" class="ghost" @click="nudge('contrast', -0.05)">−</button>
          <button type="button" class="ghost" @click="nudge('contrast', 0.05)">+</button>
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
          @input="reader.setFilters({ sepia: Number($event.target.value) })"
        />
        <span class="hud__nudge">
          <button type="button" class="ghost" @click="nudge('sepia', -0.05)">−</button>
          <button type="button" class="ghost" @click="nudge('sepia', 0.05)">+</button>
        </span>
      </label>
      <div class="hud__actions">
        <button type="button" class="ghost" @click="reader.applyNightPreset()">Preset nuit</button>
        <button type="button" class="ghost" @click="reader.resetFilters()">Reset</button>
      </div>
    </div>

    <div v-else class="hud__panel">
      <p v-if="reader.bookmarkFlash" class="hud__flash">{{ reader.bookmarkFlash }}</p>
      <ul v-if="reader.bookmarks.length" class="hud__bookmarks">
        <li v-for="bm in reader.bookmarks" :key="bm.id">
          <button type="button" class="hud__bm" @click="reader.goToBookmark(bm)">
            p.{{ bm.page + 1 }}
            <span v-if="bm.label">· {{ bm.label }}</span>
          </button>
          <button type="button" class="ghost" @click="reader.removeBookmark(bm.id)">×</button>
        </li>
      </ul>
      <p v-else class="hud__empty">Aucun signet — X pour en ajouter.</p>
      <button type="button" class="ghost" @click="reader.addBookmark()">Ajouter ici</button>
    </div>
  </aside>
</template>

<style scoped>
.hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-hud);
  padding: 1.1rem 1.2rem 1.4rem;
  background: linear-gradient(transparent, var(--hud-fade) 28%);
  color: #f2ebe0;
  animation: hud-up 220ms var(--ease-out);
  max-height: 55%;
  overflow: auto;
}

.hud--static {
  animation: none;
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
}

.hud__track {
  height: 3px;
  border-radius: 999px;
  background: rgba(242, 235, 224, 0.12);
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
  margin-top: 0.75rem;
}

.hud__tab {
  flex: 1;
  border: 1px solid rgba(242, 235, 224, 0.18);
  background: transparent;
  color: rgba(242, 235, 224, 0.75);
  padding: 0.35rem 0.4rem;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.hud__tab.is-active {
  color: #1a1510;
  background: var(--brass-bright);
  border-color: var(--brass-bright);
}

.hud__panel {
  margin-top: 0.7rem;
  display: grid;
  gap: 0.55rem;
}

.hud__meta {
  display: flex;
  justify-content: space-between;
  color: rgba(242, 235, 224, 0.7);
  font-size: 0.78rem;
  gap: 0.75rem;
}

.hud__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.hud__hint,
.hud__empty,
.hud__flash {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(242, 235, 224, 0.65);
}

.hud__flash {
  color: var(--brass-bright);
}

.hud__slider {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.hud__slider input[type='range'] {
  width: 100%;
}

.hud__nudge {
  display: flex;
  gap: 0.35rem;
}

.hud__bookmarks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
  max-height: 8rem;
  overflow: auto;
}

.hud__bookmarks li {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.hud__bm {
  flex: 1;
  text-align: left;
  border: 0;
  background: rgba(242, 235, 224, 0.08);
  color: inherit;
  padding: 0.4rem 0.55rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

@keyframes hud-up {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hud {
    animation: none;
  }
  .hud__fill {
    transition: none;
  }
}
</style>
