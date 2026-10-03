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
    orientation: 'portrait-ccw',
    setupCompleted: false,
    configLoaded: false,
    keyBindings: resolveKeyBindings(null),
    userKeyBindings: null,
    listeningForBind: null, // { context, actionId } | null
    setupFocusIndex: 0,
    settingsFocusIndex: 0,
    importFocusIndex: 0,
    /** Feedback vibration manette (Ally). */
    hapticsEnabled: true,
    hapticsAvailable: false,
  }),
  getters: {
    isDark: (s) => s.theme !== 'light',
  },
  actions: {
    setRouteName(name) {
      this.routeName = name || 'boot';
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
    refreshGamepadHint() {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    applyTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
    },
    applyOrientation(orientation) {
      this.orientation =
        orientation === 'landscape' ? 'landscape' : 'portrait-ccw';
      document.documentElement.setAttribute('data-orientation', this.orientation);
    },
    async loadConfig() {
      const config = await window.vdr.getConfig();
      this.setupCompleted = Boolean(config.setupCompleted);
      this.language = config.language || 'fr';
      this.applyOrientation(config.orientation || 'portrait-ccw');
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
    /**
     * Persiste l’orientation, redimensionne la fenêtre Electron (via main)
     * et met à jour data-orientation pour les layouts responsives.
     */
    async setOrientation(orientation) {
      this.applyOrientation(orientation);
      await window.vdr.setConfig({ orientation: this.orientation });
    },
    async toggleOrientation() {
      await this.setOrientation(
        this.orientation === 'landscape' ? 'portrait-ccw' : 'landscape',
      );
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
      // Retirer l’ancienne clé pour cette action dans ce contexte
      const merged = { ...this.keyBindings[context] };
      for (const [k, v] of Object.entries(merged)) {
        if (v === actionId) delete current[context][k];
      }
      current[context][bindingKey] = actionId;
      // Nettoyer conflits : même touche → réassignée
      for (const [k, v] of Object.entries(current[context])) {
        if (k !== bindingKey && v === actionId) delete current[context][k];
      }
      // Aussi retirer la touche d’une autre action
      for (const [k, v] of Object.entries({ ...this.keyBindings[context], ...current[context] })) {
        if (k === bindingKey && v !== actionId) {
          // ok
        }
      }
      current[context][bindingKey] = actionId;
      await this.persistKeyBindings(current);
      this.stopListening();
    },
  },
});
