<script setup>
import { computed, onMounted } from 'vue';
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

const enrichSubtitle = computed(() => {
  if (imp.enrichLoading) return 'Recherche en cours…';
  const p = imp.selectedProviderMeta;
  if (!p) return 'Provider métadonnées';
  return `${p.label} · ${p.freeLabel}`;
});

onMounted(async () => {
  await ui.exitReaderMode();
  await imp.loadProviders();
  await imp.scan();
  ui.setImportFocus(0);
});

async function doImport() {
  if (!imp.selected) return;
  await imp.commitSelected({ copyToLibrary: true });
}

async function doEnrich() {
  await imp.enrich();
}
</script>

<template>
  <section class="import relative h-full" aria-label="Import">
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="
        background:
          radial-gradient(ellipse 70% 40% at 0% 0%, var(--wash-a), transparent 50%),
          var(--ink-950);
      "
    />

    <div class="relative z-10 flex h-full flex-col px-8 py-8 sm:px-10">
      <header class="mb-4">
        <p class="m-0 text-sm font-semibold text-[var(--brass)]">Vertical Deck Reader</p>
        <h1 class="m-0 mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">Import</h1>
        <p class="m-0 mt-2 text-[var(--paper-dim)]">{{ statusLabel }}</p>
        <p v-if="imp.root" class="m-0 mt-1 break-all text-xs text-[var(--paper-dim)]">{{ imp.root }}</p>
      </header>

      <div class="import__layout grid min-h-0 flex-1 gap-5" style="grid-template-columns: minmax(18rem, 38%) minmax(0, 1fr)">
        <aside class="list flex min-h-0 flex-col gap-2 overflow-auto pr-1">
          <button
            v-for="(item, index) in imp.items"
            :key="item.filePath"
            type="button"
            class="list__item flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left"
            :class="{ 'is-focused': index === imp.cursor }"
            @click="imp.cursor = index; imp.loadDraftFromSelected()"
          >
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs"
              :class="item.alreadyInLibrary
                ? 'border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)]'
                : 'border-[var(--border)] text-transparent'"
              aria-hidden="true"
            >
              ✓
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-[family-name:var(--font-display)] font-bold">
                {{ item.detected?.title || item.name }}
              </span>
              <span class="mt-0.5 block text-xs text-[var(--paper-dim)]">
                {{ item.format?.toUpperCase() }}
                <template v-if="item.alreadyInLibrary"> · déjà importé</template>
              </span>
            </span>
          </button>

          <div
            v-if="!imp.items.length && !imp.loading"
            class="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center"
          >
            <p class="m-0 font-bold">Dossier import vide</p>
            <p class="m-0 mt-2 text-sm text-[var(--paper-dim)]">
              Dépose des CBZ, CBR ou PDF, puis Rescanner.
            </p>
          </div>
        </aside>

        <div v-if="!imp.selected && !imp.loading" class="detail detail--idle flex items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--paper-dim)]">
          <div>
            <p class="m-0 font-bold text-[var(--paper)]">Sélectionne un tome</p>
            <p class="m-0 mt-2 text-sm">↑↓ pour naviguer · A importer · Y enrichir</p>
          </div>
        </div>

        <div v-else-if="imp.selected" class="detail flex min-h-0 flex-col gap-4 overflow-auto">
          <div class="flex gap-5">
            <div class="w-28 shrink-0">
              <img
                v-if="imp.coverPreview"
                :src="imp.coverPreview"
                alt=""
                class="aspect-[2/3] w-full rounded-[var(--radius-sm)] border border-[var(--border)] object-cover"
              />
              <div
                v-else
                class="grid aspect-[2/3] place-items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--ink-800)] text-sm text-[var(--paper-dim)]"
              >
                Aperçu
              </div>
            </div>

            <div class="fields min-w-0 flex-1 space-y-3">
              <div class="field">
                <label>Provider métadonnées</label>
                <select
                  class="provider-select w-full"
                  :value="imp.activeProvider"
                  @change="imp.setProvider($event.target.value)"
                >
                  <option v-for="p in imp.providers" :key="p.id" :value="p.id">
                    {{ p.label }} — {{ p.freeLabel }}
                  </option>
                </select>
                <p v-if="imp.selectedProviderMeta?.helpText" class="provider-help m-0 mt-2 text-xs text-[var(--paper-dim)]">
                  {{ imp.selectedProviderMeta.helpText }}
                  <button
                    v-if="imp.selectedProviderMeta.helpUrl"
                    type="button"
                    class="link-btn"
                    @click="imp.openProviderHelp(imp.selectedProviderMeta)"
                  >
                    {{ imp.selectedProviderMeta.helpLinkLabel || 'Documentation' }}
                  </button>
                </p>
              </div>
              <div class="field">
                <label>Titre</label>
                <input v-model="imp.draft.title" type="text" />
              </div>
              <div class="field">
                <label>Série</label>
                <input v-model="imp.draft.series" type="text" />
              </div>
              <div class="grid grid-cols-2 gap-3">
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
              <div class="field">
                <label>Synopsis</label>
                <textarea v-model="imp.draft.description" rows="3" class="w-full resize-y" />
              </div>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <FocusButton
              :focused="ui.importFocusIndex === 0"
              subtitle="Copier vers la bibliothèque"
              @select="doImport"
            >
              Importer ce tome
            </FocusButton>
            <FocusButton
              :focused="ui.importFocusIndex === 1"
              :subtitle="enrichSubtitle"
              @select="doEnrich"
            >
              {{ imp.enrichLoading ? 'Enrichissement…' : 'Enrichir métadonnées' }}
            </FocusButton>
          </div>

          <p
            v-if="imp.enrichWarning || imp.enrichError"
            class="m-0 rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-sm"
          >
            {{ imp.enrichError || imp.enrichWarning }}
          </p>

          <div v-if="imp.enrichResults.length" class="enrich">
            <p class="m-0 text-xs uppercase tracking-wider text-[var(--brass)]">
              Résultats
              <template v-if="imp.enrichProvider"> · {{ imp.enrichProvider }}</template>
            </p>
            <button
              v-for="r in imp.enrichResults"
              :key="r.id"
              type="button"
              class="enrich__item mt-2 flex w-full flex-col gap-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left"
              @click="imp.applyEnrichResult(r)"
            >
              <strong>{{ r.title }}</strong>
              <span class="text-xs text-[var(--paper-dim)]">
                {{ r.source }} · conf. {{ Math.round((r.confidence || 0) * 100) }}%
                <template v-if="r.author"> · {{ r.author }}</template>
              </span>
              <span v-if="r.description" class="line-clamp-2 text-xs text-[var(--paper-dim)]">
                {{ r.description }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <footer class="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button type="button" class="ghost" @click="router.push({ name: 'library' })">Retour</button>
        <button type="button" class="ghost" @click="imp.scan()">Rescanner</button>
        <ControlHint :items="hints" />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.list__item {
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: border-color 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft), transform 160ms var(--ease-soft);
}

.list__item.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(3px, 0, 0);
}

.provider-select,
textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--paper);
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  font: inherit;
}

.link-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--brass-bright);
  text-decoration: underline;
  padding: 0;
  margin-left: 0.35rem;
  font: inherit;
  cursor: pointer;
}

.enrich__item {
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.enrich__item:hover {
  border-color: var(--brass);
}
</style>
