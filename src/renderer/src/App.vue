<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGamepad } from './composables/useGamepad';
import { useUiStore } from './stores/ui';
import { useLibraryStore } from './stores/library';
import { useImportStore } from './stores/import';
import { markSetupCompleted } from './router';

const router = useRouter();
const ui = useUiStore();
const library = useLibraryStore();
const imp = useImportStore();
const { start, stop, refreshOrientation } = useGamepad();

/** @type {Array<() => void>} */
let unsubs = [];

function syncOrientationSideEffects(orientation) {
  ui.applyOrientation(orientation);
  library.syncColumns(orientation === 'portrait-ccw' ? 'portrait-ccw' : 'landscape');
  refreshOrientation();
}

onMounted(async () => {
  ui.refreshGamepadHint();
  try {
    const config = await ui.loadConfig();
    // Force landscape au démarrage (menus) sauf si déjà sur lecteur
    if (ui.routeName !== 'reader') {
      await ui.exitReaderMode();
    }
    library.syncColumns('landscape');
    if (config.setupCompleted) markSetupCompleted();
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

watch(
  () => ui.routeName,
  async (name, prev) => {
    if (name === 'reader' && prev !== 'reader') {
      await ui.enterReaderMode();
      refreshOrientation();
      library.syncColumns('portrait-ccw');
    } else if (prev === 'reader' && name !== 'reader') {
      await ui.exitReaderMode();
      refreshOrientation();
      library.syncColumns('landscape');
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
