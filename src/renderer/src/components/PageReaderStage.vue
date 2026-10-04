<script setup>
/**
 * Chemin page par page — stage zoom/pan.
 *
 * La vue ne fait que **mesurer** (stage local + taille naturelle de la page) ;
 * tout le modèle de transform vit dans `shared/page-view-transform.js`.
 * La page est rendue à sa taille naturelle, le calque `.reader__pan` porte
 * `translate(-50%,-50%) translate3d(offset) scale(fitScale × zoom)`.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useReaderStore } from '../stores/reader';
import { useI18n } from '../composables/useI18n';

const reader = useReaderStore();
const { t } = useI18n();

defineEmits(['leave']);

const stageEl = ref(null);
const pageEl = ref(null);

/** @type {ResizeObserver | null} */
let observer = null;

function measureStage() {
  const el = stageEl.value;
  if (!el) return;
  // clientWidth/Height = dimensions **locales** (le rotate(90deg) du plan
  // parent ne change pas le layout) → directement exploitables par computeFit.
  reader.setStageMetrics(el.clientWidth, el.clientHeight);
}

function measurePage() {
  const img = pageEl.value;
  if (!img?.naturalWidth || !img?.naturalHeight) return;
  reader.setPageMetrics(img.naturalWidth, img.naturalHeight);
}

onMounted(() => {
  measureStage();
  measurePage();
  if (typeof ResizeObserver === 'function' && stageEl.value) {
    observer = new ResizeObserver(measureStage);
    observer.observe(stageEl.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

// Image déjà décodée (cache ObjectURL) : `load` peut ne pas se redéclencher.
watch(
  () => reader.pageUrl,
  () => {
    requestAnimationFrame(measurePage);
  },
);
</script>

<template>
  <div
    ref="stageEl"
    class="reader__stage"
    :data-fit="reader.fitMode"
    :data-measured="reader.isPageMeasured ? '1' : '0'"
    data-reader-path="page"
  >
    <div
      v-if="reader.pageUrl"
      class="reader__pan"
      :class="{ 'is-zoom-smooth': reader.zoomTransition }"
      :style="reader.pageLayerStyle"
    >
      <img
        ref="pageEl"
        class="reader__page"
        :src="reader.pageUrl"
        alt="Page courante"
        draggable="false"
        :style="reader.pageFilterStyle"
        @load="measurePage"
      />
    </div>
    <div v-else class="reader__placeholder">
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

<!--
  Non-scopé (le stage vit dans le plan du parent `.reader__plane`).
  Préfixe [data-reader-path='page'] pour isoler du strip.
-->
<style>
.reader__stage[data-reader-path='page'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}

/*
 * Calque unique zoom + pan : ancré au centre du stage, transform-origin centre.
 * `translate(-50%,-50%)` place le centre de la page sur le centre du stage,
 * `translate3d(offset)` est en px stage (non mis à l’échelle, il précède scale).
 */
.reader__stage[data-reader-path='page'] .reader__pan {
  position: absolute;
  left: 50%;
  top: 50%;
  line-height: 0;
  transform-origin: center center;
  will-change: transform;
}

/* Transition uniquement sur les pas discrets (D-Pad / L3 / LB), pas le pan. */
.reader__stage[data-reader-path='page'] .reader__pan.is-zoom-smooth {
  transition: transform 180ms ease-out;
}

/*
 * Page à sa **taille naturelle** : aucune contrainte CSS de fit.
 * L’échelle vient intégralement de `scale(fitScale × zoom)` — un seul modèle.
 */
.reader__stage[data-reader-path='page'] .reader__page {
  display: block;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  user-select: none;
  pointer-events: none;
  will-change: filter;
}

/* Avant la première mesure : pas de flash à taille naturelle. */
.reader__stage[data-reader-path='page'][data-measured='0'] .reader__pan {
  visibility: hidden;
}

.reader__stage[data-reader-path='page'] .reader__placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
  min-width: 0;
  height: 100%;
}

.reader__stage[data-reader-path='page'] .reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-bright);
}

.reader__stage[data-reader-path='page'] .dim {
  color: var(--paper-dim);
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .reader__stage[data-reader-path='page'] .reader__pan.is-zoom-smooth {
    transition: none;
  }
}
</style>
