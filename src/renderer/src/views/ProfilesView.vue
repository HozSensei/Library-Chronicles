<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useProfilesStore } from '../stores/profiles';
import { useUiStore } from '../stores/ui';
import {
  markProfileSelected,
  clearSetupGate,
  ensureSetupGate,
} from '../router';

const router = useRouter();
const profiles = useProfilesStore();
const ui = useUiStore();

const newName = ref('');
const creating = ref(false);
const showCreate = ref(false);

/** Focus : 0..n-1 = profils, n = bouton + */
const totalSlots = computed(() => profiles.profiles.length + 1);
const focused = computed(() =>
  Math.min(profiles.focusIndex, Math.max(0, totalSlots.value - 1)),
);
const isAddFocused = computed(() => focused.value === profiles.profiles.length);

const hints = [
  { key: '←→', label: 'naviguer' },
  { key: 'A', label: 'choisir / créer' },
];

onMounted(async () => {
  await ui.exitReaderMode();
  await profiles.refresh();
  const idx = profiles.profiles.findIndex((p) => p.id === profiles.activeProfileId);
  profiles.setFocus(idx >= 0 ? idx : 0);
  ui.setRouteName('profiles');
  // Si aucun profil, focus sur +
  if (!profiles.profiles.length) {
    profiles.setFocus(0);
    showCreate.value = true;
  }
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

async function choose(index) {
  if (index >= profiles.profiles.length) {
    showCreate.value = true;
    profiles.setFocus(profiles.profiles.length);
    return;
  }
  profiles.setFocus(index);
  const p = profiles.profiles[index];
  if (!p) return;
  await profiles.select(p.id);
  ui.applyTheme((await window.vdr.profiles.getPrefs(p.id))?.theme || 'dark');
  await afterSelect();
}

async function addProfile() {
  creating.value = true;
  try {
    const name = newName.value.trim() || `Lecteur ${profiles.profiles.length + 1}`;
    const color = profiles.colors[profiles.profiles.length % profiles.colors.length];
    const created = await profiles.create(name, color);
    newName.value = '';
    showCreate.value = false;
    await profiles.select(created.id);
    await afterSelect();
  } finally {
    creating.value = false;
  }
}

function onAddClick() {
  showCreate.value = true;
  profiles.setFocus(profiles.profiles.length);
}
</script>

<template>
  <section class="profiles" aria-label="Choix du profil">
    <div class="profiles__atmosphere" aria-hidden="true">
      <div class="profiles__wash" />
    </div>

    <header class="profiles__head">
      <p class="profiles__brand">Vertical Deck Reader</p>
      <h1>Qui lit ?</h1>
      <p class="lead">
        Chaque profil a sa bibliothèque, ses dossiers et ses préférences.
      </p>
    </header>

    <div class="profiles__grid" role="list">
      <button
        v-for="(p, index) in profiles.profiles"
        :key="p.id"
        type="button"
        class="avatar"
        :class="{ 'is-focused': index === focused }"
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
        :class="{ 'is-focused': isAddFocused }"
        role="listitem"
        aria-label="Ajouter un profil"
        @click="onAddClick"
      >
        <span class="avatar__disk avatar__disk--add">+</span>
        <span class="avatar__name">Ajouter</span>
      </button>
    </div>

    <form
      v-if="showCreate || !profiles.profiles.length"
      class="profiles__create"
      @submit.prevent="addProfile"
    >
      <label>
        Nouveau profil
        <input
          v-model="newName"
          type="text"
          maxlength="32"
          placeholder="Pseudo"
          autofocus
        />
      </label>
      <button type="submit" class="ghost" :disabled="creating">Créer</button>
    </form>

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
  gap: 1.5rem;
  overflow: hidden;
}

.profiles__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.profiles__wash {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--brass) 22%, transparent), transparent 55%),
    radial-gradient(ellipse at 80% 80%, color-mix(in srgb, var(--ink-soft, var(--ink-800)) 40%, transparent), transparent 50%);
}

.profiles__head,
.profiles__grid,
.profiles__create,
footer {
  position: relative;
  z-index: 1;
}

.profiles__brand {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.8rem, 5vw, 2.6rem);
  color: var(--brass-bright);
  letter-spacing: -0.02em;
}

.profiles__head h1 {
  margin: 0.35rem 0 0.25rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2rem);
}

.lead {
  margin: 0;
  color: var(--paper-dim);
  max-width: 36ch;
}

.profiles__grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem 2rem;
  flex: 1;
  align-content: center;
  overflow: auto;
  padding: 1rem 0;
}

.avatar {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
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
  width: 5.5rem;
  height: 5.5rem;
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
  font-size: 1rem;
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
  margin: 0 auto;
  width: 100%;
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
}

footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .avatar {
    transition: none;
  }
}
</style>
