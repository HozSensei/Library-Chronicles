<script setup>
import logoUrl from '../assets/library-chronicles-logo.png';

defineProps({
  /** Compact chrome · header à cheval · hero profil/boot */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'straddle', 'hero'].includes(v),
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
  height: 1.35rem;
  max-width: 9.5rem;
}

.app-brand-logo--md {
  height: 1.85rem;
  max-width: 12.5rem;
}

.app-brand-logo--lg {
  height: clamp(2.4rem, 6vw, 3.1rem);
  max-width: min(100%, 18rem);
}

/* Wordmark sticker — déborde sous le bandeau bibliothèque */
.app-brand-logo--straddle {
  height: clamp(2.85rem, 5.8vw, 3.75rem);
  max-width: min(42vw, 15rem);
  object-position: left top;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.42));
}

.app-brand-logo--hero {
  height: clamp(4.2rem, 14vw, 6.4rem);
  max-width: min(92vw, 28rem);
  object-position: center center;
  margin-inline: auto;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35));
}
</style>
