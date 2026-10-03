<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useLibraryStore } from '../stores/library';

const router = useRouter();
const library = useLibraryStore();

onMounted(() => {
  library.refresh();
});

const hints = [
  { key: 'B', label: 'retour' },
  { key: 'A', label: 'ouvrir' },
];
</script>

<template>
  <section class="library">
    <header class="library__header">
      <p class="library__brand">Vertical Deck Reader</p>
      <h1>Bibliothèque</h1>
      <p class="library__lead">
        Grille console-first — couvertures, reprise et focus manette arrivent en Phase 3.
      </p>
    </header>

    <div class="library__body">
      <div v-if="library.loading" class="library__empty">Chargement…</div>
      <div v-else-if="!library.books.length" class="library__empty">
        <p>Aucun tome indexé.</p>
        <p class="dim">Choisis un dossier racine une fois le scan Phase 3 branché.</p>
      </div>
      <div v-else class="library__grid">
        <!-- TODO[Phase 3]: tuiles couverture focusables -->
      </div>
    </div>

    <footer class="library__footer">
      <button type="button" class="ghost" @click="router.push({ name: 'boot' })">Retour</button>
      <ControlHint :items="hints" />
    </footer>
  </section>
</template>

<style scoped>
.library {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  background:
    radial-gradient(ellipse 80% 40% at 20% 0%, rgba(212, 163, 92, 0.12), transparent 50%),
    var(--ink-950);
}

.library__brand {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--brass);
  letter-spacing: 0.04em;
}

.library__header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: -0.02em;
}

.library__lead {
  margin: 0.55rem 0 0;
  color: var(--paper-dim);
  max-width: 22rem;
  line-height: 1.4;
}

.library__body {
  flex: 1;
  margin-top: 2rem;
  min-height: 0;
}

.library__empty {
  height: 100%;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.35rem;
  color: var(--paper);
  border: 1px dashed rgba(242, 235, 224, 0.14);
  border-radius: var(--radius-md);
  background: rgba(18, 20, 26, 0.55);
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}

.library__footer {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}

.ghost {
  appearance: none;
  border: 1px solid rgba(242, 235, 224, 0.16);
  background: transparent;
  color: var(--paper-dim);
  border-radius: 999px;
  padding: 0.45rem 1rem;
  cursor: pointer;
}
</style>
