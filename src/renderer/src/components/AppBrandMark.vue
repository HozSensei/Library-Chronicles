<script setup>
import { computed } from 'vue';
import glyphUrl from '../assets/library-chronicles-mark-glyph.png';
import { normalizeAvatarColor } from '../../../shared/avatar-colors.js';

const props = defineProps({
  /** Couleur du glyphe « C » (profil). */
  color: {
    type: String,
    default: '#c4a35a',
  },
  /** sm · md · lg · hero · fill (remplit le parent) */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'hero', 'fill'].includes(v),
  },
  /** Fond squircle (défaut noir) ou cercle avatar. */
  shape: {
    type: String,
    default: 'squircle',
    validator: (v) => ['squircle', 'circle'].includes(v),
  },
  plate: {
    type: String,
    default: '#0a0a0a',
  },
});

const fill = computed(() => normalizeAvatarColor(props.color));
</script>

<template>
  <span
    class="app-brand-mark"
    :class="[`app-brand-mark--${size}`, `app-brand-mark--${shape}`]"
    :style="{
      '--mark-fill': fill,
      '--mark-plate': plate,
      '--mark-glyph': `url(${glyphUrl})`,
    }"
    role="img"
    aria-label="Library Chronicles"
    title="Library Chronicles"
  >
    <span class="app-brand-mark__glyph" aria-hidden="true" />
  </span>
</template>

<style scoped>
.app-brand-mark {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  aspect-ratio: 1;
  background: var(--mark-plate, #0a0a0a);
  overflow: hidden;
  user-select: none;
  -webkit-user-drag: none;
  box-sizing: border-box;
}

.app-brand-mark--squircle {
  border-radius: 22%;
}

.app-brand-mark--circle {
  border-radius: 50%;
}

.app-brand-mark__glyph {
  position: absolute;
  inset: 0;
  background-color: var(--mark-fill, #c4a35a);
  -webkit-mask-image: var(--mark-glyph);
  mask-image: var(--mark-glyph);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.app-brand-mark--sm {
  width: 1.35rem;
  height: 1.35rem;
}

.app-brand-mark--md {
  width: 2rem;
  height: 2rem;
}

.app-brand-mark--lg {
  width: clamp(2.75rem, 8vw, 3.5rem);
  height: clamp(2.75rem, 8vw, 3.5rem);
}

.app-brand-mark--hero {
  width: clamp(4.5rem, 16vw, 6.5rem);
  height: clamp(4.5rem, 16vw, 6.5rem);
}

.app-brand-mark--fill {
  width: 100%;
  height: 100%;
}
</style>
