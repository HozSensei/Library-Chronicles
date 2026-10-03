<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGamepad } from './composables/useGamepad';
import { useUiStore } from './stores/ui';
import { useLibraryStore } from './stores/library';
import { useImportStore } from './stores/import';
import { markSetupCompleted } from './router';
import { sessionOrientationForRoute } from '../../shared/portrait-remap.js';

const router = useRouter();
const ui = useUiStore();
const library = useLibraryStore();
const imp = useImportStore();
const { start, stop, refreshOrientation } = useGamepad();

/** @type {Array<() => void>} */
let unsubs = [];

function syncOrientationSideEffects(orientation) {
  // Ne jamais appliquer un portrait pushé par le main si on n’est pas en lecteur
  const expected = sessionOrientationForRoute(ui.routeName);
  const safe =
    orientation === 'portrait-ccw' && expected !== 'portrait-ccw'
      ? 'landscape'
      : expected;
  ui.applyOrientation(safe);
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
    }
    library.syncColumns('landscape');
    refreshOrientation();
    if (config.setupCompleted) markSetupCompleted();
    try {
      const active = await window.vdr.profiles.getActive();
      if (active?.prefs?.setupCompleted) markSetupCompleted();
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
          if (ui.routeName === 'library' || ui.routeName === 'boot' || ui.routeName === 'book') {
            await library.scan();
          } else {
            await window.vdr.library.scan();
          }
        } catch (err) {
          console.warn('[VDR] watch library:', err);
        }
      }),
    );
    unsubs.push(
      window.vdr.watch.onImportChanged(async () => {
        try {
          if (ui.routeName === 'import') {
            const prev = imp.selected?.filePath;
            await imp.scan();
            if (prev) {
              const idx = imp.items.findIndex((i) => i.filePath === prev);
              if (idx >= 0) {
                imp.cursor = idx;
                await imp.loadDraftFromSelected();
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
});

onUnmounted(() => {
  stop();
  for (const off of unsubs) off();
  unsubs = [];
});

router.afterEach((to) => {
  ui.setRouteName(to.name);
});

/**
 * Resize portrait/landscape UNIQUEMENT entrée/sortie lecteur.
 * Pas de setSessionMode sur les autres changements de route.
 */
watch(
  () => ui.routeName,
  async (name, prev) => {
    if (name === 'reader' && prev !== 'reader') {
      await ui.enterReaderMode();
      refreshOrientation();
    } else if (prev === 'reader' && name !== 'reader') {
      await ui.exitReaderMode();
      ui.applyOrientation('landscape');
      refreshOrientation();
      library.syncColumns('landscape');
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
    :data-orientation="ui.orientation"
    :data-input="ui.inputContext"
  >
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.transition || 'fade-slide'" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>
