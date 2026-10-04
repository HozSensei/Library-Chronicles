/**
 * Vérifie la grille de focus Paramètres (thème / accents en rangées).
 */
import {
  groupSettingsFocusRows,
  moveSettingsFocus,
  settingsFocusRowsFromElements,
} from '../src/shared/settings-focus.js';
import { ACCENT_IDS } from '../src/shared/theme-accents.js';
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// Général : thème (2) + accents (n) + haptics (1)
const accentKeys = ACCENT_IDS.map(() => 'accent');
const generalKeys = ['theme', 'theme', ...accentKeys, null];
const generalRows = groupSettingsFocusRows(generalKeys);

assert(generalRows.length === 3, 'général : 3 rangées (thème, accents, haptics)');
assert(generalRows[0].join(',') === '0,1', 'rangée thème = indices 0,1');
assert(
  generalRows[1].length === ACCENT_IDS.length,
  `rangée accents = ${ACCENT_IDS.length} pastilles`,
);
assert(
  generalRows[2].join(',') === String(2 + ACCENT_IDS.length),
  'haptics = singleton après accents',
);

let idx = 0; // theme-dark
idx = moveSettingsFocus(generalRows, idx, 'down');
assert(idx === 2, '↓ depuis thème → premier accent (pas theme-light)');
idx = 0;
idx = moveSettingsFocus(generalRows, idx, 'right');
assert(idx === 1, '→ thème dark → light');
idx = moveSettingsFocus(generalRows, idx, 'left');
assert(idx === 0, '← thème light → dark');
idx = moveSettingsFocus(generalRows, idx, 'right');
idx = moveSettingsFocus(generalRows, idx, 'down');
assert(
  idx === 3,
  '↓ depuis theme-light (col1) → accent col1 (pas wrap horizontal)',
);
idx = moveSettingsFocus(generalRows, 2, 'up');
assert(idx === 0, '↑ depuis premier accent → theme-dark');
idx = moveSettingsFocus(generalRows, 2, 'right');
assert(idx === 3, '→ dans accents');
const lastAccent = 1 + ACCENT_IDS.length;
idx = moveSettingsFocus(generalRows, lastAccent, 'down');
assert(idx === 2 + ACCENT_IDS.length, '↓ dernier accent → haptics');
idx = moveSettingsFocus(generalRows, 2 + ACCENT_IDS.length, 'left');
assert(
  idx === 2,
  '← sur haptics (singleton) = ↑ → accent col0',
);
idx = moveSettingsFocus(generalRows, 2 + ACCENT_IDS.length, 'up');
assert(idx === 2, '↑ haptics → premier accent');


// Liste verticale sans data-focus-row : ←→ alias ↑↓
const listRows = groupSettingsFocusRows([null, null, null]);
assert(listRows.length === 3, '3 singletons');
assert(moveSettingsFocus(listRows, 1, 'left') === 0, 'liste ← = ↑');
assert(moveSettingsFocus(listRows, 1, 'right') === 2, 'liste → = ↓');

// DOM-like
const fakeEls = [
  { getAttribute: (n) => (n === 'data-focus-row' ? 'theme' : null) },
  { getAttribute: (n) => (n === 'data-focus-row' ? 'theme' : null) },
  { getAttribute: (n) => (n === 'data-focus-row' ? 'accent' : null) },
  { getAttribute: () => null },
];
const fromDom = settingsFocusRowsFromElements(fakeEls);
assert(fromDom.map((r) => r.join(',')).join('|') === '0,1|2|3', 'fromElements');

const gamepad = read('src/renderer/src/composables/useGamepad.js');
assert(
  gamepad.includes('moveSettingsFocus') &&
    gamepad.includes('settingsFocusRowsFromElements'),
  'useGamepad : navigation settings via grille',
);
assert(
  !/settingsFocusIndex\s*-\s*1/.test(
    gamepad.slice(gamepad.indexOf("route === 'settings'")),
  ),
  'useGamepad settings : plus de ±1 linéaire pour ↑↓',
);

const settingsView = read('src/renderer/src/views/SettingsView.vue');
assert(
  settingsView.includes('data-focus-row="theme"') &&
    settingsView.includes('data-focus-row="accent"'),
  'SettingsView : data-focus-row thème + accent',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nsettings-focus OK');
