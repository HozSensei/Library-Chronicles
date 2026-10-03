<script setup>
import { onMounted, onUnmounted } from 'vue';
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
  library.syncColumns(orientation);
  refreshOrientation();
}

function onDevOrientationToggle(event) {
  // Raccourci dev : Ctrl+Shift+L (landscape ↔ portrait)
  if (!(event.ctrlKey && event.shiftKey) || event.key.toLowerCase() !== 'l') {
    return;
  }
  event.preventDefault();
  ui.toggleOrientation().then(() => {
    syncOrientationSideEffects(ui.orientation);
  });
}

onMounted(async () => {
  ui.refreshGamepadHint();
  try {
    const config = await ui.loadConfig();
    library.syncColumns(ui.orientation);
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
        // Rescan + refresh liste quand des fichiers arrivent / partent
        try {
          if (ui.routeName === 'library' || ui.routeName === 'boot') {
            await library.scan();
          } else {
            // Index silencieux hors écran bibliothèque
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

  window.addEventListener('keydown', onDevOrientationToggle);
  start();
});

onUnmounted(() => {
  stop();
  window.removeEventListener('keydown', onDevOrientationToggle);
  for (const off of unsubs) off();
  unsubs = [];
});

router.afterEach((to) => {
  ui.setRouteName(to.name);
});
</script>

<template>
  <div
    class="app-shell"
    :data-route="ui.routeName"
    :data-theme="ui.theme"
    :data-orientation="ui.orientation"
  >
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.transition || 'fade-slide'" mode="out-in">
        <component :is="Component" :key="route.path" />
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
