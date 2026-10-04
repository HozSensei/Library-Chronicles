/**
 * Focus fiche livre — champs méta éditables + CTA footer (Lire | Importer des méta).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOK_FOCUS,
  clampBookFocus,
  isBookActionFocus,
  isBookEditableFocus,
  resolveBookConfirmAction,
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
assert(BOOK_FOCUS.META === 10, 'META = 10');
assert(BOOK_FOCUS.MAX === 10, 'MAX = 10');
assert(BOOK_FOCUS.BACK === undefined, 'pas de BACK footer (B manette)');
assert(BOOK_FOCUS.OPTIONS === undefined, 'OPTIONS renommé META');

assert(clampBookFocus(-1) === 0, 'clamp bas');
assert(clampBookFocus(99) === 10, 'clamp haut');
assert(clampBookFocus(2.9) === 2, 'clamp trunc');
assert(clampBookFocus(NaN) === BOOK_FOCUS.READ, 'clamp NaN → READ');

assert(!isBookActionFocus(BOOK_FOCUS.SYNOPSIS), 'synopsis = contenu');
assert(!isBookActionFocus(BOOK_FOCUS.TITLE), 'titre = contenu');
assert(isBookActionFocus(BOOK_FOCUS.READ), 'lire = action');
assert(isBookActionFocus(BOOK_FOCUS.META), 'méta = action');
assert(isBookEditableFocus(BOOK_FOCUS.TITLE), 'titre éditable');
assert(isBookEditableFocus(BOOK_FOCUS.SYNOPSIS), 'synopsis éditable');
assert(!isBookEditableFocus(BOOK_FOCUS.STATUS), 'statut non éditable');
assert(
  resolveBookConfirmAction(BOOK_FOCUS.TITLE) === 'edit-field',
  'A titre → edit-field',
);
assert(
  resolveBookConfirmAction(BOOK_FOCUS.READ) === 'activate-action',
  'A lire → activate-action',
);
assert(
  resolveBookConfirmAction(BOOK_FOCUS.META) === 'activate-action',
  'A méta → activate-action',
);

const view = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
assert(view.includes('shell-scroll'), 'BookDetail shell-scroll au bord');
assert(view.includes('book-detail__foot'), 'footer fixe fiche');
assert(view.includes('book-detail__fields'), 'panneau champs méta');
assert(view.includes('book-detail__field'), 'champs focusables');
assert(view.includes('book-detail__cover'), 'couverture');
assert(view.includes('v-model="draft.title"'), 'titre éditable v-model');
assert(view.includes('saveDraft'), 'persist méta saveDraft');
assert(view.includes('readonly'), 'champs dérivés readonly (statut/pages)');
assert(view.includes('book-detail__textarea'), 'synopsis textarea');
assert(!view.includes('book-detail__row'), 'pas de rows style liste import');
assert(view.includes('scheduleScrollFocusedIntoView'), 'scroll focus manette');
assert(view.includes('book-detail__hero'), 'hero grid cover + méta');
assert(view.includes('book-detail__cover-frame'), 'cadre cover portrait');
assert(
  /book-detail__cover-frame[\s\S]*?position:\s*relative/.test(view),
  'cover-frame position:relative (ancre LazyCover absolute)',
);
assert(view.includes('isolation: isolate'), 'isolation stacking fiche');
assert(view.includes('book-detail__rail'), 'rail série sous le contenu');
assert(view.includes('book-detail__thumb-art'), 'miniatures rail contenues');
assert(
  /book-detail__thumb-art[\s\S]*?position:\s*relative/.test(view),
  'thumb-art position:relative (pas d’overlap méta)',
);
assert(view.includes('book-detail__meta'), 'méta labels + valeurs');
assert(view.includes('grid-template-columns'), 'layout grid (pas absolute croisé)');
assert(view.includes('Importer des méta'), 'CTA Importer des méta');
assert(view.includes('goImportMeta'), 'handler recherche API');
assert(view.includes('bookMetaLocation'), 'goImportMeta → route …/meta');
assert(view.includes('resolveParentLocation'), 'B = route parent');
assert(!view.includes('entryIntent'), 'plus entryIntent');
assert(!view.includes("from === 'import'"), 'plus query from=import');
assert(
  !view.includes('action-label">Retour</span>'),
  'pas de bouton Retour redondant (B suffit)',
);
assert(
  !view.includes('BOOK_FOCUS.BACK'),
  'plus de focus BACK footer',
);
assert(
  view.includes('background: var(--surface)') &&
    view.includes('border: 1px solid var(--border)'),
  'champs style formulaire (surface + bordure)',
);

const pad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
assert(pad.includes('clampBookFocus'), 'useGamepad clamp book focus');
assert(
  pad.includes('LIBRARY_BOOK') || pad.includes("route === 'book'"),
  'handler route book / library-book',
);
assert(pad.includes('resolveBookConfirmAction'), 'confirm resolve book');
assert(pad.includes('focusTextInputForEdit'), 'confirm édite champ méta');
assert(pad.includes('data-book-action'), 'confirm cible actions fiche');
assert(
  pad.includes('resolveParentLocation'),
  'B fiche = route parent (import-book → import)',
);
assert(!pad.includes("query?.from === 'import'"), 'plus query from=import');
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
