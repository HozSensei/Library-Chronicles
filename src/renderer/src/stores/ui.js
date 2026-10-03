import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    routeName: 'boot',
    gamepadLabel: 'Manette en attente…',
    gamepadConnected: false,
    bootFocusIndex: 0,
    reducedMotion: false,
  }),
  actions: {
    setRouteName(name) {
      this.routeName = name || 'boot';
    },
    setGamepadStatus({ connected, label }) {
      this.gamepadConnected = connected;
      this.gamepadLabel = label;
    },
    setBootFocus(index) {
      this.bootFocusIndex = index;
    },
    refreshGamepadHint() {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
  },
});
