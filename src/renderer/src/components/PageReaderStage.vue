<script setup>
/**
 * Chemin page par page — stage zoom/pan (comportement pré-#57 strip-cta).
 * Isolé de StripReaderStage : pas de scroll multi-pages, pas de data-strip.
 */
import { useReaderStore } from '../stores/reader';
import { useI18n } from '../composables/useI18n';

const reader = useReaderStore();
const { t } = useI18n();

defineEmits(['leave']);
</script>

<template>
  <div class="reader__stage" :data-fit="reader.fitMode" data-reader-path="page">
    <div
      v-if="reader.pageUrl"
      class="reader__pan"
      :style="{ transform: `translate3d(${reader.panX}px, ${reader.panY}px, 0)` }"
    >
      <img
        class="reader__page"
        :class="{ 'is-zoom-smooth': reader.zoomTransition }"
        :src="reader.pageUrl"
        alt="Page courante"
        draggable="false"
        :style="reader.imageStyle"
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

<style scoped>
.reader__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
  display: grid;
  /* unsafe : garder le vrai centre même si la page overflow (fit-width/height). */
  place-items: unsafe center;
}

/* Pan en translate local — indépendant du scale (origin centre image). */
.reader__pan {
  line-height: 0;
  will-change: transform;
  max-width: none;
  max-height: none;
}

.reader__page {
  /* Zoom D-Pad : scale ancré au centre image (= centre écran si pan=0). */
  display: block;
  transform-origin: center center;
  will-change: transform, filter;
  user-select: none;
  pointer-events: none;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* L3 reset / LB fit : transition width/height (le scale D-Pad est lerp rAF). */
.reader__page.is-zoom-smooth {
  transition:
    width 200ms ease-out,
    height 200ms ease-out,
    max-width 200ms ease-out,
    max-height 200ms ease-out;
}

/*
 * Fit modes dans le plan local (avant / sous rotate(+90°) CSS).
 * Fit Width  → width: 100%  (bord à bord gauche-droite).
 * Fit Height → height: 100%.
 */
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

/*
 * custom / zoom-100 : même gabarit que fit-height (base 1×).
 * Le zoom manuel ne doit PAS basculer en taille naturelle (saut vertical).
 */
.reader__stage[data-fit='zoom-100'] .reader__page,
.reader__stage[data-fit='custom'] .reader__page {
  height: 100%;
  width: auto;
  max-width: none;
  max-height: none;
  object-fit: unset;
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

.dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
