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
import { ROUTE } from '../../../shared/app-routes.js';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/profiles',
      name: ROUTE.PROFILES,
      component: ProfilesView,
      meta: { transition: 'fade-slide', profiles: true },
    },
    {
      path: '/setup',
      name: ROUTE.SETUP,
      component: SetupView,
      meta: { transition: 'fade-slide', public: true },
    },
    {
      path: '/',
      name: ROUTE.BOOT,
      component: BootView,
    },
    {
      path: '/library',
      name: ROUTE.LIBRARY,
      component: LibraryView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/library/book/:id',
      name: ROUTE.LIBRARY_BOOK,
      component: BookDetailView,
      meta: { transition: 'fade-slide', parent: ROUTE.LIBRARY },
    },
    {
      path: '/library/book/:id/meta',
      name: ROUTE.LIBRARY_BOOK_META,
      component: ImportView,
      meta: { transition: 'fade-slide', parent: ROUTE.LIBRARY_BOOK },
    },
    {
      path: '/library/series/:seriesId',
      name: ROUTE.LIBRARY_SERIES,
      component: SeriesDetailView,
      meta: { transition: 'fade-slide', parent: ROUTE.LIBRARY },
    },
    {
      path: '/import',
      name: ROUTE.IMPORT,
      component: ImportView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/import/item/:itemKey',
      name: ROUTE.IMPORT_ITEM,
      component: ImportView,
      meta: { transition: 'fade-slide', parent: ROUTE.IMPORT },
    },
    {
      path: '/import/item/:itemKey/meta',
      name: ROUTE.IMPORT_ITEM_META,
      component: ImportView,
      meta: { transition: 'fade-slide', parent: ROUTE.IMPORT_ITEM },
    },
    {
      path: '/import/book/:id',
      name: ROUTE.IMPORT_BOOK,
      component: BookDetailView,
      meta: { transition: 'fade-slide', parent: ROUTE.IMPORT },
    },
    {
      path: '/import/book/:id/meta',
      name: ROUTE.IMPORT_BOOK_META,
      component: ImportView,
      meta: { transition: 'fade-slide', parent: ROUTE.IMPORT_BOOK },
    },
    {
      path: '/book/:id',
      redirect: (to) => ({
        name: ROUTE.LIBRARY_BOOK,
        params: { id: String(to.params.id) },
      }),
    },
    {
      path: '/series/:seriesId',
      redirect: (to) => ({
        name: ROUTE.LIBRARY_SERIES,
        params: { seriesId: String(to.params.seriesId) },
      }),
    },
    {
      path: '/settings',
      name: ROUTE.SETTINGS,
      component: SettingsView,
      meta: { transition: 'fade-slide' },
    },
    {
      path: '/reader',
      name: ROUTE.READER,
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

router.beforeEach(async (to) => {
  const hasProfile = await ensureProfileGate();
  if (!hasProfile) {
    if (to.name !== ROUTE.PROFILES) return { name: ROUTE.PROFILES };
    return true;
  }

  if (to.name === ROUTE.PROFILES && to.query.manage === '1') {
    return true;
  }
  if (to.name === ROUTE.PROFILES) {
    const done = await ensureSetupGate();
    return { name: done ? ROUTE.LIBRARY : ROUTE.SETUP };
  }

  const done = await ensureSetupGate();
  if (!done && to.name !== ROUTE.SETUP) {
    return { name: ROUTE.SETUP };
  }
  if (done && to.name === ROUTE.SETUP) {
    return { name: ROUTE.LIBRARY };
  }

  return true;
});

export default router;
