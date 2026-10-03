/**
 * Vérifie les tailles fenêtre portrait / landscape.
 */
import {
  PORTRAIT_BOUNDS,
  LANDSCAPE_BOUNDS,
  boundsForOrientation,
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

assert(PORTRAIT_BOUNDS.width === 1080 && PORTRAIT_BOUNDS.height === 1920, 'portrait 1080×1920');
assert(LANDSCAPE_BOUNDS.width === 1920 && LANDSCAPE_BOUNDS.height === 1080, 'landscape 1920×1080');
assert(boundsForOrientation('landscape') === LANDSCAPE_BOUNDS, 'bounds landscape');
assert(boundsForOrientation('portrait-ccw') === PORTRAIT_BOUNDS, 'bounds portrait-ccw');
assert(boundsForOrientation(undefined) === PORTRAIT_BOUNDS, 'bounds défaut portrait');
assert(LANDSCAPE_BOUNDS.minWidth >= 960, 'min landscape largeur');
assert(PORTRAIT_BOUNDS.minHeight >= 960, 'min portrait hauteur');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nwindow-bounds OK');
