/**
 * Vérifie les tailles fenêtre + stratégie B (landscape fixe + CSS rotate lecteur).
 */
import {
  PORTRAIT_BOUNDS,
  LANDSCAPE_BOUNDS,
  boundsForOrientation,
  clampSizeToWorkArea,
  centerInWorkArea,
  needsCssPortraitRotate,
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

assert(PORTRAIT_BOUNDS.width === 1080 && PORTRAIT_BOUNDS.height === 1920, 'portrait 1080×1920 (réf.)');
assert(LANDSCAPE_BOUNDS.width === 1920 && LANDSCAPE_BOUNDS.height === 1080, 'landscape 1920×1080');
// Stratégie B : bounds fenêtre toujours landscape
assert(boundsForOrientation('landscape') === LANDSCAPE_BOUNDS, 'bounds landscape');
assert(boundsForOrientation('portrait-ccw') === LANDSCAPE_BOUNDS, 'bounds portrait-ccw → landscape (B)');
assert(boundsForOrientation(undefined) === LANDSCAPE_BOUNDS, 'bounds défaut landscape');
assert(boundsForOrientation(null) === LANDSCAPE_BOUNDS, 'bounds null → landscape');
assert(LANDSCAPE_BOUNDS.minWidth >= 960, 'min landscape largeur');
assert(PORTRAIT_BOUNDS.minHeight >= 960, 'min portrait hauteur');

const laptop = clampSizeToWorkArea(LANDSCAPE_BOUNDS, { width: 1600, height: 900 });
assert(laptop.width === 1600 && laptop.height === 900, 'clamp ne dépasse pas workArea');
assert(laptop.minWidth <= 1600 && laptop.minHeight <= 900, 'mins clampées');

const desktop = clampSizeToWorkArea(LANDSCAPE_BOUNDS, { width: 3840, height: 2160 });
assert(desktop.width === 1920 && desktop.height === 1080, 'cible 1080p si écran plus grand');

const pos = centerInWorkArea(desktop, { x: 100, y: 50, width: 3840, height: 2160 });
assert(pos.x === 100 + (3840 - 1920) / 2, 'centre X dans workArea');
assert(pos.y === 50 + (2160 - 1080) / 2, 'centre Y dans workArea');

const ally = clampSizeToWorkArea(LANDSCAPE_BOUNDS, { width: 1920, height: 1080 });
assert(ally.width === 1920 && ally.height === 1080, 'Ally landscape : fenêtre pleine 1920×1080');

// CSS rotate actif dès que orientation logique = portrait-ccw (lecteur)
assert(
  needsCssPortraitRotate('portrait-ccw', { width: 1920, height: 1080 }) === true,
  'lecteur → cssRotate toujours',
);
assert(
  needsCssPortraitRotate('portrait-ccw', { width: 1080, height: 1920 }) === true,
  'lecteur → cssRotate même si taille portrait',
);
assert(
  needsCssPortraitRotate('landscape', { width: 1920, height: 1080 }) === false,
  'pas de CSS rotate en menus landscape',
);

// Ancien piège : setBounds portrait clampé → 1080×1080 (ne plus utiliser)
const oldTrap = clampSizeToWorkArea(PORTRAIT_BOUNDS, { width: 1920, height: 1080 });
assert(oldTrap.width === 1080 && oldTrap.height === 1080, 'preuve : portrait clampé = shrink');
assert(
  boundsForOrientation('portrait-ccw') !== PORTRAIT_BOUNDS,
  'stratégie B évite setBounds portrait',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nwindow-bounds OK');
