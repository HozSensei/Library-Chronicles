/**
 * Vérifie le système de toasts UI globaux (hors HUD progression lecteur).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

const toastStore = readFileSync(
  join(root, 'src/renderer/src/stores/toast.js'),
  'utf8',
);
const appToast = readFileSync(
  join(root, 'src/renderer/src/components/AppToast.vue'),
  'utf8',
);
const app = readFileSync(join(root, 'src/renderer/src/App.vue'), 'utf8');
const tokens = readFileSync(
  join(root, 'src/renderer/src/styles/tokens.css'),
  'utf8',
);
const importStore = readFileSync(
  join(root, 'src/renderer/src/stores/import.js'),
  'utf8',
);
const libraryStore = readFileSync(
  join(root, 'src/renderer/src/stores/library.js'),
  'utf8',
);
const profilesStore = readFileSync(
  join(root, 'src/renderer/src/stores/profiles.js'),
  'utf8',
);
const readerHud = readFileSync(
  join(root, 'src/renderer/src/components/ReaderHud.vue'),
  'utf8',
);

assert(toastStore.includes("defineStore('toast'"), 'store toast Pinia');
assert(toastStore.includes('success(message'), 'API toast.success');
assert(toastStore.includes('info(message'), 'API toast.info');
assert(toastStore.includes('error(message'), 'API toast.error');
assert(toastStore.includes('duration'), 'auto-dismiss duration');
assert(
  /type === 'error'[\s\S]*?3200|2400/.test(toastStore) ||
    toastStore.includes('2400'),
  'dismiss ~2–3s',
);

assert(appToast.includes('app-toast'), 'composant AppToast');
assert(appToast.includes('aria-live="polite"'), 'aria-live polite');
assert(appToast.includes('data-type'), 'types success/info/error');
assert(appToast.includes('var(--success)'), 'token success');
assert(appToast.includes('var(--danger)'), 'token danger');
assert(appToast.includes('var(--brass'), 'token brass (pas purple)');
assert(!/purple|#7c3aed|#8b5cf6/i.test(appToast), 'pas de purple AI');

assert(app.includes('AppToast'), 'AppToast monté dans App.vue');
assert(tokens.includes('--z-toast:'), 'token --z-toast');

assert(
  importStore.includes("success('Métadonnées appliquées')"),
  'toast apply enrich meta',
);
assert(
  importStore.includes("t('toast.imported'") ||
    importStore.includes('toast.imported'),
  'toast commit import succès',
);
assert(
  importStore.includes("t('toast.importFail'") ||
    importStore.includes('toast.importFail'),
  'toast commit import échec',
);
assert(
  importStore.includes("t('toast.removed'") ||
    importStore.includes('toast.removed'),
  'toast retrait bibliothèque',
);

assert(
  libraryStore.includes("t('toast.libraryScanned'") ||
    libraryStore.includes('toast.libraryScanned'),
  'toast scan library (UI)',
);
assert(
  !/syncFromWatch[\s\S]{0,400}useToastStore/.test(libraryStore),
  'pas de toast spam sur watcher syncFromWatch',
);
assert(
  libraryStore.includes("t('toast.sheetSaved'") ||
    libraryStore.includes('toast.sheetSaved'),
  'toast save book meta',
);

assert(
  profilesStore.includes("t('toast.profileCreated'") ||
    profilesStore.includes('toast.profileCreated'),
  'toast create profile',
);

assert(
  readerHud.includes('hud-toast'),
  'HUD toast lecteur conservé (distinct)',
);

const readerView = readFileSync(
  join(root, 'src/renderer/src/views/ReaderView.vue'),
  'utf8',
);
assert(
  readerView.includes('toast.readerStartMenu'),
  'toast Start menu à l’ouverture lecteur',
);
assert(
  readerView.includes('useToastStore') && readerView.includes('duration: 3000'),
  'toast ouverture ~3s via useToastStore',
);

const i18n = readFileSync(join(root, 'src/shared/i18n.js'), 'utf8');
assert(
  i18n.includes('readerStartMenu:') && i18n.includes('Start · Menu lecteur'),
  'i18n FR toast.readerStartMenu',
);
assert(i18n.includes('Start · Reader menu'), 'i18n EN toast.readerStartMenu');

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll toast checks passed');
