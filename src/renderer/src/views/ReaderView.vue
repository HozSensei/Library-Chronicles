<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ReaderHud from '../components/ReaderHud.vue';
import { useReaderStore } from '../stores/reader';

const router = useRouter();
const reader = useReaderStore();

onMounted(async () => {
  try {
    const config = await window.vdr.getConfig();
    if (config.phase1TestCbz) {
      await reader.open(config.phase1TestCbz);
    }
  } catch (err) {
    console.warn('[VDR] CBZ test:', err.message);
  }
});

async function leave() {
  await reader.close();
  router.push({ name: 'library' });
}
</script>

<template>
  <section class="reader" aria-label="Lecteur">
    <div class="reader__stage">
      <img
        v-if="reader.pageUrl"
        class="reader__page"
        :src="reader.pageUrl"
        alt="Page courante"
        draggable="false"
        :style="{ transform: reader.transform }"
      />
      <div v-else class="reader__placeholder">
        <p class="reader__brand">Vertical Deck Reader</p>
        <p>Aucun livre chargé</p>
        <p class="dim">TODO[Phase 1] — ouvrir un CBZ de test</p>
        <button type="button" class="ghost" @click="leave">Retour</button>
      </div>
    </div>
    <ReaderHud />
  </section>
</template>

<style scoped>
.reader {
  position: relative;
  height: 100%;
  background: #000;
}

.reader__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.reader__page {
  height: 100%;
  width: auto;
  max-width: none;
  transform-origin: center center;
  will-change: transform;
}

.reader__placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
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

.ghost {
  margin-top: 1rem;
  appearance: none;
  border: 1px solid rgba(242, 235, 224, 0.2);
  background: transparent;
  color: var(--paper-dim);
  border-radius: 999px;
  padding: 0.5rem 1.1rem;
  cursor: pointer;
}
</style>
