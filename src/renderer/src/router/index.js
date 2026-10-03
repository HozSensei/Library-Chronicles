import { createRouter, createWebHashHistory } from 'vue-router';
import BootView from '../views/BootView.vue';
import LibraryView from '../views/LibraryView.vue';
import BookDetailView from '../views/BookDetailView.vue';
import ReaderView from '../views/ReaderView.vue';
import SetupView from '../views/SetupView.vue';
import ImportView from '../views/ImportView.vue';
import SettingsView from '../views/SettingsView.vue';
import ProfilesView from '../views/ProfilesView.vue';

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
      path: '/profiles',
      name: 'profiles',
      component: ProfilesView,
      meta: { transition: 'fade-slide', profiles: true },
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
      path: '/book/:id',
      name: 'book',
      component: BookDetailView,
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
let profileGateChecked = false;
let profileSelected = false;

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

export async function ensureProfileGate() {
  if (profileGateChecked) return profileSelected;
  try {
    const config = await window.vdr.getConfig();
    profileSelected = Boolean(config.profileSelected);
  } catch {
    profileSelected = false;
  }
  profileGateChecked = true;
  return profileSelected;
}

export function markSetupCompleted() {
  setupCompleted = true;
  setupGateChecked = true;
}

export function markProfileSelected() {
  profileSelected = true;
  profileGateChecked = true;
}

export function clearProfileSelected() {
  profileSelected = false;
  profileGateChecked = true;
  window.vdr?.setConfig?.({ profileSelected: false });
}

router.beforeEach(async (to) => {
  const done = await ensureSetupGate();
  if (!done && to.name !== 'setup') {
    return { name: 'setup' };
  }
  if (done && to.name === 'setup') {
    return { name: 'profiles' };
  }

  if (!done) return true;

  const hasProfile = await ensureProfileGate();
  if (!hasProfile && to.name !== 'profiles') {
    return { name: 'profiles' };
  }
  // Gestion profils depuis Paramètres (?manage=1) même si déjà choisi
  if (hasProfile && to.name === 'profiles' && to.query.manage !== '1') {
    return { name: 'boot' };
  }
  return true;
});

export default router;
