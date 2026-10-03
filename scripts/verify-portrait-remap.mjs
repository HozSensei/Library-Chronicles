/**
 * Vérification remap portrait + bindings + parse filename.
 */
import {
  DeviceOrientation,
  remapDpad,
  remapStick,
  readingActionForLogicalDpad,
} from '../src/shared/portrait-remap.js';
import {
  resolveKeyBindings,
  actionForBinding,
  DEFAULT_KEY_BINDINGS,
} from '../src/shared/key-bindings.js';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import { naturalCompare, detectChapters } from '../src/main/extractors/cbz.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

const o = DeviceOrientation.PORTRAIT_CCW;

assert(remapDpad(o, 'up') === 'left', 'physique ↑ → logique ←');
assert(remapDpad(o, 'down') === 'right', 'physique ↓ → logique →');
assert(remapDpad(o, 'left') === 'up', 'physique ← → logique ↑');
assert(remapDpad(o, 'right') === 'down', 'physique → → logique ↓');
assert(remapDpad(DeviceOrientation.LANDSCAPE, 'up') === 'up', 'landscape inchangé');
assert(remapDpad(DeviceOrientation.LANDSCAPE, 'left') === 'left', 'landscape ← inchangé');

const stickUp = remapStick(o, 0, -1);
assert(stickUp.x === -1 && stickUp.y === 0, 'stick physique ↑ → logique ←');
const stickLeft = remapStick(o, -1, 0);
assert(stickLeft.x === 0 && stickLeft.y === -1, 'stick physique ← → logique ↑');

const landStick = remapStick(DeviceOrientation.LANDSCAPE, 0.5, -0.7);
assert(
  landStick.x === 0.5 && landStick.y === -0.7,
  'landscape stick : physique = logique',
);

assert(readingActionForLogicalDpad('left') === 'page-prev', '← écran = page prev');
assert(readingActionForLogicalDpad('right') === 'page-next', '→ écran = page next');
assert(readingActionForLogicalDpad('up') === 'zoom-in', '↑ écran = zoom in');
assert(readingActionForLogicalDpad('down') === 'zoom-out', '↓ écran = zoom out');

const bindings = resolveKeyBindings(null);
assert(
  actionForBinding(bindings, 'reader', 'dpad:left') === 'page-prev',
  'binding défaut page-prev',
);
assert(
  actionForBinding(bindings, 'reader', 'button:0') === 'toggle-direction',
  'binding défaut A = sens',
);

const custom = resolveKeyBindings({
  reader: { 'button:0': 'close-book' },
});
assert(
  actionForBinding(custom, 'reader', 'button:0') === 'close-book',
  'override utilisateur A',
);
assert(
  actionForBinding(custom, 'reader', 'dpad:up') === DEFAULT_KEY_BINDINGS.reader['dpad:up'],
  'override partiel conserve dpad',
);

const meta = detectFromFilename('/books/One Piece - Tome 03 (2019).cbz');
assert(meta.series === 'One Piece', `series détectée (${meta.series})`);
assert(meta.volume === 3, `volume détecté (${meta.volume})`);
assert(meta.year === 2019, `année détectée (${meta.year})`);
assert(meta.title.includes('One Piece'), `titre enrichi (${meta.title})`);

const names = ['ch2/page10.jpg', 'ch1/page2.jpg', 'ch1/page10.jpg', 'ch2/page2.jpg'];
const sorted = [...names].sort(naturalCompare);
assert(sorted[0] === 'ch1/page2.jpg', `tri naturel (${sorted[0]})`);
const chapters = detectChapters(sorted);
assert(chapters.length === 2, `chapitres détectés (${chapters.length})`);

if (failed) {
  console.error(`\n${failed} assertion(s) en échec`);
  process.exit(1);
}
console.log('\nTests remap / bindings / metadata OK');
