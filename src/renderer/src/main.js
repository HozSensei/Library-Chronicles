import { createApp } from 'vue';
import { createPinia } from 'pinia';
/* Titres UI — Grenze (sérif fantasy, proche du wordmark LitRPG Chronicles) */
import '@fontsource/grenze/600.css';
import '@fontsource/grenze/700.css';
import '@fontsource/grenze/800.css';
import '@fontsource/grenze/900.css';
/* Corps — Figtree inchangé */
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import App from './App.vue';
import router from './router';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/orientation.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
