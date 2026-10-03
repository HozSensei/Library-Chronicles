<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useLibraryStore } from '../stores/library';

const props = defineProps({
  bookId: { type: [Number, String], required: true },
  alt: { type: String, default: '' },
  format: { type: String, default: '' },
  eager: { type: Boolean, default: false },
});

const library = useLibraryStore();
const rootEl = ref(null);
const visible = ref(props.eager);
let observer = null;

const src = computed(() => library.covers[props.bookId] || null);
const pending = computed(() => Boolean(library.coverPending[props.bookId]));
const showSkeleton = computed(() => !src.value && (pending.value || visible.value));

async function load() {
  if (!visible.value && !props.eager) return;
  await library.ensureCover(props.bookId);
}

onMounted(() => {
  if (props.eager) {
    visible.value = true;
    load();
    return;
  }
  if (typeof IntersectionObserver === 'undefined') {
    visible.value = true;
    load();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.value = true;
          load();
          observer?.disconnect();
          observer = null;
          break;
        }
      }
    },
    { root: null, rootMargin: '120px 0px', threshold: 0.01 },
  );
  if (rootEl.value) observer.observe(rootEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

watch(
  () => props.bookId,
  () => {
    if (visible.value || props.eager) load();
  },
);
</script>

<template>
  <div ref="rootEl" class="lazy-cover">
    <img v-if="src" class="lazy-cover__img" :src="src" :alt="alt" loading="lazy" />
    <div v-else-if="showSkeleton" class="lazy-cover__skeleton" aria-hidden="true" />
    <div v-else class="lazy-cover__placeholder">{{ format || '?' }}</div>
  </div>
</template>

<style scoped>
.lazy-cover {
  position: absolute;
  inset: 0;
  background: var(--ink-800);
}

.lazy-cover__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: cover-in 280ms var(--ease-out);
}

.lazy-cover__placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--paper-dim);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.lazy-cover__skeleton {
  height: 100%;
  background: linear-gradient(
    110deg,
    var(--ink-800) 0%,
    var(--ink-700) 42%,
    var(--ink-800) 78%
  );
  background-size: 200% 100%;
  animation: shimmer 1.1s var(--ease-soft) infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes cover-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lazy-cover__img,
  .lazy-cover__skeleton {
    animation: none;
  }
}
</style>
