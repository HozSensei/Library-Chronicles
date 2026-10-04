<script setup>
/**
 * Chemin EPUB — pagination type liseuse (1 page = viewport).
 * Multi-colonnes CSS dans l’iframe + translateX ; police → reflow.
 * D-Pad / stick : page-écran ± puis chapitre ; ↑↓ police ; L3 reset.
 * Contenu isolé des filtres manga (brightness/sepia) — encre sur papier.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useReaderStore } from '../stores/reader';
import { useI18n } from '../composables/useI18n';
import {
  buildEpubThemeCss,
  clampScreenIndex,
  computeScreenCount,
  remapScreenIndex,
  screenOffsetX,
} from '../../../shared/epub-pagination.js';

const reader = useReaderStore();
const { t } = useI18n();

defineEmits(['leave']);

const stageEl = ref(null);
const frameEl = ref(null);
/** @type {ResizeObserver | null} */
let ro = null;
let measureTimer = 0;

function stageSize() {
  const el = stageEl.value;
  if (!el) return { w: 0, h: 0 };
  return {
    w: Math.max(1, el.clientWidth || 0),
    h: Math.max(1, el.clientHeight || 0),
  };
}

function frameDoc() {
  try {
    return frameEl.value?.contentDocument || null;
  } catch {
    return null;
  }
}

function injectTheme(doc, pageW, pageH) {
  if (!doc?.head) return;
  let style = doc.getElementById('vdr-epub-theme');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'vdr-epub-theme';
    doc.head.appendChild(style);
  }
  style.textContent = buildEpubThemeCss({
    fontPct: reader.fontSize || 100,
    pageWidth: pageW,
    pageHeight: pageH,
    columnGap: 0,
  });
}

function applyScreenTransform(doc, index, pageW) {
  const body = doc?.body;
  if (!body) return;
  const x = -screenOffsetX(index, pageW);
  body.style.transform = `translateX(${x}px)`;
}

/**
 * Mesure les colonnes, met à jour le store, applique le translate.
 * @param {{ preserveRatio?: boolean }} [opts]
 */
function syncPagination(opts = {}) {
  const frame = frameEl.value;
  const doc = frameDoc();
  const { w, h } = stageSize();
  if (!frame || !doc?.documentElement || !w || !h) return;

  frame.style.width = `${w}px`;
  frame.style.height = `${h}px`;
  injectTheme(doc, w, h);

  // Forcer layout après CSS colonnes.
  const scrollW = Math.max(
    doc.documentElement.scrollWidth || 0,
    doc.body?.scrollWidth || 0,
    w,
  );
  const count = computeScreenCount(scrollW, w);
  const prevCount = reader.epubScreenCount || 1;
  const prevIndex = reader.epubScreenIndex || 0;

  let nextIndex;
  if (reader.epubLandOn === 'end') {
    nextIndex = count - 1;
  } else if (reader.epubLandOn === 'start') {
    nextIndex = 0;
  } else if (opts.preserveRatio && prevCount !== count) {
    nextIndex = remapScreenIndex(prevIndex, prevCount, count);
  } else {
    nextIndex = clampScreenIndex(prevIndex, count);
  }

  reader.setEpubScreens(count, nextIndex);
  applyScreenTransform(doc, reader.epubScreenIndex, w);
}

function scheduleMeasure(preserveRatio = false) {
  if (measureTimer) clearTimeout(measureTimer);
  measureTimer = window.setTimeout(() => {
    measureTimer = 0;
    try {
      syncPagination({ preserveRatio });
    } catch {
      // blob: same-origin
    }
  }, 16);
}

function onFrameLoad() {
  scheduleMeasure(false);
}

watch(
  () => reader.pageUrl,
  async () => {
    await nextTick();
    scheduleMeasure(false);
  },
);

watch(
  () => reader.fontSize,
  async () => {
    await nextTick();
    scheduleMeasure(true);
  },
);

watch(
  () => reader.epubScreenIndex,
  () => {
    const doc = frameDoc();
    const { w } = stageSize();
    if (!doc || !w) return;
    try {
      applyScreenTransform(doc, reader.epubScreenIndex, w);
    } catch {
      // ignore
    }
  },
);

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => scheduleMeasure(true));
    ro.observe(stageEl.value);
  }
  scheduleMeasure(false);
});

onBeforeUnmount(() => {
  if (measureTimer) clearTimeout(measureTimer);
  ro?.disconnect();
  ro = null;
});
</script>

<template>
  <div
    ref="stageEl"
    class="reader__epub"
    data-reader-path="epub"
    data-epub-paginated="1"
  >
    <iframe
      v-if="reader.pageUrl"
      ref="frameEl"
      class="reader__epub-frame"
      title="Chapitre EPUB"
      sandbox="allow-same-origin"
      :src="reader.pageUrl"
      @load="onFrameLoad"
    />
    <div v-else class="reader__epub-placeholder">
      <p class="reader__brand">Library Chronicles</p>
      <p v-if="reader.loading">{{ t('reader.loading') }}</p>
      <p v-else-if="reader.error">{{ reader.error }}</p>
      <template v-else>
        <p>{{ t('reader.empty') }}</p>
        <p class="dim">{{ t('reader.emptyLead') }}</p>
      </template>
      <button type="button" class="ghost" @click="$emit('leave')">
        {{ t('reader.back') }}
      </button>
    </div>
  </div>
</template>

<style>
.reader__epub[data-reader-path='epub'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background: #f4efe6;
  color: #1a1a1a;
  /* Pas de filter CSS manga (brightness/sepia) — isole le HTML EPUB. */
  filter: none !important;
  touch-action: none;
}

.reader__epub[data-reader-path='epub'] .reader__epub-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #f4efe6;
  pointer-events: none;
}

.reader__epub[data-reader-path='epub'] .reader__epub-placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: #1a1a1a;
  padding: 2rem;
  min-width: 0;
  height: 100%;
}

.reader__epub[data-reader-path='epub'] .reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-deep, #9a7b3a);
}

.reader__epub[data-reader-path='epub'] .dim {
  color: #4a453f;
  margin: 0;
}
</style>
