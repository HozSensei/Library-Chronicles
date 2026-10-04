/**
 * Vérifie le module i18n FR/EN (locale, t, accents).
 */
import {
  DEFAULT_LOCALE,
  LOCALES,
  getLocale,
  interpolate,
  normalizeLocale,
  setLocale,
  t,
  accentLabelI18n,
  MESSAGES,
} from '../src/shared/i18n.js';
import { accentLabel } from '../src/shared/theme-accents.js';
import { setupFocusRows, setupFocusables } from '../src/shared/setup-focus.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

assert(DEFAULT_LOCALE === 'fr', 'locale défaut fr');
assert(LOCALES.includes('fr') && LOCALES.includes('en'), 'LOCALES fr+en');
assert(normalizeLocale('en') === 'en', 'normalize en');
assert(normalizeLocale('anglais') === 'en', 'normalize anglais');
assert(normalizeLocale('EN-US') === 'en', 'normalize EN-US');
assert(normalizeLocale('fr') === 'fr', 'normalize fr');
assert(normalizeLocale('de') === 'fr', 'inconnu → fr');

setLocale('en');
assert(getLocale() === 'en', 'setLocale en');
assert(t('lang.en') === 'English', 't lang.en');
assert(t('setup.prefsTitle') === 'Preferences', 't setup prefs EN');
assert(t('boot.library') === 'Library', 't boot library EN');
assert(accentLabel('amber') === 'Brass', 'accentLabel amber EN');
assert(accentLabelI18n('blue', 'en') === 'Blue', 'accentLabelI18n blue EN');
assert(t('book.read') === 'Read page by page', 't book.read EN');
assert(t('book.readStrip') === 'Read continuously', 't book.readStrip EN');
assert(t('book.readEpub') === 'Read EPUB', 't book.readEpub EN');
assert(t('book.readEpubSub') === 'Text · basic reader', 't book.readEpubSub EN');
assert(
  t('book.readFormatIncompatible') === 'Format not compatible',
  't book.readFormatIncompatible EN',
);
assert(
  t('book.readStripUnsupported') === 'Format not compatible',
  't book.readStripUnsupported EN',
);

setLocale('fr');
assert(t('lang.fr') === 'Français', 't lang.fr');
assert(t('book.read') === 'Lire page par page', 't book.read FR');
assert(t('book.readStrip') === 'Lire en continu', 't book.readStrip FR');
assert(t('book.readSub') === 'Une page à la fois', 't book.readSub FR');
assert(t('book.readEpub') === 'Lire EPUB', 't book.readEpub FR');
assert(t('book.readEpubSub') === 'Texte · lecteur basique', 't book.readEpubSub FR');
assert(
  t('book.readFormatIncompatible') === 'Format non compatible',
  't book.readFormatIncompatible FR',
);
assert(
  t('book.readStripUnsupported') === 'Format non compatible',
  't book.readStripUnsupported FR',
);
assert(accentLabel('amber') === 'Laiton', 'accentLabel amber FR');
assert(interpolate('Hello {name}', { name: 'VDR' }) === 'Hello VDR', 'interpolate');
assert(t('missing.key.zzz') === 'missing.key.zzz', 'missing key → key');

assert(t('toast.readerStartMenu') === 'Start · Menu lecteur', 'toast Start FR');
assert(t('reader.fullscreen') === 'Plein écran', 'reader.fullscreen FR');
assert(t('reader.fullscreenExit') === 'Quitter plein écran', 'reader.fullscreenExit FR');
setLocale('en');
assert(t('toast.readerStartMenu') === 'Start · Reader menu', 'toast Start EN');
assert(t('reader.fullscreen') === 'Fullscreen', 'reader.fullscreen EN');
assert(t('reader.fullscreenExit') === 'Exit fullscreen', 'reader.fullscreenExit EN');
setLocale('fr');

// Dictionnaires couvrent les namespaces UI
for (const loc of ['fr', 'en']) {
  for (const ns of [
    'boot',
    'setup',
    'profiles',
    'library',
    'settings',
    'import',
    'book',
    'seriesDetail',
    'reader',
    'toast',
    'lang',
  ]) {
    assert(MESSAGES[loc][ns] && typeof MESSAGES[loc][ns] === 'object', `${loc}.${ns} présent`);
  }
}

// Setup focus inclut Anglais
const prefs = setupFocusRows(1);
const flat = setupFocusables(1);
assert(flat.includes('lang-fr') && flat.includes('lang-en'), 'setup focus lang-fr + lang-en');
assert(prefs.some((row) => row.includes('lang-fr') && row.includes('lang-en')), 'langue côte à côte');

// Vues branchées
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
const setup = read('src/renderer/src/views/SetupView.vue');
assert(setup.includes("setLanguage('en')") || setup.includes('lang-en'), 'SetupView switch EN');
assert(setup.includes('useI18n'), 'SetupView useI18n');
const settings = read('src/renderer/src/views/SettingsView.vue');
assert(settings.includes("setLanguage('en')"), 'SettingsView setLanguage en');
assert(settings.includes('useI18n'), 'SettingsView useI18n');
const uiStore = read('src/renderer/src/stores/ui.js');
assert(uiStore.includes('async setLanguage'), 'ui.setLanguage');
assert(uiStore.includes('applyLanguage'), 'ui.applyLanguage');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\ni18n OK');
