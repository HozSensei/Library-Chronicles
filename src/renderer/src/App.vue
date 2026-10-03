<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGamepad } from './composables/useGamepad';
import { useUiStore } from './stores/ui';
import { markSetupCompleted } from './router';

const router = useRouter();
const ui = useUiStore();
const { start, stop } = useGamepad();

onMounted(async () => {
  ui.refreshGamepadHint();
  try {
    const config = await ui.loadConfig();
    if (config.setupCompleted) markSetupCompleted();
  } catch (err) {
    console.warn('[VDR] config:', err);
  }
  start();
});

onUnmounted(() => {
  stop();
});

router.afterEach((to) => {
  ui.setRouteName(to.name);
});
</script>

<template>
  <div class="app-shell" :data-route="ui.routeName" :data-theme="ui.theme">
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
