/**
 * Hiérarchie routes + B = parent (plus de ?from=import).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTE,
  ROUTE_PARENT,
  bookDetailLocation,
  bookMetaLocation,
  bookRouteContext,
  importItemLocation,
  itemKeyFromPath,
  pathFromItemKey,
  resolveParentLocation,
  uiContextForRoute,
  isImportUiRoute,
  isMetaSearchRoute,
} from '../src/shared/app-routes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); failed += 1; }
  else console.log('OK  ', msg);
}

assert(ROUTE.LIBRARY_BOOK === 'library-book', 'library-book name');
assert(ROUTE.IMPORT_BOOK_META === 'import-book-meta', 'import-book-meta');
assert(ROUTE_PARENT[ROUTE.LIBRARY_BOOK] === ROUTE.LIBRARY, 'B fiche biblio → library');
assert(ROUTE_PARENT[ROUTE.LIBRARY_BOOK_META] === ROUTE.LIBRARY_BOOK, 'B méta biblio → fiche');
assert(ROUTE_PARENT[ROUTE.IMPORT_BOOK] === ROUTE.IMPORT, 'B fiche import → import');
assert(ROUTE_PARENT[ROUTE.IMPORT_ITEM_META] === ROUTE.IMPORT_ITEM, 'B méta item → sheet');

assert(resolveParentLocation({ name: ROUTE.LIBRARY_BOOK, params: { id: '7' } })?.name === ROUTE.LIBRARY, 'parent library-book');
assert(resolveParentLocation({ name: ROUTE.LIBRARY_BOOK_META, params: { id: '7' } })?.params?.id === '7', 'parent meta conserve id');
assert(resolveParentLocation({ name: ROUTE.IMPORT_ITEM_META, params: { itemKey: 'a%2Fb.cbz' } })?.name === ROUTE.IMPORT_ITEM, 'parent import-item-meta');

const afterMeta = resolveParentLocation({ name: ROUTE.LIBRARY_BOOK_META, params: { id: '3' } });
assert(afterMeta?.name === ROUTE.LIBRARY_BOOK, 'méta biblio B → fiche');
const afterBook = resolveParentLocation(afterMeta);
assert(afterBook?.name === ROUTE.LIBRARY, 'fiche biblio B → library');
assert(afterBook?.name !== ROUTE.IMPORT, 'jamais import depuis fiche biblio');

/** Chaînes B parent complètes (import + biblio). */
function assertParentChain(start, expectedNames, label) {
  let cur = start;
  for (let i = 0; i < expectedNames.length; i += 1) {
    cur = resolveParentLocation(cur);
    assert(cur?.name === expectedNames[i], `${label}[${i}] → ${expectedNames[i]} (got ${cur?.name})`);
  }
  assert(resolveParentLocation(cur) == null, `${label} fin de chaîne`);
}

assertParentChain(
  { name: ROUTE.IMPORT_ITEM_META, params: { itemKey: 'x.cbz' } },
  [ROUTE.IMPORT_ITEM, ROUTE.IMPORT],
  'B import-item-meta',
);
assertParentChain(
  { name: ROUTE.IMPORT_BOOK_META, params: { id: '42' } },
  [ROUTE.IMPORT_BOOK, ROUTE.IMPORT],
  'B import-book-meta',
);
assertParentChain(
  { name: ROUTE.LIBRARY_BOOK_META, params: { id: '9' } },
  [ROUTE.LIBRARY_BOOK, ROUTE.LIBRARY],
  'B library-book-meta',
);
assert(
  resolveParentLocation({ name: ROUTE.IMPORT_BOOK_META, params: { id: '5' } })?.params?.id === '5',
  'B import-book-meta conserve id',
);
assert(
  resolveParentLocation({ name: ROUTE.IMPORT }) == null,
  'liste import : pas de parent route (B → library via handler)',
);

assert(uiContextForRoute(ROUTE.LIBRARY_BOOK) === 'book', 'ctx library-book');
assert(uiContextForRoute(ROUTE.IMPORT_BOOK) === 'book', 'ctx import-book');
assert(uiContextForRoute(ROUTE.LIBRARY_BOOK_META) === 'import', 'ctx meta');
assert(isImportUiRoute(ROUTE.IMPORT_ITEM_META), 'import ui meta');
assert(isMetaSearchRoute(ROUTE.LIBRARY_BOOK_META), 'meta search route');
assert(bookRouteContext(ROUTE.IMPORT_BOOK) === 'import', 'book ctx import');
assert(bookRouteContext(ROUTE.LIBRARY_BOOK) === 'library', 'book ctx library');
assert(bookDetailLocation(9, 'library').name === ROUTE.LIBRARY_BOOK, 'bookDetail library');
assert(bookDetailLocation(9, 'import').name === ROUTE.IMPORT_BOOK, 'bookDetail import');
assert(bookMetaLocation(9, 'library').name === ROUTE.LIBRARY_BOOK_META, 'bookMeta library');
const key = itemKeyFromPath('/data/foo bar.cbz');
assert(pathFromItemKey(key) === '/data/foo bar.cbz', 'itemKey roundtrip');
assert(importItemLocation('/x.cbz', { meta: true }).name === ROUTE.IMPORT_ITEM_META, 'import item meta loc');

const router = readFileSync(join(root, 'src/renderer/src/router/index.js'), 'utf8');
assert(router.includes("path: '/library/book/:id'"), 'router library book');
assert(router.includes("path: '/library/book/:id/meta'"), 'router library meta');
assert(router.includes("path: '/import/item/:itemKey'"), 'router import item');
assert(router.includes("path: '/import/book/:id'"), 'router import book');
assert(router.includes("path: '/import/book/:id/meta'"), 'router import book meta');
assert(router.includes("path: '/book/:id'"), 'redirect /book');

const bookView = readFileSync(join(root, 'src/renderer/src/views/BookDetailView.vue'), 'utf8');
assert(bookView.includes('resolveParentLocation'), 'BookDetail B parent');
assert(bookView.includes('bookMetaLocation'), 'BookDetail → meta route');
assert(!bookView.includes("from === 'import'"), 'plus query from=import');
assert(!bookView.includes('entryIntent'), 'plus entryIntent');

const importView = readFileSync(join(root, 'src/renderer/src/views/ImportView.vue'), 'utf8');
assert(importView.includes('syncFromRoute'), 'ImportView sync route');
assert(importView.includes('resolveParentLocation'), 'ImportView B parent');
assert(!importView.includes("from: 'import'"), 'ImportView sans from=import');
assert(!importView.includes('consumeEntryIntent'), 'plus consumeEntryIntent');

const gamepad = readFileSync(join(root, 'src/renderer/src/composables/useGamepad.js'), 'utf8');
assert(gamepad.includes('resolveParentLocation'), 'gamepad B parent');
assert(gamepad.includes('isImportUiRoute'), 'gamepad import ui routes');
assert(gamepad.includes('resolveImportTabAction'), 'gamepad LB/RB resolveImportTabAction');
assert(!gamepad.includes("from: 'import'"), 'gamepad sans from=import');
assert(!gamepad.includes("query?.from === 'import'"), 'gamepad sans query from');

if (failed) { console.error(`\n${failed} échec(s)`); process.exit(1); }
console.log('\napp-routes OK');
