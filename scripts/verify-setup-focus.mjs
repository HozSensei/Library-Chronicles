/**
 * Vérifie la grille de focus setup (←→ rangée, ↑↓ étapes/rangées).
 */
import {
  setupFocusRows,
  setupFocusables,
  moveSetupFocus,
  indexToRowCol,
  SETUP_FOLDER_IDS,
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

// Étape dossiers : library | import  puis next
const folders = setupFocusRows(1);
assert(folders.length === 2, 'dossiers : 2 rangées');
assert(folders[0].join(',') === 'library,import', 'rangée dossiers côte à côte');
assert(setupFocusables(1).join(',') === 'library,import,next', 'flat dossiers');

let idx = 0; // library
idx = moveSetupFocus(folders, idx, 'right');
assert(setupFocusables(1)[idx] === 'import', '←→ : library → import');
idx = moveSetupFocus(folders, idx, 'right');
assert(setupFocusables(1)[idx] === 'import', '←→ : pas d’activation hors rangée');
idx = moveSetupFocus(folders, idx, 'down');
assert(setupFocusables(1)[idx] === 'next', '↓ : import → next');
idx = moveSetupFocus(folders, idx, 'up');
assert(setupFocusables(1)[idx] === 'library' || setupFocusables(1)[idx] === 'import', '↑ retour rangée');

// Mode côte à côte + rangée accents
const prefs = setupFocusRows(2);
assert(prefs.length === 4, 'prefs : 4 rangées (mode, accents, langue, next)');
idx = 0;
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(2)[idx] === 'theme-light', 'thème → light');
idx = moveSetupFocus(prefs, idx, 'left');
assert(setupFocusables(2)[idx] === 'theme-dark', 'thème ← dark');
idx = moveSetupFocus(prefs, idx, 'down');
assert(String(setupFocusables(2)[idx]).startsWith('accent-'), '↓ → rangée accents');
idx = moveSetupFocus(prefs, idx, 'right');
assert(String(setupFocusables(2)[idx]).startsWith('accent-'), '←→ dans accents');

assert(SETUP_FOLDER_IDS.has('library') && SETUP_FOLDER_IDS.has('import'), 'ids dossier connus');

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
