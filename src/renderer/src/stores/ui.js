import { defineStore } from 'pinia';
import { resolveKeyBindings } from '../../../shared/key-bindings.js';

export const useUiStore = defineStore('ui', {
  state: () => ({
    routeName: 'boot',
    gamepadLabel: 'Manette en attente…',
    gamepadConnected: false,
    bootFocusIndex: 0,
    reducedMotion: false,
    theme: 'dark',
    language: 'fr',
    /** Session : landscape (menus) ou portrait-ccw (lecteur). */
    orientation: 'landscape',
    /** Contexte manette dérivé : ui | reader */
    inputContext: 'ui',
    setupCompleted: false,
    configLoaded: false,
    keyBindings: resolveKeyBindings(null),
    userKeyBindings: null,
    listeningForBind: null,
    setupFocusIndex: 0,
    settingsFocusIndex: 0,
    importFocusIndex: 0,
    bookFocusIndex: 0,
    hapticsEnabled: true,
    hapticsAvailable: false,
  }),
  getters: {
    isDark: (s) => s.theme !== 'light',
    isReaderOrientation: (s) => s.orientation === 'portrait-ccw',
  },
  actions: {
    setRouteName(name) {
      this.routeName = name || 'boot';
      this.inputContext = name === 'reader' ? 'reader' : 'ui';
    },
    setHapticsAvailable(available) {
      this.hapticsAvailable = Boolean(available);
    },
    async setHapticsEnabled(enabled) {
      this.hapticsEnabled = Boolean(enabled);
      await window.vdr.setConfig({ hapticsEnabled: this.hapticsEnabled });
    },
    setGamepadStatus({ connected, label }) {
      this.gamepadConnected = connected;
      this.gamepadLabel = label;
    },
    setBootFocus(index) {
      this.bootFocusIndex = index;
    },
    setSetupFocus(index) {
      this.setupFocusIndex = index;
    },
    setSettingsFocus(index) {
      this.settingsFocusIndex = index;
    },
    setImportFocus(index) {
      this.importFocusIndex = index;
    },
    setBookFocus(index) {
      this.bookFocusIndex = index;
    },
    refreshGamepadHint() {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    applyTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
    },
    applyOrientation(orientation) {
      this.orientation =
        orientation === 'portrait-ccw' ? 'portrait-ccw' : 'landscape';
      document.documentElement.setAttribute('data-orientation', this.orientation);
    },
    /**
     * Bascule fenêtre Electron + remap manette.
     * Resize uniquement si orientation change (main) — sauf opts.force.
     * @param {'ui'|'reader'} mode
     * @param {{ force?: boolean }} [opts]
     */
    async setSessionMode(mode, opts = {}) {
      const next = mode === 'reader' ? 'reader' : 'ui';
      const result = await window.vdr.setSessionMode(next, opts);
      const orientation =
        result?.orientation || (next === 'reader' ? 'portrait-ccw' : 'landscape');
      this.applyOrientation(orientation);
      this.inputContext = next === 'reader' ? 'reader' : 'ui';
      return result;
    },
    async enterReaderMode() {
      return this.setSessionMode('reader');
    },
    /** Retour menus — resize seulement si on quitte vraiment le portrait. */
    async exitReaderMode(opts = {}) {
      return this.setSessionMode('ui', opts);
    },
    async loadConfig() {
      const config = await window.vdr.getConfig();
      this.setupCompleted = Boolean(config.setupCompleted);
      this.language = config.language || 'fr';
      // Menus = landscape TOUJOURS au load — portrait uniquement si déjà sur lecteur
      // (évite le bug : config.orientation portrait-ccw → menus remappés)
      const orientation =
        this.routeName === 'reader' ? 'portrait-ccw' : 'landscape';
      this.applyOrientation(orientation);
      this.inputContext = this.routeName === 'reader' ? 'reader' : 'ui';
      this.userKeyBindings = config.keyBindings || null;
      this.keyBindings = resolveKeyBindings(this.userKeyBindings);
      this.hapticsEnabled = config.hapticsEnabled !== false;
      this.applyTheme(config.theme || 'dark');
      this.configLoaded = true;
      return config;
    },
    async setTheme(theme) {
      this.applyTheme(theme);
      await window.vdr.setConfig({ theme: this.theme });
    },
    async persistKeyBindings(userBindings) {
      this.userKeyBindings = userBindings;
      this.keyBindings = resolveKeyBindings(userBindings);
      await window.vdr.setConfig({ keyBindings: userBindings });
    },
    async resetKeyBindings() {
      await this.persistKeyBindings(null);
    },
    startListening(context, actionId) {
      this.listeningForBind = { context, actionId };
    },
    stopListening() {
      this.listeningForBind = null;
    },
    async applyCapturedBind(bindingKey) {
      if (!this.listeningForBind) return;
      const { context, actionId } = this.listeningForBind;
      const current = {
        ...(this.userKeyBindings || {}),
        [context]: { ...(this.userKeyBindings?.[context] || {}) },
      };
      const merged = { ...this.keyBindings[context] };
      for (const [k, v] of Object.entries(merged)) {
        if (v === actionId) delete current[context][k];
      }
      current[context][bindingKey] = actionId;
      for (const [k, v] of Object.entries(current[context])) {
        if (k !== bindingKey && v === actionId) delete current[context][k];
      }
      current[context][bindingKey] = actionId;
      await this.persistKeyBindings(current);
      this.stopListening();
    },
  },
});
