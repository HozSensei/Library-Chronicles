/**
 * Vérifie la grille de focus setup (←→ rangée, ↑↓ étapes/rangées).
 */
import {
  setupFocusRows,
  setupFocusables,
  moveSetupFocus,
  indexToRowCol,
  SETUP_FOLDER_IDS,
  SETUP_CONFIRM_FOCUS_SELECTOR,
} from '../src/shared/setup-focus.js';
import {
  clampSizeToWorkArea,
  centerInWorkArea,
  boundsForOrientation,
  LANDSCAPE_BOUNDS,
} from '../src/main/window-bounds.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

// Pas d’étape welcome : step 0 = dossiers empilés
assert(setupFocusRows(0)[0]?.[0] === 'library', 'step 0 démarre sur dossiers (pas welcome)');
assert(
  !setupFocusables(0).includes('welcome') && setupFocusables(0)[0] === 'library',
  'pas de splash welcome dans le focus',
);

// Étape dossiers : library, import, next — chacun sa rangée (stack vertical)
const folders = setupFocusRows(0);
assert(folders.length === 3, 'dossiers : 3 rangées empilées');
assert(folders[0].join(',') === 'library', 'rangée bibliothèque seule');
assert(folders[1].join(',') === 'import', 'rangée import seule');
assert(folders[2].join(',') === 'next', 'rangée continuer');
assert(setupFocusables(0).join(',') === 'library,import,next', 'flat dossiers');

let idx = 0; // library
idx = moveSetupFocus(folders, idx, 'right');
assert(setupFocusables(0)[idx] === 'library', '←→ : une seule option = stay');
idx = moveSetupFocus(folders, idx, 'down');
assert(setupFocusables(0)[idx] === 'import', '↓ : library → import');
idx = moveSetupFocus(folders, idx, 'down');
assert(setupFocusables(0)[idx] === 'next', '↓ : import → next');
idx = moveSetupFocus(folders, idx, 'up');
assert(setupFocusables(0)[idx] === 'import', '↑ : next → import');

// Préférences = step 1
const prefs = setupFocusRows(1);
assert(prefs.length === 4, 'prefs : 4 rangées (mode, accents, langue, next)');
assert(prefs[2].join(',') === 'lang-fr,lang-en', 'langue FR+EN côte à côte');
idx = 0;
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(1)[idx] === 'theme-light', 'thème → light');
idx = moveSetupFocus(prefs, idx, 'left');
assert(setupFocusables(1)[idx] === 'theme-dark', 'thème ← dark');
idx = moveSetupFocus(prefs, idx, 'down');
assert(String(setupFocusables(1)[idx]).startsWith('accent-'), '↓ → rangée accents');
idx = moveSetupFocus(prefs, idx, 'right');
assert(String(setupFocusables(1)[idx]).startsWith('accent-'), '←→ dans accents');

assert(setupFocusRows(2).flat().join(',') === 'finish', 'step 2 = prêt / finish');

assert(SETUP_FOLDER_IDS.has('library') && SETUP_FOLDER_IDS.has('import'), 'ids dossier connus');

// Confirm/A doit cibler FocusButton ET swatches accent (sinon A ignore la couleur focusée)
assert(
  SETUP_CONFIRM_FOCUS_SELECTOR.includes('.focus-btn.is-focused'),
  'confirm setup : FocusButton',
);
assert(
  SETUP_CONFIRM_FOCUS_SELECTOR.includes('.accent-swatch.is-focused'),
  'confirm setup : swatch accent (A sélectionne la couleur)',
);

// moveSetupFocus ne « clique » jamais — pure navigation d’index
const before = indexToRowCol(folders, 0);
const afterLeft = moveSetupFocus(folders, 0, 'left');
assert(afterLeft === 0, 'gauche sur premier item = stay (pas back / pas dialog)');
assert(before.row === 0 && before.col === 0, 'index 0 = row0 col0');

// Fenêtre 1080p clampée
const small = { x: 0, y: 0, width: 1366, height: 768 };
const clamped = clampSizeToWorkArea(LANDSCAPE_BOUNDS, small);
assert(clamped.width === 1366 && clamped.height === 768, 'clamp laptop 1366×768');
assert(clamped.minWidth <= clamped.width, 'minWidth ≤ width');
const big = { x: 10, y: 20, width: 2560, height: 1440 };
const full = clampSizeToWorkArea(boundsForOrientation('landscape'), big);
assert(full.width === 1920 && full.height === 1080, '1080p sur grand écran');
const centered = centerInWorkArea(full, big);
assert(centered.x === 10 + Math.round((2560 - 1920) / 2), 'centrage X');
assert(centered.y === 20 + Math.round((1440 - 1080) / 2), 'centrage Y');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nsetup-focus + bounds clamp OK');
