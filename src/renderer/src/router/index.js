import { createRouter, createWebHashHistory } from 'vue-router';
import BootView from '../views/BootView.vue';
import LibraryView from '../views/LibraryView.vue';
import ReaderView from '../views/ReaderView.vue';
import SetupView from '../views/SetupView.vue';
import ImportView from '../views/ImportView.vue';
import SettingsView from '../views/SettingsView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/setup',
      name: 'setup',
      component: SetupView,
      meta: { transition: 'fade-slide', public: true },
    },
    {
      path: '/',
      name: 'boot',
      component: BootView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/library',
      name: 'library',
      component: LibraryView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/import',
      name: 'import',
      component: ImportView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/reader',
      name: 'reader',
      component: ReaderView,
      meta: { transition: 'reader-in' },
    },
  ],
});

let setupGateChecked = false;
let setupCompleted = false;

export async function ensureSetupGate() {
  if (setupGateChecked) return setupCompleted;
  try {
    const config = await window.vdr.getConfig();
    setupCompleted = Boolean(config.setupCompleted);
  } catch {
    setupCompleted = false;
  }
  setupGateChecked = true;
  return setupCompleted;
}

export function markSetupCompleted() {
  setupCompleted = true;
  setupGateChecked = true;
}

router.beforeEach(async (to) => {
  const done = await ensureSetupGate();
  if (!done && to.name !== 'setup') {
    return { name: 'setup' };
  }
  if (done && to.name === 'setup') {
    return { name: 'boot' };
  }
  return true;
});

export default router;
