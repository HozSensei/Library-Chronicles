<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import { useImportStore } from '../stores/import';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const imp = useImportStore();
const ui = useUiStore();

const hints = [
  { key: '↑↓', label: 'tome' },
  { key: 'A', label: 'importer' },
  { key: 'Y', label: 'enrichir' },
  { key: 'B', label: 'retour' },
];

const statusLabel = computed(() => {
  if (imp.loading) return 'Scan…';
  if (!imp.items.length) return 'Aucun fichier dans le dossier import';
  return `${imp.items.length} fichier(s)`;
});

onMounted(async () => {
  await imp.scan();
  ui.setImportFocus(0);
});

watch(
  () => imp.cursor,
  () => {
    // draft rechargé via store
  },
);

async function doImport() {
  if (!imp.selected) return;
  await imp.commitSelected({ copyToLibrary: true });
}

async function doEnrich() {
  await imp.enrich();
}
</script>

<template>
  <section class="import">
    <header class="import__header">
      <p class="brand">Vertical Deck Reader</p>
      <h1>Import</h1>
      <p class="lead">{{ statusLabel }}</p>
      <p v-if="imp.root" class="path">{{ imp.root }}</p>
    </header>

    <div class="import__layout">
      <aside class="list">
        <button
          v-for="(item, index) in imp.items"
          :key="item.filePath"
          type="button"
          class="list__item"
          :class="{ 'is-focused': index === imp.cursor }"
          @click="imp.cursor = index; imp.loadDraftFromSelected()"
        >
          <span class="list__title">{{ item.detected?.title || item.name }}</span>
          <span class="list__meta">
            {{ item.format?.toUpperCase() }}
            <template v-if="item.alreadyInLibrary"> · déjà en biblio</template>
          </span>
        </button>
        <div v-if="!imp.items.length && !imp.loading" class="empty">
          <p class="empty__title">Dossier import vide</p>
          <p class="empty__hint">
            Dépose des CBZ, CBR ou PDF dans le dossier import, puis appuie sur Rescanner.
          </p>
        </div>
      </aside>

      <div v-if="!imp.selected && !imp.loading" class="detail detail--idle">
        <p class="empty__title">Sélectionne un tome</p>
        <p class="empty__hint">Navigue avec ↑↓, puis A pour importer ou Y pour enrichir.</p>
      </div>

      <div v-else-if="imp.selected" class="detail">
        <div class="cover-wrap">
          <img v-if="imp.coverPreview" :src="imp.coverPreview" alt="" class="cover" />
          <div v-else class="cover cover--empty">Aperçu</div>
        </div>

        <div class="fields">
          <div class="field">
            <label>Titre</label>
            <input v-model="imp.draft.title" type="text" />
          </div>
          <div class="field">
            <label>Série</label>
            <input v-model="imp.draft.series" type="text" />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Tome</label>
              <input v-model.number="imp.draft.volume" type="number" min="0" />
            </div>
            <div class="field">
              <label>Année</label>
              <input v-model.number="imp.draft.year" type="number" min="1900" />
            </div>
          </div>
          <div class="field">
            <label>Auteur</label>
            <input v-model="imp.draft.author" type="text" />
          </div>
        </div>

        <div class="actions">
          <FocusButton
            :focused="ui.importFocusIndex === 0"
            subtitle="Copier vers la bibliothèque"
            @select="doImport"
          >
            Importer ce tome
          </FocusButton>
          <FocusButton
            :focused="ui.importFocusIndex === 1"
            subtitle="API stub / ComicVine"
            @select="doEnrich"
          >
            Enrichir métadonnées
          </FocusButton>
        </div>

        <div v-if="imp.enrichResults.length" class="enrich">
          <p class="enrich__title">Résultats</p>
          <button
            v-for="r in imp.enrichResults"
            :key="r.id"
            type="button"
            class="enrich__item"
            @click="imp.applyEnrichResult(r)"
          >
            <strong>{{ r.title }}</strong>
            <span>{{ r.source }} · conf. {{ Math.round(r.confidence * 100) }}%</span>
          </button>
        </div>
      </div>
    </div>

    <footer class="import__footer">
      <button type="button" class="ghost" @click="router.push({ name: 'library' })">Retour</button>
      <button type="button" class="ghost" @click="imp.scan()">Rescanner</button>
      <ControlHint :items="hints" />
    </footer>
  </section>
</template>

<style scoped>
.import {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  background:
    radial-gradient(ellipse 80% 40% at 10% 0%, var(--wash-a), transparent 50%),
    var(--ink-950);
}

.brand {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--brass);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2rem;
}

.lead {
  margin: 0.4rem 0 0;
  color: var(--paper-dim);
}

.path {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--paper-dim);
  word-break: break-all;
}

.import__layout {
  flex: 1;
  min-height: 0;
  margin-top: 1.25rem;
  display: grid;
  grid-template-rows: minmax(0, 38%) minmax(0, 1fr);
  gap: 1rem;
}

.list {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.list__item {
  appearance: none;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.9rem;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft);
}

.list__item.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(3px, 0, 0);
}

.list__title {
  display: block;
  font-family: var(--font-display);
  font-weight: 700;
}

.list__meta {
  display: block;
  margin-top: 0.2rem;
  color: var(--paper-dim);
  font-size: 0.78rem;
}

.empty {
  color: var(--paper-dim);
  text-align: center;
  padding: 1.75rem 1.25rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.empty__title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--paper);
}

.empty__hint {
  margin: 0.45rem 0 0;
  line-height: 1.4;
  font-size: 0.9rem;
}

.detail {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: detail-in 260ms var(--ease-out);
}

.detail--idle {
  place-content: center;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 1.5rem;
  color: var(--paper-dim);
}

.cover-wrap {
  width: 100%;
  max-width: 10rem;
  align-self: center;
}

.cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.cover--empty {
  display: grid;
  place-items: center;
  background: var(--ink-800);
  color: var(--paper-dim);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.enrich__title {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brass);
}

.enrich__item {
  appearance: none;
  width: 100%;
  text-align: left;
  margin-top: 0.4rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.enrich__item span {
  color: var(--paper-dim);
  font-size: 0.78rem;
}

.import__footer {
  margin-top: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
}

@keyframes detail-in {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail {
    animation: none;
  }
  .list__item {
    transition: none;
  }
}
</style>
