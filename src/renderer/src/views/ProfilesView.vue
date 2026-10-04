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
import { LOCALES, normalizeLocale } from '../../../shared/i18n.js';
import flagFrUrl from '../assets/flags/fr.svg';
import flagEnUrl from '../assets/flags/en.svg';

const router = useRouter();
const profiles = useProfilesStore();
const ui = useUiStore();
const { t } = useI18n();

/** Zones focus formulaire naming (un seul anneau brass à la fois). */
const FORM_ZONE = Object.freeze({
  PSEUDO: 0,
  COLOR: 1,
  LANG: 2,
  SUBMIT: 3,
});

const FLAG_SRC = Object.freeze({
  fr: flagFrUrl,
  en: flagEnUrl,
});

const newName = ref('');
const creating = ref(false);
/** pick = ronds · naming = saisie pseudo (création ou édition) */
const phase = ref('pick');
/** null = création · id = renommage */
const editingId = ref(null);
const nameInput = ref(null);
/**
 * Focus formulaire / focusedId zone :
 * 0 = pseudo · 1 = color · 2 = lang · 3 = submit.
 * Une seule classe `is-focused` (ring brass) selon cette zone ;
 * `is-active` = sélection (couleur/langue) ≠ focus.
 */
const formFocus = ref(FORM_ZONE.PSEUDO);
/** Couleur d’icône choisie (création / édition). */
const selectedColor = ref('#c4a35a');
/** Locale profil (création / édition) — source de vérité i18n. */
const selectedLocale = ref('fr');
/** Locale UI avant édition (restauration à l’annulation). */
const localeBeforeEdit = ref('fr');
const localeOptions = LOCALES;

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
    if (formFocus.value === FORM_ZONE.COLOR) {
      return [
        { key: '←→', label: t('profiles.hintColor') },
        { key: '↑↓', label: t('profiles.hintFieldValidate') },
        { key: 'A', label: t('profiles.hintValidate') },
        { key: 'B', label: t('profiles.hintCancel') },
      ];
    }
    if (formFocus.value === FORM_ZONE.LANG) {
      return [
        { key: '←→', label: t('profiles.hintLang') },
        { key: '↑↓', label: t('profiles.hintFieldValidate') },
        { key: 'A', label: t('profiles.hintValidate') },
        { key: 'B', label: t('profiles.hintCancel') },
      ];
    }
    return [
      { key: '↑↓', label: t('profiles.hintNav') },
      {
        key: '←→',
        label:
          formFocus.value === FORM_ZONE.PSEUDO
            ? t('profiles.hintColor')
            : t('profiles.hintField'),
      },
      {
        key: 'A',
        label:
          formFocus.value === FORM_ZONE.SUBMIT
            ? t('profiles.hintValidate')
            : t('profiles.hintKeyboard'),
      },
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
  formFocus.value = FORM_ZONE.PSEUDO;
  await nextTick();
  // Focus champ + clavier virtuel — ne pas soumettre au premier A
  await focusTextInputForEdit(nameInput.value);
  nameInput.value?.select?.();
});

watch(formFocus, () => {
  void syncFormDomFocus();
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
  localeBeforeEdit.value = normalizeLocale(ui.language);
  selectedLocale.value = 'fr';
  ui.applyLanguage(selectedLocale.value);
  phase.value = 'naming';
  formFocus.value = FORM_ZONE.PSEUDO;
  profiles.setFocus(profiles.profiles.length);
}

function openRename(index) {
  const p = profiles.profiles[index];
  if (!p) return;
  editingId.value = p.id;
  newName.value = p.name || '';
  selectedColor.value = p.color || defaultCreateColor();
  localeBeforeEdit.value = normalizeLocale(ui.language);
  selectedLocale.value = normalizeLocale(p.language || ui.language || 'fr');
  ui.applyLanguage(selectedLocale.value);
  phase.value = 'naming';
  formFocus.value = FORM_ZONE.PSEUDO;
  profiles.setFocus(index);
}

function cancelNaming() {
  ui.applyLanguage(localeBeforeEdit.value);
  phase.value = 'pick';
  editingId.value = null;
  newName.value = '';
  formFocus.value = FORM_ZONE.PSEUDO;
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
  await afterSelect();
}

function setColor(color) {
  if (!color) return;
  selectedColor.value = color;
  formFocus.value = FORM_ZONE.COLOR;
  void syncFormDomFocus();
}

function cycleColor(delta) {
  const colors = colorOptions.value;
  if (!colors.length) return;
  const cur = colors.indexOf(selectedColor.value);
  const idx = cur >= 0 ? cur : 0;
  const next = (idx + delta + colors.length) % colors.length;
  selectedColor.value = colors[next];
  formFocus.value = FORM_ZONE.COLOR;
  void syncFormDomFocus();
}

function setLocaleFlag(locale) {
  selectedLocale.value = normalizeLocale(locale);
  formFocus.value = FORM_ZONE.LANG;
  ui.applyLanguage(selectedLocale.value);
  void syncFormDomFocus();
}

function cycleLocale(delta) {
  const list = localeOptions;
  if (!list.length) return;
  const cur = list.indexOf(normalizeLocale(selectedLocale.value));
  const idx = cur >= 0 ? cur : 0;
  const next = (idx + delta + list.length) % list.length;
  selectedLocale.value = list[next];
  formFocus.value = FORM_ZONE.LANG;
  ui.applyLanguage(selectedLocale.value);
  void syncFormDomFocus();
}

function flagSrc(locale) {
  return FLAG_SRC[normalizeLocale(locale)] || FLAG_SRC.fr;
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
    const language = normalizeLocale(selectedLocale.value);

    if (editingId.value != null) {
      await profiles.update(editingId.value, {
        name,
        color: selectedColor.value,
        language,
      });
      phase.value = 'pick';
      editingId.value = null;
      newName.value = '';
      return;
    }

    const created = await profiles.create(
      name,
      selectedColor.value,
      language,
    );
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

/** API manette / tests — focus formulaire 0|1|2|3 (pseudo|color|lang|submit) */
function moveFormFocus(delta) {
  if (delta < 0) {
    formFocus.value = Math.max(FORM_ZONE.PSEUDO, formFocus.value - 1);
  } else {
    formFocus.value = Math.min(FORM_ZONE.SUBMIT, formFocus.value + 1);
  }
}

async function syncFormDomFocus() {
  await nextTick();
  if (!isNaming.value) return;
  if (formFocus.value === FORM_ZONE.PSEUDO) {
    await focusTextInputForEdit(nameInput.value);
    return;
  }
  if (formFocus.value === FORM_ZONE.SUBMIT) {
    document.querySelector('.profiles__create .btn-primary')?.focus?.();
    return;
  }
  // color | lang : anneau via is-focused, pas via :focus-visible natif
  const active = /** @type {HTMLElement|null} */ (document.activeElement);
  if (active && active.closest?.('.profiles__create')) {
    active.blur?.();
  }
}

/**
 * Navigation formulaire naming (manette).
 * ↑↓ = champ ↔ couleur ↔ langue ↔ valider ;
 * ←→ = cycle couleurs / drapeaux (sélection auto au focus).
 */
function handleFormNav(dir) {
  if (!isNaming.value) return;
  if (dir === 'left') {
    if (formFocus.value === FORM_ZONE.COLOR) {
      cycleColor(-1);
      return;
    }
    if (formFocus.value === FORM_ZONE.LANG) {
      cycleLocale(-1);
      return;
    }
    if (formFocus.value === FORM_ZONE.SUBMIT) {
      formFocus.value = FORM_ZONE.LANG;
      return;
    }
    return;
  }
  if (dir === 'right') {
    if (formFocus.value === FORM_ZONE.COLOR) {
      cycleColor(1);
      return;
    }
    if (formFocus.value === FORM_ZONE.LANG) {
      cycleLocale(1);
      return;
    }
    if (formFocus.value === FORM_ZONE.PSEUDO) {
      formFocus.value = FORM_ZONE.COLOR;
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
    if (formFocus.value === FORM_ZONE.PSEUDO) {
      await nextTick();
      await focusTextInputForEdit(nameInput.value);
      return;
    }
    // Sur palette / drapeaux / valider : A soumet (choix déjà appliqué)
    if (
      formFocus.value === FORM_ZONE.COLOR ||
      formFocus.value === FORM_ZONE.LANG ||
      formFocus.value === FORM_ZONE.SUBMIT
    ) {
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
  cycleLocale,
  setLocaleFlag,
  flagSrc,
  phase,
  formFocus,
  selectedColor,
  selectedLocale,
  FORM_ZONE,
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
            :class="{ 'is-focused': formFocus === FORM_ZONE.PSEUDO }"
            @focus="formFocus = FORM_ZONE.PSEUDO"
          />
        </label>

        <div
          class="profiles__colors"
          role="listbox"
          :aria-label="t('profiles.colorAria')"
        >
          <button
            v-for="c in colorOptions"
            :key="c"
            type="button"
            class="color-swatch"
            role="option"
            :aria-selected="selectedColor === c"
            :class="{
              'is-active': selectedColor === c,
              'is-focused':
                formFocus === FORM_ZONE.COLOR && selectedColor === c,
            }"
            :style="{ '--swatch': c }"
            :aria-label="t('profiles.colorNamed', { color: c })"
            @click="setColor(c)"
          />
        </div>

        <div
          class="profiles__locales"
          role="listbox"
          :aria-label="t('profiles.langAria')"
        >
          <button
            v-for="loc in localeOptions"
            :key="loc"
            type="button"
            class="locale-flag"
            role="option"
            :aria-selected="selectedLocale === loc"
            :class="{
              'is-active': selectedLocale === loc,
              'is-focused':
                formFocus === FORM_ZONE.LANG && selectedLocale === loc,
            }"
            :aria-label="t(`lang.${loc}`)"
            :title="t(`lang.${loc}`)"
            @click="setLocaleFlag(loc)"
          >
            <img
              class="locale-flag__face"
              :src="flagSrc(loc)"
              alt=""
              width="32"
              height="21"
              draggable="false"
            />
            <span class="locale-flag__code">{{ loc.toUpperCase() }}</span>
          </button>
        </div>

        <button
          type="submit"
          class="btn-primary"
          :class="{ 'is-focused': formFocus === FORM_ZONE.SUBMIT }"
          :disabled="creating"
          @focus="formFocus = FORM_ZONE.SUBMIT"
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

/* Focus gamepad uniquement via .is-focused — pas de double ring :focus-visible */
.profiles__create input:focus,
.profiles__create input:focus-visible {
  outline: none;
  border-color: var(--border);
  box-shadow: none;
}

.profiles__create input.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.profiles__colors,
.profiles__locales {
  flex: 0 0 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.35rem;
  border-radius: 999px;
  border: 1px solid transparent;
  /* Pas de ring sur le conteneur : focus = pastille / drapeau is-focused */
  box-shadow: none;
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
    box-shadow 140ms var(--ease-soft),
    border-color 140ms var(--ease-soft);
}

/* Sélection ≠ focus : check subtil (bord paper), sans glow brass */
.color-swatch.is-active {
  border-color: color-mix(in srgb, var(--paper) 85%, transparent);
  transform: scale(1.06);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink-950) 35%, transparent);
}

.color-swatch.is-focused {
  box-shadow: 0 0 0 2px var(--ink-950), 0 0 0 5px var(--brass-bright);
  border-color: var(--brass-bright);
  transform: scale(1.1);
}

.color-swatch.is-active.is-focused {
  box-shadow: 0 0 0 2px var(--ink-950), 0 0 0 5px var(--brass-bright);
}

.locale-flag {
  appearance: none;
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.35rem;
  border: none;
  background: transparent;
  color: var(--paper-dim);
  cursor: pointer;
  border-radius: 4px;
  transition:
    transform 140ms var(--ease-soft),
    color 140ms var(--ease-soft),
    box-shadow 140ms var(--ease-soft);
}

.locale-flag__face {
  display: block;
  width: 1.85rem;
  height: 1.2rem;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--paper) 28%, transparent);
  box-sizing: border-box;
  background: color-mix(in srgb, var(--ink-800) 40%, transparent);
}

.locale-flag__code {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}

/* Langue active : check / scale subtil, pas d’anneau brass */
.locale-flag.is-active {
  color: var(--paper);
  transform: scale(1.05);
}

.locale-flag.is-active .locale-flag__face {
  border-color: color-mix(in srgb, var(--paper) 70%, transparent);
  box-shadow: none;
}

.locale-flag.is-active::after {
  content: '✓';
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1;
  color: var(--paper-dim);
}

.locale-flag.is-focused {
  color: var(--paper);
  box-shadow: 0 0 0 2px var(--ink-950), 0 0 0 5px var(--brass-bright);
  transform: scale(1.08);
}

.locale-flag.is-focused .locale-flag__face {
  border-color: var(--brass-bright);
}

.profiles__create .btn-primary:focus,
.profiles__create .btn-primary:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: var(--brass);
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
  .locale-flag,
  .profiles__preview-disk {
    transition: none;
  }

  .profiles__logo {
    filter: none;
  }
}
</style>
