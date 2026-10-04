<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import AppBrandLogo from '../components/AppBrandLogo.vue';
import { useProfilesStore } from '../stores/profiles';
import { useUiStore } from '../stores/ui';
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

const newName = ref('');
const creating = ref(false);
/** pick = ronds · naming = saisie pseudo (création ou édition) */
const phase = ref('pick');
/** null = création · id = renommage */
const editingId = ref(null);
const nameInput = ref(null);
/** Focus dans le formulaire : 0 = input, 1 = valider */
const formFocus = ref(0);

/** Focus : 0..n-1 = profils, n = bouton + */
const totalSlots = computed(() => profiles.profiles.length + 1);
const focused = computed(() =>
  Math.min(profiles.focusIndex, Math.max(0, totalSlots.value - 1)),
);
const isAddFocused = computed(() => focused.value === profiles.profiles.length);
const isNaming = computed(() => phase.value === 'naming');
const formTitle = computed(() =>
  editingId.value != null ? 'Renommer le profil' : 'Nouveau profil',
);
const submitLabel = computed(() =>
  editingId.value != null ? 'Enregistrer' : 'Créer',
);

const hints = computed(() => {
  if (isNaming.value) {
    return [
      { key: '←→', label: 'champ / valider' },
      { key: 'A', label: formFocus.value === 1 ? 'valider' : 'clavier' },
      { key: 'B', label: 'annuler' },
      { key: '⏎', label: 'valider' },
    ];
  }
  return [
    { key: '←→', label: 'naviguer' },
    { key: 'A', label: 'choisir' },
    { key: 'Y', label: 'renommer' },
    { key: '+', label: 'créer' },
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

onMounted(async () => {
  window.addEventListener('vdr-profile-rename', onRenameEvent);
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

function openCreate() {
  editingId.value = null;
  newName.value = '';
  phase.value = 'naming';
  formFocus.value = 0;
  profiles.setFocus(profiles.profiles.length);
}

function openRename(index) {
  const p = profiles.profiles[index];
  if (!p) return;
  editingId.value = p.id;
  newName.value = p.name || '';
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
  await afterSelect();
}

async function submitName() {
  creating.value = true;
  try {
    const name =
      newName.value.trim() ||
      (editingId.value != null
        ? profiles.profiles.find((p) => p.id === editingId.value)?.name
        : null) ||
      `Lecteur ${profiles.profiles.length + 1}`;

    if (editingId.value != null) {
      await profiles.update(editingId.value, { name });
      phase.value = 'pick';
      editingId.value = null;
      newName.value = '';
      return;
    }

    const color = profiles.colors[profiles.profiles.length % profiles.colors.length];
    const created = await profiles.create(name, color);
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

/** API manette / tests */
function moveFormFocus(delta) {
  formFocus.value = delta < 0 ? 0 : 1;
}

async function activateFocused() {
  if (isNaming.value) {
    if (formFocus.value === 0) {
      await nextTick();
      await focusTextInputForEdit(nameInput.value);
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
  phase,
});
</script>

<template>
  <section class="profiles" aria-label="Choix du profil">
    <div class="profiles__atmosphere" aria-hidden="true">
      <div class="profiles__wash" />
      <div class="profiles__vignette" />
    </div>

    <div class="profiles__stage">
      <header class="profiles__brand">
        <AppBrandLogo size="hero" class="profiles__logo" />
        <p class="profiles__prompt">Qui lit ?</p>
      </header>

      <div
        class="profiles__grid"
        role="list"
        :aria-hidden="isNaming ? 'true' : undefined"
      >
        <button
          v-for="(p, index) in profiles.profiles"
          :key="p.id"
          type="button"
          class="avatar"
          :class="{ 'is-focused': !isNaming && index === focused }"
          role="listitem"
          @click="choose(index)"
        >
          <span
            class="avatar__disk"
            :style="{
              background: p.avatarPath
                ? `center / cover url(${p.avatarPath})`
                : p.color,
            }"
          >
            <template v-if="!p.avatarPath">{{ (p.name || '?').slice(0, 1).toUpperCase() }}</template>
          </span>
          <span class="avatar__name">{{ p.name }}</span>
        </button>

        <button
          type="button"
          class="avatar avatar--add"
          :class="{ 'is-focused': !isNaming && isAddFocused }"
          role="listitem"
          aria-label="Ajouter un profil"
          @click="onAddClick"
        >
          <span class="avatar__disk avatar__disk--add">+</span>
          <span class="avatar__name">Ajouter</span>
        </button>
      </div>

      <form
        v-if="isNaming"
        class="profiles__create"
        @submit.prevent="submitName"
      >
        <label>
          {{ formTitle }}
          <input
            ref="nameInput"
            v-model="newName"
            type="text"
            maxlength="32"
            placeholder="Pseudo"
            autocomplete="off"
            enterkeyhint="done"
            inputmode="text"
            :class="{ 'is-focused': formFocus === 0 }"
            @focus="formFocus = 0"
          />
        </label>
        <button
          type="submit"
          class="btn-primary"
          :class="{ 'is-focused': formFocus === 1 }"
          :disabled="creating"
          @focus="formFocus = 1"
        >
          {{ submitLabel }}
        </button>
        <button type="button" class="ghost" @click="cancelNaming">Annuler</button>
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
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.35rem 1.85rem;
  width: 100%;
  max-width: 52rem;
  min-height: 0;
  max-height: min(42vh, 22rem);
  align-content: center;
  overflow: auto;
  overflow-x: hidden;
  padding: 0.35rem 0.5rem;
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
  border-radius: 999px;
  transition: transform 180ms var(--ease-out);
}

.avatar.is-focused {
  transform: translateY(-4px) scale(1.04);
}

.avatar.is-focused .avatar__disk {
  box-shadow: 0 0 0 3px var(--ink-950), 0 0 0 6px var(--brass-bright);
}

.avatar__disk {
  width: 5.25rem;
  height: 5.25rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 2rem;
  color: #0e1419;
  border: 2px solid color-mix(in srgb, var(--paper) 20%, transparent);
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
  .avatar {
    transition: none;
  }

  .profiles__logo {
    filter: none;
  }
}
</style>
