import { createRouter, createWebHashHistory } from 'vue-router';
import BootView from '../views/BootView.vue';
import LibraryView from '../views/LibraryView.vue';
import ReaderView from '../views/ReaderView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
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
      path: '/reader',
      name: 'reader',
      component: ReaderView,
      meta: { transition: 'reader-in' },
    },
  ],
});

export default router;
