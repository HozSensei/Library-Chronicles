<script setup>
import logoUrl from '../assets/library-chronicles-logo.png';

defineProps({
  /** Compact header / chrome vs. hero boot mark */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'hero'].includes(v),
  },
});
</script>

<template>
  <img
    :src="logoUrl"
    alt="Library Chronicles"
    title="Library Chronicles"
    class="app-brand-logo"
    :class="`app-brand-logo--${size}`"
    draggable="false"
  />
</template>

<style scoped>
.app-brand-logo {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: left center;
  user-select: none;
  -webkit-user-drag: none;
}

.app-brand-logo--sm {
  height: 1.45rem;
  max-width: 10rem;
}

.app-brand-logo--md {
  height: 1.85rem;
  max-width: 12.5rem;
}

.app-brand-logo--lg {
  height: clamp(2.4rem, 6vw, 3.1rem);
  max-width: min(100%, 18rem);
}

.app-brand-logo--hero {
  height: clamp(3.4rem, 11vw, 4.8rem);
  max-width: min(100%, 22rem);
}
</style>
