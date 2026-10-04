/**
 * Vérifie accents / thème (normalisation + grille setup + auto-apply focus).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ACCENTS,
  ACCENT_IDS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  accentFocusIds,
  accentLabel,
  normalizeAccent,
  normalizeTheme,
} from '../src/shared/theme-accents.js';
import {
  setupFocusRows,
  moveSetupFocus,
  setupFocusables,
  SETUP_CONFIRM_FOCUS_SELECTOR,
} from '../src/shared/setup-focus.js';

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

assert(DEFAULT_THEME === 'dark', 'thème défaut sombre');
assert(DEFAULT_ACCENT === 'amber', 'accent défaut laiton');
assert(ACCENT_IDS.length >= 6, 'au moins 6 accents');
assert(
  ['blue', 'orange', 'green', 'amber', 'rose', 'violet'].every((id) =>
    ACCENT_IDS.includes(id),
  ),
  'accents attendus présents',
);
assert(normalizeAccent('violet') === 'violet', 'normalize violet');
assert(normalizeAccent('STEAM') === DEFAULT_ACCENT, 'inconnu → défaut');
assert(normalizeTheme('light') === 'light', 'normalize light');
assert(normalizeTheme('cyan') === 'dark', 'thème invalide → dark');
assert(accentLabel('rose') === 'Rose', 'label rose');
assert(
  ACCENTS.every((a) => /^#[0-9a-f]{6}$/i.test(a.swatch)),
  'swatches hex',
);
assert(
  !ACCENTS.some((a) => /#1a9fff|#66c0f4|#3d9be9/i.test(a.swatch)),
  'pas de cyan Steam Deck dans les swatches',
);

const prefs = setupFocusRows(1);
assert(prefs.length === 3, 'prefs : mode + accents + next');
assert(prefs[0].join(',') === 'theme-dark,theme-light', 'mode côte à côte');
assert(prefs[1].join(',') === accentFocusIds().join(','), 'rangée accents');
let idx = moveSetupFocus(prefs, 0, 'down');
assert(setupFocusables(1)[idx] === 'accent-blue', '↓ mode → premier accent');
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(1)[idx] === 'accent-orange', '←→ accents');
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(1)[idx] === 'accent-green', '←→ vert');

assert(
  SETUP_CONFIRM_FOCUS_SELECTOR.includes('accent-swatch'),
  'A/confirm setup inclut les swatches accent (confirm inoffensif)',
);

// Auto-apply au focus (parité couleur profil) — Setup + Settings
const setupView = read('src/renderer/src/views/SetupView.vue');
assert(
  setupView.includes('watch(focusedId') &&
    setupView.includes("id === 'theme-dark'") &&
    setupView.includes("startsWith('accent-')") &&
    setupView.includes('fromAppearance') &&
    /watch\(focusedId[\s\S]{0,500}setAccent[\s\S]{0,500}setTheme/.test(
      setupView,
    ),
  'setup : thème + accent appliqués au focus (watch focusedId)',
);

const settingsView = read('src/renderer/src/views/SettingsView.vue');
assert(
  settingsView.includes("key: 'LB/RB'") &&
    !settingsView.includes("key: 'LT/RT'"),
  'settings hints : LB/RB sections (pas LT/RT)',
);
assert(
  settingsView.includes('void setTheme') &&
    settingsView.includes('void setAccent') &&
    settingsView.includes('prevSec') &&
    settingsView.includes('data-focus-row="theme"') &&
    settingsView.includes('data-focus-row="accent"') &&
    /settingsFocusIndex[\s\S]{0,600}setAccent[\s\S]{0,400}setTheme/.test(
      settingsView,
    ),
  'settings : thème + accent au focus + data-focus-row (grille ←→)',
);

const gamepad = read('src/renderer/src/composables/useGamepad.js');
assert(
  gamepad.includes('moveSettingsFocus') &&
    gamepad.includes('settingsFocusRowsFromElements'),
  'settings gamepad : grille moveSettingsFocus (↓ ne traverse pas le thème)',
);

const keys = read('src/shared/key-bindings.js');
assert(
  keys.includes("GamepadButtons.LB}`]: 'tab-prev'") &&
    keys.includes("GamepadButtons.RB}`]: 'tab-next'") &&
    /settings:[\s\S]{0,400}GamepadButtons\.LB[\s\S]{0,80}tab-prev/.test(keys),
  'settings défauts : LB/RB = sections',
);
assert(
  !/settings:[\s\S]{0,400}GamepadButtons\.LT[\s\S]{0,80}tab-prev/.test(keys),
  'settings défauts : plus de LT = tab-prev',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\ntheme-accents OK');
