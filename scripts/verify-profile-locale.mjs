/**
 * Locale par profil : drapeaux FR/EN sur ProfilesView (UX pastilles couleur),
 * persistence prefs.language, setup/settings sans double source de vérité.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  LOCALES,
  normalizeLocale,
  setLocale,
  t,
} from '../src/shared/i18n.js';
import { setupFocusables } from '../src/shared/setup-focus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// --- i18n core ---
assert(LOCALES.includes('fr') && LOCALES.includes('en'), 'LOCALES fr+en');
assert(normalizeLocale('en-US') === 'en', 'normalize en-US');
assert(normalizeLocale('fr') === 'fr', 'normalize fr');
setLocale('en');
assert(t('profiles.prompt') === 'Who’s reading?', 't EN profiles.prompt');
setLocale('fr');
assert(t('profiles.prompt') === 'Qui lit ?', 't FR profiles.prompt');
assert(Boolean(t('profiles.langAria')), 'clé profiles.langAria');
assert(Boolean(t('profiles.hintLang')), 'clé profiles.hintLang');

// --- ProfilesView UX ---
const view = read('src/renderer/src/views/ProfilesView.vue');
assert(view.includes('profiles__locales'), 'rangée drapeaux dans le formulaire');
assert(view.includes('locale-flag'), 'boutons drapeau');
assert(view.includes('selectedLocale'), 'état locale sélectionnée');
assert(view.includes('cycleLocale'), 'cycle locale ←→');
assert(view.includes('setLocaleFlag'), 'setLocaleFlag au clic');
assert(
  /formFocus\s*:\s*0\s*=\s*pseudo[\s\S]*2\s*=\s*drapeaux|Focus formulaire[\s\S]*2\s*=\s*drapeaux/.test(
    view,
  ),
  'formFocus documente drapeaux',
);
assert(
  /Math\.min\(3,\s*formFocus/.test(view) || /formFocus\.value = Math\.min\(3/.test(view),
  'focus formulaire max 3 (valider)',
);
assert(
  /language[\s\S]*selectedLocale|selectedLocale\.value/.test(view),
  'locale passée à create/update',
);
assert(
  view.includes("ui.applyLanguage(selectedLocale.value)") ||
    view.includes('ui.applyLanguage(selectedLocale'),
  'preview locale au focus/sélection',
);

// --- Store / IPC / DB ---
const store = read('src/renderer/src/stores/profiles.js');
assert(store.includes('applyPrefsToUi'), 'select applique prefs UI');
assert(
  /create\(name,\s*color,\s*language\)/.test(store),
  'create accepte language',
);
assert(
  /language !== undefined[\s\S]*setPrefs/.test(store),
  'update persiste language via setPrefs',
);

const ipc = read('src/main/ipc/profiles.js');
assert(ipc.includes('language: prefs.language'), 'list expose language');

const db = read('src/main/database/profiles.js');
assert(db.includes('normalizeLocale'), 'DB normalise locale');
assert(
  /createProfile\(\{[^}]*language/.test(db),
  'createProfile accepte language',
);

// --- Setup / Settings : profil = source de vérité ---
const setup = read('src/renderer/src/views/SetupView.vue');
assert(!setup.includes('lang-fr'), 'Setup sans picker lang-fr');
assert(!setup.includes('lang-en'), 'Setup sans picker lang-en');
assert(
  !/form\.language\s*=/.test(setup),
  'Setup ne mute plus form.language',
);

const settings = read('src/renderer/src/views/SettingsView.vue');
assert(!settings.includes("setLanguage('fr')"), 'Settings sans setLanguage FR');
assert(!settings.includes("setLanguage('en')"), 'Settings sans setLanguage EN');
assert(
  settings.includes('settings.languageOnProfile'),
  'Settings renvoie vers écran profil',
);

assert(
  !setupFocusables(1).some((id) => String(id).startsWith('lang-')),
  'setup-focus sans rangée langue',
);

const pad = read('src/renderer/src/composables/useGamepad.js');
assert(pad.includes('profiles__locales'), 'manette gère focus drapeaux');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nprofile-locale OK');
