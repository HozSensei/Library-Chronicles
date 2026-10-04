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
  /formFocus\s*:\s*0\s*=\s*pseudo[\s\S]*2\s*=\s*lang|Focus formulaire[\s\S]*2\s*=\s*lang|FORM_ZONE\.LANG/.test(
    view,
  ),
  'formFocus / FORM_ZONE documente drapeaux (lang)',
);
assert(
  /FORM_ZONE\.SUBMIT|Math\.min\(3,\s*formFocus|formFocus\.value = Math\.min\(3/.test(
    view,
  ),
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

// Assets drapeau réels (pas CSS inventé / croix type Finlande)
assert(
  fs.existsSync(path.join(root, 'src/renderer/src/assets/flags/fr.svg')),
  'asset fr.svg présent',
);
assert(
  fs.existsSync(path.join(root, 'src/renderer/src/assets/flags/en.svg')),
  'asset en.svg (Union Jack) présent',
);
assert(
  view.includes("assets/flags/fr.svg") && view.includes("assets/flags/en.svg"),
  'import SVG drapeaux FR/EN',
);
assert(view.includes('flagSrc'), 'helper flagSrc pour <img>');
assert(
  /<img[\s\S]*locale-flag__face|class="locale-flag__face"[\s\S]*:src="flagSrc/.test(
    view,
  ),
  'drapeaux via <img> SVG',
);
assert(
  !/locale-flag--en\s+\.locale-flag__face\s*\{[\s\S]*linear-gradient/.test(view),
  'pas de faux Union Jack CSS (gradient)',
);

const enSvg = read('src/renderer/src/assets/flags/en.svg');
assert(
  /#012169|#C8102E|#c8102e/i.test(enSvg) && /stroke|#fff/i.test(enSvg),
  'en.svg ressemble à un Union Jack (bleu + croix)',
);
assert(
  !/^[^<]*$/.test(enSvg.trim()) && enSvg.includes('<svg'),
  'en.svg est un SVG valide',
);

// Focus unique : is-active (sélection) ≠ is-focused (ring brass)
assert(view.includes('FORM_ZONE'), 'zones FORM_ZONE pseudo|color|lang|submit');
assert(
  /formFocus === FORM_ZONE\.LANG && selectedLocale === loc/.test(view) ||
    /FORM_ZONE\.LANG && selectedLocale/.test(view),
  'is-focused drapeau seulement si zone lang',
);
assert(
  /\.locale-flag\.is-active[\s\S]*?box-shadow:\s*none/.test(view) ||
    !/\.locale-flag\.is-active\s+\.locale-flag__face\s*\{[^}]*brass-bright/.test(
      view,
    ),
  'langue active sans ring brass (selected ≠ focus)',
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
