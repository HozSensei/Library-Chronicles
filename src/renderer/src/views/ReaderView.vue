<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReaderHud from '../components/ReaderHud.vue';
import { useReaderStore } from '../stores/reader';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const route = useRoute();
const reader = useReaderStore();
const ui = useUiStore();
const stripEl = ref(null);
const planeEl = ref(null);

const stripStyle = computed(() => ({
  filter: reader.filterCss,
  transform: `translate3d(${reader.panX}px, ${reader.panY}px, 0)`,
}));

/**
 * Ouverture fichier uniquement.
 * Le resize / setSessionMode est géré UNE FOIS par App.vue (watch route → reader).
 */
onMounted(async () => {
  const filePath = route.query.path;
  try {
    if (filePath) {
      await reader.open(String(filePath));
      return;
    }
    const config = await window.vdr.getConfig();
    if (config.phase1TestCbz) {
      await reader.open(config.phase1TestCbz);
    } else if (config.lastOpenedPath) {
      await reader.open(config.lastOpenedPath);
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
  () => route.query.path,
  async (path) => {
    if (path) await reader.open(String(path));
  },
);

watch(
  () => [reader.webtoonMode, reader.pageIndex, reader.stripPages.length],
  async () => {
    if (!reader.webtoonMode) return;
    await nextTick();
    const el = stripEl.value?.querySelector(`[data-page="${reader.pageIndex}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
);

async function leave() {
  await reader.close();
  router.push({ name: 'library' });
}

async function openNext() {
  const ok = await reader.openNextVolume();
  if (!ok) return;
  router.replace({ name: 'reader', query: { path: reader.filePath } });
}

function onStripScroll() {
  if (!stripEl.value || !reader.webtoonMode) return;
  const nodes = [...stripEl.value.querySelectorAll('[data-page]')];
  if (!nodes.length) return;
  const top = stripEl.value.scrollTop + 40;
  let best = reader.pageIndex;
  for (const node of nodes) {
    if (node.offsetTop <= top) best = Number(node.dataset.page);
  }
  if (best !== reader.pageIndex) {
    reader.pageIndex = best;
    reader.persistProgress();
    reader.syncChapterIndex();
  }
}
</script>

<template>
  <section
    class="reader"
    aria-label="Lecteur"
    :data-webtoon="reader.webtoonMode"
    :data-css-rotate="ui.readerCssRotate ? '1' : '0'"
  >
    <!--
      Plan lecteur : en css-rotate (stratégie B, fenêtre landscape),
      dimensions portrait (100vh × 100vw) puis rotate(+90° CW) pour Ally
      tenue CCW (D-Pad en bas). Inclut HUD pour rester dans le même repère.
    -->
    <div ref="planeEl" class="reader__plane">
      <div class="reader__viewport">
        <div
          v-if="reader.webtoonMode"
          ref="stripEl"
          class="reader__strip"
          @scroll.passive="onStripScroll"
        >
          <div class="reader__strip-inner" :style="stripStyle">
            <img
              v-for="page in reader.stripPages"
              :key="page.index"
              class="reader__strip-page"
              :class="{ 'is-current': page.index === reader.pageIndex }"
              :src="page.url"
              :data-page="page.index"
              :alt="`Page ${page.index + 1}`"
              draggable="false"
            />
          </div>
        </div>

        <div v-else class="reader__stage" :data-fit="reader.fitMode">
          <img
            v-if="reader.pageUrl"
            class="reader__page"
            :src="reader.pageUrl"
            alt="Page courante"
            draggable="false"
            :style="reader.imageStyle"
          />
          <div v-else class="reader__placeholder">
            <p class="reader__brand">Vertical Deck Reader</p>
            <p v-if="reader.loading">Chargement…</p>
            <p v-else-if="reader.error">{{ reader.error }}</p>
            <template v-else>
              <p>Aucun livre chargé</p>
              <p class="dim">Ouvre un tome depuis la bibliothèque ou l’import.</p>
            </template>
            <button type="button" class="ghost" @click="leave">Retour</button>
          </div>
        </div>
      </div>

      <div v-if="reader.nextVolumeOffer && reader.isFinished" class="reader__next">
        <p>Tome terminé</p>
        <button type="button" class="ghost" @click="openNext">
          RB · {{ reader.nextVolumeOffer.title }}
        </button>
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
  min-width: 0;
  min-height: 0;
}

.reader__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.reader__page {
  transform-origin: center center;
  will-change: transform, filter;
  user-select: none;
  pointer-events: none;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.reader__stage[data-fit='fit-height'] .reader__page {
  height: 100%;
  width: auto;
  max-width: none;
  object-fit: unset;
}

.reader__stage[data-fit='fit-width'] .reader__page {
  width: 100%;
  height: auto;
  max-height: none;
  object-fit: unset;
}

.reader__stage[data-fit='zoom-100'] .reader__page,
.reader__stage[data-fit='custom'] .reader__page {
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  object-fit: unset;
}

.reader__strip {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.reader__strip-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  will-change: transform, filter;
  min-height: 100%;
}

.reader__strip-page {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}

.reader__placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
  min-width: 0;
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
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  background: color-mix(in srgb, var(--ink) 82%, transparent);
  color: var(--paper);
  border: 1px solid color-mix(in srgb, var(--brass) 45%, transparent);
  min-width: 0;
}

.reader__next p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
  overflow-wrap: anywhere;
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
