import { onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useReaderStore } from '../stores/reader';
import { useLibraryStore } from '../stores/library';

const BUTTON = {
  A: 0,
  B: 1,
  Y: 3,
  LT: 6,
  RT: 7,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

const DEADZONE = 0.18;

let sharedLoop = null;

/**
 * Boucle Gamepad unique (singleton) branchée sur les stores Vue / Router.
 */
export function useGamepad() {
  const router = useRouter();
  const ui = useUiStore();
  const reader = useReaderStore();
  const library = useLibraryStore();

  if (!sharedLoop) {
    sharedLoop = createLoop({ router, ui, reader, library });
  } else {
    sharedLoop.bind({ router, ui, reader, library });
  }

  function start() {
    sharedLoop.start();
  }

  function stop() {
    sharedLoop.stop();
  }

  onScopeDispose(() => {
    // Ne stoppe pas la boucle globale si d'autres composants l'utilisent ;
    // App.vue gère le cycle de vie principal.
  });

  return { start, stop };
}

function createLoop(ctx) {
  let running = false;
  let rafId = null;
  let prevButtons = [];
  let padIndex = null;
  let handlers = ctx;

  function bind(next) {
    handlers = next;
  }

  function start() {
    if (running) return;
    running = true;
    tick();
  }

  function stop() {
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function applyDeadzone(v) {
    return Math.abs(v) < DEADZONE ? 0 : v;
  }

  function pickPad(pads) {
    if (padIndex != null && pads[padIndex]) return pads[padIndex];
    for (let i = 0; i < pads.length; i += 1) {
      if (pads[i]) {
        padIndex = i;
        return pads[i];
      }
    }
    padIndex = null;
    return null;
  }

  function edge(pad, index) {
    return Boolean(pad.buttons[index]?.pressed) && !prevButtons[index];
  }

  function dispatch(action, payload) {
    const { router, ui, reader, library } = handlers;
    const route = ui.routeName;

    if (route === 'boot') {
      if (action === 'dpad-up') ui.setBootFocus(Math.max(0, ui.bootFocusIndex - 1));
      if (action === 'dpad-down') ui.setBootFocus(Math.min(1, ui.bootFocusIndex + 1));
      if (action === 'a' || action === 'confirm') {
        if (ui.bootFocusIndex === 0) router.push({ name: 'library' });
        else router.push({ name: 'reader' });
      }
      return;
    }

    if (route === 'library') {
      if (action === 'b') router.push({ name: 'boot' });
      if (action === 'dpad-up') library.moveCursor(-1);
      if (action === 'dpad-down') library.moveCursor(1);
      return;
    }

    if (route === 'reader') {
      if (action === 'b') {
        reader.close().then(() => router.push({ name: 'library' }));
        return;
      }
      if (action === 'y') reader.toggleHud();
      if (action === 'a') reader.toggleDirection();
      if (action === 'toggle-zoom') reader.toggleZoom();
      if (action === 'dpad-up') reader.zoomBy(1);
      if (action === 'dpad-down') reader.zoomBy(-1);
      if (action === 'dpad-left') {
        reader.stepPage(reader.direction === 'rtl' ? 'next' : 'prev');
      }
      if (action === 'dpad-right') {
        reader.stepPage(reader.direction === 'rtl' ? 'prev' : 'next');
      }
      if (action === 'stick' && payload) reader.pan(payload.x, payload.y);
    }
  }

  function tick() {
    if (!running) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pickPad(pads);
    const { ui } = handlers;

    if (!pad) {
      ui.setGamepadStatus({ connected: false, label: 'Manette en attente…' });
      prevButtons = [];
    } else {
      const short = pad.id.length > 36 ? `${pad.id.slice(0, 36)}…` : pad.id;
      ui.setGamepadStatus({ connected: true, label: short });

      const x = applyDeadzone(pad.axes[0] || 0);
      const y = applyDeadzone(pad.axes[1] || 0);
      if (x !== 0 || y !== 0) dispatch('stick', { x, y });

      if (edge(pad, BUTTON.A)) dispatch('a');
      if (edge(pad, BUTTON.B)) dispatch('b');
      if (edge(pad, BUTTON.Y)) dispatch('y');
      if (edge(pad, BUTTON.L3) || edge(pad, BUTTON.R3)) dispatch('toggle-zoom');
      if (edge(pad, BUTTON.DPAD_UP)) dispatch('dpad-up');
      if (edge(pad, BUTTON.DPAD_DOWN)) dispatch('dpad-down');
      if (edge(pad, BUTTON.DPAD_LEFT)) dispatch('dpad-left');
      if (edge(pad, BUTTON.DPAD_RIGHT)) dispatch('dpad-right');
      if (edge(pad, BUTTON.LT)) dispatch('lt');
      if (edge(pad, BUTTON.RT)) dispatch('rt');

      prevButtons = pad.buttons.map((b) => Boolean(b?.pressed));
    }

    rafId = requestAnimationFrame(tick);
  }

  return { start, stop, bind };
}
