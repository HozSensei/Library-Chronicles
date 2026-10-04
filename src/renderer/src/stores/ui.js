import { defineStore } from 'pinia';
import { resolveKeyBindings } from '../../../shared/key-bindings.js';
import {
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  normalizeAccent,
  normalizeTheme,
} from '../../../shared/theme-accents.js';
import { clampBookFocus } from '../../../shared/book-focus.js';
import {
  normalizeLocale,
  setLocale,
  t,
} from '../../../shared/i18n.js';

export const useUiStore = defineStore('ui', {
  state: () => ({
    routeName: 'boot',
    gamepadLabel: t('gamepad.waiting', null, 'fr'),
    gamepadConnected: false,
    bootFocusIndex: 0,
    reducedMotion: false,
    theme: DEFAULT_THEME,
    accent: DEFAULT_ACCENT,
    language: 'fr',
    /** Session : landscape (menus) ou portrait-ccw (lecteur). */
    orientation: 'landscape',
    /**
     * Stratégie B : fenêtre landscape fixe →
     * rotation CSS +90° du plan lecteur (Ally tenue CCW).
     */
    readerCssRotate: false,
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
    /**
     * Zone focus Import :
     * - list : fichiers
     * - header : bouton « Tout importer » (liste)
     * - fields / results : fiche détail
     */
    importFocusZone: 'list',
    bookFocusIndex: 0,
    /** Focus fiche série (tomes + CTA). */
    seriesFocusIndex: 0,
    hapticsEnabled: true,
    hapticsAvailable: false,
    /** Plein écran Electron (session lecteur) — pas persisté profil. */
    fullscreen: false,
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
    async setFullscreen(enabled) {
      try {
        const result = await window.vdr.setFullscreen(Boolean(enabled));
        this.fullscreen = Boolean(result?.fullscreen);
      } catch {
        this.fullscreen = Boolean(enabled);
      }
      return this.fullscreen;
    },
    async toggleFullscreen() {
      return this.setFullscreen(!this.fullscreen);
    },
    async syncFullscreen() {
      try {
        const result = await window.vdr.getFullscreen();
        this.fullscreen = Boolean(result?.fullscreen);
      } catch {
        this.fullscreen = false;
      }
      return this.fullscreen;
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
    setImportFocusZone(zone) {
      if (zone === 'fields' || zone === 'results' || zone === 'header') {
        this.importFocusZone = zone;
      } else {
        this.importFocusZone = 'list';
      }
    },
    setBookFocus(index) {
      // Champs méta (éditables) + footer (voir shared/book-focus.js)
      this.bookFocusIndex = clampBookFocus(index);
    },
    setSeriesFocus(index, volumeCount = 0) {
      const n = Math.max(0, Number(volumeCount) || 0);
      const max = n > 0 ? n + 1 : 0;
      const i = Number(index);
      const safe = Number.isFinite(i) ? Math.trunc(i) : 0;
      this.seriesFocusIndex = Math.max(0, Math.min(max, safe));
    },
    refreshGamepadHint() {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    applyTheme(theme) {
      this.theme = normalizeTheme(theme);
      document.documentElement.setAttribute('data-theme', this.theme);
    },
    applyAccent(accent) {
      this.accent = normalizeAccent(accent);
      document.documentElement.setAttribute('data-accent', this.accent);
    },
    applyAppearance({ theme, accent } = {}) {
      if (theme !== undefined) this.applyTheme(theme);
      if (accent !== undefined) this.applyAccent(accent);
    },
    applyOrientation(orientation) {
      this.orientation =
        orientation === 'portrait-ccw' ? 'portrait-ccw' : 'landscape';
      document.documentElement.setAttribute('data-orientation', this.orientation);
      this.syncReaderRotateAttr();
    },
    setReaderCssRotate(enabled) {
      this.readerCssRotate = Boolean(enabled);
      this.syncReaderRotateAttr();
    },
    syncReaderRotateAttr() {
      const on =
        this.orientation === 'portrait-ccw' && this.readerCssRotate;
      document.documentElement.setAttribute(
        'data-reader-rotate',
        on ? '1' : '0',
      );
    },
    /**
     * Bascule fenêtre Electron + remap manette.
     * Resize uniquement si orientation change (main) — sauf opts.force.
     * Ne jamais appeler hors entrée/sortie route `reader` (pas sur fiche livre).
     * @param {'ui'|'reader'} mode
     * @param {{ force?: boolean }} [opts]
     */
    async setSessionMode(mode, opts = {}) {
      const next = mode === 'reader' ? 'reader' : 'ui';
      const result = await window.vdr.setSessionMode(next, opts);
      const orientation =
        result?.orientation || (next === 'reader' ? 'portrait-ccw' : 'landscape');
      this.applyOrientation(orientation);
      // Lecteur = toujours +90° CSS (stratégie B). Ne pas dépendre seul de
      // result.cssRotate (omission IPC → menu pause restait en layout paysage).
      this.setReaderCssRotate(next === 'reader');
      this.inputContext = next === 'reader' ? 'reader' : 'ui';
      return result;
    },
    async enterReaderMode() {
      return this.setSessionMode('reader');
    },
    /** Retour menus — resize seulement si on quitte vraiment le portrait. */
    async exitReaderMode(opts = {}) {
      // Sortie lecteur : quitter le plein écran (session) avant le resize menus.
      await this.setFullscreen(false);
      const result = await this.setSessionMode('ui', opts);
      this.setReaderCssRotate(false);
      return result;
    },
    async loadConfig() {
      const config = await window.vdr.getConfig();
      this.setupCompleted = Boolean(config.setupCompleted);
      this.applyLanguage(config.language || 'fr');
      // Menus = landscape TOUJOURS au load — portrait uniquement si déjà sur lecteur
      // (évite le bug : config.orientation portrait-ccw → menus remappés)
      const orientation =
        this.routeName === 'reader' ? 'portrait-ccw' : 'landscape';
      this.applyOrientation(orientation);
      this.inputContext = this.routeName === 'reader' ? 'reader' : 'ui';
      this.userKeyBindings = config.keyBindings || null;
      this.keyBindings = resolveKeyBindings(this.userKeyBindings);
      this.hapticsEnabled = config.hapticsEnabled !== false;
      this.applyTheme(config.theme || DEFAULT_THEME);
      this.applyAccent(config.accent || DEFAULT_ACCENT);
      this.configLoaded = true;
      return config;
    },
    applyLanguage(language) {
      this.language = normalizeLocale(language);
      setLocale(this.language);
      if (!this.gamepadConnected) {
        this.gamepadLabel = t('gamepad.waiting');
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', this.language);
      }
    },
    async persistAppearance(patch = {}) {
      if (patch.theme !== undefined) this.applyTheme(patch.theme);
      if (patch.accent !== undefined) this.applyAccent(patch.accent);
      if (patch.language !== undefined) this.applyLanguage(patch.language);
      const payload = {};
      if (patch.theme !== undefined) payload.theme = this.theme;
      if (patch.accent !== undefined) payload.accent = this.accent;
      if (patch.language !== undefined) payload.language = this.language;
      if (!Object.keys(payload).length) return;
      await window.vdr.setConfig(payload);
      try {
        await window.vdr.profiles.setPrefs(payload);
      } catch {
        // Pas de profil actif (boot / setup précoce)
      }
    },
    async setTheme(theme) {
      await this.persistAppearance({ theme });
    },
    async setAccent(accent) {
      await this.persistAppearance({ accent });
    },
    async setLanguage(language) {
      await this.persistAppearance({ language });
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
