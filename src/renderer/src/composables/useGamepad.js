import { onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useReaderStore } from '../stores/reader';
import { useLibraryStore } from '../stores/library';
import { useImportStore } from '../stores/import';
import { useProfilesStore } from '../stores/profiles';
import {
  DeviceOrientation,
  remapDpad,
  remapStick,
  sessionOrientationForRoute,
} from '../../../shared/portrait-remap.js';
import { actionForBinding, GamepadButtons } from '../../../shared/controls.js';
import { hasHaptics, pulseHaptic } from './useHaptics.js';
import { markProfileSelected, clearSetupGate } from '../router';
import {
  setupFocusRows,
  moveSetupFocus,
} from '../../../shared/setup-focus.js';

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
 * Contexte `ui` (landscape, identity) vs `reader` (portrait remap + bindings lecture).
 * Le remap portrait ne dépend QUE de la route `reader` — jamais de config.orientation
 * ni d’un inputContext sticky (bug menus encore vertical).
 */
export function useGamepad() {
  const router = useRouter();
  const ui = useUiStore();
  const reader = useReaderStore();
  const library = useLibraryStore();
  const imp = useImportStore();
  const profiles = useProfilesStore();

  if (!sharedLoop) {
    sharedLoop = createLoop({ router, ui, reader, library, imp, profiles });
  } else {
    sharedLoop.bind({ router, ui, reader, library, imp, profiles });
  }

  function start() {
    sharedLoop.start();
  }

  function stop() {
    sharedLoop.stop();
  }

  function refreshOrientation() {
    return sharedLoop?.refreshOrientation?.();
  }

  onScopeDispose(() => {});

  return { start, stop, refreshOrientation };
}

function createLoop(ctx) {
  let running = false;
  let rafId = null;
  let prevButtons = [];
  let padIndex = null;
  let handlers = ctx;
  /** @type {string} — défaut menus = landscape (identité). */
  let orientation = DeviceOrientation.LANDSCAPE;
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

  /**
   * Orientation manette = route uniquement.
   * setup / profils / boot / biblio / import / fiche / paramètres → landscape
   * reader → portrait-ccw
   * Ne jamais lire config.orientation ni inputContext (sticky après lecture).
   */
  function refreshOrientation() {
    const { ui } = handlers;
    orientation = sessionOrientationForRoute(ui.routeName);
    return orientation;
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
    if (route === 'book') return 'book';
    if (route === 'reader') return 'reader';
    if (route === 'setup') return 'setup';
    if (route === 'import') return 'import';
    if (route === 'settings') return 'settings';
    if (route === 'profiles') return 'profiles';
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

    if (ui.listeningForBind && payload?.bindingKey) {
      ui.applyCapturedBind(payload.bindingKey);
      vibe('confirm');
      return;
    }

    if (route === 'profiles') {
      const { profiles } = handlers;
      const naming = Boolean(document.querySelector('.profiles__create'));

      if (naming) {
        if (action === 'cursor-left' || action === 'cursor-up') {
          const input = document.querySelector('.profiles__create input');
          input?.focus?.();
          vibe('nav');
          return;
        }
        if (action === 'cursor-right' || action === 'cursor-down') {
          const btn = document.querySelector('.profiles__create .btn-primary');
          btn?.focus?.();
          vibe('nav');
          return;
        }
        if (action === 'confirm' || action === 'open-book') {
          // A valide le pseudo (création / édition) — focus input pour OSK SteamOS
          document.querySelector('.profiles__create input')?.focus?.();
          document.querySelector('.profiles__create')?.requestSubmit?.();
          vibe('confirm');
          return;
        }
        if (action === 'back') {
          document.querySelector('.profiles__create .ghost')?.click();
          vibe('light');
        }
        return;
      }

      if (action === 'cursor-up' || (action === 'scroll' && payload?.y < -0.45)) {
        profiles.moveFocus(-1);
        vibe('nav');
      }
      if (action === 'cursor-down' || (action === 'scroll' && payload?.y > 0.45)) {
        profiles.moveFocus(1);
        vibe('nav');
      }
      if (action === 'cursor-left') {
        profiles.moveFocus(-1);
        vibe('nav');
      }
      if (action === 'cursor-right') {
        profiles.moveFocus(1);
        vibe('nav');
      }
      if (action === 'rename' || action === 'book-options') {
        window.dispatchEvent(new CustomEvent('vdr-profile-rename'));
        vibe('light');
        return;
      }
      if (action === 'confirm' || action === 'open-book') {
        if (profiles.focusIndex >= profiles.profiles.length) {
          document.querySelector('.avatar--add')?.click();
          vibe('confirm');
          return;
        }
        const p = profiles.profiles[profiles.focusIndex];
        if (p) {
          profiles.select(p.id).then(async () => {
            markProfileSelected();
            clearSetupGate();
            const active = await window.vdr.profiles.getActive();
            if (active?.prefs?.setupCompleted) {
              router.replace({ name: 'library' });
            } else {
              router.replace({ name: 'setup' });
            }
          });
          vibe('confirm');
        }
      }
      return;
    }

    if (route === 'boot') {
      const max = Math.max(0, document.querySelectorAll('.boot__nav .focus-btn').length - 1);
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
      // ←→ = options d’une rangée ; Confirm seul ouvre le dossier. Jamais ←→ → dialog.
      const stepHint = Number(document.querySelector('.setup')?.dataset?.step ?? 0);
      const rows = setupFocusRows(Number.isFinite(stepHint) ? stepHint : 0);

      if (action === 'cursor-up') {
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'up'));
        vibe('nav');
      }
      if (action === 'cursor-down') {
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'down'));
        vibe('nav');
      }
      if (action === 'cursor-left') {
        // Navigation horizontale UNIQUEMENT — ne jamais ouvrir le sélecteur de dossier
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'left'));
        vibe('nav');
      }
      if (action === 'cursor-right') {
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'right'));
        vibe('nav');
      }
      if (action === 'back') {
        document.querySelector('.setup__footer .ghost, .setup .ghost')?.click();
        vibe('light');
      }
      if (action === 'confirm') {
        // Confirm/A seul peut activer Parcourir / thème / continuer
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
        library.moveCatalog(0, -1);
        vibe('nav');
      }
      if (action === 'cursor-down') {
        library.moveCatalog(0, 1);
        vibe('nav');
      }
      if (action === 'cursor-left') {
        library.moveCatalog(-1, 0);
        vibe('nav');
      }
      if (action === 'cursor-right') {
        library.moveCatalog(1, 0);
        vibe('nav');
      }
      if (action === 'toggle-series') {
        library.toggleViewMode();
        vibe('light');
      }
      if (action === 'open-book' || action === 'confirm') {
        if (!library.books.length) {
          router.push({ name: 'import' });
          return;
        }
        if (library.focusZone === 'series') {
          library.nextUnreadForSelected().then((book) => {
            if (book?.id) {
              router.push({ name: 'book', params: { id: String(book.id) } });
            }
          });
          return;
        }
        const book = library.selected;
        if (book?.id) {
          vibe('confirm');
          router.push({ name: 'book', params: { id: String(book.id) } });
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
        if (now - lastStickNav < 160) return;
        if (Math.abs(payload.y) < 0.45 && Math.abs(payload.x) < 0.45) return;
        lastStickNav = now;
        if (Math.abs(payload.y) >= Math.abs(payload.x)) {
          library.moveCatalog(0, payload.y > 0 ? 1 : -1);
        } else {
          library.moveCatalog(payload.x > 0 ? 1 : -1, 0);
        }
        vibe('nav');
      }
      return;
    }

    if (route === 'book') {
      if (action === 'back') {
        vibe('light');
        router.push({ name: 'library' });
      }
      if (action === 'cursor-left' || action === 'cursor-up') {
        ui.setBookFocus(Math.max(0, ui.bookFocusIndex - 1));
        vibe('nav');
      }
      if (action === 'cursor-right' || action === 'cursor-down') {
        ui.setBookFocus(Math.min(2, ui.bookFocusIndex + 1));
        vibe('nav');
      }
      if (action === 'open-book' || action === 'confirm') {
        vibe('confirm');
        const el = document.querySelectorAll('.book-detail .focus-btn')[ui.bookFocusIndex];
        el?.click();
      }
      if (action === 'settings') {
        router.push({ name: 'settings' });
      }
      if (action === 'import') {
        router.push({ name: 'import' });
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
        reader.close().then(async () => {
          await ui.exitReaderMode();
          router.push({ name: 'library' });
        });
        return;
      }
      if (action === 'toggle-pause' || action === 'toggle-overlay') {
        reader.toggleHud();
        if (action === 'toggle-pause') reader.setHudPanel('main');
      }
      if (action === 'toggle-direction') {
        vibe('confirm');
        reader.toggleDirection();
      }
      if (action === 'toggle-zoom') reader.toggleZoom();
      if (action === 'fit-width') reader.setFitWidth();
      if (action === 'toggle-webtoon') reader.toggleWebtoon();
      if (action === 'add-bookmark') reader.addBookmark();
      if (action === 'next-volume') {
        reader.openNextVolume().then((ok) => {
          if (ok && reader.filePath) {
            router.replace({ name: 'reader', query: { path: reader.filePath } });
          }
        });
      }
      if (action === 'zoom-in') {
        if (reader.webtoonMode) reader.stepPage('prev');
        else reader.zoomBy(1);
      }
      if (action === 'zoom-out') {
        if (reader.webtoonMode) reader.stepPage('next');
        else reader.zoomBy(-1);
      }
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
        if (reader.webtoonMode) {
          const strip = document.querySelector('.reader__strip');
          if (strip) {
            strip.scrollTop += payload.y * 28;
            strip.scrollLeft += payload.x * 10;
          } else {
            reader.pan(payload.x, payload.y);
          }
        } else {
          reader.pan(payload.x, payload.y);
        }
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

    refreshOrientation();

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
      const modeLabel = orientation === DeviceOrientation.PORTRAIT_CCW ? 'lecture' : 'menus';
      ui.setGamepadStatus({
        connected: true,
        label: `${short} · ${modeLabel}${hapticOk && ui.hapticsEnabled ? ' · rumble' : ''}`,
      });

      const rawX = applyDeadzone(pad.axes[0] || 0);
      const rawY = applyDeadzone(pad.axes[1] || 0);
      const stick = remapStick(orientation, rawX, rawY);
      if (stick.x !== 0 || stick.y !== 0) {
        const stickAction = resolveAction('stick:left') || 'pan';
        dispatch(stickAction, stick);
      }

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
