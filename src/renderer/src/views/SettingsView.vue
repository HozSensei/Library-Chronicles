<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ControlHint from '../components/ControlHint.vue';
import FocusButton from '../components/FocusButton.vue';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../composables/useI18n';
import { useProfilesStore } from '../stores/profiles';
import { useToastStore } from '../stores/toast';
import {
  BINDABLE_ACTIONS,
  REMAP_UI_CONTEXT,
  labelForBindingKey,
} from '../../../shared/key-bindings.js';
import { clearProfileSelected } from '../router';
import { scheduleScrollFocusedIntoView } from '../../../shared/focus-scroll.js';
import {
  ACCENTS,
  accentLabel,
} from '../../../shared/theme-accents.js';

const router = useRouter();
const ui = useUiStore();
const profiles = useProfilesStore();
const toast = useToastStore();
const { t } = useI18n();

const section = ref('general'); // general | profiles | bindings | api
const apiKeyInput = ref('');
const apiStatus = ref('');
const newProfileName = ref('');
const profileMsg = ref('');
const providers = ref([]);
const activeProvider = ref('stub');
/** id du provider en cours de test (null si idle) — permet un état « Test… » par ligne */
const testingProviderId = ref(null);
const accents = ACCENTS;

function providerCanTest(p) {
  if (!p) return false;
  if (typeof p.canTest === 'boolean') return p.canTest;
  return p.id !== 'stub';
}

const sections = computed(() => [
  { id: 'general', label: t('settings.tabGeneral') },
  { id: 'profiles', label: t('settings.tabProfiles') },
  { id: 'bindings', label: t('settings.tabBindings') },
  { id: 'api', label: t('settings.tabApi') },
]);

/** Remap UI = lecture uniquement. */
const context = REMAP_UI_CONTEXT;
const actions = computed(() =>
  (BINDABLE_ACTIONS[context] || []).map((a) => {
    const translated = t(`bind.${a.id}`);
    return { ...a, label: translated === `bind.${a.id}` ? a.label : translated };
  }),
);

const selectedProvider = computed(
  () => providers.value.find((p) => p.id === activeProvider.value) || null,
);

function keysForAction(actionId) {
  const map = ui.keyBindings[context] || {};
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
  if (p.configuredOk) {
    apiStatus.value = t('settings.testOk', { label: p.label });
    return;
  }
  if (!p.requiresApiKey) {
    apiStatus.value = `${p.label} — ${p.freeLabel}`;
    return;
  }
  apiStatus.value = p.hasKey
    ? t('settings.keySaved', { label: p.label })
    : t('settings.keyMissing', { label: p.label });
}

function syncSettingsFocusClass() {
  const items = document.querySelectorAll('.settings [data-settings-item]');
  items.forEach((el, i) => {
    el.classList.toggle('is-focused', i === ui.settingsFocusIndex);
  });
  scheduleScrollFocusedIntoView('.settings');
}

onMounted(async () => {
  await ui.loadConfig();
  await profiles.refresh();
  await refreshProviders();
  ui.setSettingsFocus(0);
  nextTick(syncSettingsFocusClass);
});

watch(
  () => [
    ui.settingsFocusIndex,
    section.value,
    activeProvider.value,
    providers.value.length,
    actions.value.length,
    profiles.profiles.length,
  ],
  () => nextTick(syncSettingsFocusClass),
);

watch(section, () => {
  ui.setSettingsFocus(0);
});

async function setTheme(theme) {
  await ui.setTheme(theme);
}

async function setAccent(accent) {
  await ui.setAccent(accent);
}

/** Accent au focus (←→). Thème idem, sans écraser au reset focus (onglet / mount). */
watch(
  () => [ui.settingsFocusIndex, section.value],
  (curr, prev) => {
    if (section.value !== 'general') return;
    const idx = ui.settingsFocusIndex;
    const accentOffset = idx - 2;
    if (accentOffset >= 0 && accentOffset < accents.length) {
      const id = accents[accentOffset].id;
      if (id !== ui.accent) void setAccent(id);
      return;
    }
    if (idx !== 0 && idx !== 1) return;
    // Mount ou changement d’onglet (focus forcé à 0) : ne pas écraser le thème.
    if (!prev) return;
    const [prevIdx, prevSec] = prev;
    if (prevSec !== 'general' || prevIdx === idx) return;
    if (idx === 0 && ui.theme !== 'dark') void setTheme('dark');
    if (idx === 1 && ui.theme !== 'light') void setTheme('light');
  },
);

async function toggleHaptics() {
  await ui.setHapticsEnabled(!ui.hapticsEnabled);
}

function generalFocusIndex(kind, id) {
  if (kind === 'theme-dark') return 0;
  if (kind === 'theme-light') return 1;
  if (kind === 'accent') {
    const i = accents.findIndex((a) => a.id === id);
    return i >= 0 ? 2 + i : 2;
  }
  if (kind === 'haptics') return 2 + accents.length;
  return 0;
}

const hapticsSubtitle = computed(() => {
  if (!ui.hapticsEnabled) return t('settings.hapticsOff');
  if (!ui.hapticsAvailable) return t('settings.hapticsOnNoHw');
  return t('settings.hapticsOn');
});

const controlHints = computed(() => [
  { key: '↑↓←→', label: t('settings.hintNav') },
  { key: 'LB/RB', label: t('settings.hintSection') },
  { key: 'A', label: t('settings.hintConfirm') },
  { key: 'B', label: t('settings.hintBack') },
]);

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

async function testProvider(target) {
  const p =
    typeof target === 'string'
      ? providers.value.find((x) => x.id === target)
      : target || selectedProvider.value;
  if (!p || !providerCanTest(p) || testingProviderId.value) return;

  // Activer le provider testé pour aligner statut / champs clé.
  if (p.id !== activeProvider.value) {
    await selectProvider(p.id);
  }

  if (p.requiresApiKey && !p.hasKey && !apiKeyInput.value.trim()) {
    toast.error(t('settings.testNeedKey', { label: p.label }));
    return;
  }
  // Si une clé est saisie mais pas encore enregistrée, l’enregistrer d’abord.
  if (p.requiresApiKey && apiKeyInput.value.trim()) {
    await window.vdr.metadata.setApiKey(p.id, apiKeyInput.value);
    apiKeyInput.value = '';
  }
  testingProviderId.value = p.id;
  try {
    const result = await window.vdr.metadata.testProvider(p.id);
    if (result?.providers) providers.value = result.providers;
    else await refreshProviders();
    syncApiStatus();
    if (result?.ok) {
      toast.success(t('toast.providerTestOk', { label: p.label }));
    } else {
      const detail = result?.error ? ` — ${result.error}` : '';
      toast.error(`${t('toast.providerTestFail', { label: p.label })}${detail}`);
    }
  } catch (err) {
    toast.error(
      `${t('toast.providerTestFail', { label: p.label })} — ${err?.message || err}`,
    );
  } finally {
    testingProviderId.value = null;
  }
}

/** @deprecated alias focus A / anciens handlers */
async function testSelectedProvider() {
  await testProvider(selectedProvider.value);
}

async function openProviderHelp(provider) {
  if (!provider?.helpUrl) return;
  await window.vdr.metadata.openHelp({
    provider: provider.id,
    url: provider.helpUrl,
  });
}

function startRebind(actionId) {
  ui.startListening(context, actionId);
}

async function resetReaderBindings() {
  await ui.resetKeyBindings();
}

async function createProfile() {
  const name = newProfileName.value.trim() || t('settings.defaultProfileName', { n: profiles.profiles.length + 1 });
  await profiles.create(name);
  newProfileName.value = '';
  profileMsg.value = t('settings.profileCreated');
}

async function activateProfile(id) {
  await profiles.select(id);
  profileMsg.value = t('settings.profileActive');
}

async function removeProfile(id) {
  const result = await profiles.remove(id);
  profileMsg.value = result.ok ? t('settings.profileDeleted') : result.error || t('settings.profileFail')
}

function openProfilePicker() {
  clearProfileSelected();
  router.push({ name: 'profiles', query: { manage: '1' } });
}

const listeningLabel = computed(() => {
  if (!ui.listeningForBind) return null;
  const actionId = ui.listeningForBind.actionId;
  const label = t(`bind.${actionId}`);
  return t('settings.listening', { action: label === `bind.${actionId}` ? actionId : label });
});
</script>

<template>
  <section class="settings">
    <header>
      <p class="brand">Library Chronicles</p>
      <h1>{{ t('settings.title') }}</h1>
      <p class="lead">{{ t('settings.lead') }}</p>
    </header>

    <nav class="tabs" :aria-label="t('settings.sectionsAria')">
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

    <div class="body shell-scroll">
      <div class="body-inner">
      <template v-if="section === 'general'">
        <p class="hint">{{ t('settings.generalHint') }}</p>

        <div class="choice-group">
          <p class="choice-group__label">{{ t('settings.mode') }}</p>
          <div class="choice-row">
            <FocusButton
              data-settings-item
              data-focus-row="theme"
              :focused="ui.settingsFocusIndex === generalFocusIndex('theme-dark')"
              :subtitle="ui.theme === 'dark' ? t('common.active') : ''"
              @select="setTheme('dark')"
            >
              {{ t('settings.dark') }}
            </FocusButton>
            <FocusButton
              data-settings-item
              data-focus-row="theme"
              :focused="ui.settingsFocusIndex === generalFocusIndex('theme-light')"
              :subtitle="ui.theme === 'light' ? t('common.active') : ''"
              @select="setTheme('light')"
            >
              {{ t('settings.light') }}
            </FocusButton>
          </div>
        </div>

        <div class="choice-group">
          <p class="choice-group__label">
            {{ t('settings.accent') }} · {{ accentLabel(ui.accent) }}
          </p>
          <div class="accent-row" role="listbox" :aria-label="t('settings.accent')">
            <button
              v-for="a in accents"
              :key="a.id"
              type="button"
              class="accent-swatch"
              data-settings-item
              data-focus-row="accent"
              role="option"
              :aria-selected="ui.accent === a.id"
              :class="{
                'is-focused': ui.settingsFocusIndex === generalFocusIndex('accent', a.id),
                'is-active': ui.accent === a.id,
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

        <FocusButton
          data-settings-item
          :focused="ui.settingsFocusIndex === generalFocusIndex('haptics')"
          :subtitle="hapticsSubtitle"
          @select="toggleHaptics"
        >
          {{ t('settings.haptics') }}
        </FocusButton>
      </template>

      <template v-else-if="section === 'profiles'">
        <p class="hint">{{ t('settings.profilesHint', { name: profiles.activeProfile?.name || '—' }) }}</p>
        <p class="hint">{{ t('settings.languageOnProfile') }}</p>
        <p v-if="profileMsg" class="api-status">{{ profileMsg }}</p>
        <ul class="profile-list">
          <li v-for="p in profiles.profiles" :key="p.id">
            <span class="profile-dot" :style="{ background: p.color }" />
            <span class="profile-name">{{ p.name }}</span>
            <button
              v-if="p.id !== profiles.activeProfileId"
              type="button"
              class="ghost"
              data-settings-item
              @click="activateProfile(p.id)"
            >
              {{ t('settings.activate') }}
            </button>
            <button type="button" class="ghost" data-settings-item @click="removeProfile(p.id)">
              {{ t('settings.delete') }}
            </button>
          </li>
        </ul>
        <div class="field">
          <label>{{ t('settings.newProfile') }}</label>
          <input
            v-model="newProfileName"
            type="text"
            maxlength="32"
            :placeholder="t('settings.namePlaceholder')"
            inputmode="text"
            autocomplete="off"
            data-settings-item
          />
        </div>
        <div class="row">
          <button type="button" class="btn-primary" data-settings-item @click="createProfile">
            {{ t('settings.create') }}
          </button>
          <button type="button" class="ghost" data-settings-item @click="openProfilePicker">
            {{ t('settings.picker') }}
          </button>
        </div>
      </template>

      <template v-else-if="section === 'bindings'">
        <p class="hint">{{ t('settings.bindingsHint') }}</p>
        <p v-if="listeningLabel" class="listen">{{ listeningLabel }}</p>
        <div class="bind-list">
          <button
            v-for="action in actions"
            :key="action.id"
            type="button"
            class="bind-row"
            data-settings-item
            :class="{
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
        <button
          type="button"
          class="btn-reset"
          data-settings-item
          @click="resetReaderBindings"
        >
          {{ t('settings.resetBindings') }}
        </button>
      </template>

      <template v-else>
        <p class="hint">{{ t('settings.apiHint') }}</p>

        <div class="provider-list" role="listbox" :aria-label="t('settings.providersAria')">
          <div
            v-for="p in providers"
            :key="p.id"
            class="provider-card"
            :class="{ 'is-active': p.id === activeProvider }"
          >
            <button
              type="button"
              class="provider-card__main"
              data-settings-item
              role="option"
              :aria-selected="p.id === activeProvider"
              @click="selectProvider(p.id)"
            >
              <span class="provider-card__label">
                <span
                  v-if="p.configuredOk"
                  class="provider-ok"
                  :aria-label="t('settings.configuredOk')"
                  :title="t('settings.configuredOk')"
                >✓</span>
                {{ p.label }}
              </span>
              <span
                class="provider-card__badge"
                :class="p.requiresApiKey ? 'is-key' : 'is-free'"
              >
                {{ p.freeLabel }}
              </span>
            </button>
            <button
              v-if="providerCanTest(p)"
              type="button"
              class="provider-card__test btn-primary"
              data-settings-item
              data-provider-test
              :disabled="testingProviderId === p.id"
              :aria-label="t('settings.testProvider') + ' — ' + p.label"
              @click="testProvider(p)"
            >
              {{
                testingProviderId === p.id
                  ? t('settings.testingProvider')
                  : t('settings.testProvider')
              }}
            </button>
          </div>
        </div>

        <p class="api-status" :class="{ 'is-ok': selectedProvider?.configuredOk }">{{ apiStatus }}</p>

        <template v-if="selectedProvider">
          <p v-if="selectedProvider.helpText" class="hint">{{ selectedProvider.helpText }}</p>
          <button
            v-if="selectedProvider.helpUrl"
            type="button"
            class="link-btn"
            data-settings-item
            @click="openProviderHelp(selectedProvider)"
          >
            {{ selectedProvider.helpLinkLabel || t('settings.docs') }}
          </button>
        </template>

        <template v-if="selectedProvider?.requiresApiKey">
          <div class="field">
            <label>{{ t('settings.keyLabel', { label: selectedProvider.label }) }}</label>
            <input
              v-model="apiKeyInput"
              type="password"
              autocomplete="off"
              inputmode="text"
              :placeholder="t('settings.keyPlaceholder')"
              data-settings-item
            />
          </div>
          <div class="row">
            <button type="button" class="btn-primary" data-settings-item @click="saveApiKey">
              {{ t('settings.saveKey') }}
            </button>
            <button type="button" class="ghost" data-settings-item @click="clearApiKey">
              {{ t('settings.clearKey') }}
            </button>
            <button
              v-if="providerCanTest(selectedProvider)"
              type="button"
              class="btn-primary"
              data-settings-item
              data-provider-test
              :disabled="testingProviderId === selectedProvider.id"
              @click="testSelectedProvider"
            >
              {{
                testingProviderId === selectedProvider.id
                  ? t('settings.testingProvider')
                  : t('settings.testProvider')
              }}
            </button>
          </div>
        </template>

        <div
          v-else-if="providerCanTest(selectedProvider)"
          class="row"
        >
          <button
            type="button"
            class="btn-primary"
            data-settings-item
            data-provider-test
            :disabled="testingProviderId === selectedProvider.id"
            @click="testSelectedProvider"
          >
            {{
              testingProviderId === selectedProvider.id
                ? t('settings.testingProvider')
                : t('settings.testProvider')
            }}
          </button>
        </div>

        <p class="hint">{{ t('settings.secretsHint') }}</p>
      </template>
      </div>
    </div>

    <footer>
      <button type="button" class="ghost" @click="router.push({ name: 'library' })">{{ t('common.back') }}</button>
      <ControlHint :items="controlHints" />
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
  padding: 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  overflow-x: hidden;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse 70% 35% at 80% 0%, var(--wash-a), transparent 55%),
    var(--ink-950);
}

.settings > header,
.settings > .tabs,
.settings > footer {
  padding-left: var(--pad);
  padding-right: var(--pad);
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
}

.settings > header {
  padding-top: var(--pad);
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
  font-weight: 800;
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
  font-family: var(--font-display);
  font-weight: 600;
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
  width: 100%;
  margin-top: 1rem;
}

.body-inner {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0 var(--pad) 0.5rem;
  box-sizing: border-box;
  max-width: 100%;
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

.btn-reset {
  appearance: none;
  align-self: flex-start;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--paper);
  border-radius: var(--radius-md);
  padding: 0.7rem 1rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn-reset.is-focused,
.btn-primary.is-focused,
.ghost.is-focused,
.link-btn.is-focused,
.field input.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  outline: none;
}

.api-status {
  margin: 0;
  color: var(--paper-dim);
}

.api-status.is-ok {
  color: var(--success);
}

.provider-list {
  display: grid;
  gap: 0.45rem;
}

.provider-card {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
}

.provider-card.is-active .provider-card__main {
  border-color: var(--brass);
  background: color-mix(in srgb, var(--brass) 10%, var(--surface));
}

.provider-card__main {
  appearance: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--paper);
  cursor: pointer;
}

.provider-card__main.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.provider-card__test {
  flex-shrink: 0;
  align-self: stretch;
  min-width: 5.5rem;
  padding: 0.55rem 0.75rem;
  font-weight: 700;
}

.provider-card__test.is-focused {
  border-color: var(--brass-bright);
  box-shadow: 0 0 0 3px var(--focus-glow);
  outline: none;
}

.provider-card__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-display);
  font-weight: 700;
}

.provider-ok {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success) 22%, transparent);
  color: var(--success);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
  flex-shrink: 0;
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

.btn-primary:disabled {
  opacity: 0.55;
  cursor: wait;
}

.link-btn {
  appearance: none;
  align-self: flex-start;
  border: 1px solid transparent;
  background: transparent;
  color: var(--brass-bright);
  text-decoration: underline;
  text-underline-offset: 0.18em;
  padding: 0.25rem 0.35rem;
  border-radius: var(--radius-sm);
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
  margin-top: 0.75rem;
  padding-bottom: var(--pad);
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
  .body-inner {
    animation: none;
  }
  .listen {
    animation: none;
  }
}

.choice-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.choice-group__label {
  margin: 0;
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

</style>
