/**
 * Navigation entre écrans (boot / library / reader).
 */

const SCREENS = ['boot', 'library', 'reader'];

export class ScreenManager {
  /** @param {HTMLElement} appRoot */
  constructor(appRoot) {
    this.appRoot = appRoot;
    this.current = 'boot';
  }

  show(name) {
    if (!SCREENS.includes(name)) return;
    this.current = name;
    this.appRoot.dataset.screen = name;

    for (const id of SCREENS) {
      const el = document.getElementById(`screen-${id}`);
      if (!el) continue;
      const active = id === name;
      el.hidden = !active;
      el.classList.toggle('screen--active', active);
    }
  }
}

export { SCREENS };
