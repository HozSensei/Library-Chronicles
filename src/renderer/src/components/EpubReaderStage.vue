<script setup>
/**
 * Chemin EPUB — pagination type liseuse (1 page = viewport local).
 *
 * Multi-colonnes CSS dans l’iframe + translateX ; police → reflow.
 * Dimensions via clientWidth/Height du stage (repère local pré-rotate(90deg)).
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
  resolveEpubPageGeometry,
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
/** Ignore les mesures obsolètes (chapitre / police / resize en vol). */
let measureGen = 0;

/**
 * Stage local (avant rotate(90deg) du plan). Ne jamais prendre
 * l’AABB post-rotation (axes échangés) — clientWidth/Height uniquement.
 */
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

/** Document iframe prêt (body avec contenu après load blob). */
function docReady(doc) {
  if (!doc?.documentElement || !doc.body) return false;
  // Blob fraîchement navigué peut exposer body vide un instant.
  if (!doc.body.childNodes || doc.body.childNodes.length === 0) return false;
  return true;
}

function injectTheme(doc, geo) {
  if (!doc?.head) return;
  let style = doc.getElementById('vdr-epub-theme');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'vdr-epub-theme';
    doc.head.appendChild(style);
  }
  style.textContent = buildEpubThemeCss({
    fontPct: reader.fontSize || 100,
    pageWidth: geo.pageWidth,
    pageHeight: geo.pageHeight,
    padX: geo.padX,
    padY: geo.padY,
  });
}

function applyScreenTransform(doc, index, stride) {
  const body = doc?.body;
  if (!body) return;
  const x = -screenOffsetX(index, stride);
  body.style.transform = `translateX(${x}px)`;
}

/**
 * Mesure les colonnes, met à jour le store, applique le translate.
 * @param {{ preserveRatio?: boolean }} [opts]
 * @returns {boolean} true si mesure appliquée
 */
function syncPagination(opts = {}) {
  const frame = frameEl.value;
  const doc = frameDoc();
  const { w, h } = stageSize();
  if (!frame || !w || !h) return false;
  if (!docReady(doc)) return false;

  const geo = resolveEpubPageGeometry({ pageWidth: w, pageHeight: h });
  frame.style.width = `${geo.pageWidth}px`;
  frame.style.height = `${geo.pageHeight}px`;
  injectTheme(doc, geo);

  // Forcer layout après CSS colonnes (lecture scrollWidth).
  void doc.body.offsetWidth;
  const scrollW = Math.max(
    doc.documentElement.scrollWidth || 0,
    doc.body?.scrollWidth || 0,
    geo.stride,
  );
  const count = computeScreenCount(scrollW, geo.stride);
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

  nextIndex = clampScreenIndex(nextIndex, count);
  reader.setEpubScreens(count, nextIndex);
  applyScreenTransform(doc, reader.epubScreenIndex, geo.stride);
  return true;
}

/**
 * Mesure après paint (double rAF) pour éviter race font-size / layout.
 * @param {boolean} [preserveRatio]
 * @param {number} [attempt]
 */
function scheduleMeasure(preserveRatio = false, attempt = 0) {
  if (measureTimer) clearTimeout(measureTimer);
  const gen = ++measureGen;
  measureTimer = window.setTimeout(() => {
    measureTimer = 0;
    const run = () => {
      if (gen !== measureGen) return;
      requestAnimationFrame(() => {
        if (gen !== measureGen) return;
        requestAnimationFrame(() => {
          if (gen !== measureGen) return;
          try {
            const ok = syncPagination({ preserveRatio });
            // Blob pas encore peint / fonts : réessayer brièvement.
            if (!ok && attempt < 8) {
              measureTimer = window.setTimeout(() => {
                measureTimer = 0;
                scheduleMeasure(preserveRatio, attempt + 1);
              }, 32);
            }
          } catch {
            // blob: same-origin / doc détaché
          }
        });
      });
    };
    // fonts.ready si dispo (évite reflow mid-mesure → count faux → blancs).
    const doc = frameDoc();
    const fonts = doc?.fonts;
    if (fonts?.ready && typeof fonts.ready.then === 'function') {
      fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  }, 16);
}

function onFrameLoad() {
  scheduleMeasure(false);
}

// Ne pas mesurer sur pageUrl seul : landOn serait consommé avant load
// (count=1) → index faux / pages blanches. @load suffit.
watch(
  () => reader.pageUrl,
  async () => {
    await nextTick();
    // Annule une mesure en vol sur l’ancien chapitre.
    measureGen += 1;
    if (measureTimer) {
      clearTimeout(measureTimer);
      measureTimer = 0;
    }
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
    if (!docReady(doc) || !w) return;
    const geo = resolveEpubPageGeometry({ pageWidth: w, pageHeight: 1 });
    try {
      applyScreenTransform(doc, reader.epubScreenIndex, geo.stride);
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
  // Si l’iframe est déjà chargée (blob en cache), forcer une mesure.
  scheduleMeasure(false);
});

onBeforeUnmount(() => {
  measureGen += 1;
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
  /* Évite barre de défilement fantôme qui rogne clientWidth. */
  overflow: hidden;
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
