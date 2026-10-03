import { createRouter, createWebHashHistory } from 'vue-router';
import BootView from '../views/BootView.vue';
import LibraryView from '../views/LibraryView.vue';
import BookDetailView from '../views/BookDetailView.vue';
import SeriesDetailView from '../views/SeriesDetailView.vue';
import ReaderView from '../views/ReaderView.vue';
import SetupView from '../views/SetupView.vue';
import ImportView from '../views/ImportView.vue';
import SettingsView from '../views/SettingsView.vue';
import ProfilesView from '../views/ProfilesView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/profiles',
      name: 'profiles',
      component: ProfilesView,
      meta: { transition: 'fade-slide', profiles: true },
    },
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
      path: '/series/:seriesId',
      name: 'series',
      component: SeriesDetailView,
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

let profileGateChecked = false;
let profileSelected = false;
let setupGateChecked = false;
let setupCompleted = false;

export async function ensureProfileGate() {
  if (profileGateChecked) return profileSelected;
  try {
    const config = await window.vdr.getConfig();
    profileSelected = Boolean(config.profileSelected && config.activeProfileId);
  } catch {
    profileSelected = false;
  }
  profileGateChecked = true;
  return profileSelected;
}

export async function ensureSetupGate() {
  if (setupGateChecked) return setupCompleted;
  try {
    const active = await window.vdr.profiles.getActive();
    // Setup par profil — prefs.setupCompleted prioritaire
    if (active?.prefs) {
      setupCompleted = Boolean(active.prefs.setupCompleted);
    } else {
      const config = await window.vdr.getConfig();
      setupCompleted = Boolean(config.setupCompleted);
    }
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

export function markProfileSelected() {
  profileSelected = true;
  profileGateChecked = true;
}

export function clearProfileSelected() {
  profileSelected = false;
  profileGateChecked = true;
  setupCompleted = false;
  setupGateChecked = false;
  window.vdr?.setConfig?.({ profileSelected: false });
}

export function clearSetupGate() {
  setupCompleted = false;
  setupGateChecked = false;
}

/**
 * Flux : Profils (1er) → Setup (par profil) → app.
 */
router.beforeEach(async (to) => {
  // 1) Toujours choisir un profil en premier
  const hasProfile = await ensureProfileGate();
  if (!hasProfile) {
    if (to.name !== 'profiles') return { name: 'profiles' };
    return true;
  }

  // Gestion profils depuis Paramètres (?manage=1)
  if (to.name === 'profiles' && to.query.manage === '1') {
    return true;
  }
  if (to.name === 'profiles') {
    const done = await ensureSetupGate();
    return { name: done ? 'library' : 'setup' };
  }

  // 2) Setup du profil actif
  const done = await ensureSetupGate();
  if (!done && to.name !== 'setup') {
    return { name: 'setup' };
  }
  if (done && to.name === 'setup') {
    return { name: 'library' };
  }

  return true;
});

export default router;
