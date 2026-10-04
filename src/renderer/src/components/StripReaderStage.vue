<script setup>
/**
 * Chemin strip continu — pages empilées + scroll vertical.
 * Isolé de PageReaderStage : pas de zoom/pan CSS, pas de D-Pad pages/zoom.
 */
import { nextTick, ref, watch } from 'vue';
import { useReaderStore } from '../stores/reader';

const reader = useReaderStore();
const stripEl = ref(null);

defineExpose({ stripEl });

/** Nav programmatique uniquement — ne pas combattre le scroll utilisateur. */
watch(
  () => reader.stripScrollToken,
  async () => {
    if (!reader.isStripMode) return;
    await nextTick();
    const el = stripEl.value?.querySelector(`[data-page="${reader.pageIndex}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
);

async function onStripScroll() {
  if (!stripEl.value || !reader.isStripMode) return;
  const el = stripEl.value;
  const nodes = [...el.querySelectorAll('[data-page]')];
  if (!nodes.length) return;
  const top = el.scrollTop + 40;
  let best = reader.pageIndex;
  for (const node of nodes) {
    if (node.offsetTop <= top) best = Number(node.dataset.page);
  }
  if (best === reader.pageIndex) return;
  const marker = el.querySelector(`[data-page="${best}"]`);
  const offsetBefore = marker?.offsetTop ?? 0;
  const scrollBefore = el.scrollTop;
  await reader.setPageFromStripScroll(best);
  await nextTick();
  const after = el.querySelector(`[data-page="${best}"]`);
  if (!after) return;
  const delta = after.offsetTop - offsetBefore;
  if (Math.abs(delta) > 0.5) el.scrollTop = scrollBefore + delta;
}
</script>

<template>
  <div
    ref="stripEl"
    class="reader__strip"
    data-reader-path="strip"
    @scroll.passive="onStripScroll"
  >
    <div class="reader__strip-inner" :style="{ filter: reader.filterCss }">
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
</template>

<style scoped>
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
  will-change: filter;
  min-height: 100%;
}

/*
 * Fit width implicite : pages bord à bord sur la largeur locale.
 * Pas de zoom CSS scale en strip (conflit scroll multi-pages + rotate) —
 * stick = scroll 4 directions ; D-Pad = no-op (voir reader-strip-controls).
 */
.reader__strip-page {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}
</style>
