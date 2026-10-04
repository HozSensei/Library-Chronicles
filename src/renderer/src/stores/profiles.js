import { defineStore } from 'pinia';
import { useToastStore } from './toast.js';
import { useUiStore } from './ui.js';
import { t } from '../../../shared/i18n.js';

export const useProfilesStore = defineStore('profiles', {
  state: () => ({
    profiles: [],
    activeProfileId: null,
    colors: [],
    prefs: {
      readingDirection: 'ltr',
      defaultFitMode: 'fit-height',
      brightness: 1,
      contrast: 1,
      sepia: 0,
    },
    focusIndex: 0,
    loading: false,
    profileSelected: false,
  }),
  getters: {
    activeProfile(s) {
      return s.profiles.find((p) => p.id === s.activeProfileId) || null;
    },
  },
  actions: {
    applyPrefsToUi(prefs) {
      if (!prefs) return;
      const ui = useUiStore();
      ui.applyAppearance({
        theme: prefs.theme,
        accent: prefs.accent,
      });
      if (prefs.language) ui.applyLanguage(prefs.language);
    },
    async refresh() {
      this.loading = true;
      try {
        const [list, active, config] = await Promise.all([
          window.vdr.profiles.list(),
          window.vdr.profiles.getActive(),
          window.vdr.getConfig(),
        ]);
        this.profiles = list.profiles || [];
        this.activeProfileId = list.activeProfileId ?? active.profile?.id ?? null;
        this.colors = list.colors || [];
        this.prefs = active.prefs || this.prefs;
        this.profileSelected = Boolean(config.profileSelected);
        if (this.focusIndex >= this.profiles.length) this.focusIndex = 0;
        return { list, active };
      } finally {
        this.loading = false;
      }
    },
    async select(id) {
      const result = await window.vdr.profiles.setActive(id);
      if (result.ok) {
        this.activeProfileId = id;
        this.profileSelected = true;
        this.prefs = result.prefs || this.prefs;
        this.applyPrefsToUi(result.prefs);
        await this.refresh();
      }
      return result;
    },
    async create(name, color, language) {
      const toast = useToastStore();
      try {
        const profile = await window.vdr.profiles.create({
          name,
          color,
          language,
        });
        await this.refresh();
        toast.success(
          t('toast.profileCreated', {
            name: profile?.name || name || t('common.profile'),
          }),
        );
        return profile;
      } catch (err) {
        toast.error(err?.message || t('toast.profileCreateFail'));
        throw err;
      }
    },
    async update(id, patch = {}) {
      const { language, ...rest } = patch;
      if (Object.keys(rest).length) {
        await window.vdr.profiles.update(id, rest);
      }
      if (language !== undefined) {
        await window.vdr.profiles.setPrefs({ language }, id);
        if (id === this.activeProfileId) {
          this.applyPrefsToUi({ language });
        }
      }
      await this.refresh();
    },
    async remove(id) {
      const result = await window.vdr.profiles.delete(id);
      await this.refresh();
      return result;
    },
    async setPrefs(patch) {
      this.prefs = await window.vdr.profiles.setPrefs(patch);
      return this.prefs;
    },
    moveFocus(delta) {
      const slots = this.profiles.length + 1; // + bouton ajouter
      this.focusIndex = (this.focusIndex + delta + slots) % slots;
    },
    setFocus(index) {
      const max = this.profiles.length; // inclus = bouton +
      this.focusIndex = Math.max(0, Math.min(index, max));
    },
  },
});
