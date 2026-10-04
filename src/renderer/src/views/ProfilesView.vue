<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import AppBrandLogo from '../components/AppBrandLogo.vue';
import { useProfilesStore } from '../stores/profiles';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../composables/useI18n';
import {
  markProfileSelected,
  clearSetupGate,
  ensureSetupGate,
} from '../router';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';
import { focusTextInputForEdit } from '../../../shared/virtual-keyboard.js';

const router = useRouter();
const profiles = useProfilesStore();
const ui = useUiStore();
const { t } = useI18n();

const newName = ref('');
const creating = ref(false);
/** pick = ronds · naming = saisie pseudo (création ou édition) */
const phase = ref('pick');
/** null = création · id = renommage */
const editingId = ref(null);
const nameInput = ref(null);
/**
 * Focus formulaire : 0 = pseudo, 1 = palette couleur, 2 = valider.
 */
const formFocus = ref(0);
/** Couleur d’icône choisie (création / édition). */
const selectedColor = ref('#c4a35a');

/** Focus : 0..n-1 = profils, n = bouton + */
const totalSlots = computed(() => profiles.profiles.length + 1);
const focused = computed(() =>
  Math.min(profiles.focusIndex, Math.max(0, totalSlots.value - 1)),
);
const isAddFocused = computed(() => focused.value === profiles.profiles.length);
const isNaming = computed(() => phase.value === 'naming');
const formTitle = computed(() =>
  editingId.value != null ? t('profiles.editProfile') : t('profiles.newProfile'),
);
const submitLabel = computed(() =>
  editingId.value != null ? t('profiles.save') : t('profiles.create'),
);
const previewInitial = computed(() => {
  const n = newName.value.trim();
  if (n) return n.slice(0, 1).toUpperCase();
  if (editingId.value != null) {
    const p = profiles.profiles.find((x) => x.id === editingId.value);
    return (p?.name || '?').slice(0, 1).toUpperCase();
  }
  return '?';
});
const colorOptions = computed(() =>
  profiles.colors?.length
    ? profiles.colors
    : ['#c4a35a', '#4a7eb5', '#d4843a', '#4a9b6e', '#c47a8a', '#8b6b9e'],
);

const hints = computed(() => {
  if (isNaming.value) {
    if (formFocus.value === 1) {
      return [
        { key: '←→', label: t('profiles.hintColor') },
        { key: '↑↓', label: t('profiles.hintFieldValidate') },
        { key: 'A', label: t('profiles.hintValidate') },
        { key: 'B', label: t('profiles.hintCancel') },
      ];
    }
    return [
      { key: '↑↓', label: t('profiles.hintNav') },
      { key: '←→', label: formFocus.value === 0 ? t('profiles.hintColor') : t('profiles.hintField') },
      { key: 'A', label: formFocus.value === 2 ? t('profiles.hintValidate') : t('profiles.hintKeyboard') },
      { key: 'B', label: t('profiles.hintCancel') },
    ];
  }
  return [
    { key: '←→', label: t('profiles.hintNav') },
    { key: 'A', label: t('profiles.hintChoose') },
    { key: 'Y', label: t('profiles.hintEdit') },
    { key: '+', label: t('profiles.hintCreate') },
  ];
});

watch(isNaming, async (on) => {
  if (!on) return;
  formFocus.value = 0;
  await nextTick();
  // Focus champ + clavier virtuel — ne pas soumettre au premier A
  await focusTextInputForEdit(nameInput.value);
  nameInput.value?.select?.();
});

watch(
  () => [profiles.focusIndex, formFocus.value, phase.value],
  () => nextTick(() => scheduleScrollFocusedIntoView('.profiles')),
);

function onRenameEvent() {
  renameFocused();
}

function onFormNavEvent(ev) {
  const dir = ev?.detail?.dir;
  if (!dir || !isNaming.value) return;
  handleFormNav(dir);
}

onMounted(async () => {
  window.addEventListener('vdr-profile-rename', onRenameEvent);
  window.addEventListener('vdr-profile-form-nav', onFormNavEvent);
  await profiles.refresh();
  const idx = profiles.profiles.findIndex((p) => p.id === profiles.activeProfileId);
  profiles.setFocus(idx >= 0 ? idx : 0);
  ui.setRouteName('profiles');
  if (!profiles.profiles.length) {
    profiles.setFocus(0);
    openCreate();
  }
});

onUnmounted(() => {
  window.removeEventListener('vdr-profile-rename', onRenameEvent);
  window.removeEventListener('vdr-profile-form-nav', onFormNavEvent);
});

async function afterSelect() {
  markProfileSelected();
  clearSetupGate();
  const done = await ensureSetupGate();
  if (!done) {
    router.replace({ name: 'setup' });
  } else {
    router.replace({ name: 'library' });
  }
}

function defaultCreateColor() {
  const colors = colorOptions.value;
  return colors[profiles.profiles.length % colors.length] || colors[0];
}

function openCreate() {
  editingId.value = null;
  newName.value = '';
  selectedColor.value = defaultCreateColor();
  phase.value = 'naming';
  formFocus.value = 0;
  profiles.setFocus(profiles.profiles.length);
}

function openRename(index) {
  const p = profiles.profiles[index];
  if (!p) return;
  editingId.value = p.id;
  newName.value = p.name || '';
  selectedColor.value = p.color || defaultCreateColor();
  phase.value = 'naming';
  formFocus.value = 0;
  profiles.setFocus(index);
}

function cancelNaming() {
  phase.value = 'pick';
  editingId.value = null;
  newName.value = '';
  formFocus.value = 0;
  if (!profiles.profiles.length) {
    openCreate();
  }
}

async function choose(index) {
  if (index >= profiles.profiles.length) {
    openCreate();
    return;
  }
  profiles.setFocus(index);
  const p = profiles.profiles[index];
  if (!p) return;
  await profiles.select(p.id);
  const prefs = await window.vdr.profiles.getPrefs(p.id);
  ui.applyAppearance({
    theme: prefs?.theme,
    accent: prefs?.accent,
  });
  if (prefs?.language) ui.applyLanguage(prefs.language);
  await afterSelect();
}

function setColor(color) {
  if (!color) return;
  selectedColor.value = color;
  formFocus.value = 1;
}

function cycleColor(delta) {
  const colors = colorOptions.value;
  if (!colors.length) return;
  const cur = colors.indexOf(selectedColor.value);
  const idx = cur >= 0 ? cur : 0;
  const next = (idx + delta + colors.length) % colors.length;
  selectedColor.value = colors[next];
  formFocus.value = 1;
}

async function submitName() {
  creating.value = true;
  try {
    const name =
      newName.value.trim() ||
      (editingId.value != null
        ? profiles.profiles.find((p) => p.id === editingId.value)?.name
        : null) ||
      t('profiles.defaultName', { n: profiles.profiles.length + 1 });

    if (editingId.value != null) {
      await profiles.update(editingId.value, {
        name,
        color: selectedColor.value,
      });
      phase.value = 'pick';
      editingId.value = null;
      newName.value = '';
      return;
    }

    const created = await profiles.create(name, selectedColor.value);
    newName.value = '';
    phase.value = 'pick';
    await profiles.select(created.id);
    await afterSelect();
  } finally {
    creating.value = false;
  }
}

function onAddClick() {
  openCreate();
}

/** API manette / tests — focus formulaire 0|1|2 */
function moveFormFocus(delta) {
  if (delta < 0) {
    formFocus.value = Math.max(0, formFocus.value - 1);
  } else {
    formFocus.value = Math.min(2, formFocus.value + 1);
  }
  void syncFormDomFocus();
}

async function syncFormDomFocus() {
  await nextTick();
  if (formFocus.value === 0) {
    await focusTextInputForEdit(nameInput.value);
  } else if (formFocus.value === 2) {
    document.querySelector('.profiles__create .btn-primary')?.focus?.();
  } else {
    /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
  }
}

/**
 * Navigation formulaire naming (manette).
 * ↑↓ = champ ↔ couleur ↔ valider ; ←→ = cycle couleurs si focus palette.
 */
function handleFormNav(dir) {
  if (!isNaming.value) return;
  if (dir === 'left') {
    if (formFocus.value === 1) {
      cycleColor(-1);
      return;
    }
    if (formFocus.value === 2) {
      formFocus.value = 1;
      void syncFormDomFocus();
      return;
    }
    void syncFormDomFocus();
    return;
  }
  if (dir === 'right') {
    if (formFocus.value === 1) {
      cycleColor(1);
      return;
    }
    if (formFocus.value === 0) {
      formFocus.value = 1;
      void syncFormDomFocus();
      return;
    }
    return;
  }
  if (dir === 'up') {
    moveFormFocus(-1);
    return;
  }
  if (dir === 'down') {
    moveFormFocus(1);
  }
}

async function activateFocused() {
  if (isNaming.value) {
    if (formFocus.value === 0) {
      await nextTick();
      await focusTextInputForEdit(nameInput.value);
      return;
    }
    if (formFocus.value === 1) {
      // Sur la palette, A valide directement (couleur déjà choisie)
      await submitName();
      return;
    }
    await submitName();
    return;
  }
  await choose(focused.value);
}

function renameFocused() {
  if (isNaming.value) return;
  if (focused.value >= profiles.profiles.length) {
    openCreate();
    return;
  }
  openRename(focused.value);
}

defineExpose({
  openCreate,
  openRename,
  cancelNaming,
  submitName,
  activateFocused,
  renameFocused,
  moveFormFocus,
  handleFormNav,
  cycleColor,
  setColor,
  phase,
  formFocus,
  selectedColor,
});
</script>

<template>
  <section class="profiles" :aria-label="t('profiles.aria')">
    <div class="profiles__atmosphere" aria-hidden="true">
      <div class="profiles__wash" />
      <div class="profiles__vignette" />
    </div>

    <div class="profiles__stage">
      <header class="profiles__brand">
        <AppBrandLogo size="hero" class="profiles__logo" />
        <p class="profiles__prompt">{{ t('profiles.prompt') }}</p>
      </header>

      <div
        v-if="!isNaming"
        class="profiles__grid"
        role="list"
      >
        <button
          v-for="(p, index) in profiles.profiles"
          :key="p.id"
          type="button"
          class="avatar"
          :class="{ 'is-focused': index === focused }"
          role="listitem"
          @click="choose(index)"
        >
          <span class="avatar__halo" aria-hidden="true">
            <span
              class="avatar__disk"
              :style="{
                background: p.avatarPath
                  ? `center / cover url(${p.avatarPath})`
                  : p.color,
              }"
            >
              <template v-if="!p.avatarPath">{{
                (p.name || '?').slice(0, 1).toUpperCase()
              }}</template>
            </span>
          </span>
          <span class="avatar__name">{{ p.name }}</span>
        </button>

        <button
          type="button"
          class="avatar avatar--add"
          :class="{ 'is-focused': isAddFocused }"
          role="listitem"
          :aria-label="t('profiles.addAria')"
          @click="onAddClick"
        >
          <span class="avatar__halo" aria-hidden="true">
            <span class="avatar__disk avatar__disk--add">+</span>
          </span>
          <span class="avatar__name">{{ t('profiles.add') }}</span>
        </button>
      </div>

      <form
        v-if="isNaming"
        class="profiles__create"
        @submit.prevent="submitName"
      >
        <div
          class="profiles__preview"
          aria-hidden="true"
        >
          <span
            class="avatar__disk profiles__preview-disk"
            :style="{ background: selectedColor }"
          >
            {{ previewInitial }}
          </span>
        </div>

        <label>
          {{ formTitle }}
          <input
            ref="nameInput"
            v-model="newName"
            type="text"
            maxlength="32"
            :placeholder="t('profiles.placeholder')"
            autocomplete="off"
            enterkeyhint="done"
            inputmode="text"
            :class="{ 'is-focused': formFocus === 0 }"
            @focus="formFocus = 0"
          />
        </label>

        <div
          class="profiles__colors"
          role="listbox"
          :aria-label="t('profiles.colorAria')"
          :class="{ 'is-focused': formFocus === 1 }"
        >
          <button
            v-for="c in colorOptions"
            :key="c"
            type="button"
            class="color-swatch"
            role="option"
            :aria-selected="selectedColor === c"
            :class="{ 'is-active': selectedColor === c }"
            :style="{ '--swatch': c }"
            :aria-label="t('profiles.colorNamed', { color: c })"
            @click="setColor(c)"
          />
        </div>

        <button
          type="submit"
          class="btn-primary"
          :class="{ 'is-focused': formFocus === 2 }"
          :disabled="creating"
          @focus="formFocus = 2"
        >
          {{ submitLabel }}
        </button>
        <button type="button" class="ghost" @click="cancelNaming">{{ t('profiles.cancel') }}</button>
      </form>
    </div>

    <footer>
      <ControlHint :items="hints" />
    </footer>
  </section>
</template>

<style scoped>
.profiles {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  gap: 1rem;
  overflow: hidden;
  overflow-x: hidden;
  min-height: 0;
}

.profiles__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.profiles__wash {
  position: absolute;
  inset: -18%;
  background:
    radial-gradient(
      ellipse 55% 42% at 50% 18%,
      color-mix(in srgb, var(--brass) 18%, transparent),
      transparent 62%
    ),
    radial-gradient(
      ellipse 70% 50% at 12% 88%,
      color-mix(in srgb, var(--ink-800) 55%, transparent),
      transparent 58%
    ),
    radial-gradient(
      ellipse 50% 40% at 92% 72%,
      color-mix(in srgb, var(--ink-soft, var(--ink-800)) 35%, transparent),
      transparent 55%
    );
}

.profiles__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 80% 70% at 50% 45%,
    transparent 40%,
    color-mix(in srgb, var(--ink-950) 55%, transparent) 100%
  );
}

.profiles__stage,
footer {
  position: relative;
  z-index: 1;
}

.profiles__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1.25rem, 3.5vh, 2.25rem);
  width: 100%;
}

.profiles__brand {
  display: grid;
  justify-items: center;
  gap: 0.85rem;
  text-align: center;
  max-width: min(100%, 36rem);
}

.profiles__logo {
  margin: 0;
}

.profiles__prompt {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 1.6vw, 1.1rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--paper-dim);
}

.profiles__grid {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: flex-start;
  gap: 1.35rem 1.85rem;
  width: auto;
  max-width: 100%;
  min-height: 0;
  /*
   * Rangée unique profils + « + » : pas de wrap / max-height / overflow-y
   * (sinon + et aperçu « ? » du naming se empilaient avec scroll parasite).
   * overflow-x:visible pour ne pas clipper le scale focus / anneau.
   */
  overflow-x: visible;
  overflow-y: visible;
  padding: 1.1rem 1.25rem 1.35rem;
}

.avatar {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
  padding: 0.35rem;
  border: none;
  background: transparent;
  color: var(--paper);
  cursor: pointer;
  border-radius: 0;
  overflow: visible;
  transition: transform 180ms var(--ease-out);
}

.avatar.is-focused {
  transform: translateY(-4px);
}

/* Halo : zone de scale + anneau hors du flux scroll clipé */
.avatar__halo {
  display: grid;
  place-items: center;
  width: 5.25rem;
  height: 5.25rem;
  overflow: visible;
}

.avatar.is-focused .avatar__halo {
  transform: scale(1.08);
  transition: transform 180ms var(--ease-out);
}

.avatar.is-focused .avatar__disk {
  box-shadow: 0 0 0 3px var(--ink-950), 0 0 0 6px var(--brass-bright);
}

.avatar__disk {
  width: 5.25rem;
  height: 5.25rem;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 2rem;
  color: #0e1419;
  border: 2px solid color-mix(in srgb, var(--paper) 20%, transparent);
  flex-shrink: 0;
  box-sizing: border-box;
}

.avatar__disk--add {
  background: color-mix(in srgb, var(--ink-800) 80%, transparent);
  color: var(--paper);
  font-size: 2.4rem;
  font-weight: 400;
  border-style: dashed;
}

.avatar__name {
  font-size: 0.95rem;
  text-align: center;
  font-weight: 600;
}

.profiles__create {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
  justify-content: center;
  max-width: 28rem;
  width: 100%;
  min-width: 0;
}

.profiles__preview {
  flex: 0 0 100%;
  display: grid;
  place-items: center;
  margin-bottom: 0.15rem;
}

.profiles__preview-disk {
  width: 4.5rem;
  height: 4.5rem;
  font-size: 1.75rem;
  transition: background-color 160ms var(--ease-soft);
}

.profiles__create label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--paper-dim);
  flex: 1;
  min-width: 12rem;
}

.profiles__create input {
  background: color-mix(in srgb, var(--ink-800) 70%, transparent);
  border: 1px solid var(--border);
  color: var(--paper);
  padding: 0.75rem 1rem;
  font: inherit;
  border-radius: 999px;
  width: 100%;
  box-sizing: border-box;
  -webkit-user-select: text;
  user-select: text;
}

.profiles__create input.is-focused,
.profiles__create input:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.profiles__colors {
  flex: 0 0 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.35rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.profiles__colors.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.color-swatch {
  appearance: none;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--paper) 25%, transparent);
  background: var(--swatch);
  cursor: pointer;
  padding: 0;
  transition:
    transform 140ms var(--ease-soft),
    box-shadow 140ms var(--ease-soft);
}

.color-swatch.is-active {
  box-shadow: 0 0 0 2px var(--ink-950), 0 0 0 4px var(--brass-bright);
  transform: scale(1.08);
}

.profiles__create .btn-primary.is-focused {
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .avatar,
  .avatar.is-focused .avatar__halo,
  .color-swatch,
  .profiles__preview-disk {
    transition: none;
  }

  .profiles__logo {
    filter: none;
  }
}
</style>
