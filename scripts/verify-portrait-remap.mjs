/**
 * Vérification rapide du remap portrait (sans framework de test).
 * Usage : node scripts/verify-portrait-remap.mjs
 */
import {
  DeviceOrientation,
  remapDpad,
  remapStick,
  readingActionForLogicalDpad,
} from '../src/shared/portrait-remap.js';

const o = DeviceOrientation.PORTRAIT_CCW;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

assert(remapDpad(o, 'up') === 'left', 'physique ↑ → logique ←');
assert(remapDpad(o, 'down') === 'right', 'physique ↓ → logique →');
assert(remapDpad(o, 'left') === 'up', 'physique ← → logique ↑');
assert(remapDpad(o, 'right') === 'down', 'physique → → logique ↓');

assert(remapDpad(DeviceOrientation.LANDSCAPE, 'up') === 'up', 'landscape inchangé');

const stickUp = remapStick(o, 0, -1);
assert(stickUp.x === -1 && stickUp.y === 0, 'stick physique ↑ → logique ←');

const stickLeft = remapStick(o, -1, 0);
assert(stickLeft.x === 0 && stickLeft.y === -1, 'stick physique ← → logique ↑');

assert(readingActionForLogicalDpad('left') === 'page-prev', '← écran = page prev');
assert(readingActionForLogicalDpad('right') === 'page-next', '→ écran = page next');
assert(readingActionForLogicalDpad('up') === 'zoom-in', '↑ écran = zoom in');
assert(readingActionForLogicalDpad('down') === 'zoom-out', '↓ écran = zoom out');

if (failed) {
  console.error(`\n${failed} assertion(s) en échec`);
  process.exit(1);
}
console.log('\nRemap portrait OK');
