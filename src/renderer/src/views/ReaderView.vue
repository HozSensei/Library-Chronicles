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

const stripStyle = computed(() => ({
  filter: reader.filterCss,
  transform: `translate3d(${reader.panX}px, ${reader.panY}px, 0)`,
}));

onMounted(async () => {
  await ui.enterReaderMode();
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

onUnmounted(async () => {
  reader.close();
  await ui.exitReaderMode();
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
  await ui.exitReaderMode();
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
  <section class="reader" aria-label="Lecteur" :data-webtoon="reader.webtoonMode">
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

    <div v-if="reader.nextVolumeOffer && reader.isFinished" class="reader__next">
      <p>Tome terminé</p>
      <button type="button" class="ghost" @click="openNext">
        RB · {{ reader.nextVolumeOffer.title }}
      </button>
    </div>

    <ReaderHud />
  </section>
</template>

<style scoped>
.reader {
  position: relative;
  height: 100%;
  background: var(--reader-bg);
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
}

.reader__next p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
