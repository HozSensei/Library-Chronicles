<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import FocusButton from '../components/FocusButton.vue';
import ControlHint from '../components/ControlHint.vue';
import { useUiStore } from '../stores/ui';
import { markSetupCompleted } from '../router';

const router = useRouter();
const ui = useUiStore();

const step = ref(0);
const defaults = ref({ libraryRoot: '', importRoot: '' });
const form = reactive({
  libraryRoot: '',
  importRoot: '',
  language: 'fr',
  theme: 'dark',
});

const steps = [
  { id: 'welcome', title: 'Bienvenue' },
  { id: 'folders', title: 'Dossiers' },
  { id: 'prefs', title: 'Préférences' },
  { id: 'done', title: 'Prêt' },
];

const focusables = computed(() => {
  if (step.value === 0) return ['next'];
  if (step.value === 1) return ['library', 'import', 'next'];
  if (step.value === 2) return ['theme-dark', 'theme-light', 'lang-fr', 'next'];
  return ['finish'];
});

const focusedId = computed(() => focusables.value[ui.setupFocusIndex] || focusables.value[0]);

onMounted(async () => {
  const paths = await window.vdr.getDefaultPaths();
  defaults.value = paths;
  form.libraryRoot = paths.libraryRoot;
  form.importRoot = paths.importRoot;
  const config = await window.vdr.getConfig();
  form.language = config.language || 'fr';
  form.theme = config.theme || 'dark';
  ui.applyTheme(form.theme);
  await ui.exitReaderMode();
  ui.setSetupFocus(0);
});

async function pickLibrary() {
  const dir = await window.vdr.pickDirectory({ title: 'Dossier bibliothèque' });
  if (dir) form.libraryRoot = dir;
}

async function pickImport() {
  const dir = await window.vdr.pickDirectory({ title: 'Dossier import' });
  if (dir) form.importRoot = dir;
}

function setTheme(theme) {
  form.theme = theme;
  ui.applyTheme(theme);
}

function next() {
  if (step.value < steps.length - 1) {
    step.value += 1;
    ui.setSetupFocus(0);
  }
}

function back() {
  if (step.value > 0) {
    step.value -= 1;
    ui.setSetupFocus(0);
  }
}

async function finish() {
  await window.vdr.setConfig({
    libraryRoot: form.libraryRoot,
    importRoot: form.importRoot,
    language: form.language,
    theme: form.theme,
    orientation: 'landscape',
    setupCompleted: true,
  });
  ui.setupCompleted = true;
  markSetupCompleted();
  ui.applyTheme(form.theme);
  await ui.exitReaderMode();
  ui.language = form.language;
  router.replace({ name: 'profiles' });
}

function activateFocused() {
  const id = focusedId.value;
  if (id === 'next') next();
  else if (id === 'finish') finish();
  else if (id === 'library') pickLibrary();
  else if (id === 'import') pickImport();
  else if (id === 'theme-dark') setTheme('dark');
  else if (id === 'theme-light') setTheme('light');
  else if (id === 'lang-fr') form.language = 'fr';
}

defineExpose({ next, back, finish, activateFocused, focusables });
</script>

<template>
  <section class="setup relative h-full overflow-hidden" aria-label="Configuration initiale">
    <div class="setup__atmosphere absolute inset-0 pointer-events-none" aria-hidden="true">
      <div
        class="absolute inset-0"
        style="
          background:
            radial-gradient(ellipse 80% 50% at 20% -10%, var(--wash-a), transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 100%, var(--wash-b), transparent 50%),
            linear-gradient(160deg, var(--ink-900) 0%, var(--ink-950) 55%, var(--ink-900) 100%);
        "
      />
    </div>

    <div class="relative z-10 mx-auto flex h-full max-w-3xl flex-col px-8 py-10 sm:px-12">
      <header class="mb-8">
        <p class="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--brass-bright)] sm:text-4xl">
          Vertical Deck Reader
        </p>
        <p class="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--brass)]">
          {{ steps[step].title }} · {{ step + 1 }}/{{ steps.length }}
        </p>
      </header>

      <div class="setup__body flex min-h-0 flex-1 flex-col gap-5 overflow-auto">
        <template v-if="step === 0">
          <h1 class="m-0 font-[family-name:var(--font-display)] text-2xl tracking-tight">
            Installons ton espace de lecture
          </h1>
          <p class="lead m-0 max-w-xl text-[var(--paper-dim)] leading-relaxed">
            Menus en paysage, lecture en portrait — l’app bascule toute seule.
            Choisis dossiers et thème, puis entre dans la bibliothèque.
          </p>
          <FocusButton :focused="focusedId === 'next'" subtitle="Continuer" @select="next">
            Commencer
          </FocusButton>
        </template>

        <template v-else-if="step === 1">
          <h1 class="m-0 font-[family-name:var(--font-display)] text-2xl tracking-tight">Dossiers</h1>
          <p class="lead m-0 max-w-xl text-[var(--paper-dim)]">
            Bibliothèque pour les tomes indexés · Import pour les fichiers à trier.
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <label>Bibliothèque</label>
              <code class="path mb-3 block break-all text-xs text-[var(--paper-dim)]">{{ form.libraryRoot }}</code>
              <FocusButton
                :focused="focusedId === 'library'"
                subtitle="Choisir un autre dossier"
                @select="pickLibrary"
              >
                Parcourir
              </FocusButton>
            </div>
            <div class="field rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <label>Import</label>
              <code class="path mb-3 block break-all text-xs text-[var(--paper-dim)]">{{ form.importRoot }}</code>
              <FocusButton
                :focused="focusedId === 'import'"
                subtitle="Inbox des nouveaux fichiers"
                @select="pickImport"
              >
                Parcourir
              </FocusButton>
            </div>
          </div>
          <FocusButton :focused="focusedId === 'next'" subtitle="Étape suivante" @select="next">
            Continuer
          </FocusButton>
        </template>

        <template v-else-if="step === 2">
          <h1 class="m-0 font-[family-name:var(--font-display)] text-2xl tracking-tight">Préférences</h1>
          <p class="lead m-0 max-w-xl text-[var(--paper-dim)]">
            Thème et langue. L’orientation est automatique (paysage menus → portrait lecteur).
          </p>

          <div class="choice-group">
            <p class="choice-group__label">Thème</p>
            <div class="choice-row grid grid-cols-2 gap-3">
              <FocusButton
                :focused="focusedId === 'theme-dark'"
                :subtitle="form.theme === 'dark' ? 'Actif' : ''"
                @select="setTheme('dark')"
              >
                Sombre
              </FocusButton>
              <FocusButton
                :focused="focusedId === 'theme-light'"
                :subtitle="form.theme === 'light' ? 'Actif' : ''"
                @select="setTheme('light')"
              >
                Clair
              </FocusButton>
            </div>
          </div>

          <div class="choice-group">
            <p class="choice-group__label">Langue</p>
            <FocusButton
              :focused="focusedId === 'lang-fr'"
              subtitle="Interface"
              @select="form.language = 'fr'"
            >
              Français
            </FocusButton>
          </div>

          <FocusButton :focused="focusedId === 'next'" subtitle="Dernière étape" @select="next">
            Continuer
          </FocusButton>
        </template>

        <template v-else>
          <h1 class="m-0 font-[family-name:var(--font-display)] text-2xl tracking-tight">Tout est prêt</h1>
          <p class="lead m-0 max-w-xl text-[var(--paper-dim)]">
            Importe tes tomes, parcours la grille, ouvre une fiche, lis en portrait.
          </p>
          <ul class="summary m-0 flex list-none flex-col gap-2 p-0 text-[var(--paper-dim)]">
            <li><strong class="text-[var(--brass-bright)]">Bibliothèque</strong> — {{ form.libraryRoot }}</li>
            <li><strong class="text-[var(--brass-bright)]">Import</strong> — {{ form.importRoot }}</li>
            <li><strong class="text-[var(--brass-bright)]">Thème</strong> — {{ form.theme }}</li>
            <li><strong class="text-[var(--brass-bright)]">Orientation</strong> — automatique</li>
          </ul>
          <FocusButton :focused="focusedId === 'finish'" subtitle="Entrer dans VDR" @select="finish">
            Terminer
          </FocusButton>
        </template>
      </div>

      <footer class="mt-6 flex flex-col items-center gap-3">
        <button v-if="step > 0" type="button" class="ghost" @click="back">Retour</button>
        <ControlHint
          :items="[
            { key: '↑↓', label: 'naviguer' },
            { key: 'A', label: 'valider' },
            { key: '←→', label: 'étapes' },
          ]"
        />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.choice-group__label {
  margin: 0 0 0.55rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--brass);
}

h1 {
  font-family: var(--font-display);
}
</style>
