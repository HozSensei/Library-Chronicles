/**
 * Garde-fous navigation Import méta-search :
 * BookDetail « Importer des méta » → flow meta-search (pas dump liste),
 * B retour fiche, entryIntent, X toggle retirer.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_FLOW,
  META_RETURN,
  flowFromViewState,
  normalizeEntryIntent,
  normalizeImportFlow,
  normalizeMetaReturn,
  resolveImportFlowBack,
  viewStateFromFlow,
} from '../src/shared/import-flow.js';
import { resolveImportBackAction } from '../src/shared/import-focus.js';

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

assert(IMPORT_FLOW.LIST === 'list', 'flow list');
assert(IMPORT_FLOW.SHEET === 'sheet', 'flow sheet');
assert(IMPORT_FLOW.META_SEARCH === 'meta-search', 'flow meta-search');
assert(META_RETURN.BOOK === 'book', 'metaReturn book');
assert(normalizeImportFlow('meta-search') === 'meta-search', 'normalize meta');
assert(normalizeImportFlow('nope') === 'list', 'normalize fallback list');
assert(normalizeMetaReturn('book') === 'book', 'normalize return book');
assert(normalizeEntryIntent('meta-search') === 'meta-search', 'entry intent');
assert(normalizeEntryIntent(null) === null, 'entry intent null');
assert(
  flowFromViewState({ viewMode: 'detail', detailTab: 'search' }) ===
    'meta-search',
  'derive meta-search',
);
assert(
  flowFromViewState({ viewMode: 'detail', detailTab: 'infos' }) === 'sheet',
  'derive sheet',
);
assert(
  flowFromViewState({ viewMode: 'list' }) === 'list',
  'derive list',
);
assert(
  viewStateFromFlow('meta-search').detailTab === 'search',
  'viewState search',
);
assert(viewStateFromFlow('sheet').viewMode === 'detail', 'viewState sheet');

assert(
  resolveImportFlowBack({ flow: 'meta-search', metaReturn: 'sheet' }) ===
    'to-sheet',
  'B meta-search → sheet',
);
assert(
  resolveImportFlowBack({ flow: 'meta-search', metaReturn: 'book' }) ===
    'to-book',
  'B meta-search → book',
);
assert(
  resolveImportFlowBack({ flow: 'sheet', metaReturn: 'list' }) === 'to-list',
  'B sheet → list',
);
assert(
  resolveImportFlowBack({ flow: 'sheet', metaReturn: 'book' }) === 'to-book',
  'B sheet (depuis book) → book',
);
assert(
  resolveImportFlowBack({ flow: 'list' }) === 'library',
  'B list → library',
);

// Alias rétrocompat import-focus
assert(
  resolveImportBackAction({
    isDetail: true,
    detailTab: 'search',
  }) === 'to-infos',
  'alias to-infos (= to-sheet)',
);
assert(
  resolveImportBackAction({
    flow: 'meta-search',
    metaReturn: 'book',
  }) === 'to-book',
  'resolveImportBackAction to-book',
);

const view = readFileSync(
  join(root, 'src/renderer/src/views/ImportView.vue'),
  'utf8',
);
const bookView = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
const store = readFileSync(
  join(root, 'src/renderer/src/stores/import.js'),
  'utf8',
);
const libStore = readFileSync(
  join(root, 'src/renderer/src/stores/library.js'),
  'utf8',
);
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const preload = readFileSync(join(root, 'src/preload/index.js'), 'utf8');
const ipc = readFileSync(join(root, 'src/main/ipc/library.js'), 'utf8');
const channels = readFileSync(
  join(root, 'src/shared/ipc-channels.js'),
  'utf8',
);

assert(store.includes('openMetaSearch'), 'store openMetaSearch');
assert(store.includes('entryIntent'), 'store entryIntent');
assert(store.includes('consumeEntryIntent'), 'store consumeEntryIntent');
assert(store.includes('metaReturn'), 'store metaReturn');
assert(store.includes('setFlow'), 'store setFlow');
assert(store.includes('goToList'), 'store goToList');
assert(store.includes('goToSheet'), 'store goToSheet');
assert(store.includes('toggleImportOrRemoveSelected'), 'store toggle X');
assert(store.includes('removeSelectedFromLibrary'), 'store remove');
assert(
  store.includes("Retiré de la bibliothèque"),
  'toast retrait bibliothèque',
);

assert(view.includes('consumeEntryIntent'), 'ImportView consomme entryIntent');
assert(
  !/onMounted\([\s\S]*?imp\.closeDetail\(\)/.test(view),
  'ImportView onMounted ne closeDetail plus aveuglément',
);
assert(
  view.includes('ne closeDetail() systématiquement') ||
    view.includes('resumeFlow'),
  'doc / garde anti-régression closeDetail',
);
assert(view.includes('resumeFlow'), 'ImportView reprend flow');
assert(view.includes('Retirer de la bibliothèque'), 'hint X retirer');
assert(view.includes('openMetaSearch'), 'ImportView openMetaSearch');
assert(view.includes('import__import-all'), 'bouton header Tout importer');
assert(view.includes('doImportAll'), 'handler doImportAll');
assert(
  !view.includes("key: 'Y', label: 'Tout importer'"),
  'plus hint Y Tout importer sur liste',
);

assert(bookView.includes('openMetaSearch'), 'BookDetail → openMetaSearch');
assert(bookView.includes('META_RETURN.BOOK'), 'BookDetail metaReturn book');
assert(bookView.includes('entryIntent: true'), 'BookDetail pose entryIntent');
assert(
  !bookView.includes('setDetailTab(IMPORT_DETAIL_TABS.SEARCH)'),
  'plus de setDetailTab SEARCH puis push (course onMounted)',
);

assert(gamepad.includes('to-book'), 'gamepad B → book');
assert(gamepad.includes('toggleImportOrRemoveSelected'), 'gamepad X toggle');
assert(gamepad.includes('openMetaSearch'), 'gamepad Y/LB → openMetaSearch');
assert(gamepad.includes('IMPORT_FLOW'), 'gamepad machine flow');
assert(
  gamepad.includes('libre sur liste'),
  'Y n’importe plus tout depuis la liste',
);
assert(
  gamepad.includes('importApplyResultPending') ||
    (gamepad.includes('META_SEARCH') &&
      gamepad.includes("importFocusZone === 'results'")),
  'A sur résultats ignore blocage focus texte',
);
assert(
  store.includes('metadataPatchFromEnrichResult'),
  'apply méta via patch série API',
);
assert(
  store.includes('return true') && store.includes('applyEnrichResult'),
  'applyEnrichResult retourne booléen',
);

assert(channels.includes('LIBRARY_DELETE_BOOK'), 'IPC channel delete');
assert(ipc.includes('LIBRARY_DELETE_BOOK'), 'IPC handler delete');
assert(ipc.includes('deleteBook'), 'IPC deleteBook DB');
assert(preload.includes('deleteBook'), 'preload deleteBook');
assert(libStore.includes('async removeBook'), 'library.removeBook');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-meta-search OK');
