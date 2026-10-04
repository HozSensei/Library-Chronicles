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
  visualPanToLocal,
} from '../../../shared/portrait-remap.js';
import { actionForBinding, GamepadButtons } from '../../../shared/controls.js';
import { hasHaptics, pulseHaptic } from './useHaptics.js';
import { markProfileSelected, clearProfileSelected, clearSetupGate } from '../router';
import {
  setupFocusRows,
  moveSetupFocus,
  SETUP_CONFIRM_FOCUS_SELECTOR,
} from '../../../shared/setup-focus.js';
import {
  focusRootForRoute,
  scheduleScrollFocusedIntoView,
} from '../../../shared/focus-scroll.js';
import {
  BOOK_FOCUS,
  bookFieldDomId,
  clampBookFocus,
  resolveBookConfirmAction,
} from '../../../shared/book-focus.js';
import {
  clampSeriesFocus,
  seriesFocusKind,
} from '../../../shared/series-focus.js';
import {
  IMPORT_DETAIL_TABS,
  IMPORT_INFOS_FIELDS,
  IMPORT_SEARCH_FIELDS,
  clampInfosFieldFocus,
  clampSearchFieldFocus,
  importFieldDomId,
  resolveImportBackAction,
  resolveImportConfirmAction,
  resolveImportTabAction,
} from '../../../shared/import-focus.js';
import { IMPORT_FLOW } from '../../../shared/import-flow.js';
import {
  META_APPLY_FIELDS,
  META_APPLY_FOCUS,
  clampMetaApplyFocus,
} from '../../../shared/meta-apply-fields.js';
import {
  ROUTE,
  bookDetailLocation,
  importItemLocation,
  isImportUiRoute,
  resolveParentLocation,
  uiContextForRoute,
} from '../../../shared/app-routes.js';
import { createStickMenuNav } from '../../../shared/stick-menu-nav.js';
import {
  isTextInputFocused,
  shouldBlockGamepadConfirmForText,
} from '../../../shared/text-input-focus.js';
import { focusTextInputForEdit, showVirtualKeyboard } from '../../../shared/virtual-keyboard.js';
import { t } from '../../../shared/i18n.js';

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
  /** Stick menus → cursor-* (edge + repeat) ; reset hors menus / pad absent. */
  const stickMenuNav = createStickMenuNav();
  /** @type {Gamepad | null} */
  let currentPad = null;
  let lastRouteForHaptic = null;

  function bind(next) {
    handlers = next;
  }

  /**
   * @param {'light'|'confirm'|'nav'} kind
   * @param {{ stickRepeat?: boolean }} [meta]
   *   stickRepeat : pas de haptic nav sur auto-repeat stick (edge seulement).
   */
  function vibe(kind, meta = {}) {
    const { ui } = handlers;
    if (!ui.hapticsEnabled) return;
    // Stick maintenu = pas de rumble à chaque pas de repeat
    if (kind === 'nav' && meta.stickRepeat) return;
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
    return uiContextForRoute(route);
  }

  function resolveAction(key) {
    const { ui } = handlers;
    const ctxName = bindingContext(ui.routeName);
    return actionForBinding(ui.keyBindings, ctxName, key);
  }

  function afterFocusMove() {
    const { ui } = handlers;
    scheduleScrollFocusedIntoView(focusRootForRoute(ui.routeName));
  }

  function dispatch(action, payload) {
    if (!action) return;
    const { router, ui, reader, library, imp } = handlers;
    const route = ui.routeName;
    const stickRepeat = Boolean(payload?.stickRepeat);
    const navVibe = () => vibe('nav', { stickRepeat });

    if (ui.listeningForBind && payload?.bindingKey) {
      ui.applyCapturedBind(payload.bindingKey);
      vibe('confirm');
      return;
    }

    // Champ texte focusé : A/confirm n’envoie pas de submit global — clavier seulement.
    // Exception : CTA Valider (bouton) focusé → isTextInputFocused = false.
    // Exception import méta-search : zone results — A doit appliquer même si
    // le champ query a encore le focus DOM (sinon apply flaky 1 fois sur 2).
    const importApplyResultPending =
      isImportUiRoute(route) &&
      !imp.isApplyModalOpen &&
      imp.isDetail &&
      imp.flow === IMPORT_FLOW.META_SEARCH &&
      ui.importFocusZone === 'results' &&
      imp.enrichResults.length > 0;
    if (
      (action === 'confirm' || action === 'open-book') &&
      shouldBlockGamepadConfirmForText() &&
      !importApplyResultPending &&
      !imp.isApplyModalOpen
    ) {
      void showVirtualKeyboard(document.activeElement);
      vibe('light');
      return;
    }

    // B hors naming profil : quitter l’édition (blur) sans submit
    if (action === 'back' && isTextInputFocused()) {
      const namingForm = document.querySelector('.profiles__create');
      if (!namingForm) {
        /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
        vibe('light');
        return;
      }
    }

    if (route === 'profiles') {
      const { profiles } = handlers;
      const naming = Boolean(document.querySelector('.profiles__create'));

      if (naming) {
        // Formulaire : 0=pseudo · 1=palette · 2=drapeaux · 3=valider
        if (
          action === 'cursor-left' ||
          action === 'cursor-right' ||
          action === 'cursor-up' ||
          action === 'cursor-down'
        ) {
          const dir = action.replace('cursor-', '');
          window.dispatchEvent(
            new CustomEvent('vdr-profile-form-nav', { detail: { dir } }),
          );
          navVibe();
          afterFocusMove();
          return;
        }
        if (action === 'confirm' || action === 'open-book') {
          const input = document.querySelector('.profiles__create input');
          const btn = document.querySelector(
            '.profiles__create .focus-btn--primary',
          );
          // Focus zone sur pastille/drapeau (pas sur le conteneur) — un seul is-focused
          const colorsFocused = Boolean(
            document.querySelector('.profiles__colors .is-focused'),
          );
          const localesFocused = Boolean(
            document.querySelector('.profiles__locales .is-focused'),
          );
          const onValidate =
            document.activeElement === btn ||
            (btn?.classList.contains('is-focused') &&
              !input?.classList.contains('is-focused') &&
              !colorsFocused &&
              !localesFocused &&
              !isTextInputFocused()) ||
            colorsFocused ||
            localesFocused;
          if (onValidate) {
            // FocusButton Créer n’est pas type=submit — clic / select
            btn?.click?.();
            vibe('confirm');
            return;
          }
          // Premier A / focus champ : ouvrir clavier, ne pas soumettre au nom défaut
          void focusTextInputForEdit(input);
          vibe('light');
          return;
        }
        if (action === 'back') {
          // Annuler sans forcer le nom par défaut
          document
            .querySelector('.profiles__create .profiles__cancel')
            ?.click();
          vibe('light');
        }
        return;
      }

      if (action === 'cursor-up') {
        profiles.moveFocus(-1);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-down') {
        profiles.moveFocus(1);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-left') {
        profiles.moveFocus(-1);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-right') {
        profiles.moveFocus(1);
        navVibe();
        afterFocusMove();
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
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-down') {
        ui.setBootFocus(Math.min(max, ui.bootFocusIndex + 1));
        navVibe();
        afterFocusMove();
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
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-down') {
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'down'));
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-left') {
        // Navigation horizontale UNIQUEMENT — ne jamais ouvrir le sélecteur de dossier
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'left'));
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-right') {
        ui.setSetupFocus(moveSetupFocus(rows, ui.setupFocusIndex, 'right'));
        navVibe();
        afterFocusMove();
      }
      if (action === 'back') {
        document.querySelector('.setup__footer .ghost, .setup .ghost')?.click();
        vibe('light');
      }
      if (action === 'confirm') {
        // Confirm/A : FocusButton + swatches accent (pas seulement .focus-btn)
        const focused = document.querySelector(SETUP_CONFIRM_FOCUS_SELECTOR);
        vibe('confirm');
        focused?.click();
      }
      return;
    }

    if (route === 'library') {
      // B / back = no-op : la bibliothèque est l’accueil (pas de retour boot).
      if (action === 'back') {
        return;
      }
      if (action === 'cursor-up') {
        library.moveCatalog(0, -1);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-down') {
        library.moveCatalog(0, 1);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-left') {
        library.moveCatalog(-1, 0);
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-right') {
        library.moveCatalog(1, 0);
        navVibe();
        afterFocusMove();
      }
      if (action === 'toggle-series') {
        library.toggleViewMode();
        vibe('light');
      }
      if (action === 'open-book' || action === 'confirm') {
        // Header : A active l’item focus (onglet → contenu, actions → route)
        if (library.focusZone === 'nav') {
          const item = library.selectedHeaderNav;
          if (!item) return;
          if (item.kind === 'tab') {
            library.setCatalogTab(item.tab, { keepNav: false });
            vibe('confirm');
            afterFocusMove();
            return;
          }
          if (item.action === 'scan') {
            vibe('light');
            void library.scan();
            return;
          }
          if (item.action === 'import') {
            vibe('light');
            router.push({ name: ROUTE.IMPORT });
            return;
          }
          if (item.action === 'settings') {
            vibe('light');
            router.push({ name: ROUTE.SETTINGS });
            return;
          }
          if (item.action === 'profile') {
            vibe('light');
            clearProfileSelected();
            router.push({ name: ROUTE.PROFILES, query: { manage: '1' } });
            return;
          }
          return;
        }
        if (!library.books.length) {
          router.push({ name: ROUTE.IMPORT });
          return;
        }
        if (library.focusZone === 'series') {
          const target = library.resolveSeriesOpen();
          if (target?.type === 'series' && target.seriesId) {
            vibe('confirm');
            router.push({
              name: ROUTE.LIBRARY_SERIES,
              params: { seriesId: String(target.seriesId) },
            });
          }
          return;
        }
        if (library.focusZone === 'recent') {
          const target = library.resolveRecentOpen();
          if (target?.type === 'series' && target.seriesId) {
            vibe('confirm');
            router.push({
              name: ROUTE.LIBRARY_SERIES,
              params: { seriesId: String(target.seriesId) },
            });
            return;
          }
          if (target?.type === 'book' && target.bookId != null) {
            vibe('confirm');
            router.push({ name: 'book', params: { id: String(target.bookId) } });
          }
          return;
        }
        const book = library.selected;
        if (book?.id) {
          vibe('confirm');
          router.push(bookDetailLocation(book.id, 'library'));
        }
      }
      if (action === 'import') {
        vibe('light');
        router.push({ name: ROUTE.IMPORT });
      }
      if (action === 'settings') {
        vibe('light');
        router.push({ name: ROUTE.SETTINGS });
      }
      /** LB / RB → onglets Bibliothèque / Tous / Récents / Séries */
      if (action === 'tab-next') {
        library.cycleCatalogTab(1);
        vibe('light');
        afterFocusMove();
      }
      if (action === 'tab-prev') {
        library.cycleCatalogTab(-1);
        vibe('light');
        afterFocusMove();
      }
      /** LT / RT → filtre statut */
      if (action === 'filter-next') {
        library.cycleFilter(1);
        vibe('light');
      }
      if (action === 'filter-prev') {
        library.cycleFilter(-1);
        vibe('light');
      }
      return;
    }

    if (
      route === ROUTE.BOOK ||
      route === ROUTE.LIBRARY_BOOK ||
      route === ROUTE.IMPORT_BOOK
    ) {
      if (action === 'back') {
        vibe('light');
        const parent = resolveParentLocation(router.currentRoute.value);
        if (parent?.name === ROUTE.IMPORT) {
          imp.goToList();
          ui.setImportFocusZone('list');
          ui.setImportFocus(0);
        }
        router.push(parent || { name: ROUTE.LIBRARY });
      }
      // ↑↓ / stick : parcours blocs focusables (méta, synopsis…) → scrollIntoView
      // ←→ : même chaîne (footer CTA inclus), comme Import en paysage console.
      if (action === 'cursor-left' || action === 'cursor-up') {
        ui.setBookFocus(clampBookFocus(ui.bookFocusIndex - 1));
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-right' || action === 'cursor-down') {
        ui.setBookFocus(clampBookFocus(ui.bookFocusIndex + 1));
        navVibe();
        afterFocusMove();
      }
      if (action === 'open-book' || action === 'confirm') {
        const intent = resolveBookConfirmAction(ui.bookFocusIndex);
        if (intent === 'activate-action') {
          vibe('confirm');
          document
            .querySelector(
              `.book-detail [data-book-action="${ui.bookFocusIndex}"]`,
            )
            ?.click();
        } else if (intent === 'edit-field') {
          const id = bookFieldDomId(ui.bookFocusIndex);
          const el = id
            ? document.querySelector(
                `.book-detail [data-book-field="${id}"] input, .book-detail [data-book-field="${id}"] textarea`,
              )
            : null;
          void focusTextInputForEdit(el);
          vibe('light');
        }
      }
      if (action === 'settings') {
        router.push({ name: ROUTE.SETTINGS });
      }
      if (action === 'import') {
        router.push({ name: ROUTE.IMPORT });
      }
      return;
    }

    if (route === ROUTE.SERIES || route === ROUTE.LIBRARY_SERIES) {
      const seriesId = router.currentRoute.value.params.seriesId;
      const group = library.getSeriesById(seriesId);
      const volumeCount = group?.volumes?.length || 0;

      if (action === 'back') {
        vibe('light');
        router.push({ name: ROUTE.LIBRARY });
        return;
      }
      if (action === 'cursor-left' || action === 'cursor-up') {
        ui.setSeriesFocus(
          clampSeriesFocus(ui.seriesFocusIndex - 1, volumeCount),
          volumeCount,
        );
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-right' || action === 'cursor-down') {
        ui.setSeriesFocus(
          clampSeriesFocus(ui.seriesFocusIndex + 1, volumeCount),
          volumeCount,
        );
        navVibe();
        afterFocusMove();
      }
      if (action === 'open-book' || action === 'confirm') {
        const kind = seriesFocusKind(ui.seriesFocusIndex, volumeCount);
        if (kind === 'back') {
          vibe('light');
          router.push({ name: ROUTE.LIBRARY });
          return;
        }
        let book = null;
        if (kind === 'volume') {
          book = group?.volumes?.[ui.seriesFocusIndex] || null;
        } else {
          book = group?.nextUnread || group?.volumes?.[0] || null;
        }
        if (book?.id) {
          vibe('confirm');
          router.push(bookDetailLocation(book.id, 'library'));
        }
      }
      if (action === 'settings') {
        router.push({ name: ROUTE.SETTINGS });
      }
      if (action === 'import') {
        router.push({ name: ROUTE.IMPORT });
      }
      return;
    }

    if (isImportUiRoute(route)) {
      // ——— Modal apply champs méta ———
      if (imp.isApplyModalOpen) {
        if (action === 'back') {
          vibe('light');
          imp.cancelApplyEnrich();
          return;
        }
        if (action === 'cursor-up' || action === 'cursor-left') {
          imp.setApplyModalFocus(imp.applyModalFocus - 1);
          afterFocusMove();
          return;
        }
        if (action === 'cursor-down' || action === 'cursor-right') {
          imp.setApplyModalFocus(imp.applyModalFocus + 1);
          afterFocusMove();
          return;
        }
        if (action === 'confirm' || action === 'open-book') {
          const focus = clampMetaApplyFocus(imp.applyModalFocus);
          if (focus === META_APPLY_FOCUS.APPLY) {
            vibe('confirm');
            const cur = router.currentRoute.value;
            const bookId =
              cur.name === ROUTE.IMPORT_BOOK_META ||
              cur.name === ROUTE.LIBRARY_BOOK_META
                ? cur.params.id
                : (imp.metaReturnBookId ?? imp.selected?.existingBookId ?? null);
            imp.confirmApplyEnrich({ bookId });
            afterFocusMove();
            return;
          }
          const field = META_APPLY_FIELDS[focus];
          if (field) {
            imp.toggleApplyField(field.id);
            vibe('light');
          }
          return;
        }
        return;
      }

      // ——— Fiche détail : flows sheet / meta-search ———
      if (imp.isDetail) {
        const resultCount = imp.enrichResults.length;
        const zone = ui.importFocusZone;
        const flow = imp.flow;
        const tab = flow === IMPORT_FLOW.META_SEARCH
          ? IMPORT_DETAIL_TABS.SEARCH
          : IMPORT_DETAIL_TABS.INFOS;
        const fieldMax =
          tab === IMPORT_DETAIL_TABS.SEARCH
            ? IMPORT_SEARCH_FIELDS.MAX
            : IMPORT_INFOS_FIELDS.MAX;
        const clampField =
          tab === IMPORT_DETAIL_TABS.SEARCH
            ? clampSearchFieldFocus
            : clampInfosFieldFocus;

        const current = router.currentRoute.value;

        const goToInfos = () => {
          // Infos = sheet item uniquement — jamais remonter à /import (liste)
          if (current.name === ROUTE.IMPORT_ITEM) return;
          const item = imp.selected;
          if (item?.filePath) {
            router.push(importItemLocation(item.filePath));
            return;
          }
          const parent = resolveParentLocation(current);
          if (parent && parent.name !== ROUTE.IMPORT) {
            router.push(parent);
          }
        };

        const goToSearch = () => {
          if (current.name === ROUTE.IMPORT_ITEM_META) return;
          const item = imp.selected;
          if (item?.filePath) {
            router.push(importItemLocation(item.filePath, { meta: true }));
          }
        };

        const closeToList = () => {
          router.push({ name: ROUTE.IMPORT });
        };

        const goParentRoute = () => {
          const parent = resolveParentLocation(current);
          if (parent) {
            router.push(parent);
            return;
          }
          closeToList();
        };

        // B : toujours route parent (jamais ?from=import)
        if (action === 'back') {
          vibe('light');
          const back = resolveImportBackAction({
            flow,
            metaReturn: imp.metaReturn,
            isDetail: true,
            detailTab: tab,
            zone,
            routeName: current.name,
          });
          if (
            back === 'to-book' ||
            back === 'to-infos' ||
            back === 'to-sheet' ||
            back === 'to-list' ||
            back === 'to-parent'
          ) {
            goParentRoute();
          } else {
            router.push({ name: ROUTE.LIBRARY });
          }
          return;
        }

        // LB / RB : Infos ← / Recherche → (directionnel, pas toggle).
        // Uniquement fiche item (± meta). Méta livre / déjà sur l’onglet → noop.
        if (action === 'tab-prev' || action === 'tab-next') {
          const tabIntent = resolveImportTabAction({
            routeName: current.name,
            direction: action === 'tab-prev' ? -1 : 1,
            detailTab: tab,
          });
          if (tabIntent === 'to-infos') {
            goToInfos();
            vibe('light');
          } else if (tabIntent === 'to-search') {
            goToSearch();
            vibe('light');
          }
          // noop : pas de navigation parasite (liste / parent fiche)
          return;
        }

        const onProvider =
          tab === IMPORT_DETAIL_TABS.SEARCH &&
          zone === 'fields' &&
          ui.importFocusIndex === IMPORT_SEARCH_FIELDS.PROVIDER;

        // Sur provider : ←→ cycle les sources API
        if (onProvider && (action === 'cursor-left' || action === 'cursor-right')) {
          void imp.cycleProvider(action === 'cursor-left' ? -1 : 1);
          afterFocusMove();
          return;
        }

        const goPrev = action === 'cursor-up' || action === 'cursor-left';
        const goNext = action === 'cursor-down' || action === 'cursor-right';

        if (goPrev) {
          if (zone === 'results') {
            if (ui.importFocusIndex > 0) {
              const next = ui.importFocusIndex - 1;
              ui.setImportFocus(next);
              imp.enrichResultCursor = next;
            } else {
              ui.setImportFocusZone('fields');
              ui.setImportFocus(IMPORT_SEARCH_FIELDS.PROVIDER);
            }
          } else {
            ui.setImportFocusZone('fields');
            ui.setImportFocus(clampField(ui.importFocusIndex - 1));
          }
          afterFocusMove();
        }

        if (goNext) {
          if (zone === 'fields') {
            if (ui.importFocusIndex < fieldMax) {
              ui.setImportFocus(clampField(ui.importFocusIndex + 1));
            } else if (tab === IMPORT_DETAIL_TABS.SEARCH && resultCount > 0) {
              try {
                /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
              } catch {
                /* ignore */
              }
              ui.setImportFocusZone('results');
              ui.setImportFocus(0);
              imp.enrichResultCursor = 0;
            }
            // Sinon reste sur dernier champ (plus de footer actions)
          } else if (zone === 'results') {
            if (ui.importFocusIndex < resultCount - 1) {
              const next = ui.importFocusIndex + 1;
              ui.setImportFocus(next);
              imp.enrichResultCursor = next;
            }
          }
          afterFocusMove();
        }

        // A : guards champ / résultat (import = X uniquement)
        if (action === 'confirm') {
          const intent = resolveImportConfirmAction({
            isDetail: true,
            detailTab: tab,
            zone,
            focusIndex: ui.importFocusIndex,
            resultCount,
          });

          if (intent === 'apply-result') {
            // Libérer le focus DOM query (évite course clavier / double-fire)
            try {
              /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
            } catch {
              /* ignore */
            }
            const idx = ui.importFocusIndex;
            vibe('confirm');
            ui.setImportFocusZone('results');
            ui.setImportFocus(idx);
            imp.enrichResultCursor = idx;
            // applyEnrichCursor(idx) : index UI explicite, pas de toggle
            const applied = imp.applyEnrichCursor(idx);
            if (!applied) {
              // Fallback : cursor store si focusIndex désynchronisé
              imp.applyEnrichCursor(imp.enrichResultCursor);
            }
            afterFocusMove();
          } else if (intent === 'run-search') {
            void (async () => {
              await imp.enrich();
              if (imp.enrichResults.length) {
                try {
                  /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
                } catch {
                  /* ignore */
                }
                ui.setImportFocusZone('results');
                ui.setImportFocus(0);
                imp.enrichResultCursor = 0;
              }
              afterFocusMove();
            })();
          } else if (intent === 'focus-provider') {
            document
              .querySelector('.import [data-import-field="provider"] select')
              ?.focus?.();
            vibe('light');
          } else if (intent === 'edit-query' || intent === 'edit-field') {
            const id = importFieldDomId(ui.importFocusIndex, tab);
            const el = document.querySelector(
              `.import [data-import-field="${id}"] input, .import [data-import-field="${id}"] textarea`,
            );
            void focusTextInputForEdit(el);
            vibe('light');
          }
        }

        // X sur fiche = Importer le livre → puis fiche /import/book/:id
        if (action === 'import-one') {
          if (imp.selected && !imp.committing) {
            vibe('confirm');
            void (async () => {
              const result = await imp.commitSelected({ copyToLibrary: true });
              const bookId =
                result?.book?.id ?? imp.selected?.existingBookId;
              if (bookId != null) {
                router.push(bookDetailLocation(bookId, 'import'));
                return;
              }
              closeToList();
            })();
          }
        }

        // Y : sheet → meta-search (route) ; meta-search → lancer search
        if (action === 'import-all' || action === 'enrich') {
          void (async () => {
            if (tab !== IMPORT_DETAIL_TABS.SEARCH) {
              goToSearch();
              return;
            }
            // Sync query depuis le DOM (clavier virtuel)
            const input = document.querySelector(
              '.import [data-import-field="query"] input',
            );
            if (input && typeof input.value === 'string') {
              imp.setSearchQuery(input.value);
            }
            await imp.enrich();
            if (imp.enrichResults.length) {
              try {
                /** @type {HTMLElement|null} */ (document.activeElement)?.blur?.();
              } catch {
                /* ignore */
              }
              ui.setImportFocusZone('results');
              ui.setImportFocus(0);
              imp.enrichResultCursor = 0;
            } else {
              ui.setImportFocusZone('fields');
              ui.setImportFocus(IMPORT_SEARCH_FIELDS.QUERY);
            }
            afterFocusMove();
          })();
        }

        return;
      }

      // ——— Liste fichiers ———
      if (action === 'back') {
        vibe('light');
        router.push({ name: ROUTE.LIBRARY });
      }
      // Navigation liste + header « Tout importer ». Plus de footer actions / Y bulk.
      if (action === 'cursor-up') {
        if (ui.importFocusZone === 'header') {
          afterFocusMove();
          return;
        }
        if (imp.cursor <= 0) {
          ui.setImportFocusZone('header');
          ui.setImportFocus(0);
          afterFocusMove();
          return;
        }
        ui.setImportFocusZone('list');
        imp.moveCursor(-1);
        afterFocusMove();
      }
      if (action === 'cursor-down') {
        if (ui.importFocusZone === 'header') {
          ui.setImportFocusZone('list');
          if (imp.items.length) {
            imp.cursor = Math.max(0, Math.min(imp.cursor, imp.items.length - 1));
          }
          afterFocusMove();
          return;
        }
        ui.setImportFocusZone('list');
        imp.moveCursor(1);
        afterFocusMove();
      }
      if (action === 'confirm') {
        if (ui.importFocusZone === 'header') {
          if (imp.items.length && !imp.committing) {
            vibe('confirm');
            void imp.commitAll({ copyToLibrary: true });
          }
          return;
        }
        // Liste : A = ouvrir fiche /import/book/:id ou /import/item/:key
        vibe('confirm');
        void (async () => {
          const item = imp.selected;
          if (item?.existingBookId != null) {
            router.push(bookDetailLocation(item.existingBookId, 'import'));
            return;
          }
          if (item?.filePath) {
            router.push(importItemLocation(item.filePath));
          }
        })();
      }
      // X = toggle : importer ce tome / retirer de la bibliothèque si ✓
      if (action === 'import-one') {
        if (ui.importFocusZone === 'header') return;
        if (imp.selected && !imp.committing) {
          vibe('confirm');
          void imp.toggleImportOrRemoveSelected({ copyToLibrary: true });
        }
      }
      // Y / enrich : libre sur liste (méta / recherche uniquement en fiche)
      return;
    }

    if (route === 'settings') {
      if (action === 'back') {
        if (ui.listeningForBind) {
          ui.stopListening();
          return;
        }
        vibe('light');
        router.push({ name: ROUTE.LIBRARY });
      }
      const focusItems = [
        ...document.querySelectorAll('.settings [data-settings-item]'),
      ];
      const maxSettings = Math.max(0, focusItems.length - 1);
      if (action === 'cursor-up' || action === 'cursor-left') {
        ui.setSettingsFocus(Math.max(0, ui.settingsFocusIndex - 1));
        navVibe();
        afterFocusMove();
      }
      if (action === 'cursor-down' || action === 'cursor-right') {
        ui.setSettingsFocus(Math.min(maxSettings, ui.settingsFocusIndex + 1));
        navVibe();
        afterFocusMove();
      }
      /** LT / RT uniquement → sections Paramètres */
      if (action === 'tab-prev') {
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active > 0) {
          tabs[active - 1].click();
          vibe('light');
        }
        ui.setSettingsFocus(0);
        afterFocusMove();
      }
      if (action === 'tab-next') {
        const tabs = [...document.querySelectorAll('.settings .tab')];
        const active = tabs.findIndex((t) => t.classList.contains('is-active'));
        if (active >= 0 && active < tabs.length - 1) {
          tabs[active + 1].click();
          vibe('light');
        }
        ui.setSettingsFocus(0);
        afterFocusMove();
      }
      if (action === 'confirm') {
        const el = focusItems[ui.settingsFocusIndex];
        vibe('confirm');
        if (!el) return;
        if (el.matches('input, textarea')) {
          el.focus();
          return;
        }
        el.click();
      }
      return;
    }

    if (route === 'reader') {
      // Modal pause Select : focus trap — A valider, B fermer, D-Pad/stick nav.
      if (reader.hudVisible) {
        if (
          action === 'close-book' ||
          action === 'back' ||
          action === 'toggle-pause' ||
          action === 'toggle-overlay'
        ) {
          vibe('light');
          reader.closeHud();
          return;
        }
        if (
          action === 'cursor-up' ||
          action === 'page-prev' ||
          action === 'zoom-out' ||
          action === 'cursor-left'
        ) {
          reader.moveHudFocus(-1);
          navVibe();
          afterFocusMove();
          return;
        }
        if (
          action === 'cursor-down' ||
          action === 'page-next' ||
          action === 'zoom-in' ||
          action === 'cursor-right'
        ) {
          reader.moveHudFocus(1);
          navVibe();
          afterFocusMove();
          return;
        }
        if (
          action === 'confirm' ||
          action === 'toggle-direction' ||
          action === 'open-book'
        ) {
          vibe('confirm');
          const items = document.querySelectorAll('.hud [data-hud-focus]');
          const el = items[reader.hudFocusIndex];
          el?.click();
          return;
        }
        if (action === 'add-bookmark') {
          vibe('confirm');
          reader.addBookmark();
          return;
        }
        // Bloquer pan / pages / zoom tant que la modal est ouverte.
        return;
      }

      // Écran fin de tome (série) : focus sur boutons adjacent (↑↓ / A).
      // page-prev / zoom / pan restent gérés plus bas pour quitter la dernière page.
      if (reader.showEndSeriesNav) {
        if (
          action === 'cursor-up' ||
          action === 'cursor-left' ||
          action === 'cursor-down' ||
          action === 'cursor-right'
        ) {
          reader.moveEndFocus(
            action === 'cursor-up' || action === 'cursor-left' ? -1 : 1,
          );
          navVibe();
          afterFocusMove();
          return;
        }
        if (
          action === 'confirm' ||
          action === 'toggle-direction' ||
          action === 'open-book'
        ) {
          vibe('confirm');
          const items = document.querySelectorAll('.reader__next [data-end-focus]');
          const el = items[reader.endFocusIndex];
          el?.click();
          return;
        }
      }

      if (action === 'close-book' || action === 'back') {
        vibe('light');
        // Sortie lecture : navigation seule → App.vue fait exitReaderMode une fois.
        reader.close().then(() => {
          router.push({ name: ROUTE.LIBRARY });
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
      if (action === 'reset-zoom' || action === 'toggle-zoom') {
        if (!reader.isStripMode) reader.resetZoom();
      }
      if (action === 'fit-width') {
        if (!reader.isStripMode) reader.setFitWidth();
      }
      if (action === 'add-bookmark') reader.addBookmark();
      if (action === 'next-volume') {
        reader.openNextVolume().then((ok) => {
          if (ok && reader.filePath) {
            const query = { path: reader.filePath };
            if (reader.isStripMode) query.mode = 'strip';
            router.replace({ name: 'reader', query });
          }
        });
      }
      if (action === 'prev-volume') {
        reader.openPrevVolume().then((ok) => {
          if (ok && reader.filePath) {
            const query = { path: reader.filePath };
            if (reader.isStripMode) query.mode = 'strip';
            router.replace({ name: 'reader', query });
          }
        });
      }
      // Mode page : zoom D-Pad ↑/↓ ; pages ←/→.
      // Mode strip : pas de zoom (bord à bord) — ↑/↓ et ←/→ sautent de page ;
      // stick scroll le strip.
      if (reader.isStripMode) {
        if (action === 'zoom-in') reader.stepPage('prev');
        if (action === 'zoom-out') reader.stepPage('next');
      } else {
        if (action === 'zoom-in') reader.zoomBy(1);
        if (action === 'zoom-out') reader.zoomBy(-1);
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
        // Sous +90° CSS : payload = axes physiques ; visualPanToLocal =
        // même rotate(+90° CW) que la page. Sinon payload déjà remappé écran.
        // remapStick inchangé pour modal pause / menus.
        const local = ui.readerCssRotate
          ? visualPanToLocal(payload.x, payload.y)
          : payload;
        if (reader.isStripMode) {
          const strip = document.querySelector('.reader__strip');
          if (strip) {
            strip.scrollTop += local.y * 28;
            strip.scrollLeft += local.x * 10;
          }
        } else {
          reader.pan(local.x, local.y);
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
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pickPad(pads);
      // reader doit venir de handlers — sinon ReferenceError en route reader
      // et la boucle rAF meurt (régression modal pause / stick zoom).
      const { ui, reader } = handlers;
      currentPad = pad;

      refreshOrientation();

      if (lastRouteForHaptic !== ui.routeName) {
        if (lastRouteForHaptic != null) vibe('light');
        lastRouteForHaptic = ui.routeName;
      }

      if (!pad) {
        ui.setGamepadStatus({ connected: false, label: t('gamepad.waiting') });
        ui.setHapticsAvailable(false);
        prevButtons = [];
        stickMenuNav.reset();
      } else {
        const short = pad.id.length > 36 ? `${pad.id.slice(0, 36)}…` : pad.id;
        const hapticOk = hasHaptics(pad);
        ui.setHapticsAvailable(hapticOk);
        const modeLabel = orientation === DeviceOrientation.PORTRAIT_CCW ? t('gamepad.modeReader') : t('gamepad.modeMenus');
        ui.setGamepadStatus({
          connected: true,
          label: `${short} · ${modeLabel}${hapticOk && ui.hapticsEnabled ? ` · ${t('gamepad.rumble')}` : ''}`,
        });

        const rawX = applyDeadzone(pad.axes[0] || 0);
        const rawY = applyDeadzone(pad.axes[1] || 0);

        if (ui.routeName === 'reader') {
          if (reader.hudVisible) {
            // Modal pause : stick = nav focus (comme menus), pas de pan.
            const logical = remapStick(orientation, rawX, rawY);
            const dir = stickMenuNav.update(logical.x, logical.y, performance.now());
            if (dir) {
              const stickPayload = { stickRepeat: stickMenuNav.lastWasRepeat() };
              if (dir === 'up') dispatch('cursor-up', stickPayload);
              else if (dir === 'down') dispatch('cursor-down', stickPayload);
              else if (dir === 'left') dispatch('cursor-left', stickPayload);
              else if (dir === 'right') dispatch('cursor-right', stickPayload);
            }
          } else {
            // Lecteur : pan analogique — pas de focus menu.
            // Sous +90° CSS : axes physiques (identité landscape) ; la rotation
            // stick = page est faite dans visualPanToLocal. Sinon remap portrait.
            stickMenuNav.reset();
            const stick = ui.readerCssRotate
              ? { x: rawX, y: rawY }
              : remapStick(orientation, rawX, rawY);
            if (stick.x !== 0 || stick.y !== 0) {
              const stickAction = resolveAction('stick:left') || 'pan';
              dispatch(stickAction, stick);
            }
          }
        } else if (!ui.listeningForBind) {
          // Menus landscape : stick = D-Pad (cursor-*) via bindings dpad:*.
          // Pas de remap (Haut=Haut). Edge + repeat pour ne pas spammer.
          const dir = stickMenuNav.update(rawX, rawY, performance.now());
          if (dir) {
            const action = resolveAction(`dpad:${dir}`);
            if (action) {
              dispatch(action, { stickRepeat: stickMenuNav.lastWasRepeat() });
            }
          }
        } else {
          stickMenuNav.reset();
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
    } catch (err) {
      console.warn('[VDR] gamepad tick:', err);
    }

    rafId = requestAnimationFrame(tick);
  }

  return { start, stop, bind, refreshOrientation };
}
