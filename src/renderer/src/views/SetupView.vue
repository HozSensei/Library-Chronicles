<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FocusButton from '../components/FocusButton.vue';
import ControlHint from '../components/ControlHint.vue';
import { useUiStore } from '../stores/ui';
import { markSetupCompleted } from '../router';
import {
  setupFocusRows,
  setupFocusables,
  moveSetupFocus,
} from '../../../shared/setup-focus.js';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

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

const focusRows = computed(() => setupFocusRows(step.value));
const focusables = computed(() => setupFocusables(step.value));
const focusedId = computed(
  () => focusables.value[ui.setupFocusIndex] || focusables.value[0],
);

watch(step, () => {
  ui.setSetupFocus(0);
});

watch(
  () => [ui.setupFocusIndex, step.value],
  () => nextTick(() => scheduleScrollFocusedIntoView('.setup')),
);

onMounted(async () => {
  const paths =
    (await window.vdr.profiles.defaultPaths?.()) ||
    (await window.vdr.getDefaultPaths());
  defaults.value = paths;
  const active = await window.vdr.profiles.getActive();
  const prefs = active?.prefs;
  form.libraryRoot = prefs?.libraryRoot || paths.libraryRoot;
  form.importRoot = prefs?.importRoot || paths.importRoot;
  form.language = prefs?.language || 'fr';
  form.theme = prefs?.theme || 'dark';
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
  }
}

function back() {
  if (step.value > 0) {
    step.value -= 1;
  }
}

async function finish() {
  await window.vdr.profiles.setPrefs({
    libraryRoot: form.libraryRoot,
    importRoot: form.importRoot,
    language: form.language,
    theme: form.theme,
    setupCompleted: true,
  });
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
  ui.language = form.language;
  router.replace({ name: 'library' });
}

function moveFocus(dir) {
  const nextIndex = moveSetupFocus(focusRows.value, ui.setupFocusIndex, dir);
  ui.setSetupFocus(nextIndex);
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

defineExpose({
  next,
  back,
  finish,
  activateFocused,
  moveFocus,
  focusables,
  focusRows,
});
</script>

<template>
  <section class="setup" :data-step="step" aria-label="Configuration initiale">
    <div class="setup__atmosphere" aria-hidden="true">
      <div
        class="setup__wash"
        style="
          background:
            radial-gradient(ellipse 80% 50% at 20% -10%, var(--wash-a), transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 100%, var(--wash-b), transparent 50%),
            linear-gradient(160deg, var(--ink-900) 0%, var(--ink-950) 55%, var(--ink-900) 100%);
        "
      />
    </div>

    <div class="setup__frame">
      <header class="setup__header">
        <p class="setup__brand">Vertical Deck Reader</p>
        <p class="setup__step">
          {{ steps[step].title }} · {{ step + 1 }}/{{ steps.length }}
        </p>
      </header>

      <div class="setup__body">
        <template v-if="step === 0">
          <h1>Installons ton espace de lecture</h1>
          <p class="lead">
            Profil sélectionné — configure ses dossiers et son thème.
            Menus en paysage, lecture en portrait : l’app bascule toute seule.
          </p>
          <FocusButton :focused="focusedId === 'next'" subtitle="Continuer" @select="next">
            Commencer
          </FocusButton>
        </template>

        <template v-else-if="step === 1">
          <h1>Dossiers</h1>
          <p class="lead">
            Bibliothèque pour les tomes indexés · Import pour les fichiers à trier.
          </p>
          <div class="choice-row">
            <div class="field-card">
              <label>Bibliothèque</label>
              <code class="path">{{ form.libraryRoot }}</code>
              <FocusButton
                :focused="focusedId === 'library'"
                subtitle="Choisir un autre dossier"
                @select="pickLibrary"
              >
                Parcourir
              </FocusButton>
            </div>
            <div class="field-card">
              <label>Import</label>
              <code class="path">{{ form.importRoot }}</code>
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
          <h1>Préférences</h1>
          <p class="lead">
            Thème et langue. L’orientation est automatique (paysage menus → portrait lecteur).
          </p>

          <div class="choice-group">
            <p class="choice-group__label">Thème</p>
            <div class="choice-row">
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
          <h1>Tout est prêt</h1>
          <p class="lead">
            Importe tes tomes, parcours la grille, ouvre une fiche, lis en portrait.
          </p>
          <ul class="summary">
            <li><strong>Bibliothèque</strong> — {{ form.libraryRoot }}</li>
            <li><strong>Import</strong> — {{ form.importRoot }}</li>
            <li><strong>Thème</strong> — {{ form.theme }}</li>
            <li><strong>Orientation</strong> — automatique</li>
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
            { key: '↑↓', label: 'rangée' },
            { key: '←→', label: 'option' },
            { key: 'A', label: 'valider' },
            { key: 'B', label: 'retour' },
          ]"
        />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.setup {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  overflow-x: hidden;
}

.setup__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.setup__wash {
  position: absolute;
  inset: 0;
}

.setup__frame {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  max-width: 48rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 2rem 1.75rem 1.25rem;
  overflow-x: hidden;
  box-sizing: border-box;
}

.setup__header {
  flex-shrink: 0;
  margin-bottom: 1.25rem;
  min-width: 0;
}

.setup__brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.25rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--brass-bright);
}

.setup__step {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brass);
}

.setup__body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.15rem;
}

.setup__footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.85rem;
  padding-top: 0.5rem;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  letter-spacing: -0.01em;
}

.lead {
  margin: 0;
  max-width: 36rem;
  color: var(--paper-dim);
  line-height: 1.5;
}

.choice-group__label {
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--brass);
}

.choice-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  min-width: 0;
  width: 100%;
}

.field-card {
  min-width: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.field-card label {
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--paper-dim);
}

.path {
  display: block;
  font-size: 0.72rem;
  color: var(--paper-dim);
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
  max-width: 100%;
}

.summary {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: var(--paper-dim);
  min-width: 0;
}

.summary li {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.summary strong {
  color: var(--brass-bright);
}

@media (max-width: 640px) {
  .choice-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .setup__frame {
    padding: 1.25rem 1rem 1rem;
  }
}
</style>
