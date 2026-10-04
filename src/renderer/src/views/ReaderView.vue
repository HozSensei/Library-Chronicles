<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageReaderStage from '../components/PageReaderStage.vue';
import StripReaderStage from '../components/StripReaderStage.vue';
import ReaderHud from '../components/ReaderHud.vue';
import { useReaderStore } from '../stores/reader';
import { useUiStore } from '../stores/ui';
import { useToastStore } from '../stores/toast';
import { useI18n } from '../composables/useI18n';
import {
  normalizeReadingMode,
  READING_MODE,
} from '../../../shared/reading-mode.js';

const router = useRouter();
const route = useRoute();
const reader = useReaderStore();
const ui = useUiStore();
const toast = useToastStore();
const { t } = useI18n();

function modeFromRoute() {
  return normalizeReadingMode(route.query.mode);
}

function readerQuery(filePath, mode = reader.readingMode) {
  const query = { path: filePath };
  if (normalizeReadingMode(mode) === READING_MODE.STRIP) {
    query.mode = READING_MODE.STRIP;
  }
  return query;
}

async function openFromRoute() {
  const filePath = route.query.path;
  const mode = modeFromRoute();
  if (filePath) {
    await reader.open(String(filePath), { readingMode: mode });
    return;
  }
  const config = await window.vdr.getConfig();
  if (config.phase1TestCbz) {
    await reader.open(config.phase1TestCbz, { readingMode: mode });
  } else if (config.lastOpenedPath) {
    await reader.open(config.lastOpenedPath, { readingMode: mode });
  }
}

/**
 * Ouverture fichier uniquement.
 * Le resize / setSessionMode est géré UNE FOIS par App.vue (watch route → reader).
 * Mode posé depuis ?mode=page|strip — jamais d’héritage sticky entre sessions.
 */
onMounted(async () => {
  try {
    await openFromRoute();
    // Une fois par ouverture du lecteur : hint Start → menu pause.
    if (reader.filePath) {
      toast.info(t('toast.readerStartMenu'), { duration: 3000 });
    }
  } catch (err) {
    console.warn('[VDR] open:', err.message);
  }
});

onUnmounted(() => {
  reader.close();
  // Pas d’exitReaderMode ici — App.vue watch (reader → autre) le fait une seule fois.
});

watch(
  () => [route.query.path, route.query.mode],
  async ([path]) => {
    if (path) {
      try {
        await reader.open(String(path), { readingMode: modeFromRoute() });
      } catch (err) {
        console.warn('[VDR] open:', err.message);
      }
    }
  },
);

async function leave() {
  await reader.close();
  router.push({ name: 'library' });
}

async function openAdjacent(delta) {
  const ok =
    delta < 0 ? await reader.openPrevVolume() : await reader.openNextVolume();
  if (!ok) return;
  router.replace({
    name: 'reader',
    query: readerQuery(reader.filePath, reader.readingMode),
  });
}

function endFocusId(id) {
  const ids = [];
  if (reader.prevVolumeOffer) ids.push('prev-volume');
  if (reader.nextVolumeOffer) ids.push('next-volume');
  return ids[reader.endFocusIndex] === id;
}
</script>

<template>
  <section
    class="reader"
    :aria-label="t('reader.aria')"
    :data-strip="reader.isStripMode ? '1' : '0'"
    :data-reader-path="reader.isStripMode ? 'strip' : 'page'"
    :data-css-rotate="ui.readerCssRotate ? '1' : '0'"
  >
    <!--
      Plan lecteur : en css-rotate (stratégie B, fenêtre landscape),
      dimensions portrait (100vh × 100vw) puis rotate(+90° CW) pour Ally
      tenue CCW (D-Pad en bas). Inclut HUD pour rester dans le même repère.
    -->
    <div class="reader__plane">
      <div class="reader__viewport">
        <!-- Chemins strictement séparés : StripReaderStage vs PageReaderStage -->
        <StripReaderStage
          v-if="reader.isStripMode && reader.pageCount > 0"
        />
        <PageReaderStage
          v-else-if="reader.pageCount > 0"
          @leave="leave"
        />
        <div v-else class="reader__placeholder">
          <p class="reader__brand">Library Chronicles</p>
          <p v-if="reader.loading">{{ t('reader.loading') }}</p>
          <p v-else-if="reader.error">{{ reader.error }}</p>
          <template v-else>
            <p>{{ t('reader.empty') }}</p>
            <p class="dim">{{ t('reader.emptyLead') }}</p>
          </template>
          <button type="button" class="ghost" @click="leave">{{ t('reader.back') }}</button>
        </div>
      </div>

      <div
        v-if="reader.showEndSeriesNav && !reader.hudVisible"
        class="reader__next"
        role="dialog"
        aria-label="Fin de tome — navigation série"
      >
        <p class="reader__next-label">{{ t('reader.tomeDone') }}</p>
        <p v-if="reader.series" class="reader__next-series">
          {{ reader.series }}
          <template v-if="reader.volume != null"> · T{{ reader.volume }}</template>
        </p>
        <div class="reader__next-actions">
          <button
            v-if="reader.prevVolumeOffer"
            type="button"
            class="ghost"
            data-end-focus
            :class="{ 'is-focused': endFocusId('prev-volume') }"
            @click="openAdjacent(-1)"
          >
            Tome précédent
            <span class="reader__next-title">{{ reader.prevVolumeOffer.title }}</span>
          </button>
          <button
            v-if="reader.nextVolumeOffer"
            type="button"
            class="btn-primary"
            data-end-focus
            :class="{ 'is-focused': endFocusId('next-volume') }"
            @click="openAdjacent(1)"
          >
            Tome suivant
            <span class="reader__next-title">{{ reader.nextVolumeOffer.title }}</span>
          </button>
        </div>
        <p class="reader__next-hint">{{ t('reader.nextHint') }}</p>
      </div>

      <ReaderHud />
    </div>
  </section>
</template>

<style scoped>
.reader {
  position: relative;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
  background: var(--reader-bg);
}

/* Plan plein cadre (fenêtre déjà portrait rare / tests). */
.reader__plane {
  position: absolute;
  inset: 0;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

/*
 * Stratégie B — fenêtre landscape fixe :
 * plan local portrait (largeur = hauteur fenêtre, hauteur = largeur fenêtre),
 * puis +90° CW pour lecture Ally CCW (D-Pad en bas).
 * Après rotation le plan remplit exactement le viewport landscape.
 */
.reader[data-css-rotate='1'] .reader__plane {
  inset: auto;
  top: 50%;
  left: 50%;
  width: 100vh;
  height: 100vw;
  max-width: none;
  max-height: none;
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
}

.reader__viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
  min-width: 0;
  min-height: 0;
  touch-action: none;
}

.reader__placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
  min-width: 0;
  height: 100%;
}

.reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-bright);
}

.reader__next {
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 1.25rem;
  z-index: calc(var(--z-hud) + 1);
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  color: var(--paper);
  border: 1px solid color-mix(in srgb, var(--brass) 45%, transparent);
  min-width: 0;
  max-width: min(26rem, calc(100% - 2rem));
  margin-inline: auto;
  box-sizing: border-box;
}

.reader__next-label,
.reader__next-series,
.reader__next-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
  overflow-wrap: anywhere;
}

.reader__next-label {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--paper);
  font-size: 0.95rem;
}

.reader__next-actions {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.reader__next-actions > * {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  text-align: center;
}

.reader__next-actions .is-focused {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.reader__next-title {
  display: block;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.72rem;
  color: var(--paper-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader__next-hint {
  text-align: center;
  letter-spacing: 0.02em;
  font-size: 0.72rem;
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
