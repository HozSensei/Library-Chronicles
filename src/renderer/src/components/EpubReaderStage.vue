<script setup>
/**
 * Chemin EPUB — texte reflow (spine = chapitres).
 * Stick scroll sur le stage ; D-Pad ←→ chapitre ; ↑↓ taille police ; L3 reset.
 * Pas de zoom/pan image ni strip vertical « pages images ».
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useReaderStore } from '../stores/reader';
import { useI18n } from '../composables/useI18n';

const reader = useReaderStore();
const { t } = useI18n();

defineEmits(['leave']);

const stageEl = ref(null);
const frameEl = ref(null);

function themeCss() {
  const pct = reader.fontSize || 100;
  return `
html, body {
  background: transparent !important;
  color: var(--paper, #f3ead7) !important;
  font-size: ${pct}% !important;
}
body {
  font-family: Georgia, 'Times New Roman', serif;
  margin: 0;
  padding: 1.1rem 1.25rem 2.5rem;
  line-height: 1.55;
  max-width: 42rem;
  margin-inline: auto;
  overflow-wrap: anywhere;
}
a { color: var(--paper-dim, #c4b8a4); }
img, svg { max-width: 100%; height: auto; }
`;
}

function injectTheme(doc) {
  if (!doc?.head) return;
  let style = doc.getElementById('vdr-epub-theme');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'vdr-epub-theme';
    doc.head.appendChild(style);
  }
  style.textContent = themeCss();
}

function syncFrameHeight() {
  const frame = frameEl.value;
  const doc = frame?.contentDocument;
  if (!frame || !doc?.documentElement) return;
  injectTheme(doc);
  const h = Math.max(
    doc.documentElement.scrollHeight || 0,
    doc.body?.scrollHeight || 0,
    stageEl.value?.clientHeight || 0,
  );
  frame.style.height = `${h}px`;
}

function onFrameLoad() {
  try {
    syncFrameHeight();
    if (stageEl.value) stageEl.value.scrollTop = 0;
  } catch {
    // blob: same-origin
  }
}

watch(
  () => [reader.pageUrl, reader.fontSize],
  async () => {
    await nextTick();
    try {
      syncFrameHeight();
    } catch {
      // ignore
    }
  },
);

onBeforeUnmount(() => {
  // ObjectURL révoqué par le store
});
</script>

<template>
  <div
    ref="stageEl"
    class="reader__epub"
    data-reader-path="epub"
    :style="{ filter: reader.filterCss }"
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
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--reader-bg);
  color: var(--paper);
  touch-action: pan-y pan-x;
}

.reader__epub[data-reader-path='epub'] .reader__epub-frame {
  display: block;
  width: 100%;
  min-height: 100%;
  border: 0;
  background: transparent;
  pointer-events: none;
}

.reader__epub[data-reader-path='epub'] .reader__epub-placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
  min-width: 0;
  height: 100%;
}

.reader__epub[data-reader-path='epub'] .reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-bright);
}

.reader__epub[data-reader-path='epub'] .dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
