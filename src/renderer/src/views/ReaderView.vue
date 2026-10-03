<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReaderHud from '../components/ReaderHud.vue';
import { useReaderStore } from '../stores/reader';

const router = useRouter();
const route = useRoute();
const reader = useReaderStore();

onMounted(async () => {
  const filePath = route.query.path;
  try {
    if (filePath) {
      await reader.open(String(filePath));
      return;
    }
    const config = await window.vdr.getConfig();
    if (config.phase1TestCbz) {
      await reader.open(config.phase1TestCbz);
    } else if (config.lastOpenedPath) {
      await reader.open(config.lastOpenedPath);
    }
  } catch (err) {
    console.warn('[VDR] open:', err.message);
  }
});

onUnmounted(() => {
  // Laisser la session ouverte seulement si on navigue ailleurs sans close ?
  // On ferme pour libérer la mémoire.
  reader.close();
});

watch(
  () => route.query.path,
  async (path) => {
    if (path) await reader.open(String(path));
  },
);

async function leave() {
  await reader.close();
  router.push({ name: 'library' });
}
</script>

<template>
  <section class="reader" aria-label="Lecteur">
    <div class="reader__stage" :data-fit="reader.fitMode">
      <img
        v-if="reader.pageUrl"
        class="reader__page"
        :src="reader.pageUrl"
        alt="Page courante"
        draggable="false"
        :style="reader.imageStyle"
      />
      <div v-else class="reader__placeholder">
        <p class="reader__brand">Vertical Deck Reader</p>
        <p v-if="reader.loading">Chargement…</p>
        <p v-else-if="reader.error">{{ reader.error }}</p>
        <template v-else>
          <p>Aucun livre chargé</p>
          <p class="dim">Ouvre un tome depuis la bibliothèque ou l’import.</p>
        </template>
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
  background: var(--reader-bg);
}

.reader__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.reader__page {
  transform-origin: center center;
  will-change: transform;
  user-select: none;
  pointer-events: none;
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
</style>
