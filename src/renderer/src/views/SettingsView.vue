<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import { useUiStore } from '../stores/ui';
import { useProfilesStore } from '../stores/profiles';
import {
  BINDABLE_ACTIONS,
  labelForBindingKey,
} from '../../../shared/key-bindings.js';
import { clearProfileSelected } from '../router';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';

const router = useRouter();
const ui = useUiStore();
const profiles = useProfilesStore();

const section = ref('general'); // general | profiles | bindings | api
const context = ref('reader');
const apiKeyInput = ref('');
const apiStatus = ref('');
const newProfileName = ref('');
const profileMsg = ref('');
const providers = ref([]);
const activeProvider = ref('stub');

const sections = [
  { id: 'general', label: 'Général' },
  { id: 'profiles', label: 'Profils' },
  { id: 'bindings', label: 'Manette' },
  { id: 'api', label: 'API métadonnées' },
];

const actions = computed(() => BINDABLE_ACTIONS[context.value] || []);

const selectedProvider = computed(
  () => providers.value.find((p) => p.id === activeProvider.value) || null,
);

function keysForAction(actionId) {
  const map = ui.keyBindings[context.value] || {};
  return Object.entries(map)
    .filter(([, v]) => v === actionId)
    .map(([k]) => labelForBindingKey(k));
}

async function refreshProviders() {
  const data = await window.vdr.metadata.listProviders();
  providers.value = data.providers || [];
  activeProvider.value = data.activeProvider || 'stub';
  syncApiStatus();
}

function syncApiStatus() {
  const p = selectedProvider.value;
  if (!p) {
    apiStatus.value = '';
    return;
  }
  if (!p.requiresApiKey) {
    apiStatus.value = `${p.label} — ${p.freeLabel}`;
    return;
  }
  apiStatus.value = p.hasKey
    ? `Clé ${p.label} enregistrée`
    : `Aucune clé ${p.label}`;
}

onMounted(async () => {
  await ui.loadConfig();
  await profiles.refresh();
  await refreshProviders();
  ui.setSettingsFocus(0);
  nextTick(() => scheduleScrollFocusedIntoView('.settings'));
});

watch(
  () => [ui.settingsFocusIndex, section.value],
  () => nextTick(() => scheduleScrollFocusedIntoView('.settings')),
);

async function toggleTheme() {
  await ui.setTheme(ui.theme === 'dark' ? 'light' : 'dark');
}

async function toggleHaptics() {
  await ui.setHapticsEnabled(!ui.hapticsEnabled);
}

const hapticsSubtitle = computed(() => {
  if (!ui.hapticsEnabled) return 'Désactivé';
  if (!ui.hapticsAvailable) return 'Activé · matériel non détecté (no-op)';
  return 'Activé · rumble Ally / gamepad';
});

async function selectProvider(id) {
  await window.vdr.metadata.setProvider(id);
  activeProvider.value = id;
  apiKeyInput.value = '';
  await refreshProviders();
}

async function saveApiKey() {
  const p = selectedProvider.value;
  if (!p?.requiresApiKey) return;
  await window.vdr.metadata.setApiKey(p.id, apiKeyInput.value);
  apiKeyInput.value = '';
  await refreshProviders();
}

async function clearApiKey() {
  const p = selectedProvider.value;
  if (!p?.requiresApiKey) return;
  await window.vdr.metadata.setApiKey(p.id, '');
  await refreshProviders();
}

async function openProviderHelp(provider) {
  if (!provider?.helpUrl) return;
  await window.vdr.metadata.openHelp({
    provider: provider.id,
    url: provider.helpUrl,
  });
}

function startRebind(actionId) {
  ui.startListening(context.value, actionId);
}

async function createProfile() {
  const name = newProfileName.value.trim() || `Lecteur ${profiles.profiles.length + 1}`;
  await profiles.create(name);
  newProfileName.value = '';
  profileMsg.value = 'Profil créé';
}

async function activateProfile(id) {
  await profiles.select(id);
  profileMsg.value = 'Profil actif mis à jour';
}

async function removeProfile(id) {
  const result = await profiles.remove(id);
  profileMsg.value = result.ok ? 'Profil supprimé' : result.error || 'Échec';
}

function openProfilePicker() {
  clearProfileSelected();
  router.push({ name: 'profiles', query: { manage: '1' } });
}

const listeningLabel = computed(() => {
  if (!ui.listeningForBind) return null;
  return `Appuie sur une touche pour « ${ui.listeningForBind.actionId} »…`;
});
</script>

<template>
  <section class="settings">
    <header>
      <p class="brand">Vertical Deck Reader</p>
      <h1>Paramètres</h1>
      <p class="lead">
        Thème, profils, haptics, remapping manette, providers métadonnées.
        Orientation automatique : paysage (menus) → portrait (lecture).
      </p>
    </header>

    <nav class="tabs" aria-label="Sections">
      <button
        v-for="s in sections"
        :key="s.id"
        type="button"
        class="tab"
        :class="{ 'is-active': section === s.id }"
        @click="section = s.id"
      >
        {{ s.label }}
      </button>
    </nav>

    <div class="body">
      <template v-if="section === 'general'">
        <p class="hint">
          Orientation : <strong>automatique</strong> — menus en paysage (1920×1080),
          lecture en portrait Ally (1080×1920 + remap manette).
        </p>
        <FocusButton
          :focused="ui.settingsFocusIndex === 0"
          :subtitle="ui.theme === 'dark' ? 'Sombre actif' : 'Clair actif'"
          @select="toggleTheme"
        >
          Basculer thème
        </FocusButton>
        <FocusButton
          :focused="ui.settingsFocusIndex === 1"
          :subtitle="hapticsSubtitle"
          @select="toggleHaptics"
        >
          Vibrations manette
        </FocusButton>
      </template>

      <template v-else-if="section === 'profiles'">
        <p class="hint">
          Actif :
          <strong>{{ profiles.activeProfile?.name || '—' }}</strong>
          — progression / signets / filtres sont locaux à ce profil.
        </p>
        <p v-if="profileMsg" class="api-status">{{ profileMsg }}</p>
        <ul class="profile-list">
          <li v-for="p in profiles.profiles" :key="p.id">
            <span class="profile-dot" :style="{ background: p.color }" />
            <span class="profile-name">{{ p.name }}</span>
            <button
              v-if="p.id !== profiles.activeProfileId"
              type="button"
              class="ghost"
              @click="activateProfile(p.id)"
            >
              Activer
            </button>
            <button type="button" class="ghost" @click="removeProfile(p.id)">Suppr.</button>
          </li>
        </ul>
        <div class="field">
          <label>Nouveau profil</label>
          <input
            v-model="newProfileName"
            type="text"
            maxlength="32"
            placeholder="Nom"
            inputmode="text"
            autocomplete="off"
          />
        </div>
        <div class="row">
          <button type="button" class="btn-primary" @click="createProfile">Créer</button>
          <button type="button" class="ghost" @click="openProfilePicker">Écran choix</button>
        </div>
      </template>

      <template v-else-if="section === 'bindings'">
        <p v-if="listeningLabel" class="listen">{{ listeningLabel }}</p>
        <div class="ctx">
          <button
            v-for="c in ['reader', 'library', 'book', 'boot', 'profiles', 'import', 'settings']"
            :key="c"
            type="button"
            class="chip"
            :class="{ 'is-active': context === c }"
            @click="context = c"
          >
            {{ c }}
          </button>
        </div>
        <div class="bind-list">
          <button
            v-for="(action, index) in actions"
            :key="action.id"
            type="button"
            class="bind-row"
            :class="{
              'is-focused': ui.settingsFocusIndex === index,
              'is-listening':
                ui.listeningForBind?.actionId === action.id &&
                ui.listeningForBind?.context === context,
            }"
            @click="startRebind(action.id)"
          >
            <span class="bind-row__label">{{ action.label }}</span>
            <span class="bind-row__keys">
              {{ keysForAction(action.id).join(' · ') || '—' }}
            </span>
          </button>
        </div>
        <button type="button" class="ghost" @click="ui.resetKeyBindings()">
          Réinitialiser mapping
        </button>
      </template>

      <template v-else>
        <p class="hint">
          Choisis un provider pour l’enrichissement à l’import. Offline : stub + édition manuelle.
        </p>

        <div class="provider-list" role="listbox" aria-label="Providers métadonnées">
          <button
            v-for="p in providers"
            :key="p.id"
            type="button"
            class="provider-card"
            :class="{ 'is-active': p.id === activeProvider }"
            role="option"
            :aria-selected="p.id === activeProvider"
            @click="selectProvider(p.id)"
          >
            <span class="provider-card__label">{{ p.label }}</span>
            <span
              class="provider-card__badge"
              :class="p.requiresApiKey ? 'is-key' : 'is-free'"
            >
              {{ p.freeLabel }}
            </span>
          </button>
        </div>

        <p class="api-status">{{ apiStatus }}</p>

        <template v-if="selectedProvider">
          <p v-if="selectedProvider.helpText" class="hint">{{ selectedProvider.helpText }}</p>
          <button
            v-if="selectedProvider.helpUrl"
            type="button"
            class="link-btn"
            @click="openProviderHelp(selectedProvider)"
          >
            {{ selectedProvider.helpLinkLabel || 'Documentation' }}
          </button>
        </template>

        <template v-if="selectedProvider?.requiresApiKey">
          <div class="field">
            <label>Clé {{ selectedProvider.label }}</label>
            <input
              v-model="apiKeyInput"
              type="password"
              autocomplete="off"
              inputmode="text"
              placeholder="Stockée localement (userData)"
            />
          </div>
          <div class="row">
            <button type="button" class="btn-primary" @click="saveApiKey">Enregistrer</button>
            <button type="button" class="ghost" @click="clearApiKey">Effacer</button>
          </div>
        </template>

        <p class="hint">
          Les secrets restent dans <code>userData/vdr-secrets.json</code> — jamais commités.
        </p>
      </template>
    </div>

    <footer>
      <button type="button" class="ghost" @click="router.push({ name: 'boot' })">Retour</button>
      <ControlHint
        :items="[
          { key: '↑↓', label: 'naviguer' },
          { key: '←→', label: 'section' },
          { key: 'A', label: 'modifier' },
          { key: 'B', label: 'retour' },
        ]"
      />
    </footer>
  </section>
</template>

<style scoped>
.settings {
  height: 100%;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  overflow-x: hidden;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse 70% 35% at 80% 0%, var(--wash-a), transparent 55%),
    var(--ink-950);
}

.brand {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--brass);
  font-size: 0.95rem;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2rem;
}

.lead {
  margin: 0.45rem 0 0;
  color: var(--paper-dim);
}

.tabs {
  display: flex;
  gap: 0.45rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
}

.tab {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--paper-dim);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition:
    border-color 160ms var(--ease-soft),
    background 160ms var(--ease-soft),
    color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft);
}

.tab.is-active {
  color: var(--paper);
  border-color: var(--brass);
  background: rgba(212, 163, 92, 0.12);
}

.tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overflow-x: hidden;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  animation: panel-in 280ms var(--ease-out);
}

.listen {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  background: rgba(212, 163, 92, 0.15);
  color: var(--brass-bright);
  animation: pulse 1.2s var(--ease-soft) infinite;
}

.ctx {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  appearance: none;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--paper-dim);
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.chip.is-active {
  border-color: var(--brass);
  color: var(--paper);
}

.bind-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bind-row {
  appearance: none;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
}

.bind-row.is-focused,
.bind-row.is-listening {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.bind-row__label {
  font-family: var(--font-display);
  font-weight: 700;
}

.bind-row__keys {
  color: var(--brass-bright);
  font-size: 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.api-status {
  margin: 0;
  color: var(--success);
}

.provider-list {
  display: grid;
  gap: 0.45rem;
}

.provider-card {
  appearance: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--paper);
  cursor: pointer;
}

.provider-card.is-active {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.provider-card__label {
  font-family: var(--font-display);
  font-weight: 700;
}

.provider-card__badge {
  font-size: 0.72rem;
  color: var(--paper-dim);
  white-space: nowrap;
}

.provider-card__badge.is-free {
  color: var(--success);
}

.provider-card__badge.is-key {
  color: var(--brass-bright);
}

.link-btn {
  appearance: none;
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--brass-bright);
  text-decoration: underline;
  text-underline-offset: 0.18em;
  padding: 0;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.row {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.hint {
  color: var(--paper-dim);
  font-size: 0.85rem;
  line-height: 1.4;
}

.profile-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.profile-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.profile-dot {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.profile-name {
  flex: 1;
  font-weight: 600;
}

.hint code {
  font-size: 0.8em;
}

.field {
  display: grid;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  color: var(--paper-dim);
}

.field input {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--paper);
  padding: 0.65rem 0.75rem;
  font: inherit;
  border-radius: var(--radius-sm);
}

.btn-primary {
  appearance: none;
  border: 1px solid var(--brass);
  background: color-mix(in srgb, var(--brass) 22%, transparent);
  color: var(--paper);
  padding: 0.55rem 0.9rem;
  font: inherit;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

footer {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  min-width: 0;
  max-width: 100%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .body {
    animation: none;
  }
  .listen {
    animation: none;
  }
}
</style>
