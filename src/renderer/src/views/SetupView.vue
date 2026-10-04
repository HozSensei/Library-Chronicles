<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FocusButton from '../components/FocusButton.vue';
import ControlHint from '../components/ControlHint.vue';
import AppBrandLogo from '../components/AppBrandLogo.vue';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../composables/useI18n';
import { markSetupCompleted } from '../router';
import {
  setupFocusRows,
  setupFocusables,
  moveSetupFocus,
} from '../../../shared/setup-focus.js';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';
import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  accentLabel,
  normalizeAccent,
  normalizeTheme,
} from '../../../shared/theme-accents.js';

const router = useRouter();
const ui = useUiStore();
const { t } = useI18n();

const step = ref(0);
const defaults = ref({ libraryRoot: '', importRoot: '' });
const accents = ACCENTS;
const form = reactive({
  libraryRoot: '',
  importRoot: '',
  theme: DEFAULT_THEME,
  accent: DEFAULT_ACCENT,
});

/** Dossiers → préférences → prêt (pas d’écran welcome). */
const steps = computed(() => [
  { id: 'folders', title: t('setup.stepFolders') },
  { id: 'prefs', title: t('setup.stepPrefs') },
  { id: 'done', title: t('setup.stepDone') },
]);

const controlHints = computed(() => [
  { key: '↑↓', label: t('common.row') },
  { key: '←→', label: t('common.option') },
  { key: 'A', label: t('common.confirm') },
  { key: 'B', label: t('common.back').toLowerCase() },
]);

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
  form.theme = normalizeTheme(prefs?.theme);
  form.accent = normalizeAccent(prefs?.accent);
  ui.applyAppearance({ theme: form.theme, accent: form.accent });
  // Langue = prefs profil (source de vérité) — pas de picker setup
  if (prefs?.language) ui.applyLanguage(prefs.language);
  ui.setSetupFocus(0);
});

async function pickLibrary() {
  const dir = await window.vdr.pickDirectory({ title: t('setup.pickLibraryTitle') });
  if (dir) form.libraryRoot = dir;
}

async function pickImport() {
  const dir = await window.vdr.pickDirectory({ title: t('setup.pickImportTitle') });
  if (dir) form.importRoot = dir;
}

function setTheme(theme) {
  form.theme = normalizeTheme(theme);
  ui.applyTheme(form.theme);
}

function setAccent(accent) {
  form.accent = normalizeAccent(accent);
  ui.applyAccent(form.accent);
}

function next() {
  if (step.value < steps.value.length - 1) {
    step.value += 1;
  }
}

function back() {
  if (step.value > 0) {
    step.value -= 1;
  }
}

async function finish() {
  // Ne pas réécrire language — profil = source de vérité (drapeaux)
  await window.vdr.profiles.setPrefs({
    libraryRoot: form.libraryRoot,
    importRoot: form.importRoot,
    theme: form.theme,
    accent: form.accent,
    setupCompleted: true,
  });
  const prefs = await window.vdr.profiles.getPrefs();
  await window.vdr.setConfig({
    libraryRoot: form.libraryRoot,
    importRoot: form.importRoot,
    language: prefs?.language || ui.language || 'fr',
    theme: form.theme,
    accent: form.accent,
    orientation: 'landscape',
    setupCompleted: true,
  });
  ui.setupCompleted = true;
  markSetupCompleted();
  ui.applyAppearance({ theme: form.theme, accent: form.accent });
  if (prefs?.language) ui.applyLanguage(prefs.language);
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
  else if (id?.startsWith('accent-')) setAccent(id.slice('accent-'.length));
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
  <section class="setup" :data-step="step" :aria-label="t('setup.aria')">
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
        <AppBrandLogo size="lg" class="setup__brand" />
        <p class="setup__step">
          {{ steps[step].title }} · {{ step + 1 }}/{{ steps.length }}
        </p>
      </header>

      <div class="setup__body">
        <template v-if="step === 0">
          <h1>{{ t('setup.foldersTitle') }}</h1>
          <p class="lead">{{ t('setup.foldersLead') }}</p>
          <div class="folder-stack">
            <div class="field-card">
              <label>{{ t('setup.libraryLabel') }}</label>
              <code class="path">{{ form.libraryRoot }}</code>
              <FocusButton
                compact
                :focused="focusedId === 'library'"
                :subtitle="t('setup.browseLibrarySub')"
                @select="pickLibrary"
              >
                {{ t('setup.browse') }}
              </FocusButton>
            </div>
            <div class="field-card">
              <label>{{ t('setup.importLabel') }}</label>
              <code class="path">{{ form.importRoot }}</code>
              <FocusButton
                compact
                :focused="focusedId === 'import'"
                :subtitle="t('setup.browseImportSub')"
                @select="pickImport"
              >
                {{ t('setup.browse') }}
              </FocusButton>
            </div>
          </div>
          <div class="setup-actions">
            <FocusButton
              compact
              tone="primary"
              :focused="focusedId === 'next'"
              @select="next"
            >
              {{ t('common.continue') }}
            </FocusButton>
          </div>
        </template>

        <template v-else-if="step === 1">
          <h1>{{ t('setup.prefsTitle') }}</h1>
          <p class="lead">{{ t('setup.prefsLead') }}</p>

          <div class="choice-group">
            <p class="choice-group__label">{{ t('setup.mode') }}</p>
            <div class="choice-row">
              <FocusButton
                compact
                :focused="focusedId === 'theme-dark'"
                :subtitle="form.theme === 'dark' ? t('common.active') : ''"
                @select="setTheme('dark')"
              >
                {{ t('setup.dark') }}
              </FocusButton>
              <FocusButton
                compact
                :focused="focusedId === 'theme-light'"
                :subtitle="form.theme === 'light' ? t('common.active') : ''"
                @select="setTheme('light')"
              >
                {{ t('setup.light') }}
              </FocusButton>
            </div>
          </div>

          <div class="choice-group">
            <p class="choice-group__label">{{ t('setup.accent') }}</p>
            <div class="accent-row" role="listbox" :aria-label="t('setup.accentAria')">
              <button
                v-for="a in accents"
                :key="a.id"
                type="button"
                class="accent-swatch"
                role="option"
                :aria-selected="form.accent === a.id"
                :class="{
                  'is-focused': focusedId === `accent-${a.id}`,
                  'is-active': form.accent === a.id,
                }"
                :title="accentLabel(a.id)"
                :aria-label="accentLabel(a.id)"
                @click="setAccent(a.id)"
              >
                <span class="accent-swatch__dot" :style="{ background: a.swatch }" />
                <span class="accent-swatch__label">{{ accentLabel(a.id) }}</span>
              </button>
            </div>
          </div>

          <div class="setup-actions">
            <FocusButton
              compact
              tone="primary"
              :focused="focusedId === 'next'"
              @select="next"
            >
              {{ t('common.continue') }}
            </FocusButton>
          </div>
        </template>

        <template v-else>
          <h1>{{ t('setup.doneTitle') }}</h1>
          <p class="lead">{{ t('setup.doneLead') }}</p>
          <ul class="summary">
            <li><strong>{{ t('setup.libraryLabel') }}</strong> — {{ form.libraryRoot }}</li>
            <li><strong>{{ t('setup.importLabel') }}</strong> — {{ form.importRoot }}</li>
            <li>
              <strong>{{ t('setup.theme') }}</strong> —
              {{ form.theme === 'light' ? t('setup.light') : t('setup.dark') }} ·
              {{ accentLabel(form.accent) }}
            </li>
            <li>
              <strong>{{ t('setup.orientation') }}</strong> —
              {{ t('setup.orientationAuto') }}
            </li>
          </ul>
          <div class="setup-actions">
            <FocusButton
              compact
              tone="primary"
              :focused="focusedId === 'finish'"
              @select="finish"
            >
              {{ t('setup.finish') }}
            </FocusButton>
          </div>
        </template>
      </div>

      <footer class="setup__footer">
        <button v-if="step > 0" type="button" class="ghost" @click="back">
          {{ t('common.back') }}
        </button>
        <ControlHint :items="controlHints" />
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
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--brass) 55%, transparent) transparent;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  /* Marge interne : halo focus des swatches / boutons non rogné par overflow-x */
  padding-inline: 0.35rem;
  box-sizing: border-box;
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
  font-weight: 800;
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

.folder-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}

.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  min-width: 0;
  width: 100%;
}

.accent-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-width: 0;
  width: 100%;
  padding: 0.2rem 0.1rem;
  box-sizing: border-box;
}

.accent-swatch {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 4.25rem;
  padding: 0.55rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--paper-dim);
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft);
}

.accent-swatch__dot {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.accent-swatch__label {
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.accent-swatch.is-active {
  border-color: var(--brass);
  color: var(--paper);
}

.accent-swatch.is-focused,
.accent-swatch:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(0, -1px, 0);
  color: var(--paper);
}

.field-card {
  min-width: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
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

.setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.25rem;
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
  .setup__frame {
    padding: 1.25rem 1rem 1rem;
  }
}
</style>
