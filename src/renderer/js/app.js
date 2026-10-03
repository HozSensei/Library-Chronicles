/**
 * Point d'entrée renderer — orchestre écrans, gamepad, lecteur.
 */

import { GamepadLoop } from './gamepad.js';
import { ReaderEngine } from './reader-engine.js';
import { LibraryUI } from './library-ui.js';
import { ScreenManager } from './screens.js';
import { FocusNav } from './focus-nav.js';

const statusEl = document.getElementById('gamepad-status');
const screens = new ScreenManager(document.getElementById('app'));
const bootFocus = new FocusNav(document.getElementById('screen-boot'));

const reader = new ReaderEngine({
  stage: document.getElementById('reader-stage'),
  image: document.getElementById('reader-page'),
  placeholder: document.getElementById('reader-placeholder'),
});

const library = new LibraryUI(document.getElementById('library-grid'));

const hud = {
  root: document.getElementById('reader-hud'),
  title: document.getElementById('hud-title'),
  page: document.getElementById('hud-page'),
  fill: document.getElementById('hud-progress-fill'),
  direction: document.getElementById('hud-direction'),
};

function refreshHud() {
  const s = reader.hudState();
  hud.title.textContent = s.title;
  hud.page.textContent = s.pageLabel;
  hud.fill.style.width = `${s.progress}%`;
  hud.direction.textContent = `Sens : ${s.direction}`;
}

function toggleHud() {
  hud.root.hidden = !hud.root.hidden;
}

async function goLibrary() {
  screens.show('library');
  await library.refresh();
}

async function goReader() {
  screens.show('reader');
  hud.root.hidden = true;
  refreshHud();

  // Phase 1 : si un CBZ de test est configuré, tenter l'ouverture.
  try {
    const config = await window.vdr.getConfig();
    if (config.phase1TestCbz) {
      await reader.open(config.phase1TestCbz);
      refreshHud();
    }
  } catch (err) {
    console.warn('[VDR] Ouverture test CBZ:', err.message);
  }
}

function goBoot() {
  screens.show('boot');
  bootFocus.sync();
}

document.getElementById('btn-library').addEventListener('click', () => goLibrary());
document.getElementById('btn-reader').addEventListener('click', () => goReader());

const gamepad = new GamepadLoop({
  onStatus: (msg) => {
    if (statusEl) statusEl.textContent = msg;
  },
  onAction: (action, payload) => {
    const screen = screens.current;

    if (screen === 'boot') {
      if (action === 'dpad-up') bootFocus.move(-1);
      if (action === 'dpad-down') bootFocus.move(1);
      if (action === 'a') bootFocus.activate();
      return;
    }

    if (screen === 'library') {
      if (action === 'b') goBoot();
      if (action === 'dpad-up') library.moveCursor(0, -1);
      if (action === 'dpad-down') library.moveCursor(0, 1);
      // TODO[Phase 3]: A ouvrir, stick scroll, LT/RT onglets
      return;
    }

    if (screen === 'reader') {
      if (action === 'b') {
        reader.close().then(() => goLibrary());
        return;
      }
      if (action === 'y') {
        toggleHud();
        return;
      }
      if (action === 'a') {
        reader.toggleDirection();
        refreshHud();
        return;
      }
      if (action === 'toggle-zoom') {
        reader.toggleZoom();
        return;
      }
      if (action === 'dpad-up') reader.zoomBy(1);
      if (action === 'dpad-down') reader.zoomBy(-1);
      if (action === 'dpad-left') {
        reader.stepPage(reader.direction === 'rtl' ? 'next' : 'prev').then(refreshHud);
      }
      if (action === 'dpad-right') {
        reader.stepPage(reader.direction === 'rtl' ? 'prev' : 'next').then(refreshHud);
      }
      if (action === 'stick' && payload) {
        // Axe Y manette : pan vertical (et X si zoomé)
        reader.pan(payload.x, payload.y);
      }
      // TODO[Phase 2]: LT/RT chapitres
    }
  },
});

bootFocus.sync();
gamepad.start();

window.addEventListener('gamepadconnected', (e) => {
  console.info('[VDR] Gamepad connecté', e.gamepad.id);
});

window.addEventListener('gamepaddisconnected', () => {
  console.info('[VDR] Gamepad déconnecté');
});

console.info('[VDR] Renderer prêt — voir ROADMAP.md');
