<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppToast from './components/AppToast.vue';
import { useGamepad } from './composables/useGamepad';
import { useBrandFavicon } from './composables/useBrandFavicon';
import { useUiStore } from './stores/ui';
import { useLibraryStore } from './stores/library';
import { useImportStore } from './stores/import';
import { useProfilesStore } from './stores/profiles';
import { markSetupCompleted } from './router';
import { sessionOrientationForRoute } from '../../shared/portrait-remap.js';
import { installVirtualKeyboardOnFocus } from '../../shared/virtual-keyboard.js';
import { viewTransitionKey } from '../../shared/app-routes.js';

const router = useRouter();
const ui = useUiStore();
const library = useLibraryStore();
const imp = useImportStore();
const profiles = useProfilesStore();
const { start, stop, refreshOrientation } = useGamepad();
useBrandFavicon();

/** @type {Array<() => void>} */
let unsubs = [];
/** @type {(() => void) | null} */
let uninstallVk = null;

/** Évite double enter/exit (watch + autre appel concurrent). */
let sessionTransition = Promise.resolve();

function queueSession(fn) {
  sessionTransition = sessionTransition.then(fn).catch((err) => {
    console.warn('[VDR] session mode:', err);
  });
  return sessionTransition;
}

function syncOrientationSideEffects(orientation) {
  // Ne jamais appliquer un portrait pushé par le main si on n’est pas en lecteur
  const expected = sessionOrientationForRoute(ui.routeName);
  const safe =
    orientation === 'portrait-ccw' && expected !== 'portrait-ccw'
      ? 'landscape'
      : expected;
  ui.applyOrientation(safe);
  // Lecteur : garder +90° CSS même si un event orientation arrive sans cssRotate.
  ui.setReaderCssRotate(safe === 'portrait-ccw');
  library.syncColumns('landscape');
  refreshOrientation();
}

onMounted(async () => {
  ui.refreshGamepadHint();
  try {
    const config = await ui.loadConfig();
    // Boot menus : sync orientation store (resize déjà fait à createWindow ;
    // setSessionMode ui sans force = no-op si déjà landscape → pas de saut).
    if (ui.routeName !== 'reader') {
      await ui.setSessionMode('ui');
      ui.applyOrientation('landscape');
      ui.setReaderCssRotate(false);
    }
    library.syncColumns('landscape');
    refreshOrientation();
    if (config.setupCompleted) markSetupCompleted();
    try {
      await profiles.refresh();
      if (profiles.prefs?.setupCompleted) markSetupCompleted();
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn('[VDR] config:', err);
  }

  if (window.vdr?.onOrientationChanged) {
    unsubs.push(
      window.vdr.onOrientationChanged((payload) => {
        syncOrientationSideEffects(payload?.orientation || ui.orientation);
      }),
    );
  }

  if (window.vdr?.watch) {
    unsubs.push(
      window.vdr.watch.onLibraryChanged(async () => {
        try {
          // Incrémental : n’ouvre pas les archives déjà indexées (évite rescans lourds).
          if (
            ui.routeName === 'library' ||
            ui.routeName === 'boot' ||
            ui.routeName === 'book' ||
            ui.routeName === 'library-book' ||
            ui.routeName === 'import-book' ||
            ui.routeName === 'series' ||
            ui.routeName === 'library-series'
          ) {
            await library.syncFromWatch();
          } else {
            await window.vdr.library.scan({ force: false });
            library.invalidate();
          }
        } catch (err) {
          console.warn('[VDR] watch library:', err);
        }
      }),
    );
    unsubs.push(
      window.vdr.watch.onImportChanged(async () => {
        try {
          if (
            ui.routeName === 'import' ||
            ui.routeName === 'import-item' ||
            ui.routeName === 'import-item-meta' ||
            ui.routeName === 'import-book-meta' ||
            ui.routeName === 'library-book-meta'
          ) {
            const prev = imp.selected?.filePath;
            // reloadDraft:false — un seul hydrate après restore du cursor
            // (évite draft rempli par scan puis ré-écrasé).
            await imp.scan({ reloadDraft: false });
            if (prev) {
              const idx = imp.items.findIndex((i) => i.filePath === prev);
              if (idx >= 0) {
                imp.cursor = idx;
                if (imp.viewMode === 'detail') {
                  await imp.loadDraftFromSelected({ keepResults: true });
                }
              }
            }
          }
        } catch (err) {
          console.warn('[VDR] watch import:', err);
        }
      }),
    );
  }

  start();
  uninstallVk = installVirtualKeyboardOnFocus(document);
});

onUnmounted(() => {
  stop();
  uninstallVk?.();
  uninstallVk = null;
  for (const off of unsubs) off();
  unsubs = [];
});

router.afterEach((to) => {
  ui.setRouteName(to.name);
});

/**
 * Entrée/sortie lecteur : orientation logique + CSS rotate.
 * Fenêtre reste landscape (stratégie B) — setSessionMode ne shrink pas.
 * Pas de setSessionMode sur fiche livre, grille, import, setup, etc.
 */
watch(
  () => ui.routeName,
  (name, prev) => {
    if (name === 'reader' && prev !== 'reader') {
      queueSession(async () => {
        await ui.enterReaderMode();
        refreshOrientation();
      });
    } else if (prev === 'reader' && name !== 'reader') {
      queueSession(async () => {
        await ui.exitReaderMode();
        ui.applyOrientation('landscape');
        ui.setReaderCssRotate(false);
        refreshOrientation();
        library.syncColumns('landscape');
      });
    } else {
      refreshOrientation();
    }
  },
);
</script>

<template>
  <div
    class="app-shell"
    :data-route="ui.routeName"
    :data-theme="ui.theme"
    :data-accent="ui.accent"
    :data-orientation="ui.orientation"
    :data-reader-rotate="ui.readerCssRotate ? '1' : '0'"
    :data-input="ui.inputContext"
  >
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.transition || 'fade-slide'" mode="out-in">
        <!-- Clé stable import-shell : pas de remount liste↔fiche↔méta (évite flash). -->
        <component :is="Component" :key="viewTransitionKey(route)" />
      </Transition>
    </RouterView>
    <AppToast />
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
  position: relative;
  box-sizing: border-box;
}

/* Padding L/R menus — évite les halos focus rognés aux bords (hors lecteur). */
.app-shell:not([data-route='reader']) {
  padding-inline: var(--shell-inset-x);
}
</style>
