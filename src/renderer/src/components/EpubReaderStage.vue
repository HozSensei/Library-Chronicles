<script setup>
/**
 * Chemin EPUB — pagination viewport via **epub.js** (pas de colonnes CSS maison).
 *
 * - Charge l’archive `.epub` (ArrayBuffer IPC) une fois.
 * - `rendition.next()` / `prev()` pour les pages-écran ; spine pour les chapitres.
 * - Dimensions = `clientWidth` / `clientHeight` du stage (repère local pré-rotate(+90°)).
 * - Thème encre/papier + sauts de page avant titres chapitre (themes.default).
 * - Police → themes.fontSize (reflow géré par epub.js).
 * - LT/RT (store.stepChapter) = spine ±1 ; pages via rendition next/prev.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ePubMod from 'epubjs';
import { useReaderStore } from '../stores/reader';
import { useI18n } from '../composables/useI18n';
import {
  EPUB_ENGINE,
  EPUB_INK,
  EPUB_PAPER_BG,
  buildEpubJsThemeRules,
} from '../../../shared/epub-pagination.js';
import {
  base64ToArrayBuffer,
  resolveEpubFactory,
} from '../../../shared/epubjs-loader.js';

const reader = useReaderStore();
const { t } = useI18n();

defineEmits(['leave']);

const stageEl = ref(null);
const bootError = ref(null);
const engineReady = ref(false);

/** @type {import('epubjs').Book | null} */
let book = null;
/** @type {import('epubjs').Rendition | null} */
let rendition = null;
/** @type {ResizeObserver | null} */
let ro = null;
/** Ignore display() déclenché par notre propre sync spine. */
let syncingFromRendition = false;
/** Génération pour annuler un boot concurrent. */
let bootGen = 0;
/** Resize debounce. */
let resizeTimer = 0;

const ePub = resolveEpubFactory(ePubMod);

const showPlaceholder = computed(
  () =>
    Boolean(bootError.value) ||
    Boolean(reader.error) ||
    !reader.filePath ||
    (reader.loading && !engineReady.value),
);

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

function applyTheme() {
  if (!rendition) return;
  // Inclut break-before:page sur titres/blocs chapitre (buildEpubJsThemeRules).
  const rules = buildEpubJsThemeRules({ fontPct: reader.fontSize || 100 });
  rendition.themes.default(rules);
  rendition.themes.fontSize(`${reader.fontSize || 100}%`);
  rendition.themes.override('color', EPUB_INK, true);
  rendition.themes.override('background-color', EPUB_PAPER_BG, true);
}

function destroyEngine() {
  reader.registerEpubNavigator(null);
  try {
    rendition?.destroy();
  } catch {
    // ignore
  }
  try {
    book?.destroy();
  } catch {
    // ignore
  }
  rendition = null;
  book = null;
  engineReady.value = false;
}

/**
 * Atterrir en fin de section courante (page-prev chapitre).
 */
async function goToSectionEnd() {
  if (!rendition) return;
  let guard = 0;
  while (guard < 400) {
    guard += 1;
    const loc =
      typeof rendition.currentLocation === 'function'
        ? rendition.currentLocation()
        : rendition.location;
    const start = loc?.start || loc;
    if (!start?.displayed) break;
    const page = start.displayed.page || 1;
    const total = Math.max(1, start.displayed.total || 1);
    if (page >= total) break;
    const spineIdx = start.index;
    // eslint-disable-next-line no-await-in-loop
    await rendition.next();
    const after =
      typeof rendition.currentLocation === 'function'
        ? rendition.currentLocation()
        : rendition.location;
    const afterStart = after?.start || after;
    if (afterStart?.index != null && afterStart.index !== spineIdx) {
      // eslint-disable-next-line no-await-in-loop
      await rendition.prev();
      break;
    }
  }
}

function onRelocated(location) {
  if (!location?.start) return;
  syncingFromRendition = true;
  try {
    const page = location.start.displayed?.page || 1;
    const total = Math.max(1, location.start.displayed?.total || 1);
    reader.setEpubScreens(total, page - 1);
    const spineIdx = location.start.index;
    if (typeof spineIdx === 'number' && spineIdx !== reader.pageIndex) {
      reader.syncEpubSpineIndex(spineIdx);
    }
  } finally {
    // microtask : laisse les watchers pageIndex ignorer ce cycle
    queueMicrotask(() => {
      syncingFromRendition = false;
    });
  }
}

/**
 * @param {'prev'|'next'} which
 * @returns {Promise<boolean>}
 */
async function navigatePage(which) {
  if (!rendition) return false;
  try {
    const loc = rendition.location;
    if (which === 'next') {
      if (loc?.atEnd) return false;
      await rendition.next();
      return true;
    }
    if (loc?.atStart) return false;
    await rendition.prev();
    return true;
  } catch {
    return false;
  }
}

function scheduleResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeTimer = 0;
    if (!rendition) return;
    const { w, h } = stageSize();
    if (w > 1 && h > 1) {
      try {
        rendition.resize(w, h);
      } catch {
        // ignore
      }
    }
  }, 40);
}

async function bootEngine() {
  const gen = ++bootGen;
  bootError.value = null;
  destroyEngine();

  if (!reader.isEpubMode || !reader.filePath || !stageEl.value) return;
  if (typeof window.vdr?.reader?.getBytes !== 'function') {
    bootError.value = 'IPC getBytes indisponible';
    return;
  }

  try {
    const payload = await window.vdr.reader.getBytes();
    if (gen !== bootGen) return;
    if (!payload?.data) throw new Error('Archive EPUB vide');

    const ab = base64ToArrayBuffer(payload.data);
    book = ePub(ab);

    await book.ready;
    if (gen !== bootGen) return;

    const { w, h } = stageSize();
    // Vider le conteneur avant renderTo (epub.js y injecte ses iframes).
    stageEl.value.replaceChildren();

    rendition = book.renderTo(stageEl.value, {
      width: w,
      height: h,
      flow: 'paginated',
      spread: 'none',
      allowScriptedContent: false,
      // On mesure clientWidth/Height nous-mêmes (rotation Ally +90°).
      resizeOnOrientationChange: false,
    });

    applyTheme();
    if (reader.direction === 'rtl') {
      try {
        rendition.direction('rtl');
      } catch {
        // ignore
      }
    }

    rendition.on('relocated', onRelocated);
    reader.registerEpubNavigator(navigatePage);

    const target = Math.max(0, Math.min(reader.pageIndex || 0, (reader.pageCount || 1) - 1));
    await rendition.display(target);
    if (gen !== bootGen) return;

    if (reader.epubLandOn === 'end') {
      await goToSectionEnd();
      reader.clearEpubLandOn();
    }

    engineReady.value = true;
  } catch (err) {
    if (gen !== bootGen) return;
    bootError.value = err?.message || String(err);
    engineReady.value = false;
    destroyEngine();
  }
}

watch(
  () => reader.filePath,
  async () => {
    await nextTick();
    await bootEngine();
  },
);

watch(
  () => reader.pageIndex,
  async (idx) => {
    if (syncingFromRendition || !rendition || !engineReady.value) return;
    try {
      await rendition.display(Math.max(0, Number(idx) || 0));
      if (reader.epubLandOn === 'end') {
        await goToSectionEnd();
        reader.clearEpubLandOn();
      } else if (reader.epubLandOn === 'start') {
        reader.clearEpubLandOn();
      }
    } catch {
      // ignore
    }
  },
);

watch(
  () => reader.fontSize,
  () => {
    if (!rendition) return;
    applyTheme();
  },
);

watch(
  () => reader.direction,
  (dir) => {
    if (!rendition) return;
    try {
      rendition.direction(dir === 'rtl' ? 'rtl' : 'ltr');
    } catch {
      // ignore
    }
  },
);

onMounted(async () => {
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => scheduleResize());
    ro.observe(stageEl.value);
  }
  await bootEngine();
});

onBeforeUnmount(() => {
  bootGen += 1;
  if (resizeTimer) clearTimeout(resizeTimer);
  ro?.disconnect();
  ro = null;
  destroyEngine();
});
</script>

<template>
  <div
    class="reader__epub-wrap"
    data-reader-path="epub"
    :data-epub-engine="EPUB_ENGINE"
    data-epub-paginated="1"
  >
    <div
      ref="stageEl"
      class="reader__epub"
      data-epub-stage="1"
    />
    <div
      v-if="showPlaceholder"
      class="reader__epub-placeholder"
    >
      <p class="reader__brand">Library Chronicles</p>
      <p v-if="bootError">{{ bootError }}</p>
      <p v-else-if="reader.loading">{{ t('reader.loading') }}</p>
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
.reader__epub-wrap[data-reader-path='epub'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background: #f4efe6;
  color: #1a1a1a;
  filter: none !important;
  touch-action: none;
}

.reader__epub-wrap[data-reader-path='epub'] .reader__epub {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f4efe6;
}

/* epub.js injecte iframe(s) — plein cadre, sans scroll fantôme. */
.reader__epub-wrap[data-reader-path='epub'] .reader__epub iframe {
  border: 0 !important;
  background: #f4efe6;
  pointer-events: none;
}

.reader__epub-wrap[data-reader-path='epub'] .reader__epub-placeholder {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: #1a1a1a;
  padding: 2rem;
  min-width: 0;
  background: #f4efe6;
}

.reader__epub-wrap[data-reader-path='epub'] .reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-deep, #9a7b3a);
}

.reader__epub-wrap[data-reader-path='epub'] .dim {
  color: #4a453f;
  margin: 0;
}
</style>
