<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import { useProfilesStore } from '../stores/profiles';
import { useUiStore } from '../stores/ui';
import { markProfileSelected } from '../router';

const router = useRouter();
const profiles = useProfilesStore();
const ui = useUiStore();

const newName = ref('');
const creating = ref(false);

const hints = [
  { key: '↑↓', label: 'naviguer' },
  { key: 'A', label: 'choisir' },
];

const focused = computed(() =>
  Math.min(profiles.focusIndex, Math.max(0, profiles.profiles.length - 1)),
);

onMounted(async () => {
  await profiles.refresh();
  const idx = profiles.profiles.findIndex((p) => p.id === profiles.activeProfileId);
  profiles.setFocus(idx >= 0 ? idx : 0);
  ui.setRouteName('profiles');
});

async function choose(index) {
  profiles.setFocus(index);
  const p = profiles.profiles[index];
  if (!p) return;
  await profiles.select(p.id);
  markProfileSelected();
  router.replace({ name: 'boot' });
}

async function addProfile() {
  creating.value = true;
  try {
    const name = newName.value.trim() || `Lecteur ${profiles.profiles.length + 1}`;
    const color = profiles.colors[profiles.profiles.length % profiles.colors.length];
    const created = await profiles.create(name, color);
    newName.value = '';
    const idx = profiles.profiles.findIndex((p) => p.id === created.id);
    if (idx >= 0) await choose(idx);
  } finally {
    creating.value = false;
  }
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
        Progression, signets et préférences restent locaux à chaque profil.
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
        <span class="avatar__disk" :style="{ background: p.color }">
          {{ p.name.slice(0, 1).toUpperCase() }}
        </span>
        <span class="avatar__name">{{ p.name }}</span>
      </button>
    </div>

    <form class="profiles__create" @submit.prevent="addProfile">
      <label>
        Nouveau profil
        <input v-model="newName" type="text" maxlength="32" placeholder="Nom" />
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
  gap: 1.25rem;
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
    radial-gradient(ellipse at 80% 80%, color-mix(in srgb, var(--ink-soft) 40%, transparent), transparent 50%);
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
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  color: var(--brass-bright);
  letter-spacing: -0.02em;
}

.profiles__head h1 {
  margin: 0.35rem 0 0.25rem;
  font-family: var(--font-display);
  font-size: 1.45rem;
}

.lead {
  margin: 0;
  color: var(--paper-dim);
  max-width: 28ch;
}

.profiles__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  flex: 1;
  align-content: start;
  overflow: auto;
}

.avatar {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  padding: 1rem 0.75rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--paper);
  cursor: pointer;
  border-radius: 4px;
}

.avatar.is-focused {
  border-color: var(--brass-bright);
  background: color-mix(in srgb, var(--brass) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass-bright) 40%, transparent);
}

.avatar__disk {
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.6rem;
  color: #1a1510;
}

.avatar__name {
  font-size: 0.95rem;
  text-align: center;
}

.profiles__create {
  display: grid;
  gap: 0.5rem;
}

.profiles__create label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--paper-dim);
}

.profiles__create input {
  background: color-mix(in srgb, var(--ink-soft) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--paper) 18%, transparent);
  color: var(--paper);
  padding: 0.65rem 0.75rem;
  font: inherit;
  border-radius: 2px;
}

footer {
  margin-top: auto;
}
</style>
