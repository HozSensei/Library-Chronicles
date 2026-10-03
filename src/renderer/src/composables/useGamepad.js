import { onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useReaderStore } from '../stores/reader';
import { useLibraryStore } from '../stores/library';
import { useImportStore } from '../stores/import';
import {
  DeviceOrientation,
  remapDpad,
  remapStick,
} from '../../../shared/portrait-remap.js';
import { actionForBinding, GamepadButtons } from '../../../shared/controls.js';
import { hasHaptics, pulseHaptic } from './useHaptics.js';

const BUTTON = GamepadButtons;

const PHYSICAL_DPAD = [
  [BUTTON.DPAD_UP, 'up'],
  [BUTTON.DPAD_DOWN, 'down'],
  [BUTTON.DPAD_LEFT, 'left'],
  [BUTTON.DPAD_RIGHT, 'right'],
];

const DEADZONE = 0.18;

let sharedLoop = null;

/**
 * Boucle Gamepad unique.
 * Pipeline : entrée physique → remap portrait → mapping utilisateur → action.
 */
export function useGamepad() {
  const router = useRouter();
  const ui = useUiStore();
  const reader = useReaderStore();
  const library = useLibraryStore();
  const imp = useImportStore();

  if (!sharedLoop) {
    sharedLoop = createLoop({ router, ui, reader, library, imp });
  } else {
    sharedLoop.bind({ router, ui, reader, library, imp });
  }

  function start() {
    sharedLoop.start();
  }

  function stop() {
    sharedLoop.stop();
  }

  onScopeDispose(() => {});

  return { start, stop };
}

function createLoop(ctx) {
  let running = false;
  let rafId = null;
  let prevButtons = [];
  let padIndex = null;
  let handlers = ctx;
  /** @type {string} */
  let orientation = DeviceOrientation.PORTRAIT_CCW;
  let lastStickNav = 0;
  /** @type {Gamepad | null} */
  let currentPad = null;
  let lastRouteForHaptic = null;

  function bind(next) {
    handlers = next;
  }

  function vibe(kind) {
    const { ui } = handlers;
    if (!ui.hapticsEnabled) return;
    pulseHaptic(currentPad, kind, { enabled: true });
  }

  async function refreshOrientation() {
    try {
      const config = await window.vdr.getConfig();
      orientation =
        config.orientation === DeviceOrientation.LANDSCAPE
          ? DeviceOrientation.LANDSCAPE
          : DeviceOrientation.PORTRAIT_CCW;
      handlers.ui.orientation = orientation;
    } catch {
      orientation = DeviceOrientation.PORTRAIT_CCW;
    }
  }

  function start() {
    if (running) return;
    running = true;
    refreshOrientation();
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

  function bindingContext(route) {
    if (route === 'boot') return 'boot';
    if (route === 'library') return 'library';
    if (route === 'reader') return 'reader';
    if (route === 'setup') return 'setup';
    if (route === 'import') return 'import';
    if (route === 'settings') return 'settings';
    return 'boot';
  }

  function resolveAction(key) {
    const { ui } = handlers;
    const ctxName = bindingContext(ui.routeName);
    return actionForBinding(ui.keyBindings, ctxName, key);
  }

  function dispatch(action, payload) {
    if (!action) return;
    const { router, ui, reader, library, imp } = handlers;
    const route = ui.routeName;

    // Mode écoute remapping
    if (ui.listeningForBind && payload?.bindingKey) {
      ui.applyCapturedBind(payload.bindingKey);
      vibe('confirm');
      return;
    }

    if (route === 'boot') {
      const max = 3;
      if (action === 'cursor-up') {
        ui.setBootFocus(Math.max(0, ui.bootFocusIndex - 1));
        vibe('nav');
      }
      if (action === 'cursor-down') {
        ui.setBootFocus(Math.min(max, ui.bootFocusIndex + 1));
        vibe('nav');
      }
      if (action === 'confirm' || action === 'open-book') {
        vibe('confirm');
        const el = document.querySelectorAll('.boot__nav .focus-btn')[ui.bootFocusIndex];
        el?.click();
      }
      return;
    }

    if (route === 'setup') {
      const maxSetup = Math.max(0, document.querySelectorAll('.setup .focus-btn').length - 1);
      if (action === 'cursor-up') {
        ui.setSetupFocus(Math.max(0, ui.setupFocusIndex - 1));
        vibe('nav');
      }
      if (action === 'cursor-down') {
        ui.setSetupFocus(Math.min(maxSetup, ui.setupFocusIndex + 1));
        vibe('nav');
      }
      if (action === 'cursor-left' || action === 'back') {
        document.querySelector('.setup .ghost')?.click();
      }
      if (action === 'cursor-right') {
        const focused = document.querySelector('.setup .focus-btn.is-focused');
        if (focused) {
          vibe('confirm');
          focused.click();
        } else {
          document.querySelector('.setup .focus-btn:last-of-type')?.click();
        }
      }
      if (action === 'confirm') {
        const focused = document.querySelector('.setup .focus-btn.is-focused');
        vibe('confirm');
        focused?.click();
      }
      return;
    }

    if (route === 'library') {
      if (action === 'back') {
        vibe('light');
        router.push({ name: 'boot' });
      }
      if (action === 'cursor-up') {
        library.moveCursorGrid(0, -1);
        vibe('nav');
      }
      if (action === 'cursor-down') {
        library.moveCursorGrid(0, 1);
        vibe('nav');
      }
      if (action === 'cursor-left') {
        library.moveCursorGrid(-1, 0);
        vibe('nav');
      }
      if (action === 'cursor-right') {
        library.moveCursorGrid(1, 0);
        vibe('nav');
      }
      if (action === 'open-book' || action === 'confirm') {
        const book = library.selected;
        if (book) {
          vibe('confirm');
          router.push({ name: 'reader', query: { path: book.filePath } });
        }
      }
      if (action === 'import') {
        vibe('light');
        router.push({ name: 'import' });
      }
      if (action === 'settings') {
        vibe('light');
        router.push({ name: 'settings' });
      }
      if (action === 'tab-next') {
        library.cycleFilter(1);
        vibe('light');
      }
      if (action === 'tab-prev') {
        library.cycleFilter(-1);
        vibe('light');
      }
      if (action === 'scroll' && payload) {
        const now = performance.now();
        if (now - lastStickNav < 180) return;
        if (Math.abs(payload.y) < 0.45 && Math.abs(payload.x) < 0.45) return;
        lastStickNav = now;
        if (Math.abs(payload.y) >= Math.abs(payload.x)) {
          library.moveCursorGrid(0, payload.y > 0 ? 1 : -1);
        } else {
          library.moveCursorGrid(payload.x > 0 ? 1 : -1, 0);
        }
        vibe('nav');
      }
      return;
    }

    if (route === 'import') {
      if (action === 'back') {
        vibe('light');
        router.push({ name: 'library' });
      }
      if (action === 'cursor-up') {
        imp.moveCursor(-1);
        vibe('nav');
      }
      if (action === 'cursor-down') {
        imp.moveCursor(1);
        vibe('nav');
      }
      if (action === 'cursor-left') {
        ui.setImportFocus(Math.max(0, ui.importFocusIndex - 1));
        vibe('nav');
      }
      if (action === 'cursor-right') {
        ui.setImportFocus(Math.min(1, ui.importFocusIndex + 1));
        vibe('nav');
      }
      if (action === 'confirm') {
        vibe('confirm');
        if (ui.importFocusIndex === 1) imp.enrich();
        else imp.commitSelected({ copyToLibrary: true });
      }
      if (action === 'enrich') {
        vibe('confirm');
        imp.enrich();
      }
      return;
    }

    if (route === 'settings') {
      if (action === 'back') {
        if (ui.listeningForBind) {
          ui.stopListening();
          return;
        }
        vibe('light');
        router.push({ name: 'boot' });
      }
      const maxSettings = Math.max(
        0,
        document.querySelectorAll(
          '.settings .bind-row, .settings .focus-btn, .settings .tab',
        ).length - 1,
      );
      if (action === 'cursor-up') {
        ui.setSettingsFocus(Math.max(0, ui.settingsFocusIndex - 1));
        vibe('nav');
      }
      if (action === 'cursor-down') {
        ui.setSettingsFocus(Math.min(maxSettings, ui.settingsFocusIndex + 1));
        vibe('nav');
      }
      if (action === 'tab-prev' || action === 'cursor-left') {
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active > 0) {
          tabs[active - 1].click();
          vibe('light');
        }
        ui.setSettingsFocus(0);
      }
      if (action === 'tab-next' || action === 'cursor-right') {
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active >= 0 && active < tabs.length - 1) {
          tabs[active + 1].click();
          vibe('light');
        }
        ui.setSettingsFocus(0);
      }
      if (action === 'confirm') {
        const row = document.querySelector(
          '.settings .bind-row.is-focused, .settings .focus-btn.is-focused',
        );
        vibe('confirm');
        row?.click();
      }
      return;
    }
    if (route === 'reader') {
      if (action === 'close-book' || action === 'back') {
        vibe('light');
        reader.close().then(() => router.push({ name: 'library' }));
        return;
      }
      if (action === 'toggle-overlay') reader.toggleHud();
      if (action === 'toggle-direction') {
        vibe('confirm');
        reader.toggleDirection();
      }
      if (action === 'toggle-zoom') reader.toggleZoom();
      if (action === 'fit-width') reader.setFitWidth();
      if (action === 'zoom-in') reader.zoomBy(1);
      if (action === 'zoom-out') reader.zoomBy(-1);
      if (action === 'page-prev') {
        vibe('light');
        reader.stepPage('prev');
      }
      if (action === 'page-next') {
        vibe('light');
        reader.stepPage('next');
      }
      if (action === 'chapter-prev') {
        vibe('confirm');
        reader.stepChapter(-1);
      }
      if (action === 'chapter-next') {
        vibe('confirm');
        reader.stepChapter(1);
      }
      if ((action === 'pan' || action === 'stick') && payload) {
        reader.pan(payload.x, payload.y);
      }
    }
  }

  function emitLogicalDpad(physical) {
    const logical = remapDpad(orientation, physical);
    const key = `dpad:${logical}`;
    const { ui } = handlers;

    if (ui.listeningForBind) {
      ui.applyCapturedBind(key);
      return;
    }

    const action = resolveAction(key);
    dispatch(action);
  }

  function tick() {
    if (!running) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pickPad(pads);
    const { ui } = handlers;
    currentPad = pad;

    // Pulse léger au changement de page / route (une fois)
    if (lastRouteForHaptic !== ui.routeName) {
      if (lastRouteForHaptic != null) vibe('light');
      lastRouteForHaptic = ui.routeName;
    }

    if (!pad) {
      ui.setGamepadStatus({ connected: false, label: 'Manette en attente…' });
      ui.setHapticsAvailable(false);
      prevButtons = [];
    } else {
      const short = pad.id.length > 36 ? `${pad.id.slice(0, 36)}…` : pad.id;
      const hapticOk = hasHaptics(pad);
      ui.setHapticsAvailable(hapticOk);
      ui.setGamepadStatus({
        connected: true,
        label: `${short} · ${orientation}${hapticOk && ui.hapticsEnabled ? ' · rumble' : ''}`,
      });

      const rawX = applyDeadzone(pad.axes[0] || 0);
      const rawY = applyDeadzone(pad.axes[1] || 0);
      const stick = remapStick(orientation, rawX, rawY);
      if (stick.x !== 0 || stick.y !== 0) {
        const stickAction = resolveAction('stick:left') || 'pan';
        dispatch(stickAction, stick);
      }

      // Boutons (hors D-Pad) — mapping utilisateur
      const buttonIndices = [
        BUTTON.A,
        BUTTON.B,
        BUTTON.X,
        BUTTON.Y,
        BUTTON.LB,
        BUTTON.RB,
        BUTTON.LT,
        BUTTON.RT,
        BUTTON.SELECT,
        BUTTON.START,
        BUTTON.L3,
        BUTTON.R3,
      ];
      for (const index of buttonIndices) {
        if (!edge(pad, index)) continue;
        const bindingKey = `button:${index}`;
        if (ui.listeningForBind) {
          ui.applyCapturedBind(bindingKey);
          vibe('confirm');
          continue;
        }
        const action = resolveAction(bindingKey);
        dispatch(action, { bindingKey });
      }

      for (const [index, physical] of PHYSICAL_DPAD) {
        if (edge(pad, index)) emitLogicalDpad(physical);
      }

      prevButtons = pad.buttons.map((b) => Boolean(b?.pressed));
    }

    rafId = requestAnimationFrame(tick);
  }

  return { start, stop, bind, refreshOrientation };
}
