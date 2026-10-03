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
  orientation: 'portrait-ccw',
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
  if (step.value === 2) return ['theme-dark', 'theme-light', 'orient-ccw', 'orient-land', 'lang-fr', 'next'];
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
  form.orientation = config.orientation || 'portrait-ccw';
  ui.applyTheme(form.theme);
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
    orientation: form.orientation,
    setupCompleted: true,
  });
  ui.setupCompleted = true;
  markSetupCompleted();
  ui.applyTheme(form.theme);
  ui.orientation = form.orientation;
  ui.language = form.language;
  router.replace({ name: 'boot' });
}

function activateFocused() {
  const id = focusedId.value;
  if (id === 'next') next();
  else if (id === 'finish') finish();
  else if (id === 'library') pickLibrary();
  else if (id === 'import') pickImport();
  else if (id === 'theme-dark') setTheme('dark');
  else if (id === 'theme-light') setTheme('light');
  else if (id === 'orient-ccw') form.orientation = 'portrait-ccw';
  else if (id === 'orient-land') form.orientation = 'landscape';
  else if (id === 'lang-fr') form.language = 'fr';
}

defineExpose({ next, back, finish, activateFocused, focusables });
</script>

<template>
  <section class="setup" aria-label="Configuration initiale">
    <div class="setup__atmosphere" aria-hidden="true">
      <div class="setup__wash" />
    </div>

    <header class="setup__brand">
      <p class="setup__mark">Vertical Deck Reader</p>
      <p class="setup__step">{{ steps[step].title }} · {{ step + 1 }}/{{ steps.length }}</p>
    </header>

    <div class="setup__body">
      <template v-if="step === 0">
        <h1>Installons ton espace de lecture</h1>
        <p class="lead">
          Quelques choix essentiels — dossiers, thème, orientation Ally — avant d’entrer dans
          l’app.
        </p>
        <FocusButton :focused="focusedId === 'next'" subtitle="Continuer" @select="next">
          Commencer
        </FocusButton>
      </template>

      <template v-else-if="step === 1">
        <h1>Dossiers</h1>
        <p class="lead">Bibliothèque pour les tomes indexés · Import pour les fichiers à trier.</p>
        <div class="fields">
          <div class="field">
            <label>Bibliothèque</label>
            <code class="path">{{ form.libraryRoot }}</code>
            <FocusButton
              :focused="focusedId === 'library'"
              subtitle="Choisir un autre dossier"
              @select="pickLibrary"
            >
              Parcourir bibliothèque
            </FocusButton>
          </div>
          <div class="field">
            <label>Import</label>
            <code class="path">{{ form.importRoot }}</code>
            <FocusButton
              :focused="focusedId === 'import'"
              subtitle="Inbox des nouveaux fichiers"
              @select="pickImport"
            >
              Parcourir import
            </FocusButton>
          </div>
        </div>
        <FocusButton :focused="focusedId === 'next'" subtitle="Étape suivante" @select="next">
          Continuer
        </FocusButton>
      </template>

      <template v-else-if="step === 2">
        <h1>Préférences</h1>
        <p class="lead">Thème, langue et orientation manette.</p>
        <div class="choice-row">
          <FocusButton
            :focused="focusedId === 'theme-dark'"
            :subtitle="form.theme === 'dark' ? 'Actif' : ''"
            @select="setTheme('dark')"
          >
            Thème sombre
          </FocusButton>
          <FocusButton
            :focused="focusedId === 'theme-light'"
            :subtitle="form.theme === 'light' ? 'Actif' : ''"
            @select="setTheme('light')"
          >
            Thème clair
          </FocusButton>
        </div>
        <div class="choice-row">
          <FocusButton
            :focused="focusedId === 'orient-ccw'"
            :subtitle="form.orientation === 'portrait-ccw' ? 'Ally portrait' : ''"
            @select="form.orientation = 'portrait-ccw'"
          >
            Portrait 90° CCW
          </FocusButton>
          <FocusButton
            :focused="focusedId === 'orient-land'"
            :subtitle="form.orientation === 'landscape' ? 'Dev desktop' : ''"
            @select="form.orientation = 'landscape'"
          >
            Landscape
          </FocusButton>
        </div>
        <FocusButton
          :focused="focusedId === 'lang-fr'"
          subtitle="Interface"
          @select="form.language = 'fr'"
        >
          Français
        </FocusButton>
        <FocusButton :focused="focusedId === 'next'" subtitle="Dernière étape" @select="next">
          Continuer
        </FocusButton>
      </template>

      <template v-else>
        <h1>Tout est prêt</h1>
        <p class="lead">
          Importe tes tomes, parcours la bibliothèque, lis à la manette. Tu pourras tout modifier
          dans Paramètres.
        </p>
        <ul class="summary">
          <li><strong>Bibliothèque</strong> — {{ form.libraryRoot }}</li>
          <li><strong>Import</strong> — {{ form.importRoot }}</li>
          <li><strong>Thème</strong> — {{ form.theme }}</li>
          <li><strong>Orientation</strong> — {{ form.orientation }}</li>
        </ul>
        <FocusButton :focused="focusedId === 'finish'" subtitle="Entrer dans VDR" @select="finish">
          Terminer
        </FocusButton>
      </template>
    </div>

    <footer class="setup__footer">
      <button v-if="step > 0" type="button" class="ghost" @click="back">Retour</button>
      <ControlHint
        :items="[
          { key: '↑↓', label: 'naviguer' },
          { key: 'A', label: 'valider' },
          { key: '←→', label: 'étapes' },
        ]"
      />
    </footer>
  </section>
</template>

<style scoped>
.setup {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  overflow: hidden;
}

.setup__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.setup__wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 55% at 50% -10%, var(--wash-a), transparent 60%),
    radial-gradient(ellipse 70% 45% at 80% 90%, var(--wash-b), transparent 55%),
    linear-gradient(165deg, var(--ink-900) 0%, var(--ink-950) 55%, var(--ink-900) 100%);
}

.setup__brand,
.setup__body,
.setup__footer {
  position: relative;
  z-index: 1;
}

.setup__brand {
  margin-top: min(6vh, 3rem);
}

.setup__mark {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2rem, 7vw, 2.8rem);
  letter-spacing: -0.03em;
  line-height: 0.95;
}

.setup__step {
  margin: 0.6rem 0 0;
  color: var(--brass-bright);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.setup__body {
  flex: 1;
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
  overflow: auto;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.55rem;
  letter-spacing: -0.02em;
}

.lead {
  margin: 0 0 0.5rem;
  color: var(--paper-dim);
  line-height: 1.45;
  max-width: 24rem;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.path {
  display: block;
  font-size: 0.78rem;
  color: var(--paper-dim);
  word-break: break-all;
  margin-bottom: 0.35rem;
}

.choice-row {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.summary {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: var(--paper-dim);
  font-size: 0.9rem;
}

.summary strong {
  color: var(--brass-bright);
  font-weight: 600;
}

.setup__footer {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
</style>
