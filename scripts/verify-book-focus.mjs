/**
 * Focus fiche livre — champs méta readonly + CTA footer (style Import detail).
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

assert(BOOK_FOCUS.TITLE === 0, 'TITLE = 0');
assert(BOOK_FOCUS.SERIES === 1, 'SERIES = 1');
assert(BOOK_FOCUS.VOLUME === 2, 'VOLUME = 2');
assert(BOOK_FOCUS.YEAR === 3, 'YEAR = 3');
assert(BOOK_FOCUS.AUTHOR === 4, 'AUTHOR = 4');
assert(BOOK_FOCUS.STATUS === 5, 'STATUS = 5');
assert(BOOK_FOCUS.PAGES === 6, 'PAGES = 6');
assert(BOOK_FOCUS.PROVIDER === 7, 'PROVIDER = 7');
assert(BOOK_FOCUS.SYNOPSIS === 8, 'SYNOPSIS = 8');
assert(BOOK_FOCUS.READ === 9, 'READ = 9');
assert(BOOK_FOCUS.BACK === 10, 'BACK = 10');
assert(BOOK_FOCUS.OPTIONS === 11, 'OPTIONS = 11');
assert(BOOK_FOCUS.MAX === 11, 'MAX = 11');

assert(clampBookFocus(-1) === 0, 'clamp bas');
assert(clampBookFocus(99) === 11, 'clamp haut');
assert(clampBookFocus(2.9) === 2, 'clamp trunc');
assert(clampBookFocus(NaN) === BOOK_FOCUS.READ, 'clamp NaN → READ');

assert(!isBookActionFocus(BOOK_FOCUS.SYNOPSIS), 'synopsis = contenu');
assert(!isBookActionFocus(BOOK_FOCUS.TITLE), 'titre = contenu');
assert(isBookActionFocus(BOOK_FOCUS.READ), 'lire = action');

const view = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
assert(view.includes('shell-scroll'), 'BookDetail shell-scroll au bord');
assert(view.includes('book-detail__foot'), 'footer fixe fiche');
assert(view.includes('book-detail__fields'), 'panneau champs méta');
assert(view.includes('book-detail__field'), 'champs focusables');
assert(view.includes('book-detail__cover'), 'couverture');
assert(view.includes('readonly'), 'champs readonly (focusables)');
assert(view.includes('book-detail__textarea'), 'synopsis textarea');
assert(!view.includes('book-detail__row'), 'pas de rows style liste import');
assert(view.includes('scheduleScrollFocusedIntoView'), 'scroll focus manette');

const pad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
assert(pad.includes('clampBookFocus'), 'useGamepad clamp book focus');
assert(pad.includes("route === 'book'"), 'handler route book');
assert(pad.includes('book-detail__action'), 'confirm cible actions fiche');
assert(pad.includes('book-detail__field'), 'confirm sur champ méta');
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
