/**
 * Focus fiche livre — blocs scrollables + CTA footer (style Import).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOK_FOCUS,
  clampBookFocus,
  isBookActionFocus,
} from '../src/shared/book-focus.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

assert(BOOK_FOCUS.IDENTITY === 0, 'IDENTITY = 0');
assert(BOOK_FOCUS.META === 1, 'META = 1');
assert(BOOK_FOCUS.SYNOPSIS === 2, 'SYNOPSIS = 2');
assert(BOOK_FOCUS.READ === 3, 'READ = 3');
assert(BOOK_FOCUS.BACK === 4, 'BACK = 4');
assert(BOOK_FOCUS.OPTIONS === 5, 'OPTIONS = 5');
assert(BOOK_FOCUS.MAX === 5, 'MAX = 5');

assert(clampBookFocus(-1) === 0, 'clamp bas');
assert(clampBookFocus(99) === 5, 'clamp haut');
assert(clampBookFocus(2.9) === 2, 'clamp trunc');
assert(clampBookFocus(NaN) === BOOK_FOCUS.READ, 'clamp NaN → READ');

assert(!isBookActionFocus(BOOK_FOCUS.SYNOPSIS), 'synopsis = contenu');
assert(isBookActionFocus(BOOK_FOCUS.READ), 'lire = action');

const view = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
assert(view.includes('shell-scroll'), 'BookDetail shell-scroll au bord');
assert(view.includes('book-detail__foot'), 'footer fixe fiche');
assert(view.includes('book-detail__row--synopsis'), 'row synopsis focusable');
assert(view.includes('book-detail__row--meta'), 'row méta focusable');
assert(view.includes('scheduleScrollFocusedIntoView'), 'scroll focus manette');

const pad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
assert(pad.includes('clampBookFocus'), 'useGamepad clamp book focus');
assert(pad.includes("route === 'book'"), 'handler route book');
assert(pad.includes('book-detail__action'), 'confirm cible actions fiche');
// Ne pas casser le chemin reader (scope tick)
const tickBody = pad.slice(pad.indexOf('function tick()'));
assert(
  /const\s*\{\s*ui\s*,\s*reader\s*\}\s*=\s*handlers/.test(tickBody) ||
    /const\s*\{\s*reader\s*,\s*ui\s*\}\s*=\s*handlers/.test(tickBody),
  'tick() destructure { ui, reader } depuis handlers',
);
assert(
  tickBody.includes('try {') && tickBody.includes('catch'),
  'tick() try/catch pour préserver la boucle rAF',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nbook-focus OK');
