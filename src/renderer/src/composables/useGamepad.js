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

  function bind(next) {
    handlers = next;
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
      return;
    }

    if (route === 'boot') {
      const max = 3;
      if (action === 'cursor-up') ui.setBootFocus(Math.max(0, ui.bootFocusIndex - 1));
      if (action === 'cursor-down') ui.setBootFocus(Math.min(max, ui.bootFocusIndex + 1));
      if (action === 'confirm' || action === 'open-book') {
        // BootView gère via index — déclencher navigation soft
        const el = document.querySelectorAll('.boot__nav .focus-btn')[ui.bootFocusIndex];
        el?.click();
      }
      return;
    }

    if (route === 'setup') {
      const maxSetup = Math.max(0, document.querySelectorAll('.setup .focus-btn').length - 1);
      if (action === 'cursor-up') ui.setSetupFocus(Math.max(0, ui.setupFocusIndex - 1));
      if (action === 'cursor-down') {
        ui.setSetupFocus(Math.min(maxSetup, ui.setupFocusIndex + 1));
      }
      if (action === 'cursor-left' || action === 'back') {
        document.querySelector('.setup .ghost')?.click();
      }
      if (action === 'cursor-right') {
        // Avancer d’étape si bouton Continuer/Terminer focusé, sinon focus next
        const focused = document.querySelector('.setup .focus-btn.is-focused');
        if (focused) focused.click();
        else document.querySelector('.setup .focus-btn:last-of-type')?.click();
      }
      if (action === 'confirm') {
        const focused = document.querySelector('.setup .focus-btn.is-focused');
        focused?.click();
      }
      return;
    }

    if (route === 'library') {
      if (action === 'back') router.push({ name: 'boot' });
      if (action === 'cursor-up') library.moveCatalog(0, -1);
      if (action === 'cursor-down') library.moveCatalog(0, 1);
      if (action === 'cursor-left') library.moveCatalog(-1, 0);
      if (action === 'cursor-right') library.moveCatalog(1, 0);
      if (action === 'open-book' || action === 'confirm') {
        if (library.focusZone === 'hero' && library.heroMode === 'empty') {
          router.push({ name: 'import' });
          return;
        }
        if (library.focusZone === 'hero' && library.heroMode === 'invite' && !library.heroBook) {
          if (!library.focusRecent(0)) library.focusGrid(0);
          return;
        }
        const book = library.selected;
        if (book) router.push({ name: 'reader', query: { path: book.filePath } });
      }
      if (action === 'import') router.push({ name: 'import' });
      if (action === 'settings') router.push({ name: 'settings' });
      if (action === 'tab-next') library.cycleFilter(1);
      if (action === 'tab-prev') library.cycleFilter(-1);
      if (action === 'scroll' && payload) {
        const now = performance.now();
        const stickDelay = library.focusZone === 'recent' ? 140 : 180;
        if (now - lastStickNav < stickDelay) return;
        if (Math.abs(payload.y) < 0.45 && Math.abs(payload.x) < 0.45) return;
        lastStickNav = now;
        if (Math.abs(payload.y) >= Math.abs(payload.x)) {
          library.moveCatalog(0, payload.y > 0 ? 1 : -1);
        } else {
          library.moveCatalog(payload.x > 0 ? 1 : -1, 0);
        }
      }
      return;
    }

    if (route === 'import') {
      if (action === 'back') router.push({ name: 'library' });
      if (action === 'cursor-up') imp.moveCursor(-1);
      if (action === 'cursor-down') imp.moveCursor(1);
      if (action === 'cursor-left') {
        ui.setImportFocus(Math.max(0, ui.importFocusIndex - 1));
      }
      if (action === 'cursor-right') {
        ui.setImportFocus(Math.min(1, ui.importFocusIndex + 1));
      }
      if (action === 'confirm') {
        if (ui.importFocusIndex === 1) imp.enrich();
        else imp.commitSelected({ copyToLibrary: true });
      }
      if (action === 'enrich') imp.enrich();
      return;
    }

    if (route === 'settings') {
      if (action === 'back') {
        if (ui.listeningForBind) {
          ui.stopListening();
          return;
        }
        router.push({ name: 'boot' });
      }
      const maxSettings = Math.max(
        0,
        document.querySelectorAll(
          '.settings .bind-row, .settings .focus-btn, .settings .tab',
        ).length - 1,
      );
      if (action === 'cursor-up') ui.setSettingsFocus(Math.max(0, ui.settingsFocusIndex - 1));
      if (action === 'cursor-down') {
        ui.setSettingsFocus(Math.min(maxSettings, ui.settingsFocusIndex + 1));
      }
      if (action === 'tab-prev' || action === 'cursor-left') {
        document.querySelector('.settings .tab:not(.is-active)')?.previousElementSibling?.click?.();
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active > 0) tabs[active - 1].click();
        ui.setSettingsFocus(0);
      }
      if (action === 'tab-next' || action === 'cursor-right') {
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active >= 0 && active < tabs.length - 1) tabs[active + 1].click();
        ui.setSettingsFocus(0);
      }
      if (action === 'confirm') {
        const row = document.querySelector(
          '.settings .bind-row.is-focused, .settings .focus-btn.is-focused',
        );
        row?.click();
      }
      return;
    }
    if (route === 'reader') {
      if (action === 'close-book' || action === 'back') {
        reader.close().then(() => router.push({ name: 'library' }));
        return;
      }
      if (action === 'toggle-overlay') reader.toggleHud();
      if (action === 'toggle-direction') reader.toggleDirection();
      if (action === 'toggle-zoom') reader.toggleZoom();
      if (action === 'fit-width') reader.setFitWidth();
      if (action === 'zoom-in') reader.zoomBy(1);
      if (action === 'zoom-out') reader.zoomBy(-1);
      if (action === 'page-prev') reader.stepPage('prev');
      if (action === 'page-next') reader.stepPage('next');
      if (action === 'chapter-prev') reader.stepChapter(-1);
      if (action === 'chapter-next') reader.stepChapter(1);
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

    if (!pad) {
      ui.setGamepadStatus({ connected: false, label: 'Manette en attente…' });
      prevButtons = [];
    } else {
      const short = pad.id.length > 36 ? `${pad.id.slice(0, 36)}…` : pad.id;
      ui.setGamepadStatus({
        connected: true,
        label: `${short} · ${orientation}`,
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
